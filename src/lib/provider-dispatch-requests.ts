export const DISPATCH_REQUEST_ERROR_MESSAGE =
  "Dispatch request could not be completed. Please try again or contact support.";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function getSelectedDispatchWorkerIds(metadata: Record<string, unknown>) {
  return Array.isArray(metadata.worker_ids)
    ? metadata.worker_ids.filter((workerId): workerId is string => typeof workerId === "string" && workerId.trim() !== "")
    : [];
}

export function toNullableUuid(value: unknown) {
  return typeof value === "string" && UUID_PATTERN.test(value) ? value : null;
}

export function buildProviderAuditEventInsert(input: {
  providerId: string;
  actorUserId: string | null;
  eventType: string;
  metadata: Record<string, unknown>;
}) {
  const entityId = toNullableUuid(input.metadata.job_id);

  return {
    provider_id: input.providerId,
    actor_user_id: toNullableUuid(input.actorUserId),
    event_type: input.eventType,
    entity_type: entityId ? "job" : null,
    entity_id: entityId,
    metadata: input.metadata,
  };
}

export function buildLegacyProviderAuditEventInsert(input: {
  providerId: string;
  eventType: string;
  metadata: Record<string, unknown>;
}) {
  return {
    provider_id: input.providerId,
    event_type: input.eventType,
    metadata: input.metadata,
  };
}

export function isProviderAuditSchemaError(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const record = error as Record<string, unknown>;
  const code = typeof record.code === "string" ? record.code : "";
  const message = typeof record.message === "string" ? record.message.toLowerCase() : "";
  const details = typeof record.details === "string" ? record.details.toLowerCase() : "";
  const hint = typeof record.hint === "string" ? record.hint.toLowerCase() : "";
  const text = [message, details, hint].join(" ");

  return (
    code === "PGRST205" ||
    code === "PGRST204" ||
    (text.includes("provider_audit_events") && (text.includes("schema cache") || text.includes("could not find")))
  );
}

export function shouldRetryProviderAuditLegacyInsert(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const record = error as Record<string, unknown>;
  const code = typeof record.code === "string" ? record.code : "";
  const message = typeof record.message === "string" ? record.message.toLowerCase() : "";
  const details = typeof record.details === "string" ? record.details.toLowerCase() : "";
  const hint = typeof record.hint === "string" ? record.hint.toLowerCase() : "";
  const text = [message, details, hint].join(" ");

  return (
    code === "PGRST204" ||
    text.includes("actor_user_id") ||
    text.includes("entity_type") ||
    text.includes("entity_id")
  );
}

export function getProviderAuditClientError(eventType: string, error: unknown) {
  if (eventType === "dispatch_requested") return DISPATCH_REQUEST_ERROR_MESSAGE;
  if (isProviderAuditSchemaError(error)) return "Provider activity could not be recorded right now.";
  return "Unable to record provider event.";
}
