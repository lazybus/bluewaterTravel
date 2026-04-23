#!/usr/bin/env node

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const DEFAULTS = {
  latitude: 45.2500,
  longitude: -81.6700,
  radius: 25000,
  municipality: "Tobermory",
  overpassUrl: "https://overpass-api.de/api/interpreter",
  sampleSize: 5,
};

const DEFAULT_OVERPASS_URLS = [
  DEFAULTS.overpassUrl,
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
];

const ALL_CATEGORIES = ["activity", "food", "accommodation", "logistics", "viewpoint"];
const GEOMETRY_TYPES = ["node", "way", "relation"];

const CATEGORY_FILTERS = {
  activity: [
    { key: "tourism", values: ["attraction", "museum", "gallery"] },
    { key: "leisure", values: ["park", "nature_reserve", "beach"] },
    { key: "natural", values: ["beach", "cave", "arch", "cliff"] },
  ],
  food: [
    { key: "amenity", values: ["restaurant", "cafe", "fast_food", "bar", "pub", "ice_cream"] },
  ],
  accommodation: [
    { key: "tourism", values: ["hotel", "motel", "guest_house", "hostel", "camp_site", "caravan_site", "resort", "chalet"] },
  ],
  logistics: [
    { key: "amenity", values: ["fuel", "parking", "ferry_terminal", "drinking_water", "toilets", "pharmacy"] },
    { key: "shop", values: ["supermarket", "convenience"] },
    { key: "leisure", values: ["marina"] },
  ],
  viewpoint: [
    { key: "tourism", values: ["viewpoint"] },
  ],
};

const TYPE_PRIORITY = {
  relation: 3,
  way: 2,
  node: 1,
};

const LOGISTICS_TYPE_LABELS = {
  fuel: "fuel",
  parking: "parking",
  ferry_terminal: "ferry_terminal",
  drinking_water: "water",
  toilets: "toilets",
  pharmacy: "pharmacy",
  supermarket: "groceries",
  convenience: "groceries",
  marina: "marina",
};

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});

async function main() {
  const options = parseArgs(process.argv.slice(2));

  if (options.help) {
    printHelp();
    return;
  }

  const query = buildOverpassQuery(options);
  const elements = await fetchOverpassElements(getOverpassUrls(options), query);
  const normalized = normalizeElements(elements, options);
  const limitedCandidates =
    typeof options.limit === "number"
      ? applyCategoryBalancedLimit(normalized.candidates, options.limit)
      : normalized.candidates;
  const limitedCountsByKind = countBy(limitedCandidates, (candidate) => candidate.poiKind);
  const sameNameReviewGroups = findSameNameReviewGroups(normalized.candidates);

  printSummary({
    mode: options.write ? "write" : "dry-run",
    options,
    rawElementCount: elements.length,
    totalNormalizedCount: normalized.candidates.length,
    ...normalized,
    countsByKind: limitedCountsByKind,
    candidates: limitedCandidates,
  });

  if (options.reviewSameName) {
    printSameNameReview({
      reviewGroups: sameNameReviewGroups,
      categoryFilter: options.categories,
    });
  }

  if (options.exportJsonPath) {
    await exportReviewJson(options.exportJsonPath, {
      generatedAt: new Date().toISOString(),
      mode: options.write ? "write" : "dry-run",
      query: {
        latitude: options.latitude,
        longitude: options.longitude,
        radius: options.radius,
        municipality: options.municipality,
        categories: options.categories,
      },
      counts: {
        rawElementCount: elements.length,
        normalizedCandidateCount: normalized.candidates.length,
        displayedCandidateCount: limitedCandidates.length,
      },
      skipped: normalized.skipped,
      reviewGroups: sameNameReviewGroups,
      candidates: normalized.candidates,
    });
  }

  if (!options.write) {
    return;
  }

  const supabase = createSupabaseAdminClient();
  const result = await writeCandidates(supabase, limitedCandidates);
  printWriteSummary(result);

  if (result.errors.length > 0) {
    process.exitCode = 1;
  }
}

