export type WorkerLocationPrecision = "full_postcode" | "postcode_district" | "town";
export type JobLocationPrecision = "full_postcode" | "postcode_area" | "custom_address";

export interface GeocodeResult {
  latitude: number;
  longitude: number;
  source: "manual" | "google_geocoding" | "nominatim";
  matched_query: string;
}

export interface StructuredLocationDetails {
  location_display: string | null;
  location_query: string | null;
  location_precision: string | null;
}

interface WorkerLocationInput {
  town?: string | null;
  postcode?: string | null;
  locationDisplay?: string | null;
  locationQuery?: string | null;
  locationPrecision?: WorkerLocationPrecision | null;
}

interface JobLocationInput {
  area?: string | null;
  postcode?: string | null;
  locationDisplay?: string | null;
  locationQuery?: string | null;
  locationPrecision?: JobLocationPrecision | null;
}

interface ResolveCoordinatesInput {
  placeId?: string | null;
  formattedAddress?: string | null;
  locationQuery?: string | null;
  fallbackQueries?: string[];
  manualLatitude?: number | null;
  manualLongitude?: number | null;
}

function isFiniteCoordinate(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value);
}

function normalizePart(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function withUnitedKingdom(parts: Array<string | null | undefined>) {
  return [...parts.map(normalizePart), "United Kingdom"]
    .filter((value, index, array): value is string => Boolean(value) && array.indexOf(value as string) === index)
    .join(", ");
}

function toDisplay(parts: Array<string | null | undefined>) {
  return parts.map(normalizePart).filter(Boolean).join(", ") || null;
}

export function derivePostcodeDistrict(postcode: string | null | undefined) {
  const normalizedPostcode = normalizePart(postcode);
  if (!normalizedPostcode) {
    return null;
  }

  const match = normalizedPostcode.toUpperCase().match(/^([A-Z]{1,2}\d[A-Z\d]?)/);
  return match?.[1] ?? normalizedPostcode.split(/\s+/)[0] ?? null;
}

export function extractUkPostcode(value: string | null | undefined) {
  const normalized = normalizePart(value);
  if (!normalized) {
    return null;
  }

  const match = normalized.toUpperCase().match(/\b([A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2})\b/);
  return match?.[1]?.replace(/\s+/, " ") ?? null;
}

function uniqueQueries(queries: Array<string | null | undefined>) {
  return queries
    .map((query) => query?.trim() ?? "")
    .filter((query, index, array) => query.length > 0 && array.indexOf(query) === index);
}

function getGoogleMapsApiKey() {
  return process.env.GOOGLE_MAPS_API_KEY?.trim() || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY?.trim() || "";
}

function shouldTrustManualLocationQuery(query: string) {
  const normalized = query.trim();

  if (!normalized) {
    return false;
  }

  if (extractUkPostcode(normalized)) {
    return true;
  }

  if (normalized.includes(",") && normalized.length >= 12) {
    return true;
  }

  return /\d/.test(normalized) && normalized.length >= 8;
}

export function buildWorkerFallbackQueries(
  town: string | null | undefined,
  postcode: string | null | undefined,
) {
  const normalizedTown = normalizePart(town);
  const normalizedPostcode = normalizePart(postcode);

  return uniqueQueries([
    withUnitedKingdom([normalizedPostcode]),
    withUnitedKingdom([normalizedPostcode, normalizedTown]),
    withUnitedKingdom([normalizedTown]),
  ]);
}

export function buildJobFallbackQueries(
  area: string | null | undefined,
  postcode: string | null | undefined,
) {
  const normalizedArea = normalizePart(area);
  const normalizedPostcode = normalizePart(postcode);

  return uniqueQueries([
    withUnitedKingdom([normalizedPostcode]),
    withUnitedKingdom([normalizedPostcode, normalizedArea]),
    withUnitedKingdom([normalizedArea]),
  ]);
}

export function buildWorkerLocationDetails(input: WorkerLocationInput): StructuredLocationDetails {
  const normalizedTown = normalizePart(input.town);
  const normalizedDisplay = normalizePart(input.locationDisplay);
  const normalizedPostcode = normalizePart(input.postcode) ?? extractUkPostcode(normalizedDisplay);
  const postcodeDistrict = derivePostcodeDistrict(normalizedPostcode);
  const normalizedQuery = normalizePart(input.locationQuery);
  const precision = input.locationPrecision ?? "postcode_district";

  if (normalizedQuery && precision === "full_postcode") {
    return {
      location_display: normalizedDisplay ?? toDisplay([normalizedPostcode]),
      location_query: normalizedQuery,
      location_precision: precision,
    };
  }

  if (precision === "full_postcode") {
    return {
      location_display: normalizedDisplay ?? toDisplay([normalizedPostcode]),
      location_query: withUnitedKingdom([normalizedPostcode ?? normalizedDisplay]),
      location_precision: precision,
    };
  }

  if (precision === "town") {
    return {
      location_display: normalizedDisplay ?? toDisplay([normalizedTown]),
      location_query: withUnitedKingdom([normalizedDisplay ?? normalizedTown]),
      location_precision: precision,
    };
  }

  return {
    location_display: normalizedDisplay ?? toDisplay([postcodeDistrict, normalizedTown]),
    location_query: withUnitedKingdom([postcodeDistrict, normalizedTown ?? "London"]),
    location_precision: "postcode_district",
  };
}

export function buildJobLocationDetails(input: JobLocationInput): StructuredLocationDetails {
  const normalizedArea = normalizePart(input.area);
  const normalizedDisplay = normalizePart(input.locationDisplay);
  const normalizedPostcode = normalizePart(input.postcode) ?? extractUkPostcode(normalizedDisplay);
  const postcodeDistrict = derivePostcodeDistrict(normalizedPostcode);
  const normalizedQuery = normalizePart(input.locationQuery);
  const precision =
    input.locationPrecision ??
    (normalizedDisplay ? "custom_address" : normalizedPostcode ? "full_postcode" : "postcode_area");

  if (normalizedQuery && precision === "full_postcode") {
    return {
      location_display: normalizedDisplay ?? toDisplay([normalizedPostcode]),
      location_query: normalizedQuery,
      location_precision: precision,
    };
  }

  if (precision === "custom_address" && normalizedDisplay) {
    return {
      location_display: normalizedDisplay,
      location_query: withUnitedKingdom([normalizedDisplay]),
      location_precision: precision,
    };
  }

  if (precision === "full_postcode") {
    return {
      location_display: normalizedDisplay ?? toDisplay([normalizedPostcode]),
      location_query: withUnitedKingdom([normalizedPostcode ?? normalizedDisplay]),
      location_precision: precision,
    };
  }

  return {
    location_display: normalizedDisplay ?? toDisplay([postcodeDistrict, normalizedArea]),
    location_query: withUnitedKingdom([postcodeDistrict, normalizedArea ?? normalizedDisplay]),
    location_precision: "postcode_area",
  };
}

async function geocodeSingleQuery(query: string) {
  const searchParams = new URLSearchParams({
    q: query,
    format: "jsonv2",
    limit: "1",
    countrycodes: "gb",
    addressdetails: "1",
  });
  const url = `https://nominatim.openstreetmap.org/search?${searchParams.toString()}`;

  console.info("[maps:geocode] request", { query, url });

  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      "User-Agent": "workforce-dispatch-local/1.0",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    console.error("[maps:geocode] request failed", {
      query,
      status: response.status,
      statusText: response.statusText,
      body: errorText.slice(0, 500),
    });
    return null;
  }

  const payload = (await response.json()) as Array<{
    lat?: string;
    lon?: string;
    display_name?: string;
  }>;
  const result = payload[0];

  console.info("[maps:geocode] response", {
    query,
    matches: payload.length,
    first: result ?? null,
  });

  if (!result?.lat || !result?.lon) {
    console.warn("[maps:geocode] no coordinate match", { query });
    return null;
  }

  const latitude = Number(result.lat);
  const longitude = Number(result.lon);

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    console.error("[maps:geocode] invalid numeric coordinate", { query, latitude, longitude });
    return null;
  }

  return {
    latitude,
    longitude,
    matched_query: query,
  };
}

