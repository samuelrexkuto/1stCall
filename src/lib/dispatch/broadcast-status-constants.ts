export const BROADCAST_STATUSES = {
  READY: "broadcast ready",
  AWAITING_RESPONSE: "awaiting response",
  COMPLETED: "completed",
} as const;

export type BroadcastStatus = (typeof BROADCAST_STATUSES)[keyof typeof BROADCAST_STATUSES];

export const BROADCAST_STATUS_OPTIONS = [
  BROADCAST_STATUSES.READY,
  BROADCAST_STATUSES.AWAITING_RESPONSE,
  BROADCAST_STATUSES.COMPLETED,
] as const;

export const BROADCAST_STATUS_LABELS: Record<BroadcastStatus, string> = {
  [BROADCAST_STATUSES.READY]: "Broadcast ready",
  [BROADCAST_STATUSES.AWAITING_RESPONSE]: "Awaiting response",
  [BROADCAST_STATUSES.COMPLETED]: "Completed",
};

export function isBroadcastStatus(value: unknown): value is BroadcastStatus {
  return typeof value === "string" && BROADCAST_STATUS_OPTIONS.includes(value as BroadcastStatus);
}

export function normaliseBroadcastStatus(status: string | null | undefined): BroadcastStatus {
  const normalized = (status ?? "").trim().toLowerCase();
  if (normalized === BROADCAST_STATUSES.AWAITING_RESPONSE || normalized === "broadcasting" || normalized === "sent") {
    return BROADCAST_STATUSES.AWAITING_RESPONSE;
  }
  if (normalized === BROADCAST_STATUSES.COMPLETED) return BROADCAST_STATUSES.COMPLETED;
  return BROADCAST_STATUSES.READY;
}
