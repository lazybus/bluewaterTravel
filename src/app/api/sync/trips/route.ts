import { NextResponse, type NextRequest } from "next/server";
import type { TripSyncRequest, TripSyncResponse } from "@/lib/sync/contracts";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getAuthenticatedActor } from "@/lib/supabase/auth";

function isTripSyncRequest(value: unknown): value is TripSyncRequest {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<TripSyncRequest>;

  return (
    typeof candidate.tripId === "string" &&
    typeof candidate.deviceId === "string" &&
    typeof candidate.baseTripVersion === "number" &&
    Array.isArray(candidate.mutations)
  );
}

export async function GET(request: NextRequest) {
  const actor = await getAuthenticatedActor();

  if (!actor) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const tripId = request.nextUrl.searchParams.get("tripId");

  if (!tripId) {
    return NextResponse.json({ error: "tripId query parameter is required." }, { status: 400 });
  }

  const adminClient = createSupabaseAdminClient();
  const [{ data: trip, error: tripError }, { data: mutations, error: mutationError }] = await Promise.all([
    adminClient
      .from("trips")
      .select("id, trip_version")
      .eq("id", tripId)
      .eq("user_id", actor.userId)
      .maybeSingle(),
    adminClient
      .from("trip_mutations")
      .select("id, client_mutation_id, operation, entity_type, entity_id, applied_trip_version, created_at")
      .eq("trip_id", tripId)
      .eq("user_id", actor.userId)
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  if (tripError || mutationError) {
    return NextResponse.json({ error: tripError?.message ?? mutationError?.message }, { status: 500 });
  }

  if (!trip) {
    return NextResponse.json({ error: "Trip not found." }, { status: 404 });
  }

  return NextResponse.json({
    tripId,
    tripVersion: trip.trip_version,
    mutations: mutations ?? [],
  });
}

export async function POST(request: NextRequest) {
  const actor = await getAuthenticatedActor();

  if (!actor) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const body: unknown = await request.json();

  if (!isTripSyncRequest(body)) {
    return NextResponse.json(
      { error: "Invalid trip sync payload." },
      { status: 400 },
    );
  }

  const adminClient = createSupabaseAdminClient();
  const { data: trip, error: tripError } = await adminClient
    .from("trips")
    .select("id, trip_version")
    .eq("id", body.tripId)
    .eq("user_id", actor.userId)
    .maybeSingle();

  if (tripError) {
    return NextResponse.json({ error: tripError.message }, { status: 500 });
  }

  if (!trip) {
    return NextResponse.json({ error: "Trip not found." }, { status: 404 });
  }

  if (trip.trip_version !== body.baseTripVersion) {
    return NextResponse.json(
      {
        tripId: body.tripId,
        nextTripVersion: trip.trip_version,
        acceptedMutationIds: [],
        conflicts: [
          {
            entityId: body.tripId,
            fields: ["trip_version"],
            reason: `Trip version mismatch. Expected ${body.baseTripVersion} but server has ${trip.trip_version}.`,
          },
        ],
        appliedAt: new Date().toISOString(),
      } satisfies TripSyncResponse,
      { status: 409 },
    );
  }

  const platform = request.headers.get("sec-ch-ua-platform") ?? "web";
  const deviceLabel = request.headers.get("user-agent")?.slice(0, 120) ?? "Web PWA";

  const { error: deviceError } = await adminClient.from("user_devices").upsert(
    {
      id: body.deviceId,
      user_id: actor.userId,
      device_label: deviceLabel,
      platform,
      app_version: request.headers.get("x-app-version") ?? null,
      last_seen_at: new Date().toISOString(),
    },
    { onConflict: "id" },
  );

  if (deviceError) {
    return NextResponse.json({ error: deviceError.message }, { status: 500 });
  }

  const nextTripVersion = trip.trip_version + body.mutations.length;
  const mutationRows = body.mutations.map((mutation, index) => ({
    trip_id: body.tripId,
    user_id: actor.userId,
    device_id: body.deviceId,
    client_mutation_id: mutation.clientMutationId,
    base_trip_version: body.baseTripVersion,
    entity_type: mutation.entityType,
    entity_id: mutation.entityId,
    operation: mutation.operation,
    payload: mutation.payload,
    applied_trip_version: trip.trip_version + index + 1,
  }));

  const { error: insertError } = await adminClient.from("trip_mutations").insert(mutationRows);

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  const { error: tripUpdateError } = await adminClient
    .from("trips")
    .update({
      trip_version: nextTripVersion,
      updated_at: new Date().toISOString(),
    })
    .eq("id", body.tripId)
    .eq("user_id", actor.userId);

  if (tripUpdateError) {
    return NextResponse.json({ error: tripUpdateError.message }, { status: 500 });
  }

  const response: TripSyncResponse = {
    tripId: body.tripId,
    nextTripVersion,
    acceptedMutationIds: body.mutations.map((mutation) => mutation.clientMutationId),
    conflicts: [],
    appliedAt: new Date().toISOString(),
  };

  return NextResponse.json(response, { status: 202 });
}