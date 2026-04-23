export const poiKinds = [
  "accommodation",
  "food",
  "activity",
  "logistics",
  "viewpoint",
] as const;

export const recordTypeOptions = [
  { value: "activity", label: "Attraction / Activity" },
  { value: "food", label: "Restaurant / Food" },
  { value: "accommodation", label: "Accommodation" },
  { value: "logistics", label: "Logistics / Survival" },
  { value: "viewpoint", label: "Viewpoint" },
] as const;

export const warningTypes = [
  "reservation",
  "ferry",
  "parking",
  "weather",
  "safety",
  "seasonal",
  "hours",
] as const;

export const warningSeverities = ["info", "warning", "critical"] as const;

export type PoiKind = (typeof poiKinds)[number];
export type WarningType = (typeof warningTypes)[number];
export type WarningSeverity = (typeof warningSeverities)[number];

export type PoiSummaryRecord = {
  id: string;
  slug: string;
  name: string;
  poiKind: PoiKind;
  municipality: string;
  isPublished: boolean;
  updatedAt: string;
};

export type PoiHourRecord = {
  id?: string;
  seasonLabel: string;
  validFrom: string;
  validTo: string;
  dayOfWeek: number;
  opensAt: string;
  closesAt: string;
  earlyCloseWarningMinutes: string;
  closed: boolean;
  notes: string;
};

export type PoiWarningRecord = {
  id?: string;
  warningType: WarningType;
  severity: WarningSeverity;
  title: string;
  message: string;
  actionUrl: string;
  requiresAcknowledgement: boolean;
  leadTimeHours: string;
};

export type PoiActivityProfileRecord = {
  defaultDurationMinutes: string;
  minDurationMinutes: string;
  maxDurationMinutes: string;
  trailDifficulty: string;
  distanceKm: string;
  elevationGainM: string;
  crowdIntensity: string;
  weatherSensitivity: string;
};

export type PoiFoodProfileRecord = {
  cuisineTypes: string;
  diningStyle: string;
  priceBand: string;
  menuUrl: string;
  patio: boolean;
  takeoutAvailable: boolean;
  reservationRecommended: boolean;
};

export type PoiAccommodationProfileRecord = {
  accommodationType: string;
  capacityMin: string;
  capacityMax: string;
  roofed: boolean;
  glamping: boolean;
  camping: boolean;
  directBooking: boolean;
};

export type PoiLogisticsProfileRecord = {
  logisticsType: string;
  fuelTypes: string;
  chargerTypes: string;
  potableWater: boolean;
  seasonalNotes: string;
};

export type PoiImageRecord = {
  id?: string;
  url: string;
  altText: string;
  caption: string;
  storagePath?: string;
};

export type PoiEditorRecord = {
  id?: string;
  slug: string;
  name: string;
  summary: string;
  description: string;
  poiKind: PoiKind;
  latitude: string;
  longitude: string;
  address: string;
  municipality: string;
  phone: string;
  website: string;
  bookingUrl: string;
  source: string;
  isPublished: boolean;
  hours: PoiHourRecord[];
  warnings: PoiWarningRecord[];
  activityProfile: PoiActivityProfileRecord;
  foodProfile: PoiFoodProfileRecord;
  accommodationProfile: PoiAccommodationProfileRecord;
  logisticsProfile: PoiLogisticsProfileRecord;
  images: PoiImageRecord[];
};

export function createEmptyPoiRecord(): PoiEditorRecord {
  return {
    slug: "",
    name: "",
    summary: "",
    description: "",
    poiKind: "activity",
    latitude: "45.2500",
    longitude: "-81.6700",
    address: "",
    municipality: "",
    phone: "",
    website: "",
    bookingUrl: "",
    source: "curated",
    isPublished: false,
    hours: [
      {
        seasonLabel: "Summer",
        validFrom: "",
        validTo: "",
        dayOfWeek: 6,
        opensAt: "09:00",
        closesAt: "17:00",
        earlyCloseWarningMinutes: "",
        closed: false,
        notes: "",
      },
    ],
    warnings: [
      {
        warningType: "parking",
        severity: "warning",
        title: "",
        message: "",
        actionUrl: "",
        requiresAcknowledgement: false,
        leadTimeHours: "",
      },
    ],
    activityProfile: {
      defaultDurationMinutes: "90",
      minDurationMinutes: "60",
      maxDurationMinutes: "180",
      trailDifficulty: "moderate",
      distanceKm: "",
      elevationGainM: "",
      crowdIntensity: "high",
      weatherSensitivity: "medium",
    },
    foodProfile: {
      cuisineTypes: "",
      diningStyle: "",
      priceBand: "",
      menuUrl: "",
      patio: false,
      takeoutAvailable: false,
      reservationRecommended: false,
    },
    accommodationProfile: {
      accommodationType: "",
      capacityMin: "",
      capacityMax: "",
      roofed: true,
      glamping: false,
      camping: false,
      directBooking: false,
    },
    logisticsProfile: {
      logisticsType: "",
      fuelTypes: "",
      chargerTypes: "",
      potableWater: false,
      seasonalNotes: "",
    },
    images: [],
  };
}

export function getRecordTypeLabel(poiKind: PoiKind) {
  return recordTypeOptions.find((option) => option.value === poiKind)?.label ?? poiKind;
}