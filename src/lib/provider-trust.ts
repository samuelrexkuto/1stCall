export type ProviderPaymentReliabilityStatus =
  | "limited_data"
  | "strong"
  | "moderate"
  | "at_risk"
  | "under_review";

export type WorkerPaymentTrustLabel =
  | "Payment Reliability: Strong"
  | "Payment Reliability: Moderate"
  | "Payment Reliability: Limited Data"
  | "Payment Reliability: Under Review";

export type PlatformBackedStatus =
  | "none"
  | "proposed"
  | "approved"
  | "active"
  | "completed"
  | "revoked";

export const PAYMENT_RELIABILITY_LABELS: Record<ProviderPaymentReliabilityStatus, string> = {
  limited_data: "Limited Data",
  strong: "Strong",
  moderate: "Moderate",
  at_risk: "At Risk",
  under_review: "Under Review",
};

export const PLATFORM_BACKED_STATUS_LABELS: Record<PlatformBackedStatus, string> = {
  none: "None",
  proposed: "Proposed",
  approved: "Approved",
  active: "Active",
  completed: "Completed",
  revoked: "Revoked",
};

export function normalisePaymentReliabilityStatus(
  value: unknown,
): ProviderPaymentReliabilityStatus {
  return value === "strong" ||
    value === "moderate" ||
    value === "at_risk" ||
    value === "under_review" ||
    value === "limited_data"
    ? value
    : "limited_data";
}

export function getPaymentReliabilityLabel(value: unknown) {
  return PAYMENT_RELIABILITY_LABELS[normalisePaymentReliabilityStatus(value)];
}

export function getWorkerFacingPaymentReliabilityLabel(
  value: unknown,
): WorkerPaymentTrustLabel {
  const status = normalisePaymentReliabilityStatus(value);

  if (status === "strong") return "Payment Reliability: Strong";
  if (status === "moderate") return "Payment Reliability: Moderate";
  if (status === "limited_data") return "Payment Reliability: Limited Data";

  return "Payment Reliability: Under Review";
}

export function normalisePlatformBackedStatus(value: unknown): PlatformBackedStatus {
  return value === "proposed" ||
    value === "approved" ||
    value === "active" ||
    value === "completed" ||
    value === "revoked" ||
    value === "none"
    ? value
    : "none";
}

export function getPlatformBackedStatusLabel(value: unknown) {
  return PLATFORM_BACKED_STATUS_LABELS[normalisePlatformBackedStatus(value)];
}

export function getPlatformBackedTrustLabel(job: {
  platform_backed_job?: boolean | null;
  platform_backed_status?: string | null;
  worker_payment_protected?: boolean | null;
}) {
  if (!job.platform_backed_job) return null;
  if (job.worker_payment_protected) return "Payment Protected by Platform";

  const status = normalisePlatformBackedStatus(job.platform_backed_status);
  if (status === "active" || status === "approved") return "Platform Payment Support Active";
  return "Platform-Backed Job";
}