function parseArgs(argv) {
  const options = {
    help: false,
    write: false,
    latitude: DEFAULTS.latitude,
    longitude: DEFAULTS.longitude,
    radius: DEFAULTS.radius,
    municipality: DEFAULTS.municipality,
    overpassUrl: DEFAULTS.overpassUrl,
    categories: [...ALL_CATEGORIES],
    limit: null,
    sampleSize: DEFAULTS.sampleSize,
    reviewSameName: false,
    exportJsonPath: null,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];

    if (argument === "--help" || argument === "-h") {
      options.help = true;
      continue;
    }

    if (argument === "--write") {
      options.write = true;
      continue;
    }

    if (argument === "--review-same-name") {
      options.reviewSameName = true;
      continue;
    }

    if (argument.startsWith("--export-json=")) {
      options.exportJsonPath = argument.slice("--export-json=".length).trim();
      continue;
    }

    if (argument === "--export-json") {
      options.exportJsonPath = readValue(argv, ++index, "--export-json").trim();
      continue;
    }

    if (argument.startsWith("--category=")) {
      options.categories = parseCategories(argument.slice("--category=".length));
      continue;
    }

    if (argument === "--category") {
      options.categories = parseCategories(readValue(argv, ++index, "--category"));
      continue;
    }

    if (argument.startsWith("--lat=")) {
      options.latitude = parseNumber(argument.slice("--lat=".length), "--lat");
      continue;
    }

    if (argument === "--lat") {
      options.latitude = parseNumber(readValue(argv, ++index, "--lat"), "--lat");
      continue;
    }

    if (argument.startsWith("--lng=")) {
      options.longitude = parseNumber(argument.slice("--lng=".length), "--lng");
      continue;
    }

    if (argument === "--lng") {
      options.longitude = parseNumber(readValue(argv, ++index, "--lng"), "--lng");
      continue;
    }

    if (argument.startsWith("--radius=")) {
      options.radius = parseNumber(argument.slice("--radius=".length), "--radius");
      continue;
    }

    if (argument === "--radius") {
      options.radius = parseNumber(readValue(argv, ++index, "--radius"), "--radius");
      continue;
    }

    if (argument.startsWith("--municipality=")) {
      options.municipality = argument.slice("--municipality=".length).trim() || DEFAULTS.municipality;
      continue;
    }

    if (argument === "--municipality") {
      options.municipality = readValue(argv, ++index, "--municipality").trim() || DEFAULTS.municipality;
      continue;
    }

    if (argument.startsWith("--limit=")) {
      options.limit = parseInteger(argument.slice("--limit=".length), "--limit");
      continue;
    }

    if (argument === "--limit") {
      options.limit = parseInteger(readValue(argv, ++index, "--limit"), "--limit");
      continue;
    }

    if (argument.startsWith("--sample=")) {
      options.sampleSize = parseInteger(argument.slice("--sample=".length), "--sample");
      continue;
    }

    if (argument === "--sample") {
      options.sampleSize = parseInteger(readValue(argv, ++index, "--sample"), "--sample");
      continue;
    }

    if (argument.startsWith("--overpass-url=")) {
      options.overpassUrl = argument.slice("--overpass-url=".length).trim() || DEFAULTS.overpassUrl;
      continue;
    }

    if (argument === "--overpass-url") {
      options.overpassUrl = readValue(argv, ++index, "--overpass-url").trim() || DEFAULTS.overpassUrl;
      continue;
    }

    throw new Error(`Unknown argument: ${argument}`);
  }

  if (options.radius <= 0) {
    throw new Error("--radius must be greater than 0.");
  }

  if (options.sampleSize < 0) {
    throw new Error("--sample must be 0 or greater.");
  }

  return options;
}

function printHelp() {
  console.log(`One-time OSM/Overpass POI importer for Bluewater Travels.

Usage:
  node scripts/import-osm-pois.mjs [options]

Modes:
  Default mode is dry-run. Add --write to insert POIs into Supabase.

Options:
  --write                     Persist imported POIs into Supabase.
  --category activity,food    Comma-separated categories. Defaults to all.
  --lat 45.25                 Center latitude. Defaults to Tobermory.
  --lng -81.67                Center longitude. Defaults to Tobermory.
  --radius 25000              Search radius in meters.
  --municipality Tobermory    Fallback municipality label.
  --limit 20                  Limit candidate count after normalization.
  --sample 5                  Preview sample row count in output.
  --review-same-name          Show groups that share the same name with addresses and coordinates.
  --export-json PATH          Write the normalized candidate set and review groups to a JSON file.
  --overpass-url URL          Override the Overpass interpreter endpoint.
  --help                      Show this help text.

Examples:
  node scripts/import-osm-pois.mjs --category activity,viewpoint --limit 10
  node scripts/import-osm-pois.mjs --category food --review-same-name --export-json tmp/food-review.json
  node scripts/import-osm-pois.mjs --category food --write
`);
}

function readValue(argv, index, flagName) {
  const value = argv[index];

  if (!value) {
    throw new Error(`Missing value for ${flagName}.`);
  }

  return value;
}