async function geocodeWithGoogle(params: { address?: string | null; placeId?: string | null }) {
  const apiKey = getGoogleMapsApiKey();

  if (!apiKey) {
    return null;
  }

  const searchParams = new URLSearchParams({ key: apiKey });
  if (params.placeId?.trim()) {
    searchParams.set("place_id", params.placeId.trim());
  } else if (params.address?.trim()) {
    searchParams.set("address", params.address.trim());
  } else {
    return null;
  }

  const url = `https://maps.googleapis.com/maps/api/geocode/json?${searchParams.toString()}`;
  const response = await fetch(url, {
    headers: { Accept: "application/json" },
    cache: "no-store",
  });

  if (!response.ok) {
    return null;
  }

  const payload = (await response.json()) as {
    status?: string;
    results?: Array<{ geometry?: { location?: { lat?: number; lng?: number } } }>;
  };
  const location = payload.results?.[0]?.geometry?.location;

  if (payload.status !== "OK" || typeof location?.lat !== "number" || typeof location?.lng !== "number") {
    return null;
  }

  return {
    latitude: location.lat,
    longitude: location.lng,
  };
}

export async function resolveSavedCoordinates({
  placeId,
  formattedAddress,
  locationQuery,
  fallbackQueries = [],
  manualLatitude,
  manualLongitude,
}: ResolveCoordinatesInput): Promise<GeocodeResult | null> {
  if (isFiniteCoordinate(manualLatitude) && isFiniteCoordinate(manualLongitude)) {
    const matchedQuery = "manual place geometry";
    return {
      latitude: Number(manualLatitude),
      longitude: Number(manualLongitude),
      source: "manual",
      matched_query: matchedQuery,
    };
  }

  const normalizedPlaceId = normalizePart(placeId);
  if (normalizedPlaceId) {
    const googleResult = await geocodeWithGoogle({ placeId: normalizedPlaceId });
    if (googleResult) {
      return {
        ...googleResult,
        source: "google_geocoding",
        matched_query: `place_id:${normalizedPlaceId}`,
      };
    }
  }

  const normalizedFormattedAddress = normalizePart(formattedAddress);
  if (normalizedFormattedAddress) {
    const googleResult = await geocodeWithGoogle({ address: normalizedFormattedAddress });
    if (googleResult) {
      return {
        ...googleResult,
        source: "google_geocoding",
        matched_query: normalizedFormattedAddress,
      };
    }
  }

  const primaryQuery = normalizePart(locationQuery);
  const candidateQueries = primaryQuery
    ? [primaryQuery, ...uniqueQueries(fallbackQueries)]
    : uniqueQueries(fallbackQueries);

  for (const query of candidateQueries) {
    if (!shouldTrustManualLocationQuery(query)) {
      continue;
    }

    const nominatimResult = await geocodeSingleQuery(query);
    if (nominatimResult) {
      return {
        latitude: nominatimResult.latitude,
        longitude: nominatimResult.longitude,
        source: "nominatim",
        matched_query: nominatimResult.matched_query,
      };
    }
  }

  return null;
}

export async function geocodeLocation({
  locationQuery,
  fallbackQueries = [],
  manualLatitude,
  manualLongitude,
}: {
  locationQuery?: string | null;
  fallbackQueries?: string[];
  manualLatitude?: number | null;
  manualLongitude?: number | null;
}): Promise<GeocodeResult | null> {
  return resolveSavedCoordinates({
    locationQuery,
    fallbackQueries,
    manualLatitude,
    manualLongitude,
  });
}
