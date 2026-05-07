import { formatLocationLabel, normalizeLocationPayload, type ResolvedLocationPayload } from "@/lib/location";

export type WorkerLocationRecord = Partial<
  ResolvedLocationPayload & {
    town: string | null;
    location_precision: string | null;
  }
>;

export type JobLocationRecord = Partial<
  ResolvedLocationPayload & {
    area: string | null;
    location_precision: string | null;
  }
>;

function normalizeText(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function normalizeWorkerLocationRecord(record: WorkerLocationRecord) {
  const normalized = normalizeLocationPayload({
    location_text: normalizeText(record.location_text) ?? normalizeText(record.location_display),
    location_display: normalizeText(record.location_display),
    location_query: normalizeText(record.location_query),
    formatted_address: normalizeText(record.formatted_address),
    place_id: normalizeText(record.place_id),
    postcode: normalizeText(record.postcode),
    locality: normalizeText(record.locality) ?? normalizeText(record.town),
    administrative_area: normalizeText(record.administrative_area),
    country: normalizeText(record.country),
    latitude: typeof record.latitude === "number" ? record.latitude : null,
    longitude: typeof record.longitude === "number" ? record.longitude : null,
  });

  return {
    ...normalized,
    town: normalized.locality ?? normalizeText(record.town),
    location_precision: normalizeText(record.location_precision),
    location_display: formatLocationLabel(normalized),
  };
}

export function normalizeJobLocationRecord(record: JobLocationRecord) {
  const normalized = normalizeLocationPayload({
    location_text: normalizeText(record.location_text) ?? normalizeText(record.location_display),
    location_display: normalizeText(record.location_display),
    location_query: normalizeText(record.location_query),
    formatted_address: normalizeText(record.formatted_address),
    place_id: normalizeText(record.place_id),
    postcode: normalizeText(record.postcode),
    locality: normalizeText(record.locality) ?? normalizeText(record.area),
    administrative_area: normalizeText(record.administrative_area),
    country: normalizeText(record.country),
    latitude: typeof record.latitude === "number" ? record.latitude : null,
    longitude: typeof record.longitude === "number" ? record.longitude : null,
  });

  return {
    ...normalized,
    area: normalized.locality ?? normalizeText(record.area),
    location_precision: normalizeText(record.location_precision),
    location_display: formatLocationLabel(normalized),
  };
}

export function isSchemaColumnMissing(message: string, table: "jobs" | "workers") {
  const lower = message.toLowerCase();
  return (
    (lower.includes(`column ${table}.`) && lower.includes("does not exist")) ||
    (lower.includes(`'${table}'`) && lower.includes("schema cache") && lower.includes("column"))
  );
}