function parseNumber(value, flagName) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    throw new Error(`Invalid numeric value for ${flagName}: ${value}`);
  }

  return parsed;
}

function parseInteger(value, flagName) {
  const parsed = Number.parseInt(value, 10);

  if (!Number.isInteger(parsed)) {
    throw new Error(`Invalid integer value for ${flagName}: ${value}`);
  }

  return parsed;
}

function parseCategories(value) {
  const categories = value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  if (categories.length === 0) {
    throw new Error("At least one category must be provided.");
  }

  const invalid = categories.filter((category) => !ALL_CATEGORIES.includes(category));

  if (invalid.length > 0) {
    throw new Error(`Unsupported categories: ${invalid.join(", ")}`);
  }

  return Array.from(new Set(categories));
}

function buildOverpassQuery(options) {
  const statements = [];

  for (const category of options.categories) {
    const filters = CATEGORY_FILTERS[category] ?? [];

    for (const filter of filters) {
      const matcher = escapeRegExpList(filter.values);

      for (const geometryType of GEOMETRY_TYPES) {
        statements.push(
          `  ${geometryType}(around:${Math.round(options.radius)},${options.latitude},${options.longitude})["${filter.key}"~"^(${matcher})$"];`,
        );
      }
    }
  }

  return `[out:json][timeout:90];\n(\n${statements.join("\n")}\n);\nout center tags;`;
}

async function fetchOverpassElements(overpassUrl, query) {
  const overpassUrls = Array.isArray(overpassUrl) ? overpassUrl : [overpassUrl];
  const endpointFailures = [];

  for (const currentOverpassUrl of overpassUrls) {
  const attempts = [
    {
      label: "POST form",
      request: () =>
        fetch(currentOverpassUrl, {
          method: "POST",
          headers: buildOverpassHeaders({
            "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
          }),
          body: `data=${encodeURIComponent(query)}`,
        }),
    },
    {
      label: "POST text",
      request: () =>
        fetch(currentOverpassUrl, {
          method: "POST",
          headers: buildOverpassHeaders({
            "Content-Type": "text/plain;charset=UTF-8",
          }),
          body: query,
        }),
    },
    {
      label: "GET data",
      request: () =>
        fetch(`${currentOverpassUrl}?data=${encodeURIComponent(query)}`, {
          method: "GET",
          headers: buildOverpassHeaders(),
        }),
    },
  ];

  const failures = [];

    for (const attempt of attempts) {
      const response = await attempt.request();

      if (!response.ok) {
        const message = await response.text();
        failures.push(`${attempt.label}: ${response.status} ${message.slice(0, 120)}`);
        continue;
      }

      const payload = await response.json().catch(() => null);

      if (payload && Array.isArray(payload.elements)) {
        return payload.elements;
      }

      failures.push(`${attempt.label}: response was not valid Overpass JSON`);
    }

    endpointFailures.push(`${currentOverpassUrl} => ${failures.join(" | ")}`);
  }

  throw new Error(`Overpass request failed after multiple attempts: ${endpointFailures.join(" || ")}`);
}

function getOverpassUrls(options) {
  if (options.overpassUrl !== DEFAULTS.overpassUrl) {
    return [options.overpassUrl];
  }

  return DEFAULT_OVERPASS_URLS;
}

function buildOverpassHeaders(extraHeaders = {}) {
  return {
    Accept: "application/json,text/plain;q=0.9,*/*;q=0.8",
    "User-Agent": "bluewater-travels-osm-import/0.1",
    ...extraHeaders,
  };
}

function normalizeElements(elements, options) {
  const skipped = {
    missingName: 0,
    missingCoordinates: 0,
    unsupportedType: 0,
    duplicateCandidate: 0,
    hiddenOrAbandoned: 0,
    lowSignalName: 0,
  };

  const dedupedCandidates = [];
  const dedupedCandidatesByName = new Map();

  for (const element of elements) {
    const mapped = mapElementToCandidate(element, options);

    if (!mapped.ok) {
      skipped[mapped.reason] += 1;
      continue;
    }

    const candidateNameKey = buildNameKey(mapped.value);
    const candidatesWithSameName = dedupedCandidatesByName.get(candidateNameKey) ?? [];
    const existingIndex = candidatesWithSameName.findIndex((candidate) =>
      isDuplicateCandidate(candidate, mapped.value),
    );

    if (existingIndex === -1) {
      dedupedCandidates.push(mapped.value);
      candidatesWithSameName.push(mapped.value);
      dedupedCandidatesByName.set(candidateNameKey, candidatesWithSameName);
      continue;
    }

    const existing = candidatesWithSameName[existingIndex];

    if (mapped.value.score > existing.score) {
      const dedupedCandidateIndex = dedupedCandidates.findIndex(
        (candidate) => candidate.source === existing.source,
      );

      if (dedupedCandidateIndex !== -1) {
        dedupedCandidates[dedupedCandidateIndex] = mapped.value;
      }

      candidatesWithSameName[existingIndex] = mapped.value;
      dedupedCandidatesByName.set(candidateNameKey, candidatesWithSameName);
      skipped.duplicateCandidate += 1;
      continue;
    }

    skipped.duplicateCandidate += 1;
  }

  const candidates = dedupedCandidates.sort((left, right) => {
    if (left.poiKind !== right.poiKind) {
      return left.poiKind.localeCompare(right.poiKind);
    }

    return left.name.localeCompare(right.name);
  });

  const countsByKind = countBy(candidates, (candidate) => candidate.poiKind);

  return {
    candidates,
    countsByKind,
    skipped,
  };
}

