import { NextResponse } from "next/server";
import {
  mapPoiSummary,
  buildPointValue,
  toNullableFloat,
  toNullableInteger,
  toTextArray,
} from "@/lib/admin/poi-api";
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
    Array.isArray(candidate.images) &&
    typeof candidate.activityProfile === "object"
  );
}

export async function GET() {
  const access = await requireCuratorActor();

  if (!access.actor) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const adminClient = createSupabaseAdminClient();
  const { data, error } = await adminClient
    .from("poi_admin_view")
    .select("id, slug, name, poi_kind, municipality, is_published, updated_at")
    .order("updated_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ pois: (data ?? []).map(mapPoiSummary) });
}

export async function POST(request: Request) {
  const access = await requireCuratorActor();

  if (!access.actor) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const body: unknown = await request.json();

  if (!isPoiEditorRecord(body)) {
    return NextResponse.json({ error: "Invalid POI payload." }, { status: 400 });
  }

  const adminClient = createSupabaseAdminClient();

  const { data: poi, error: poiError } = await adminClient
    .from("pois")
    .insert({
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
      created_by: access.actor.userId,
      updated_by: access.actor.userId,
    })
    .select("id")
    .single();

  if (poiError || !poi) {
    return NextResponse.json({ error: poiError?.message ?? "Unable to create POI." }, { status: 500 });
  }

  const poiId = poi.id;

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
  }

  if (body.poiKind === "food") {
    const { error } = await adminClient.from("food_profiles").upsert({
      poi_id: poiId,
      cuisine_types: toTextArray(body.foodProfile.cuisineTypes),
      dining_style: body.foodProfile.diningStyle || null,
      price_band: body.foodProfile.priceBand || null,
      menu_url: body.foodProfile.menuUrl || null,
      patio: body.foodProfile.patio,
      takeout_available: body.foodProfile.takeoutAvailable,
      reservation_recommended: body.foodProfile.reservationRecommended,
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  if (body.poiKind === "accommodation") {
    const { error } = await adminClient.from("accommodation_profiles").upsert({
      poi_id: poiId,
      accommodation_type: body.accommodationProfile.accommodationType || null,
      capacity_min: toNullableInteger(body.accommodationProfile.capacityMin),
      capacity_max: toNullableInteger(body.accommodationProfile.capacityMax),
      roofed: body.accommodationProfile.roofed,
      glamping: body.accommodationProfile.glamping,
      camping: body.accommodationProfile.camping,
      direct_booking: body.accommodationProfile.directBooking,
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  if (body.poiKind === "logistics") {
    const { error } = await adminClient.from("logistics_profiles").upsert({
      poi_id: poiId,
      logistics_type: body.logisticsProfile.logisticsType || null,
      fuel_types: toTextArray(body.logisticsProfile.fuelTypes),
      charger_types: toTextArray(body.logisticsProfile.chargerTypes),
      potable_water: body.logisticsProfile.potableWater,
      seasonal_notes: body.logisticsProfile.seasonalNotes || null,
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  return NextResponse.json({ id: poiId }, { status: 201 });
}