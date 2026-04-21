import { NextResponse } from "next/server";
import { buildPointValue, mapPoiEditorRecord, toNullableFloat, toNullableInteger } from "@/lib/admin/poi-api";
import type { PoiEditorRecord } from "@/lib/admin/poi-records";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requireCuratorActor } from "@/lib/supabase/auth";

function isPoiEditorRecord(value: unknown): value is PoiEditorRecord {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<PoiEditorRecord>;

  return (
    typeof candidate.slug === "string" &&
    typeof candidate.name === "string" &&
    typeof candidate.poiKind === "string" &&
    Array.isArray(candidate.hours) &&
    Array.isArray(candidate.warnings) &&
    typeof candidate.activityProfile === "object"
  );
}

export async function GET(_request: Request, ctx: RouteContext<"/api/admin/pois/[poiId]">) {
  const access = await requireCuratorActor();

  if (!access.actor) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const { poiId } = await ctx.params;
  const adminClient = createSupabaseAdminClient();

  const [{ data: poi, error: poiError }, { data: hours, error: hoursError }, { data: warnings, error: warningsError }, { data: activityProfile, error: activityError }] = await Promise.all([
    adminClient.from("poi_admin_view").select("*").eq("id", poiId).maybeSingle(),
    adminClient.from("poi_hours").select("*").eq("poi_id", poiId).order("day_of_week", { ascending: true }),
    adminClient.from("poi_warnings").select("*").eq("poi_id", poiId).order("created_at", { ascending: true }),
    adminClient.from("activity_profiles").select("*").eq("poi_id", poiId).maybeSingle(),
  ]);

  const firstError = poiError ?? hoursError ?? warningsError ?? activityError;
  if (firstError) {
    return NextResponse.json({ error: firstError.message }, { status: 500 });
  }

  if (!poi) {
    return NextResponse.json({ error: "POI not found." }, { status: 404 });
  }

  return NextResponse.json({
    poi: mapPoiEditorRecord({
      poi,
      hours: hours ?? [],
      warnings: warnings ?? [],
      activityProfile,
    }),
  });
}

export async function PUT(request: Request, ctx: RouteContext<"/api/admin/pois/[poiId]">) {
  const access = await requireCuratorActor();

  if (!access.actor) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const body: unknown = await request.json();

  if (!isPoiEditorRecord(body)) {
    return NextResponse.json({ error: "Invalid POI payload." }, { status: 400 });
  }

  const { poiId } = await ctx.params;
  const adminClient = createSupabaseAdminClient();

  const { error: poiError } = await adminClient
    .from("pois")
    .update({
      slug: body.slug,
      name: body.name,
      summary: body.summary || null,
      description: body.description || null,
      poi_kind: body.poiKind,
      geom: buildPointValue(body.latitude, body.longitude),
      address: body.address || null,
      municipality: body.municipality || null,
      phone: body.phone || null,
      website: body.website || null,
      booking_url: body.bookingUrl || null,
      is_published: body.isPublished,
      source: body.source || "curated",
      updated_by: access.actor.userId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", poiId);

  if (poiError) {
    return NextResponse.json({ error: poiError.message }, { status: 500 });
  }

  const childDeletes = await Promise.all([
    adminClient.from("poi_hours").delete().eq("poi_id", poiId),
    adminClient.from("poi_warnings").delete().eq("poi_id", poiId),
  ]);

  const deleteError = childDeletes.find((result) => result.error)?.error;
  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 });
  }

  if (body.hours.length > 0) {
    const { error } = await adminClient.from("poi_hours").insert(
      body.hours.map((hour) => ({
        poi_id: poiId,
        season_label: hour.seasonLabel,
        valid_from: hour.validFrom || null,
        valid_to: hour.validTo || null,
        day_of_week: hour.dayOfWeek,
        opens_at: hour.opensAt || null,
        closes_at: hour.closesAt || null,
        early_close_warning_minutes: toNullableInteger(hour.earlyCloseWarningMinutes),
        closed: hour.closed,
        notes: hour.notes || null,
      })),
    );

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  const validWarnings = body.warnings.filter((warning) => warning.title.trim() && warning.message.trim());

  if (validWarnings.length > 0) {
    const { error } = await adminClient.from("poi_warnings").insert(
      validWarnings.map((warning) => ({
        poi_id: poiId,
        warning_type: warning.warningType,
        severity: warning.severity,
        title: warning.title,
        message: warning.message,
        action_url: warning.actionUrl || null,
        requires_acknowledgement: warning.requiresAcknowledgement,
        lead_time_hours: toNullableInteger(warning.leadTimeHours),
      })),
    );

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  const profile = body.activityProfile;

  if (profile.defaultDurationMinutes.trim()) {
    const { error } = await adminClient.from("activity_profiles").upsert({
      poi_id: poiId,
      default_duration_minutes: Number.parseInt(profile.defaultDurationMinutes, 10),
      min_duration_minutes: toNullableInteger(profile.minDurationMinutes),
      max_duration_minutes: toNullableInteger(profile.maxDurationMinutes),
      trail_difficulty: profile.trailDifficulty || null,
      distance_km: toNullableFloat(profile.distanceKm),
      elevation_gain_m: toNullableInteger(profile.elevationGainM),
      crowd_intensity: profile.crowdIntensity || null,
      weather_sensitivity: profile.weatherSensitivity || null,
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  } else {
    const { error } = await adminClient.from("activity_profiles").delete().eq("poi_id", poiId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(_request: Request, ctx: RouteContext<"/api/admin/pois/[poiId]">) {
  const access = await requireCuratorActor();

  if (!access.actor) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const { poiId } = await ctx.params;
  const adminClient = createSupabaseAdminClient();
  const { error } = await adminClient.from("pois").delete().eq("id", poiId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return new Response(null, { status: 204 });
}