function buildNameKey(candidate) {
  return `${candidate.poiKind}:${slugify(candidate.name)}`;
}

function isDuplicateCandidate(existingCandidate, candidate) {
  if (buildNameKey(existingCandidate) !== buildNameKey(candidate)) {
    return false;
  }

  const existingAddress = normalizeAddressForComparison(existingCandidate.address);
  const candidateAddress = normalizeAddressForComparison(candidate.address);

  if (existingAddress && candidateAddress) {
    return existingAddress === candidateAddress;
  }

  return getDistanceMeters(existingCandidate, candidate) <= 40;
}

function normalizeAddressForComparison(address) {
  if (!address || typeof address !== "string") {
    return "";
  }

  return address
    .toLowerCase()
    .replace(/\bstreet\b/g, "st")
    .replace(/\broad\b/g, "rd")
    .replace(/\bavenue\b/g, "ave")
    .replace(/\bdrive\b/g, "dr")
    .replace(/\bhighway\b/g, "hwy")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function getDistanceMeters(left, right) {
  const earthRadiusMeters = 6371000;
  const leftLatitudeRadians = toRadians(left.latitude);
  const rightLatitudeRadians = toRadians(right.latitude);
  const latitudeDeltaRadians = toRadians(right.latitude - left.latitude);
  const longitudeDeltaRadians = toRadians(right.longitude - left.longitude);

  const haversine =
    Math.sin(latitudeDeltaRadians / 2) ** 2 +
    Math.cos(leftLatitudeRadians) *
      Math.cos(rightLatitudeRadians) *
      Math.sin(longitudeDeltaRadians / 2) ** 2;

  const arc = 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));

  return earthRadiusMeters * arc;
}

function toRadians(value) {
  return (value * Math.PI) / 180;
}

function mapElementToCandidate(element, options) {
  const tags = element?.tags ?? {};

  if (isHiddenOrAbandoned(tags)) {
    return { ok: false, reason: "hiddenOrAbandoned" };
  }

  const rawName = typeof tags.name === "string" ? tags.name.trim() : "";

  if (!rawName) {
    return { ok: false, reason: "missingName" };
  }

  const poiKind = inferPoiKind(tags);

  if (!poiKind || !options.categories.includes(poiKind)) {
    return { ok: false, reason: "unsupportedType" };
  }

  if (isLowSignalName(rawName, tags, poiKind)) {
    return { ok: false, reason: "lowSignalName" };
  }

  const coordinates = getCoordinates(element);

  if (!coordinates) {
    return { ok: false, reason: "missingCoordinates" };
  }

  const address = buildAddress(tags);
  const municipality =
    firstTruthy(tags["addr:city"], tags["addr:town"], tags["addr:village"], tags["addr:hamlet"]) ??
    options.municipality;
  const website = normalizeUrl(firstTruthy(tags["contact:website"], tags.website));
  const phone = firstTruthy(tags["contact:phone"], tags.phone);
  const bookingUrl = normalizeUrl(
    firstTruthy(tags["reservation:website"], tags.booking, poiKind === "accommodation" ? tags.website : null),
  );
  const source = `osm:${element.type}:${element.id}`;
  const activityProfile = buildActivityProfile(tags, poiKind);
  const foodProfile = buildFoodProfile(tags);
  const accommodationProfile = buildAccommodationProfile(tags);
  const logisticsProfile = buildLogisticsProfile(tags);

  const candidate = {
    name: rawName,
    poiKind,
    latitude: coordinates.latitude,
    longitude: coordinates.longitude,
    address,
    municipality,
    phone: phone ?? "",
    website: website ?? "",
    bookingUrl: bookingUrl ?? "",
    source,
    summary: "",
    description: "",
    isPublished: false,
    hours: [],
    warnings: [],
    activityProfile,
    foodProfile,
    accommodationProfile,
    logisticsProfile,
  };

  return {
    ok: true,
    value: {
      ...candidate,
      score: scoreCandidate(candidate, element),
    },
  };
}

