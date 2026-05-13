import type { createAdminSupabaseClient } from "@/lib/supabase/admin";

type SupabaseAdminClient = ReturnType<typeof createAdminSupabaseClient>;

const ASSIGNMENT_SELECT =
  "id, job_id, worker_id, provider_id, requested_by_client, requested_by_client_at, requested_rank, dispatch_status, accepted_at, declined_at, dispatched_at, no_response_at, confirmed_for_job, confirmed_at, released_to_client, released_to_client_at, payment_cycle, payment_status, created_at, updated_at";
const ASSIGNMENT_FALLBACK_SELECT =
  "id, job_id, worker_id, provider_id, requested_by_client, requested_by_client_at, requested_rank, payment_cycle, payment_status, created_at";
const WORKER_SELECT =
  "id, full_name, phone, email, primary_role, location_display, town, postcode, profile_image_url, avatar_url, card_image_url";
const WORKER_FALLBACK_SELECT =
  "id, full_name, primary_role, town, postcode";

export interface RequestedAssignmentRow {
  id: string;
  job_id: string;
  worker_id: string;
  provider_id?: string | null;
  requested_by_client?: boolean | null;
  requested_by_client_at?: string | null;
  requested_rank?: number | null;
  dispatch_status?: string | null;
  accepted_at?: string | null;
  declined_at?: string | null;
  dispatched_at?: string | null;
  no_response_at?: string | null;
  confirmed_for_job?: boolean | null;
  confirmed_at?: string | null;
  released_to_client?: boolean | null;
  released_to_client_at?: string | null;
  payment_cycle?: string | null;
  payment_status?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface RequestedWorkforceRecord {
  id: string;
  workerId: string;
  assignmentId: string;
  name: string;
  primaryRole: string;
  workforceType: string;
  area: string | null;
  postcode: string | null;
  phone: string | null;
  mobile: string | null;
  email: string | null;
  avatarUrl: string | null;
  requestedRank: number;
  requestedByClient: true;
  requestedAt: string | null;
  dispatchStatus: string;
  dispatch_status: string;
  status: "Requested by client";
  paymentCycle: string | null;
  paymentStatus: string | null;
  acceptedAt?: string | null;
  declinedAt?: string | null;
  dispatchedAt?: string | null;
  noResponseAt?: string | null;
  confirmedForJob?: boolean;
  confirmed_for_job?: boolean;
  confirmedAt?: string | null;
  confirmed_at?: string | null;
  releasedToClient?: boolean;
  released_to_client?: boolean;
  releasedToClientAt?: string | null;
  released_to_client_at?: string | null;
  contactDetailsReleased: boolean;
  canViewContactDetails: boolean;
}

interface LoadRequestedWorkforceOptions {
  viewerRole?: string | null;
}

async function loadAssignments(supabase: SupabaseAdminClient, jobId: string) {
  let result = await supabase
    .from("job_worker_assignments")
    .select(ASSIGNMENT_SELECT)
    .eq("job_id", jobId)
    .eq("requested_by_client", true)
    .order("requested_rank", { ascending: true, nullsFirst: false })
    .order("requested_by_client_at", { ascending: true, nullsFirst: false });

  if (result.error?.code === "42703") {
    result = await supabase
      .from("job_worker_assignments")
      .select(ASSIGNMENT_FALLBACK_SELECT)
      .eq("job_id", jobId)
      .eq("requested_by_client", true)
      .order("requested_rank", { ascending: true, nullsFirst: false })
      .order("requested_by_client_at", { ascending: true, nullsFirst: false }) as typeof result;
  }

  if (result.error) throw result.error;
  return (result.data ?? []) as RequestedAssignmentRow[];
}

async function loadWorkersById(supabase: SupabaseAdminClient, workerIds: string[]) {
  if (workerIds.length === 0) return new Map<string, Record<string, unknown>>();

  let result = await supabase
    .from("workers")
    .select(WORKER_SELECT)
    .in("id", workerIds);

  if (result.error?.code === "42703") {
    result = await supabase
      .from("workers")
      .select(WORKER_FALLBACK_SELECT)
      .in("id", workerIds) as typeof result;
  }

  if (result.error) throw result.error;

  return new Map(
    ((result.data ?? []) as Array<Record<string, unknown>>).map((worker) => [String(worker.id), worker]),
  );
}

async function loadWorkerImagesById(supabase: SupabaseAdminClient, workerIds: string[]) {
  if (workerIds.length === 0) return new Map<string, string>();

  const imageByWorkerId = new Map<string, string>();
  const { data, error } = await supabase
    .from("worker_documents")
    .select("worker_id, file_url, mime_type, file_name, created_at")
    .in("worker_id", workerIds)
    .eq("document_type", "portfolio")
    .not("file_url", "is", null)
    .order("created_at", { ascending: false });

  if (error) return imageByWorkerId;

  for (const row of data ?? []) {
    const workerId = String(row.worker_id);
    if (imageByWorkerId.has(workerId)) continue;
    const fileUrl = typeof row.file_url === "string" ? row.file_url : "";
    const mimeType = typeof row.mime_type === "string" ? row.mime_type : "";
    const fileName = typeof row.file_name === "string" ? row.file_name : "";
    if (fileUrl && (mimeType.startsWith("image/") || /\.(png|jpe?g|webp|gif|bmp|svg)$/i.test(fileName))) {
      imageByWorkerId.set(workerId, fileUrl);
    }
  }

  return imageByWorkerId;
}

export async function loadRequestedWorkforceForJob(
  supabase: SupabaseAdminClient,
  jobId: string,
  options: LoadRequestedWorkforceOptions = {},
): Promise<RequestedWorkforceRecord[]> {
  const assignments = await loadAssignments(supabase, jobId);
  const workerIds = assignments.map((row) => String(row.worker_id)).filter(Boolean);
  const uniqueWorkerIds = [...new Set(workerIds)];
  const workerById = await loadWorkersById(supabase, uniqueWorkerIds);
  const workerImageById = await loadWorkerImagesById(supabase, uniqueWorkerIds);

  return assignments.map((assignment, index) => {
    const worker = workerById.get(String(assignment.worker_id)) ?? {};
    const workerId = String(assignment.worker_id);
    const dispatchStatus = assignment.dispatch_status ?? "requested";
    const isAccepted = dispatchStatus === "accepted";
    const isAdmin = options.viewerRole === undefined || options.viewerRole === "admin";
    const canExposeContactDetails = isAdmin || isAccepted;
    const primaryRole =
      typeof worker.primary_role === "string" && worker.primary_role.trim()
        ? worker.primary_role
        : "Not provided";
    const area =
      typeof worker.location_display === "string" && worker.location_display.trim()
        ? worker.location_display
        : typeof worker.town === "string" && worker.town.trim()
          ? worker.town
          : null;

    return {
      id: workerId,
      workerId,
      assignmentId: String(assignment.id),
      name:
        typeof worker.full_name === "string" && worker.full_name.trim()
          ? worker.full_name
          : "Unnamed worker",
      primaryRole,
      workforceType: primaryRole || "Tradesman",
      area,
      postcode: typeof worker.postcode === "string" ? worker.postcode : null,
      phone: canExposeContactDetails && typeof worker.phone === "string" ? worker.phone : null,
      mobile: null,
      email: canExposeContactDetails && typeof worker.email === "string" ? worker.email : null,
      avatarUrl:
        (typeof worker.profile_image_url === "string" && worker.profile_image_url) ||
        (typeof worker.avatar_url === "string" && worker.avatar_url) ||
        (typeof worker.card_image_url === "string" && worker.card_image_url) ||
        workerImageById.get(workerId) ||
        null,
      requestedRank: assignment.requested_rank ?? index + 1,
      requestedByClient: true,
      requestedAt: assignment.requested_by_client_at ?? assignment.created_at ?? null,
      dispatchStatus,
      dispatch_status: dispatchStatus,
      status: "Requested by client",
      paymentCycle: assignment.payment_cycle ?? null,
      paymentStatus: assignment.payment_status ?? null,
      acceptedAt: assignment.accepted_at ?? null,
      declinedAt: assignment.declined_at ?? null,
      dispatchedAt: assignment.dispatched_at ?? null,
      noResponseAt: assignment.no_response_at ?? null,
      confirmedForJob: Boolean(assignment.confirmed_for_job),
      confirmed_for_job: Boolean(assignment.confirmed_for_job),
      confirmedAt: assignment.confirmed_at ?? null,
      confirmed_at: assignment.confirmed_at ?? null,
      releasedToClient: Boolean(assignment.released_to_client),
      released_to_client: Boolean(assignment.released_to_client),
      releasedToClientAt: assignment.released_to_client_at ?? null,
      released_to_client_at: assignment.released_to_client_at ?? null,
      contactDetailsReleased: isAdmin || isAccepted,
      canViewContactDetails: isAdmin || isAccepted,
    };
  });
}

export async function verifyRequestedAssignmentRows(
  supabase: SupabaseAdminClient,
  jobId: string,
) {
  return loadAssignments(supabase, jobId);
}
