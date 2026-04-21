import {
  createEmptyPoiRecord,
  type PoiActivityProfileRecord,
  type PoiEditorRecord,
  type PoiHourRecord,
  type PoiSummaryRecord,
  type PoiWarningRecord,
} from "@/lib/admin/poi-records";

type PoiAdminViewRow = {
  id: string;
  slug: string;
  name: string;
  summary: string | null;
  description: string | null;
  poi_kind: PoiSummaryRecord["poiKind"];
  latitude: number | null;
  longitude: number | null;
  address: string | null;
  municipality: string | null;
  phone: string | null;
  website: string | null;
  booking_url: string | null;
  is_published: boolean;
  source: string;
  updated_at: string;
};

type PoiSummaryRow = Pick<
  PoiAdminViewRow,
  "id" | "slug" | "name" | "poi_kind" | "municipality" | "is_published" | "updated_at"
>;

type PoiHoursRow = {
  id: string;
  season_label: string;
  valid_from: string | null;
  valid_to: string | null;
  day_of_week: number;
  opens_at: string | null;
  closes_at: string | null;
  early_close_warning_minutes: number | null;
  closed: boolean;
  notes: string | null;
};

type PoiWarningsRow = {
  id: string;
  warning_type: PoiWarningRecord["warningType"];
  severity: PoiWarningRecord["severity"];
  title: string;
  message: string;
  action_url: string | null;
  requires_acknowledgement: boolean;
  lead_time_hours: number | null;
};

type PoiActivityRow = {
  default_duration_minutes: number;
  min_duration_minutes: number | null;
  max_duration_minutes: number | null;
  trail_difficulty: string | null;
  distance_km: number | null;
  elevation_gain_m: number | null;
  crowd_intensity: string | null;
  weather_sensitivity: string | null;
};

export function mapPoiSummary(row: PoiSummaryRow): PoiSummaryRecord {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    poiKind: row.poi_kind,
    municipality: row.municipality ?? "",
    isPublished: row.is_published,
    updatedAt: row.updated_at,
  };
}

export function mapPoiEditorRecord(params: {
  poi: PoiAdminViewRow;
  hours: PoiHoursRow[];
  warnings: PoiWarningsRow[];
  activityProfile: PoiActivityRow | null;
}): PoiEditorRecord {
  const baseRecord = createEmptyPoiRecord();

  return {
    id: params.poi.id,
    slug: params.poi.slug,
    name: params.poi.name,
    summary: params.poi.summary ?? "",
    description: params.poi.description ?? "",
    poiKind: params.poi.poi_kind,
    latitude: params.poi.latitude?.toString() ?? baseRecord.latitude,
    longitude: params.poi.longitude?.toString() ?? baseRecord.longitude,
    address: params.poi.address ?? "",
    municipality: params.poi.municipality ?? "",
    phone: params.poi.phone ?? "",
    website: params.poi.website ?? "",
    bookingUrl: params.poi.booking_url ?? "",
    source: params.poi.source,
    isPublished: params.poi.is_published,
    hours:
      params.hours.length > 0
        ? params.hours.map(mapPoiHour)
        : baseRecord.hours,
    warnings:
      params.warnings.length > 0
        ? params.warnings.map(mapPoiWarning)
        : baseRecord.warnings,
    activityProfile: params.activityProfile
      ? mapPoiActivityProfile(params.activityProfile)
      : baseRecord.activityProfile,
  };
}

function mapPoiHour(row: PoiHoursRow): PoiHourRecord {
  return {
    id: row.id,
    seasonLabel: row.season_label,
    validFrom: row.valid_from ?? "",
    validTo: row.valid_to ?? "",
    dayOfWeek: row.day_of_week,
    opensAt: row.opens_at?.slice(0, 5) ?? "",
    closesAt: row.closes_at?.slice(0, 5) ?? "",
    earlyCloseWarningMinutes: row.early_close_warning_minutes?.toString() ?? "",
    closed: row.closed,
    notes: row.notes ?? "",
  };
}

function mapPoiWarning(row: PoiWarningsRow): PoiWarningRecord {
  return {
    id: row.id,
    warningType: row.warning_type,
    severity: row.severity,
    title: row.title,
    message: row.message,
    actionUrl: row.action_url ?? "",
    requiresAcknowledgement: row.requires_acknowledgement,
    leadTimeHours: row.lead_time_hours?.toString() ?? "",
  };
}

function mapPoiActivityProfile(row: PoiActivityRow): PoiActivityProfileRecord {
  return {
    defaultDurationMinutes: row.default_duration_minutes.toString(),
    minDurationMinutes: row.min_duration_minutes?.toString() ?? "",
    maxDurationMinutes: row.max_duration_minutes?.toString() ?? "",
    trailDifficulty: row.trail_difficulty ?? "",
    distanceKm: row.distance_km?.toString() ?? "",
    elevationGainM: row.elevation_gain_m?.toString() ?? "",
    crowdIntensity: row.crowd_intensity ?? "",
    weatherSensitivity: row.weather_sensitivity ?? "",
  };
}

export function buildPointValue(latitude: string, longitude: string) {
  return `SRID=4326;POINT(${longitude} ${latitude})`;
}

export function toNullableInteger(value: string) {
  if (!value.trim()) {
    return null;
  }

  return Number.parseInt(value, 10);
}

export function toNullableFloat(value: string) {
  if (!value.trim()) {
    return null;
  }

  return Number.parseFloat(value);
}