function inferPoiKind(tags) {
  if (matchesTag(tags, "tourism", ["viewpoint"])) {
    return "viewpoint";
  }

  if (matchesTag(tags, "amenity", ["restaurant", "cafe", "fast_food", "bar", "pub", "ice_cream"])) {
    return "food";
  }

  if (matchesTag(tags, "tourism", ["hotel", "motel", "guest_house", "hostel", "camp_site", "caravan_site", "resort", "chalet"])) {
    return "accommodation";
  }

  if (
    matchesTag(tags, "amenity", ["fuel", "parking", "ferry_terminal", "drinking_water", "toilets", "pharmacy"]) ||
    matchesTag(tags, "shop", ["supermarket", "convenience"]) ||
    matchesTag(tags, "leisure", ["marina"])
  ) {
    return "logistics";
  }

  if (
    matchesTag(tags, "tourism", ["attraction", "museum", "gallery"]) ||
    matchesTag(tags, "leisure", ["park", "nature_reserve", "beach"]) ||
    matchesTag(tags, "natural", ["beach", "cave", "arch", "cliff"])
  ) {
    return "activity";
  }

  return null;
}

function matchesTag(tags, key, values) {
  const value = tags[key];
  return typeof value === "string" && values.includes(value);
}

function isHiddenOrAbandoned(tags) {
  return [
    tags.disused,
    tags.abandoned,
    tags.demolished,
    tags.removed,
    tags["abandoned:amenity"],
    tags["disused:amenity"],
    tags["abandoned:tourism"],
    tags["disused:tourism"],
  ].some((value) => value === "yes");
}

function getCoordinates(element) {
  if (typeof element?.lat === "number" && typeof element?.lon === "number") {
    return { latitude: element.lat, longitude: element.lon };
  }

  if (typeof element?.center?.lat === "number" && typeof element?.center?.lon === "number") {
    return { latitude: element.center.lat, longitude: element.center.lon };
  }

  return null;
}

function isLowSignalName(name, tags, poiKind) {
  return poiKind === "accommodation" && tags.tourism === "camp_site" && /^\d+$/.test(name);
}

function buildAddress(tags) {
  const fullAddress = firstTruthy(tags["addr:full"], tags["contact:address"]);

  if (fullAddress) {
    return fullAddress;
  }

  const parts = [
    joinNonEmpty([tags["addr:housenumber"], tags["addr:street"]], " "),
    tags["addr:city"] ?? tags["addr:town"] ?? tags["addr:village"] ?? tags["addr:hamlet"],
    tags["addr:province"],
    tags["addr:postcode"],
  ].filter(Boolean);

  return parts.join(", ");
}

function buildActivityProfile(tags, poiKind) {
  if (poiKind !== "activity") {
    return {
      defaultDurationMinutes: "",
      minDurationMinutes: "",
      maxDurationMinutes: "",
      trailDifficulty: "",
      distanceKm: "",
      elevationGainM: "",
      crowdIntensity: "",
      weatherSensitivity: "",
    };
  }

  const defaultDurationMinutes =
    matchesTag(tags, "tourism", ["museum", "gallery"]) ? "90" :
    matchesTag(tags, "leisure", ["park", "nature_reserve"]) ? "180" :
    matchesTag(tags, "natural", ["beach", "cave", "arch", "cliff"]) ? "120" :
    "90";

  return {
    defaultDurationMinutes,
    minDurationMinutes: "",
    maxDurationMinutes: "",
    trailDifficulty: "",
    distanceKm: "",
    elevationGainM: "",
    crowdIntensity: "",
    weatherSensitivity: matchesTag(tags, "natural", ["beach", "cave", "arch", "cliff"]) ? "high" : "",
  };
}

function buildFoodProfile(tags) {
  const amenity = typeof tags.amenity === "string" ? tags.amenity : "";
  const cuisines = typeof tags.cuisine === "string" ? tags.cuisine.split(/[;,]/).map((part) => part.trim()).filter(Boolean) : [];

  return {
    cuisineTypes: cuisines.join(", "),
    diningStyle: amenity,
    priceBand: "",
    menuUrl: normalizeUrl(firstTruthy(tags.menu, tags["contact:menu"])) ?? "",
    patio: isAffirmativeTag(tags.outdoor_seating),
    takeoutAvailable: isAffirmativeTag(tags.takeaway),
    reservationRecommended: isAffirmativeTag(tags.reservation),
  };
}

