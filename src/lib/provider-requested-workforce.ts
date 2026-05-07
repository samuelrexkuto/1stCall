export function formatProviderRequestedNames(names: string[], maxVisible = 3) {
  const cleanNames = names.map((name) => name.trim()).filter(Boolean);
  if (cleanNames.length === 0) return "";

  const visible = cleanNames.slice(0, maxVisible);
  return cleanNames.length > maxVisible ? `${visible.join(", ")}, ...` : visible.join(", ");
}

export function uniqueStringList(values: string[]) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isUuid(value: string) {
  return UUID_PATTERN.test(value);
}

export function getRequestedWorkerIdsFromBody(body: unknown) {
  if (!body || typeof body !== "object") return [];
  const record = body as Record<string, unknown>;
  const raw =
    Array.isArray(record.worker_ids)
      ? record.worker_ids
      : Array.isArray(record.workforceIds)
        ? record.workforceIds
        : Array.isArray(record.selectedWorkforceIds)
          ? record.selectedWorkforceIds
          : [];

  return uniqueStringList(raw.filter((workerId): workerId is string => typeof workerId === "string"));
}
