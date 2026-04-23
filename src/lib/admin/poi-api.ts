import {
  createEmptyPoiRecord,
  type PoiAccommodationProfileRecord,
  type PoiActivityProfileRecord,
  type PoiEditorRecord,
  type PoiFoodProfileRecord,
  type PoiHourRecord,
  type PoiImageRecord,
  type PoiLogisticsProfileRecord,
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

type PoiFoodRow = {
  cuisine_types: string[] | null;
  dining_style: string | null;
  price_band: string | null;
  menu_url: string | null;
  patio: boolean;
  takeout_available: boolean;
  reservation_recommended: boolean;
};

type PoiAccommodationRow = {
  accommodation_type: string | null;
  capacity_min: number | null;
  capacity_max: number | null;
  roofed: boolean;
  glamping: boolean;
  camping: boolean;
  direct_booking: boolean;
};

type PoiLogisticsRow = {
  logistics_type: string | null;
  fuel_types: string[] | null;
  charger_types: string[] | null;
  potable_water: boolean;
  seasonal_notes: string | null;
};

type PoiMediaRow = {
  id: string;
  image_url: string;
  alt_text: string | null;
  caption: string | null;
  is_thumbnail: boolean;
  sort_order: number;
  storage_path?: string | null;
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
  foodProfile: PoiFoodRow | null;
  accommodationProfile: PoiAccommodationRow | null;
  logisticsProfile: PoiLogisticsRow | null;
  media: PoiMediaRow[];
}): PoiEditorRecord {
  const baseRecord = createEmptyPoiRecord();
  const images = [...params.media]
    .sort((left, right) => {
      if (left.is_thumbnail !== right.is_thumbnail) {
        return left.is_thumbnail ? -1 : 1;
      }

      return left.sort_order - right.sort_order;
    })
    .map(mapPoiImage);

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
    foodProfile: params.foodProfile
      ? mapPoiFoodProfile(params.foodProfile)
      : baseRecord.foodProfile,
    accommodationProfile: params.accommodationProfile
      ? mapPoiAccommodationProfile(params.accommodationProfile)
      : baseRecord.accommodationProfile,
    logisticsProfile: params.logisticsProfile
      ? mapPoiLogisticsProfile(params.logisticsProfile)
      : baseRecord.logisticsProfile,
    images,
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

function mapPoiFoodProfile(row: PoiFoodRow): PoiFoodProfileRecord {
  return {
    cuisineTypes: (row.cuisine_types ?? []).join(", "),
    diningStyle: row.dining_style ?? "",
    priceBand: row.price_band ?? "",
    menuUrl: row.menu_url ?? "",
    patio: row.patio,
    takeoutAvailable: row.takeout_available,
    reservationRecommended: row.reservation_recommended,
  };
}

function mapPoiAccommodationProfile(
  row: PoiAccommodationRow,
): PoiAccommodationProfileRecord {
  return {
    accommodationType: row.accommodation_type ?? "",
    capacityMin: row.capacity_min?.toString() ?? "",
    capacityMax: row.capacity_max?.toString() ?? "",
    roofed: row.roofed,
    glamping: row.glamping,
    camping: row.camping,
    directBooking: row.direct_booking,
  };
}

function mapPoiLogisticsProfile(row: PoiLogisticsRow): PoiLogisticsProfileRecord {
  return {
    logisticsType: row.logistics_type ?? "",
    fuelTypes: (row.fuel_types ?? []).join(", "),
    chargerTypes: (row.charger_types ?? []).join(", "),
    potableWater: row.potable_water,
    seasonalNotes: row.seasonal_notes ?? "",
  };
}

function mapPoiImage(row: PoiMediaRow): PoiImageRecord {
  return {
    id: row.id,
    url: row.image_url,
    altText: row.alt_text ?? "",
    caption: row.caption ?? "",
    storagePath: row.storage_path ?? undefined,
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

export function toTextArray(value: string) {
  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}