function buildAccommodationProfile(tags) {
  const accommodationType = typeof tags.tourism === "string" ? tags.tourism : "";
  const isCamping = ["camp_site", "caravan_site"].includes(accommodationType);

  return {
    accommodationType,
    capacityMin: "",
    capacityMax: "",
    roofed: !isCamping,
    glamping: isAffirmativeTag(tags.glamping),
    camping: isCamping,
    directBooking: Boolean(normalizeUrl(firstTruthy(tags["reservation:website"], tags.booking))),
  };
}

function buildLogisticsProfile(tags) {
  const logisticsType =
    LOGISTICS_TYPE_LABELS[tags.amenity] ??
    LOGISTICS_TYPE_LABELS[tags.shop] ??
    LOGISTICS_TYPE_LABELS[tags.leisure] ??
    "";

  const fuelTypes = Object.entries(tags)
    .filter(([key, value]) => key.startsWith("fuel:") && value === "yes")
    .map(([key]) => key.slice("fuel:".length));
  const chargerTypes = Object.entries(tags)
    .filter(([key, value]) => key.startsWith("socket:") && value === "yes")
    .map(([key]) => key.slice("socket:".length));

  return {
    logisticsType,
    fuelTypes: fuelTypes.join(", "),
    chargerTypes: chargerTypes.join(", "),
    potableWater: matchesTag(tags, "amenity", ["drinking_water"]) || isAffirmativeTag(tags.potable_water),
    seasonalNotes: firstTruthy(tags.seasonal, tags["opening_hours:covid19"]) ?? "",
  };
}

function scoreCandidate(candidate, element) {
  let score = TYPE_PRIORITY[element.type] ?? 0;

  if (candidate.address) {
    score += 10;
  }

  if (candidate.website) {
    score += 6;
  }

  if (candidate.phone) {
    score += 4;
  }

  if (candidate.bookingUrl) {
    score += 3;
  }

  return score;
}

function printSummary(summary) {
  console.log(`Mode: ${summary.mode}`);
  console.log(
    `Query: center=(${summary.options.latitude}, ${summary.options.longitude}) radius=${summary.options.radius}m categories=${summary.options.categories.join(", ")}`,
  );
  console.log(`Raw OSM elements: ${summary.rawElementCount}`);
  console.log(`Normalized candidates: ${summary.totalNormalizedCount}`);

  if (summary.totalNormalizedCount !== summary.candidates.length) {
    console.log(`Displayed candidates after limit: ${summary.candidates.length}`);
  }

  console.log("Candidates by category:");
  console.table(summary.countsByKind);
  console.log("Skipped elements:");
  console.table(summary.skipped);

  if (summary.options.sampleSize > 0 && summary.candidates.length > 0) {
    console.log("Sample candidates:");
    console.table(
      summary.candidates.slice(0, summary.options.sampleSize).map((candidate) => ({
        name: candidate.name,
        poiKind: candidate.poiKind,
        municipality: candidate.municipality,
        website: candidate.website,
        source: candidate.source,
      })),
    );
  }
}

function printSameNameReview({ reviewGroups, categoryFilter }) {
  console.log(`Same-name review groups: ${reviewGroups.length} for categories ${categoryFilter.join(", ")}`);

  if (reviewGroups.length === 0) {
    return;
  }

  for (const group of reviewGroups) {
    console.log(`Review group: ${group.poiKind} / ${group.name} (${group.occurrenceCount} records)`);
    console.table(
      group.records.map((record) => ({
        source: record.source,
        address: record.address || "",
        municipality: record.municipality,
        latitude: record.latitude.toFixed(6),
        longitude: record.longitude.toFixed(6),
        phone: record.phone || "",
        website: record.website || "",
      })),
    );
  }
}

