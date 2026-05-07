export interface ResolvedLocationPayload {
  location_text: string | null;
  location_display: string | null;
  location_query: string | null;
  formatted_address: string | null;
  place_id: string | null;
  postcode: string | null;
  locality: string | null;
  administrative_area: string | null;
  country: string | null;
  latitude: number | null;
  longitude: number | null;
}

export interface BuildResolvedLocationPayloadResult {
  location: ResolvedLocationPayload;
  isConfirmed: boolean;
  isUnresolved: boolean;
  preservedExisting: boolean;
  shouldResolveCoordinates: boolean;
}

function normalizeText(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function createEmptyResolvedLocation(locationText: string | null = null): ResolvedLocationPayload {
  return {
    location_text: locationText,
    location_display: locationText,
    location_query: null,
    formatted_address: null,
    place_id: null,
    postcode: null,
    locality: null,
    administrative_area: null,
    country: null,
    latitude: null,
    longitude: null,
  };
}

export function hasValidCoordinates(location: Pick<ResolvedLocationPayload, "latitude" | "longitude">) {
  return typeof location.latitude === "number" && Number.isFinite(location.latitude) &&
    typeof location.longitude === "number" && Number.isFinite(location.longitude);
}

export function formatLocationLabel(location: Partial<ResolvedLocationPayload>) {
  const localityAndPostcode = [normalizeText(location.locality), normalizeText(location.postcode)]
    .filter(Boolean)
    .join(", ");

  return (
    normalizeText(location.location_display) ??
    normalizeText(location.formatted_address) ??
    (localityAndPostcode || null) ??
    normalizeText(location.location_text) ??
    null
  );
}

export function normalizeLocationPayload(location: Partial<ResolvedLocationPayload>): ResolvedLocationPayload {
  const normalized: ResolvedLocationPayload = {
    location_text: normalizeText(location.location_text),
    location_display: normalizeText(location.location_display),
    location_query: normalizeText(location.location_query),
    formatted_address: normalizeText(location.formatted_address),
    place_id: normalizeText(location.place_id),
    postcode: normalizeText(location.postcode),
    locality: normalizeText(location.locality),
    administrative_area: normalizeText(location.administrative_area),
    country: normalizeText(location.country),
    latitude:
      typeof location.latitude === "number" && Number.isFinite(location.latitude) ? Number(location.latitude) : null,
    longitude:
      typeof location.longitude === "number" && Number.isFinite(location.longitude) ? Number(location.longitude) : null,
  };

  normalized.location_display = formatLocationLabel(normalized);
  normalized.location_query =
    normalized.formatted_address ??
    normalized.location_display ??
    normalized.location_text ??
    null;

  return normalized;
}

export function buildResolvedLocationPayload({
  input,
  rawText,
  existing,
}: {
  input: Partial<ResolvedLocationPayload>;
  rawText?: string | null;
  existing?: Partial<ResolvedLocationPayload> | null;
}): BuildResolvedLocationPayloadResult {
  const incoming = normalizeLocationPayload({
    ...input,
    location_text: normalizeText(input.location_text) ?? normalizeText(rawText),
  });
  const existingLocation = existing ? normalizeLocationPayload(existing) : null;

  if (isConfirmedLocation(incoming)) {
    return {
      location: incoming,
      isConfirmed: true,
      isUnresolved: false,
      preservedExisting: false,
      shouldResolveCoordinates:
        !hasValidCoordinates(incoming) && Boolean(incoming.place_id || incoming.formatted_address),
    };
  }

  const incomingDisplayText =
    normalizeText(rawText) ??
    normalizeText(incoming.location_text) ??
    normalizeText(incoming.location_display) ??
    normalizeText(incoming.formatted_address);

  if (
    existingLocation &&
    isConfirmedLocation(existingLocation) &&
    incomingDisplayText &&
    [
      normalizeText(existingLocation.location_text),
      normalizeText(existingLocation.location_display),
      normalizeText(existingLocation.formatted_address),
    ].includes(incomingDisplayText)
  ) {
    return {
      location: existingLocation,
      isConfirmed: true,
      isUnresolved: false,
      preservedExisting: true,
      shouldResolveCoordinates: false,
    };
  }

  return {
    location: createEmptyResolvedLocation(incomingDisplayText),
    isConfirmed: false,
    isUnresolved: Boolean(incomingDisplayText),
    preservedExisting: false,
    shouldResolveCoordinates: false,
  };
}

export function buildJobCompatibilityLocation(location: ResolvedLocationPayload) {
  return {
    area: location.locality ?? location.administrative_area ?? location.location_display ?? null,
    postcode: location.postcode ?? null,
  };
}

export function buildWorkerCompatibilityLocation(location: ResolvedLocationPayload) {
  return {
    town: location.locality ?? location.administrative_area ?? null,
    postcode: location.postcode ?? null,
  };
}

export function isConfirmedLocation(location: Partial<ResolvedLocationPayload>) {
  return hasValidCoordinates({
    latitude: typeof location.latitude === "number" ? location.latitude : null,
    longitude: typeof location.longitude === "number" ? location.longitude : null,
  }) || Boolean(normalizeText(location.place_id));
}
