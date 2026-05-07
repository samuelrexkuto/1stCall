import { z } from "zod";

export const uuidSchema = z.string().uuid();

export const ACCEPTED_ASSIGNMENT_STATUSES = [
  "accepted",
  "selected_for_release",
  "released_to_client",
  "worker_accepted",
] as const;

export const RELEASED_WORKFORCE_SELECT =
  "id, job_id, worker_id, assignment_status, accepted_at, accepted_by_worker_at, selected_for_release_at, released_to_client_at, released_by_admin, workers(id, full_name, phone, email, primary_role, town, postcode, location_display, right_to_work, contract_signed, cscs_uploaded, certificates_uploaded, portfolio_uploaded, reliability_score)";

export function getAcceptedAt(row: Record<string, unknown>) {
  return typeof row.accepted_at === "string"
    ? row.accepted_at
    : typeof row.accepted_by_worker_at === "string"
      ? row.accepted_by_worker_at
      : null;
}

export function normalizeAssignmentStatus(status: unknown) {
  if (status === "worker_accepted") return "accepted";
  if (status === "worker_declined") return "rejected";
  return typeof status === "string" ? status : "pending";
}

function getWorker(row: Record<string, unknown>) {
  const nested = row.workers;
  if (Array.isArray(nested)) return nested[0] as Record<string, unknown> | undefined;
  return nested && typeof nested === "object" ? nested as Record<string, unknown> : undefined;
}

export function toWorkerAssignmentPayload(row: Record<string, unknown>) {
  const worker = getWorker(row) ?? {};
  const workerType =
    typeof worker.primary_role === "string" && worker.primary_role.trim()
      ? worker.primary_role
      : "Tradesman";
  const location = [worker.location_display, worker.town, worker.postcode]
    .filter((value) => typeof value === "string" && value.trim())
    .map(String)[0] ?? null;
  const compliance = [
    worker.right_to_work ? "Right to work" : null,
    worker.contract_signed ? "Contract signed" : null,
    worker.cscs_uploaded ? "CSCS" : null,
    worker.certificates_uploaded ? "Certificates" : null,
  ].filter(Boolean);

  return {
    assignment_id: String(row.id),
    worker_id: String(row.worker_id),
    assignment_status: normalizeAssignmentStatus(row.assignment_status),
    accepted_at: getAcceptedAt(row),
    selected_for_release_at: typeof row.selected_for_release_at === "string" ? row.selected_for_release_at : null,
    released_to_client_at: typeof row.released_to_client_at === "string" ? row.released_to_client_at : null,
    worker: {
      id: String(worker.id ?? row.worker_id),
      name: typeof worker.full_name === "string" ? worker.full_name : "Workforce",
      role: typeof worker.primary_role === "string" ? worker.primary_role : null,
      workforce_type: workerType,
      location,
      postcode: typeof worker.postcode === "string" ? worker.postcode : null,
      phone: typeof worker.phone === "string" ? worker.phone : null,
      email: typeof worker.email === "string" ? worker.email : null,
      site_score: typeof worker.site_score === "number"
        ? worker.site_score
        : typeof worker.reliability_score === "number"
          ? worker.reliability_score
          : null,
      compliance_summary: compliance,
      portfolio_available: Boolean(worker.portfolio_uploaded),
    },
  };
}