async function exportReviewJson(exportPath, payload) {
  const resolvedPath = path.resolve(exportPath);
  await mkdir(path.dirname(resolvedPath), { recursive: true });
  await writeFile(resolvedPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  console.log(`Exported review JSON: ${resolvedPath}`);
}

function findSameNameReviewGroups(candidates) {
  const groupsByName = new Map();

  for (const candidate of candidates) {
    const key = buildNameKey(candidate);
    const current = groupsByName.get(key) ?? [];
    current.push(candidate);
    groupsByName.set(key, current);
  }

  return Array.from(groupsByName.entries())
    .filter(([, records]) => records.length > 1)
    .map(([key, records]) => {
      const [poiKind] = key.split(":", 2);
      return {
        key,
        poiKind,
        name: records[0]?.name ?? "",
        occurrenceCount: records.length,
        records: records.map((record) => ({
          name: record.name,
          poiKind: record.poiKind,
          address: record.address,
          municipality: record.municipality,
          latitude: record.latitude,
          longitude: record.longitude,
          phone: record.phone,
          website: record.website,
          source: record.source,
        })),
      };
    })
    .sort((left, right) => {
      if (left.poiKind !== right.poiKind) {
        return left.poiKind.localeCompare(right.poiKind);
      }

      return left.name.localeCompare(right.name);
    });
}

function createSupabaseAdminClient() {
  const url = readRequiredEnvWithFallback("NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_URL");
  const secret = readRequiredEnvWithFallback("SUPABASE_SECRET_KEY", "SUPABASE_SERVICE_ROLE_KEY");

  return createClient(url, secret, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

function readRequiredEnvWithFallback(preferredName, fallbackName) {
  const value = process.env[preferredName] ?? process.env[fallbackName] ?? null;

  if (!value) {
    throw new Error(`Missing required environment variable: ${preferredName} (or ${fallbackName}).`);
  }

  return value;
}

async function writeCandidates(supabase, candidates) {
  const existingPois = await fetchExistingPois(supabase);
  const existingSources = new Set(existingPois.map((poi) => poi.source));
  const existingSlugs = new Set(existingPois.map((poi) => poi.slug));
  const result = {
    inserted: 0,
    skippedExisting: 0,
    insertedByKind: countBy(candidates.filter(() => false), (candidate) => candidate.poiKind),
    errors: [],
  };

  for (const candidate of candidates) {
    if (existingSources.has(candidate.source)) {
      result.skippedExisting += 1;
      continue;
    }

    const slug = ensureUniqueSlug(candidate.name, existingSlugs, candidate.source);

    try {
      const { data: poi, error: poiError } = await supabase
        .from("pois")
        .insert({
          slug,
          name: candidate.name,
          summary: candidate.summary || null,
          description: candidate.description || null,
          poi_kind: candidate.poiKind,
          geom: buildPointValue(candidate.latitude, candidate.longitude),
          address: candidate.address || null,
          municipality: candidate.municipality || null,
          phone: candidate.phone || null,
          website: candidate.website || null,
          booking_url: candidate.bookingUrl || null,
          is_published: false,
          source: candidate.source,
        })
        .select("id")
        .single();

      if (poiError || !poi) {
        throw new Error(poiError?.message ?? `Unable to insert ${candidate.name}.`);
      }

      await insertProfileIfNeeded(supabase, poi.id, candidate);

      existingSlugs.add(slug);
      existingSources.add(candidate.source);
      result.inserted += 1;
      result.insertedByKind[candidate.poiKind] = (result.insertedByKind[candidate.poiKind] ?? 0) + 1;
    } catch (error) {
      result.errors.push({
        name: candidate.name,
        source: candidate.source,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return result;
}

async function fetchExistingPois(supabase) {
  const { data, error } = await supabase.from("pois").select("source, slug");

  if (error) {
    throw new Error(`Unable to load existing POIs: ${error.message}`);
  }

  return data ?? [];
}

async function insertProfileIfNeeded(supabase, poiId, candidate) {
  if (candidate.poiKind === "activity" && candidate.activityProfile.defaultDurationMinutes) {
    const { error } = await supabase.from("activity_profiles").upsert({
      poi_id: poiId,
      default_duration_minutes: Number.parseInt(candidate.activityProfile.defaultDurationMinutes, 10),
      min_duration_minutes: toNullableInteger(candidate.activityProfile.minDurationMinutes),
      max_duration_minutes: toNullableInteger(candidate.activityProfile.maxDurationMinutes),
      trail_difficulty: candidate.activityProfile.trailDifficulty || null,
      distance_km: toNullableFloat(candidate.activityProfile.distanceKm),
      elevation_gain_m: toNullableInteger(candidate.activityProfile.elevationGainM),
      crowd_intensity: candidate.activityProfile.crowdIntensity || null,
      weather_sensitivity: candidate.activityProfile.weatherSensitivity || null,
    });

    if (error) {
      throw new Error(error.message);
    }
  }

  if (candidate.poiKind === "food") {
    const { error } = await supabase.from("food_profiles").upsert({
      poi_id: poiId,
      cuisine_types: toTextArray(candidate.foodProfile.cuisineTypes),
      dining_style: candidate.foodProfile.diningStyle || null,
      price_band: candidate.foodProfile.priceBand || null,
      menu_url: candidate.foodProfile.menuUrl || null,
      patio: candidate.foodProfile.patio,
      takeout_available: candidate.foodProfile.takeoutAvailable,
      reservation_recommended: candidate.foodProfile.reservationRecommended,
    });

    if (error) {
      throw new Error(error.message);
    }
  }

  if (candidate.poiKind === "accommodation") {
    const { error } = await supabase.from("accommodation_profiles").upsert({
      poi_id: poiId,
      accommodation_type: candidate.accommodationProfile.accommodationType || null,
      capacity_min: toNullableInteger(candidate.accommodationProfile.capacityMin),
      capacity_max: toNullableInteger(candidate.accommodationProfile.capacityMax),
      roofed: candidate.accommodationProfile.roofed,
      glamping: candidate.accommodationProfile.glamping,
      camping: candidate.accommodationProfile.camping,
      direct_booking: candidate.accommodationProfile.directBooking,
    });

    if (error) {
      throw new Error(error.message);
    }
  }

  if (candidate.poiKind === "logistics") {
    const { error } = await supabase.from("logistics_profiles").upsert({
      poi_id: poiId,
      logistics_type: candidate.logisticsProfile.logisticsType || null,
      fuel_types: toTextArray(candidate.logisticsProfile.fuelTypes),
      charger_types: toTextArray(candidate.logisticsProfile.chargerTypes),
      potable_water: candidate.logisticsProfile.potableWater,
      seasonal_notes: candidate.logisticsProfile.seasonalNotes || null,
    });

    if (error) {
      throw new Error(error.message);
    }
  }
}

function printWriteSummary(result) {
  console.log(`Inserted POIs: ${result.inserted}`);
  console.log(`Skipped existing sources: ${result.skippedExisting}`);
  console.log("Inserted by category:");
  console.table(result.insertedByKind);

  if (result.errors.length > 0) {
    console.log("Insert errors:");
    console.table(result.errors);
  }
}

function ensureUniqueSlug(name, existingSlugs, source) {
  const baseSlug = slugify(name) || "poi";

  if (!existingSlugs.has(baseSlug)) {
    return baseSlug;
  }

  const sourceSuffix = source.split(":").slice(-1)[0];
  const candidate = `${baseSlug}-${sourceSuffix}`;

  if (!existingSlugs.has(candidate)) {
    return candidate;
  }

  let index = 2;

  while (existingSlugs.has(`${candidate}-${index}`)) {
    index += 1;
  }

  return `${candidate}-${index}`;
}

function buildPointValue(latitude, longitude) {
  return `SRID=4326;POINT(${longitude} ${latitude})`;
}

function toNullableInteger(value) {
  if (!value || !String(value).trim()) {
    return null;
  }

  return Number.parseInt(String(value), 10);
}

function toNullableFloat(value) {
  if (!value || !String(value).trim()) {
    return null;
  }

  return Number.parseFloat(String(value));
}

function toTextArray(value) {
  if (!value || !String(value).trim()) {
    return [];
  }

  return String(value)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeUrl(value) {
  if (!value || typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();

  if (!trimmed) {
    return null;
  }

  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }

  return `https://${trimmed}`;
}

function isAffirmativeTag(value) {
  return ["yes", "true", "1", "designated", "permissive"].includes(value);
}

function firstTruthy(...values) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return null;
}

function joinNonEmpty(values, separator) {
  return values.filter(Boolean).join(separator);
}

function escapeRegExpList(values) {
  return values.map((value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");
}

function slugify(value) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function countBy(items, getKey) {
  const counts = {};

  for (const item of items) {
    const key = getKey(item);
    counts[key] = (counts[key] ?? 0) + 1;
  }

  return counts;
}

function applyCategoryBalancedLimit(candidates, limit) {
  const grouped = new Map();

  for (const category of ALL_CATEGORIES) {
    grouped.set(category, []);
  }

  for (const candidate of candidates) {
    grouped.get(candidate.poiKind)?.push(candidate);
  }

  const limited = [];
  let addedInPass = true;

  while (limited.length < limit && addedInPass) {
    addedInPass = false;

    for (const category of ALL_CATEGORIES) {
      const bucket = grouped.get(category);

      if (!bucket || bucket.length === 0) {
        continue;
      }

      const nextCandidate = bucket.shift();

      if (!nextCandidate) {
        continue;
      }

      limited.push(nextCandidate);
      addedInPass = true;

      if (limited.length >= limit) {
        break;
      }
    }
  }

  return limited;
}