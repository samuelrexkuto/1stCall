import type { JobOverviewRow, MatchingWorker } from "@/components/jobs/JobOverviewTable";
import { unstable_noStore as noStore } from "next/cache";
import { formatPayRate } from "@/lib/jobs/formatPayRate";
import {
  getRecommendedWorkersForJob,
  type JobProviderJobHistoryRow,
  type SuggestedJobPost,
} from "@/lib/job-provider-ai";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { runSchemaSafeQuery } from "@/lib/supabase/schema-safe";
import { normalizeJobLocationRecord } from "@/lib/location-records";
import { loadWorkersOverview } from "@/lib/workers";
import { normalisePaymentReliabilityStatus, normalisePlatformBackedStatus } from "@/lib/provider-trust";
import { getSiteScoreStatusLabel } from "@/lib/provider-access";
import {
  getSafeWorkerSubtitle,
  getWorkerCardImage,
  getWorkerDisplayGrouping,
  getWorkerProfileImage,
} from "@/lib/worker-display";
import { calculateWorkerPaymentSummary, type LabourPaymentCycle, type LabourPaymentStatus } from "@/lib/labour-payments";
import {
  normaliseBroadcastStatus,
} from "@/lib/dispatch/broadcast-status-constants";
import { normaliseStringList } from "@/lib/stringLists";
import type { NormalisedRequestedWorkforce } from "@/lib/jobs/normaliseRequestedWorkforce";

interface ProviderRow {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  town: string | null;
  postcode: string | null;
  created_at: string;
  payment_reliability_status?: string | null;
}

interface JobRow {
  id: string;
  title: string;
  required_role: string | null;
  area: string | null;
  postcode: string | null;
  provider_id: string | null;
  job_status: string;
  fill_status: string | null;
  broadcast_status?: string | null;
  payment_status: string | null;
  headcount_required: number | null;
  headcount_confirmed: number | null;
  starts_at: string | null;
  notes: string | null;
  created_at: string;
  alert_type?: string | null;
  core_role?: string | null;
  selected_role?: string | null;
  trade?: string | null;
  location_label?: string | null;
  location_confirmed?: boolean | null;
  start_time?: string | null;
  end_time?: string | null;
  time_window?: string | null;
  duration?: string | null;
  end_date?: string | null;
  pay_rate?: string | null;
  pay_rate_amount?: number | null;
  pay_rate_unit?: string | null;
  duties?: string | null;
  dbs_required?: boolean | null;
  dbs_requirement?: string | null;
  enhanced_dbs_required?: boolean | null;
  cscs_required?: boolean | null;
  ipaf_required?: boolean | null;
  own_tools_required?: boolean | null;
  tools_required?: string | null;
  ppe_required?: boolean | null;
  ppe_detail?: string | null;
  skills_required?: unknown;
  requirements?: unknown;
  shift_pattern?: string | null;
  tickets_required?: unknown;
  certificates_required?: string | null;
  optional_supporting_notes?: string | null;
  selected_keywords?: unknown;
  payment_type?: string | null;
  location_display?: string | null;
  location_query?: string | null;
  location_text?: string | null;
  formatted_address?: string | null;
  place_id?: string | null;
  location_resolved?: boolean | null;
  locality?: string | null;
  administrative_area?: string | null;
  country?: string | null;
  invoice_status?: string | null;
  invoice_send_date?: string | null;
  invoice_due_date?: string | null;
  invoice_last_sent_at?: string | null;
  invoice_notes?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  platform_backed_job?: boolean | null;
  platform_backed_status?: string | null;
  platform_backed_note?: string | null;
  platform_backed_approved_by_admin?: boolean | null;
  platform_backed_payment_terms?: string | null;
  walk_off_clause_enabled?: boolean | null;
  worker_payment_protected?: boolean | null;
  payment_terms_days?: number | null;
  provider_agreed_terms_verified?: boolean | null;
  worker_agreed_terms_verified?: boolean | null;
}

interface JobWorkerAssignmentRow {
  id: string;
  job_id: string;
  worker_id: string;
  assignment_status: string;
  requested_by_client: boolean | null;
  requested_by_client_at?: string | null;
  requested_rank: number | null;
  dispatch_status?: string | null;
  accepted_at?: string | null;
  confirmed_for_job?: boolean | null;
  confirmed_at?: string | null;
  selected_for_release_at?: string | null;
  released_by_admin?: string | null;
  accepted_by_worker?: boolean | null;
  accepted_by_worker_at?: string | null;
  broadcast_completed?: boolean | null;
  released_to_client?: boolean | null;
  released_to_client_at?: string | null;
  confirmed_start_date: string | null;
  confirmed_end_date: string | null;
  payment_cycle: LabourPaymentCycle | null;
  payment_cycle_anchor_date: string | null;
  day_rate: number | null;
  worked_days_current_cycle: number | null;
  estimated_amount_due: number | null;
  payment_status: LabourPaymentStatus | null;
  last_payment_date: string | null;
  next_payment_due_date: string | null;
  preliminary_notice_sent_at: string | null;
  payment_notes: string | null;
  created_at: string;
}

interface RequestedWorkerDetailRow {
  id: string;
  full_name: string | null;
  phone?: string | null;
  email?: string | null;
  primary_role?: string | null;
  location_display?: string | null;
  town?: string | null;
  postcode?: string | null;
}

export interface JobsOverviewFilters {
  title: string;
  role: string;
  area: string;
  postcode: string;
  provider: string;
  job_status: string;
  fill_status: string;
  payment_status: string;
  broadcast_status: string;
}

interface JobsOverviewOptions {
  viewerProviderId?: string;
}

export interface JobsOverviewPayload {
  jobs: JobOverviewRow[];
  providers: Array<{
    id: string;
    provider_id: string;
    name: string;
    company_name: string;
    email: string | null;
    phone: string | null;
    town: string | null;
    postcode: string | null;
    created_at: string;
  }>;
  warning: string;
  capabilities: {
    invoices: boolean;
  };
}

const JOBS_SELECTS = {
  modern:
    "id, title, required_role, area, postcode, provider_id, job_status, fill_status, broadcast_status, payment_status, headcount_required, headcount_confirmed, starts_at, notes, created_at, alert_type, core_role, selected_role, trade, location_label, location_confirmed, start_time, end_time, time_window, duration, end_date, pay_rate, pay_rate_amount, pay_rate_unit, duties, dbs_required, dbs_requirement, enhanced_dbs_required, cscs_required, ipaf_required, own_tools_required, tools_required, ppe_required, ppe_detail, skills_required, requirements, shift_pattern, tickets_required, certificates_required, optional_supporting_notes, selected_keywords, payment_type, invoice_status, invoice_send_date, invoice_due_date, invoice_last_sent_at, invoice_notes, platform_backed_job, platform_backed_status, platform_backed_note, platform_backed_approved_by_admin, platform_backed_payment_terms, walk_off_clause_enabled, worker_payment_protected, payment_terms_days, provider_agreed_terms_verified, worker_agreed_terms_verified",
  noBroadcast:
    "id, title, required_role, area, postcode, provider_id, job_status, fill_status, broadcast_status, payment_status, headcount_required, headcount_confirmed, starts_at, notes, created_at, alert_type, core_role, duration, end_date, pay_rate, duties, dbs_requirement, ipaf_required, own_tools_required, ppe_required, skills_required, shift_pattern, tickets_required, optional_supporting_notes, payment_type, invoice_status, invoice_send_date, invoice_due_date, invoice_last_sent_at, invoice_notes",
  legacy:
    "id, title, required_role, area, postcode, provider_id, job_status, fill_status, broadcast_status, payment_status, headcount_required, headcount_confirmed, starts_at, notes, created_at",
} as const;

async function loadJobWorkerAssignments(
  supabase: ReturnType<typeof createAdminSupabaseClient>,
  jobIds: string[],
) {
  if (jobIds.length === 0) return [] as JobWorkerAssignmentRow[];
  const result = await supabase
    .from("job_worker_assignments")
    .select("id, job_id, worker_id, assignment_status, requested_by_client, requested_by_client_at, requested_rank, dispatch_status, accepted_at, confirmed_for_job, confirmed_at, selected_for_release_at, released_by_admin, accepted_by_worker, accepted_by_worker_at, broadcast_completed, released_to_client, released_to_client_at, confirmed_start_date, confirmed_end_date, payment_cycle, payment_cycle_anchor_date, day_rate, worked_days_current_cycle, estimated_amount_due, payment_status, last_payment_date, next_payment_due_date, preliminary_notice_sent_at, payment_notes, created_at")
    .in("job_id", jobIds);

  if (result.error) {
    if (isJobsSchemaMismatch(result.error.message) || result.error.message.toLowerCase().includes("job_worker_assignments")) {
      return [];
    }
    throw result.error;
  }
  return (result.data ?? []) as JobWorkerAssignmentRow[];
}

async function loadRequestedWorkerDetails(
  supabase: ReturnType<typeof createAdminSupabaseClient>,
  workerIds: string[],
) {
  if (workerIds.length === 0) return new Map<string, RequestedWorkerDetailRow>();
  const uniqueWorkerIds = [...new Set(workerIds)];
  let result = await supabase
    .from("workers")
    .select("id, full_name, phone, email, primary_role, location_display, town, postcode")
    .in("id", uniqueWorkerIds);

  if (result.error && result.error.code === "42703") {
    result = await supabase
      .from("workers")
      .select("id, full_name, primary_role, town, postcode")
      .in("id", uniqueWorkerIds) as typeof result;
  }

  if (result.error) {
    console.warn("[loadJobsOverview] requested workforce details lookup failed", result.error);
    return new Map<string, RequestedWorkerDetailRow>();
  }

  return new Map(
    ((result.data ?? []) as RequestedWorkerDetailRow[]).map((worker) => [String(worker.id), worker]),
  );
}

function getBroadcastStatusLabel(status: string | null | undefined) {
  return normaliseBroadcastStatus(status);
}

function getFillStatus(
  job: Pick<JobOverviewRow, "job_status" | "workers_required" | "workers_confirmed">,
) {
  if (job.job_status === "cancelled") return "Cancelled";
  if (job.job_status === "completed") return "Completed";
  if (job.workers_confirmed >= job.workers_required) return "Filled";
  if (job.workers_confirmed > 0) return "Part-filled";
  return "Open";
}

function toDispatchSummary(job: {
  title: string;
  required_role: string | null;
  area: string | null;
  postcode: string | null;
  starts_at: string | null;
  notes: string | null;
}) {
  return [
    job.required_role || "General role",
    job.area || "Area TBC",
    job.postcode || "postcode TBC",
    job.starts_at ? `starts ${job.starts_at}` : "start time TBC",
    job.notes || "No notes added",
  ].join(" | ");
}

function toJobRecommendationInput(job: JobRow, area: string | null, postcode: string): SuggestedJobPost {
  const skills = normaliseStringList(job.skills_required);
  const requirements = normaliseStringList(job.requirements);
  return {
    title: job.title,
    tradeCategory: job.selected_role ?? job.required_role ?? job.core_role ?? job.trade ?? job.title,
    coreRole: job.core_role,
    selectedRole: job.selected_role,
    requiredRole: job.required_role,
    trade: job.trade,
    quantity: Number(job.headcount_required ?? 1),
    location: area ?? postcode,
    locationLatitude: job.latitude ?? null,
    locationLongitude: job.longitude ?? null,
    startDate: job.starts_at ? String(job.starts_at).slice(0, 10) : undefined,
    durationLabel: job.duration ?? undefined,
    skillsRequired: skills,
    requirements,
    dbsRequirement: job.dbs_requirement ?? undefined,
    enhancedDbsRequired: Boolean(job.enhanced_dbs_required),
    ppeRequired: Boolean(job.ppe_required),
    ownToolsRequired: Boolean(job.own_tools_required),
    cscsRequired: Boolean(job.cscs_required),
    ipafRequired: Boolean(job.ipaf_required),
    notes: job.notes ?? undefined,
  };
}

export { normaliseStringList } from "@/lib/stringLists";

function toJobHistoryRows(jobs: JobRow[]): JobProviderJobHistoryRow[] {
  return jobs.map((job) => ({
    job_title: job.title,
    trade_type: job.required_role,
    area: job.area,
    postcode: job.postcode ?? "",
  }));
}

export function normalizeJobsSchemaError(message: string) {
  const lower = message.toLowerCase();
  if (
    lower.includes("schema cache") ||
    lower.includes("column jobs.alert_type does not exist") ||
    lower.includes("column public.jobs.alert_type does not exist") ||
    lower.includes("column jobs.end_date does not exist") ||
    lower.includes("column public.jobs.end_date does not exist") ||
    lower.includes("column jobs.pay_rate does not exist") ||
    lower.includes("column public.jobs.pay_rate does not exist") ||
    lower.includes("column jobs.pay_rate_display does not exist") ||
    lower.includes("column public.jobs.pay_rate_display does not exist") ||
    lower.includes("column jobs.broadcast_status does not exist") ||
    lower.includes("column public.jobs.broadcast_status does not exist") ||
    lower.includes("column jobs.invoice_status does not exist") ||
    lower.includes("column public.jobs.invoice_status does not exist") ||
    lower.includes("column jobs.invoice_send_date does not exist") ||
    lower.includes("column public.jobs.invoice_send_date does not exist") ||
    lower.includes("column jobs.invoice_due_date does not exist") ||
    lower.includes("column public.jobs.invoice_due_date does not exist") ||
    lower.includes("column jobs.invoice_last_sent_at does not exist") ||
    lower.includes("column public.jobs.invoice_last_sent_at does not exist") ||
    lower.includes("column jobs.invoice_notes does not exist") ||
    lower.includes("column public.jobs.invoice_notes does not exist") ||
    lower.includes("column job_providers.email does not exist") ||
    lower.includes("column public.job_providers.email does not exist") ||
    lower.includes("column job_providers.payment_reliability_status does not exist") ||
    lower.includes("column public.job_providers.payment_reliability_status does not exist") ||
    lower.includes("could not find the") ||
    lower.includes("column jobs.platform_backed_job does not exist") ||
    lower.includes("column public.jobs.platform_backed_job does not exist") ||
    lower.includes("column jobs.platform_backed_status does not exist") ||
    lower.includes("column public.jobs.platform_backed_status does not exist") ||
    lower.includes("column jobs.platform_backed_payment_terms does not exist") ||
    lower.includes("column public.jobs.platform_backed_payment_terms does not exist") ||
    lower.includes("column jobs.payment_terms_days does not exist") ||
    lower.includes("column public.jobs.payment_terms_days does not exist") ||
    lower.includes("column jobs.provider_agreed_terms_verified does not exist") ||
    lower.includes("column public.jobs.provider_agreed_terms_verified does not exist") ||
    lower.includes("column jobs.worker_agreed_terms_verified does not exist") ||
    lower.includes("column public.jobs.worker_agreed_terms_verified does not exist")
  ) {
    return "Jobs schema is not ready yet. Please run the latest database migration and reload the PostgREST schema cache.";
  }

  return message;
}

function isJobsSchemaMismatch(message: string) {
  return normalizeJobsSchemaError(message) !== message;
}

async function queryJobs(
  supabase: ReturnType<typeof createAdminSupabaseClient>,
  filters: Omit<JobsOverviewFilters, "provider" | "fill_status">,
  options: JobsOverviewOptions,
  select: string,
  supportsBroadcastFilter = false,
) {
  let jobsQuery = supabase
    .from("jobs")
    .select(select)
    .order("starts_at", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false });

  if (filters.title) jobsQuery = jobsQuery.ilike("title", `%${filters.title}%`);
  if (filters.role) jobsQuery = jobsQuery.eq("required_role", filters.role);
  if (filters.area) jobsQuery = jobsQuery.ilike("area", `%${filters.area}%`);
  if (filters.postcode) jobsQuery = jobsQuery.ilike("postcode", `%${filters.postcode}%`);
  if (filters.job_status) jobsQuery = jobsQuery.eq("job_status", filters.job_status);
  if (supportsBroadcastFilter && filters.broadcast_status) jobsQuery = jobsQuery.eq("broadcast_status", filters.broadcast_status);
  if (filters.payment_status) jobsQuery = jobsQuery.eq("payment_status", filters.payment_status);
  if (options.viewerProviderId) jobsQuery = jobsQuery.eq("provider_id", options.viewerProviderId);

  return jobsQuery;
}

export async function loadJobsOverview(
  filters: JobsOverviewFilters,
  options: JobsOverviewOptions = {},
): Promise<JobsOverviewPayload> {
  noStore();
  console.log("[loadJobsOverview] start", { filters });
  const supabase = createAdminSupabaseClient();
  const providersQueryBuilder = supabase
    .from("job_providers")
    .select("id, name, email, phone, town, postcode, created_at, payment_reliability_status");
  const scopedProvidersQueryBuilder = options.viewerProviderId
    ? providersQueryBuilder.eq("id", options.viewerProviderId)
    : providersQueryBuilder;

  const [primaryProvidersResult, primaryJobsResult] = await Promise.all([
    scopedProvidersQueryBuilder.order("name", { ascending: true }),
    runSchemaSafeQuery<JobRow[]>([
      {
        label: "jobs-modern",
        missingColumns: ["broadcast_status", "alert_type", "core_role", "selected_role", "location_label", "pay_rate_amount", "pay_rate_unit", "requirements", "ppe_detail", "enhanced_dbs_required", "own_tools_required", "selected_keywords", "end_date", "pay_rate", "invoice_status", "invoice_send_date", "invoice_due_date", "invoice_last_sent_at", "invoice_notes", "platform_backed_job", "platform_backed_status", "platform_backed_payment_terms", "payment_terms_days", "provider_agreed_terms_verified", "worker_agreed_terms_verified"],
        query: async () => await queryJobs(supabase, filters, options, JOBS_SELECTS.modern, true),
      },
      {
        label: "jobs-no-broadcast",
        missingColumns: ["alert_type", "end_date", "pay_rate", "invoice_status", "invoice_send_date", "invoice_due_date", "invoice_last_sent_at", "invoice_notes"],
        query: async () => await queryJobs(supabase, filters, options, JOBS_SELECTS.noBroadcast, true),
      },
      {
        label: "jobs-legacy",
        query: async () => await queryJobs(supabase, filters, options, JOBS_SELECTS.legacy, true),
      },
    ]),
  ]);

  let providerRows = primaryProvidersResult.data;
  let providerError = primaryProvidersResult.error;
  let jobRows = primaryJobsResult.data;
  let jobsError = primaryJobsResult.error;
  let schemaWarning: string | null = null;
  let invoiceFeaturesEnabled = primaryJobsResult.attempt === "jobs-modern" || primaryJobsResult.attempt === "jobs-no-broadcast";

  if (providerError && isJobsSchemaMismatch(providerError.message)) {
    const fallbackProvidersQueryBuilder = supabase
      .from("job_providers")
      .select("id, name, phone, town, postcode, created_at");
    const fallbackProvidersResult = await (options.viewerProviderId
      ? fallbackProvidersQueryBuilder.eq("id", options.viewerProviderId)
      : fallbackProvidersQueryBuilder)
      .order("name", { ascending: true });

    if (!fallbackProvidersResult.error) {
      providerRows = (fallbackProvidersResult.data ?? []) as unknown as typeof providerRows;
      providerError = null;
      schemaWarning = "Jobs overview is running in compatibility mode. Run the latest database migration and reload the PostgREST schema cache.";
      invoiceFeaturesEnabled = false;
    }
  }

  if (!jobsError && primaryJobsResult.usedFallback) {
    schemaWarning = "Jobs overview is running in compatibility mode. Run the latest database migration and reload the PostgREST schema cache.";
  }

  if (providerError) {
    console.error("[loadJobsOverview] provider query failed", providerError);
    throw new Error(providerError.message);
  }

  if (jobsError) {
    console.error("[loadJobsOverview] jobs query failed", jobsError);
    throw new Error(normalizeJobsSchemaError(jobsError.message));
  }

  const providers = ((providerRows ?? []) as ProviderRow[]).map((providerRow) => ({
    id: providerRow.id,
    provider_id: providerRow.id,
    name: providerRow.name,
    company_name: providerRow.name,
    email: "email" in providerRow ? providerRow.email : null,
    phone: providerRow.phone,
    town: providerRow.town,
    postcode: providerRow.postcode,
    created_at: providerRow.created_at,
  }));

  const providerNameById = new Map(providers.map((providerRow) => [providerRow.id, providerRow.name]));
  const providerPaymentReliabilityById = new Map(
    ((providerRows ?? []) as ProviderRow[]).map((providerRow) => [
      providerRow.id,
      normalisePaymentReliabilityStatus(providerRow.payment_reliability_status),
    ]),
  );

  const matchingWorkers = await loadWorkersOverview({
    name: "",
    worker_type: "",
    primary_role: "",
    location: "",
    available_today: "",
  })
    .then((payload) => payload.workers)
    .catch((error) => {
      console.warn("[loadJobsOverview] AI matching workforce load failed", error);
      return [];
    });
  const jobHistoryRows = toJobHistoryRows((jobRows ?? []) as unknown as JobRow[]);
  const jobIds = ((jobRows ?? []) as unknown as JobRow[]).map((job) => String(job.id)).filter(Boolean);
  const acceptedAssignmentsResult = jobIds.length > 0
    ? await supabase
        .from("job_worker_assignments")
        .select("job_id, worker_id")
        .in("job_id", jobIds)
        .eq("requested_by_client", true)
        .eq("dispatch_status", "accepted")
    : { data: [], error: null };

  if (acceptedAssignmentsResult.error) {
    console.error("[loadJobsOverview] failed to load accepted assignments", acceptedAssignmentsResult.error);
  }

  const acceptedWorkerIdsByJobId = new Map<string, string[]>();
  for (const row of acceptedAssignmentsResult.data ?? []) {
    const jobId = String(row.job_id);
    const current = acceptedWorkerIdsByJobId.get(jobId) || [];
    current.push(String(row.worker_id));
    acceptedWorkerIdsByJobId.set(jobId, current);
  }
  const acceptedCountByJobId = new Map(
    Array.from(acceptedWorkerIdsByJobId.entries()).map(([jobId, workerIds]) => [jobId, workerIds.length]),
  );

  const assignmentRows = await loadJobWorkerAssignments(
    supabase,
    jobIds,
  );
  const requestedWorkerDetailsById = await loadRequestedWorkerDetails(
    supabase,
    assignmentRows
      .filter((assignment) => assignment.requested_by_client)
      .map((assignment) => String(assignment.worker_id)),
  );
  const assignmentsByJobId = new Map<string, JobWorkerAssignmentRow[]>();
  for (const assignment of assignmentRows) {
    const current = assignmentsByJobId.get(String(assignment.job_id)) ?? [];
    current.push(assignment);
    assignmentsByJobId.set(String(assignment.job_id), current);
  }
  const workerById = new Map(matchingWorkers.map((worker) => [worker.worker_id, worker]));

  const jobs = ((jobRows ?? []) as unknown as JobRow[])
    .map((job) => {
      const payRateDisplay = formatPayRate(job.pay_rate, job.payment_type);
      const normalizedLocation = normalizeJobLocationRecord(job);
      const broadcastStatus = getBroadcastStatusLabel(job.broadcast_status);
      const skillsRequired = normaliseStringList(job.skills_required);
      const requirements = normaliseStringList(job.requirements);
      const ticketsRequired = normaliseStringList(job.tickets_required);
      const selectedKeywords = normaliseStringList(job.selected_keywords);
      const jobAssignments = assignmentsByJobId.get(String(job.id)) ?? [];
      const requestedWorkerById = new Map(
        jobAssignments
          .filter((assignment) => assignment.requested_by_client)
          .map((assignment) => [String(assignment.worker_id), assignment]),
      );
      const requestedWorkforce: NormalisedRequestedWorkforce[] = Array.from(requestedWorkerById.entries())
        .map(([workerId, assignment], index) => {
          const worker = workerById.get(workerId);
          const requestedDetail = requestedWorkerDetailsById.get(workerId);
          const area = worker?.location_display ?? requestedDetail?.location_display ?? worker?.town ?? requestedDetail?.town ?? null;
          const primaryRole = worker?.primary_role ?? requestedDetail?.primary_role ?? "Not provided";
          return {
            id: workerId,
            name: worker?.full_name ?? requestedDetail?.full_name ?? "Unnamed worker",
            primaryRole,
            workforceType: worker?.workerType === "contractor" ? "Contractor" : primaryRole || "Tradesman",
            area,
            postcode: worker?.postcode ?? requestedDetail?.postcode ?? null,
            matchPercentage: null,
            phone: worker?.phone ?? requestedDetail?.phone ?? null,
            email: worker?.email ?? requestedDetail?.email ?? null,
            avatarUrl: worker?.profileImageUrl ?? worker?.cardImageUrl ?? null,
            requestedRank: assignment.requested_rank ?? index + 1,
            requestedByClient: true,
            requestedAt: assignment.requested_by_client_at ?? assignment.created_at ?? null,
            dispatchStatus: assignment.dispatch_status ?? assignment.assignment_status ?? "requested",
            dispatch_status: assignment.dispatch_status ?? assignment.assignment_status ?? "requested",
            confirmedForJob: Boolean(assignment.confirmed_for_job),
            confirmed_for_job: Boolean(assignment.confirmed_for_job),
            confirmedAt: assignment.confirmed_at ?? null,
            confirmed_at: assignment.confirmed_at ?? null,
            releasedToClient: Boolean(assignment.released_to_client),
            released_to_client: Boolean(assignment.released_to_client),
            releasedToClientAt: assignment.released_to_client_at ?? null,
            released_to_client_at: assignment.released_to_client_at ?? null,
            status: "Requested by client" as const,
          };
        })
        .sort((left, right) => Number(left.requestedRank ?? 999) - Number(right.requestedRank ?? 999));
      const requestedWorkerIds = requestedWorkforce.map((worker) => worker.id);
      const acceptedWorkforce = requestedWorkforce.filter((worker) => {
        const status = worker.dispatchStatus || worker.dispatch_status;
        return status === "accepted";
      });
      const confirmedWorkforce = requestedWorkforce.filter((worker) => {
        const status = worker.dispatchStatus || worker.dispatch_status;
        return status === "accepted" || worker.confirmedForJob || worker.confirmed_for_job;
      });
      const confirmedWorkerNames = confirmedWorkforce.map((worker) => worker.name).filter(Boolean);
      const liveAcceptedWorkerIds = acceptedWorkerIdsByJobId.get(String(job.id)) || [];
      const liveAcceptedCount = acceptedCountByJobId.get(String(job.id)) ?? 0;
      const hasLiveAcceptedCounts = !acceptedAssignmentsResult.error;
      const workersConfirmed =
        hasLiveAcceptedCounts
          ? liveAcceptedCount
          : confirmedWorkforce.length ||
            acceptedWorkforce.length ||
            Number(job.headcount_confirmed ?? 0);
      const assignmentByWorkerId = new Map(
        jobAssignments.map((assignment) => [String(assignment.worker_id), assignment]),
      );
      const matchingForJobBase: MatchingWorker[] = getRecommendedWorkersForJob(
        toJobRecommendationInput(job, normalizedLocation.area, normalizedLocation.postcode ?? ""),
        jobHistoryRows,
        matchingWorkers,
      )
        .map(({ worker, recommendation }) => {
          const grouping = getWorkerDisplayGrouping(worker);
          const responseTime = worker.avgResponseTimeLabel
            ? `Avg Response Time: ${worker.avgResponseTimeLabel}`
            : "Response time not yet recorded";
          const assignment = assignmentByWorkerId.get(worker.worker_id);

          return {
            worker_id: worker.worker_id,
            full_name: worker.full_name,
            phone: worker.phone,
            primary_role: worker.primary_role,
            worker_type: worker.workerType,
            contractor_type: worker.contractorType ?? null,
            specialist_area: worker.specialistArea ?? null,
            skill_tags: worker.skill_tags,
            location_display: worker.location_display,
            town: worker.town,
            postcode: worker.postcode,
            available_today: worker.available_today,
            priority_tier: worker.priority_tier,
            whatsapp_opt_in: worker.whatsapp_opt_in,
            right_to_work: worker.right_to_work,
            contract_signed: worker.contract_signed,
            site_score: worker.stathub.overallScore,
            verified_bookings: worker.statHubMeta.verifiedCompletedJobsCount,
            match_strength: recommendation.matchStrength,
            role_score: recommendation.roleScore,
            skills_score: recommendation.skillsScore,
            compliance_score: recommendation.complianceScore,
            location_score: recommendation.locationScore,
            availability_score: recommendation.availabilityScore,
            performance_score: recommendation.performanceScore,
            match_reasons: recommendation.reasons ?? [],
            match_gaps: recommendation.gaps ?? [],
            match_reason: [
              recommendation.scoreReason,
              worker.stathub.status === "insufficient"
                ? "Evidence is still building before a mature public score is released."
                : "",
              responseTime,
            ].filter(Boolean).join(" "),
            distance_label: recommendation.distanceLabel,
            card_image_url: getWorkerCardImage(worker),
            profile_image_url: getWorkerProfileImage(worker),
            subtitle: getSafeWorkerSubtitle(worker),
            grouping_detail_label: grouping.detailLabel,
            grouping_detail_value: grouping.detailValue,
            site_score_status_label: getSiteScoreStatusLabel(worker.stathub.status),
            requested_by_client: Boolean(assignment?.requested_by_client),
            requested_rank: assignment?.requested_rank ?? null,
            assignment_status: assignment?.assignment_status ?? null,
            accepted_by_worker: Boolean(assignment?.accepted_by_worker) || assignment?.assignment_status === "accepted" || assignment?.assignment_status === "selected_for_release" || assignment?.assignment_status === "released_to_client",
            accepted_by_worker_at: assignment?.accepted_at ?? assignment?.accepted_by_worker_at ?? null,
            broadcast_completed: Boolean(assignment?.broadcast_completed),
            released_to_client: Boolean(assignment?.released_to_client) || assignment?.assignment_status === "released_to_client",
            released_to_client_at: assignment?.released_to_client_at ?? null,
          };
        })
        .sort((a, b) => {
          if (a.requested_by_client !== b.requested_by_client) return a.requested_by_client ? -1 : 1;
          if (a.requested_by_client && b.requested_by_client) {
            return Number(a.requested_rank ?? 999) - Number(b.requested_rank ?? 999);
          }
          if ((b.match_strength ?? 0) !== (a.match_strength ?? 0)) return (b.match_strength ?? 0) - (a.match_strength ?? 0);
          if (a.available_today !== b.available_today) return a.available_today ? -1 : 1;
          return (b.site_score ?? 0) - (a.site_score ?? 0);
        })
        .slice(0, 6);
      const includedWorkerIds = new Set(matchingForJobBase.map((worker) => worker.worker_id));
      const requestedOnlyWorkers: MatchingWorker[] = jobAssignments
        .filter((assignment) =>
          (assignment.requested_by_client || assignment.released_to_client || assignment.assignment_status === "released_to_client") &&
          !includedWorkerIds.has(String(assignment.worker_id)),
        )
        .flatMap((assignment) => {
          const worker = workerById.get(String(assignment.worker_id));
          if (!worker) return [];
          const grouping = getWorkerDisplayGrouping(worker);

          return [{
            worker_id: worker.worker_id,
            full_name: worker.full_name,
            phone: worker.phone,
            primary_role: worker.primary_role,
            worker_type: worker.workerType,
            contractor_type: worker.contractorType ?? null,
            specialist_area: worker.specialistArea ?? null,
            skill_tags: worker.skill_tags,
            location_display: worker.location_display,
            town: worker.town,
            postcode: worker.postcode,
            available_today: worker.available_today,
            priority_tier: worker.priority_tier,
            whatsapp_opt_in: worker.whatsapp_opt_in,
            right_to_work: worker.right_to_work,
            contract_signed: worker.contract_signed,
            site_score: worker.stathub.overallScore,
            verified_bookings: worker.statHubMeta.verifiedCompletedJobsCount,
            match_strength: 0,
            role_score: 0,
            skills_score: 0,
            compliance_score: 0,
            location_score: 0,
            availability_score: worker.available_today ? 100 : 0,
            performance_score: worker.stathub.overallScore ?? 0,
            match_reasons: ["Provider requested this workforce record."],
            match_gaps: [],
            match_reason: "Provider requested this workforce record.",
            distance_label: undefined,
            card_image_url: getWorkerCardImage(worker),
            profile_image_url: getWorkerProfileImage(worker),
            subtitle: getSafeWorkerSubtitle(worker),
            grouping_detail_label: grouping.detailLabel,
            grouping_detail_value: grouping.detailValue,
            site_score_status_label: getSiteScoreStatusLabel(worker.stathub.status),
            requested_by_client: true,
            requested_rank: assignment.requested_rank ?? null,
            assignment_status: assignment.assignment_status,
            accepted_by_worker: Boolean(assignment.accepted_by_worker) || assignment.assignment_status === "accepted" || assignment.assignment_status === "selected_for_release" || assignment.assignment_status === "released_to_client",
            accepted_by_worker_at: assignment.accepted_at ?? assignment.accepted_by_worker_at ?? null,
            broadcast_completed: Boolean(assignment.broadcast_completed),
            released_to_client: Boolean(assignment.released_to_client) || assignment.assignment_status === "released_to_client",
            released_to_client_at: assignment.released_to_client_at ?? null,
          } satisfies MatchingWorker];
        });
      const matchingForJob = [...matchingForJobBase, ...requestedOnlyWorkers].sort((a, b) => {
        if (a.requested_by_client !== b.requested_by_client) return a.requested_by_client ? -1 : 1;
        if (a.requested_by_client && b.requested_by_client) {
          return Number(a.requested_rank ?? 999) - Number(b.requested_rank ?? 999);
        }
        return (b.match_strength ?? 0) - (a.match_strength ?? 0);
      });
      const labourPayments = jobAssignments.map((assignment) => {
        const worker = workerById.get(String(assignment.worker_id));
        const summary = calculateWorkerPaymentSummary({
          assignment: assignment as unknown as Record<string, unknown>,
          worker: worker as unknown as Record<string, unknown>,
          job: job as unknown as Record<string, unknown>,
        });
        return {
          assignment_id: assignment.id,
          job_id: String(assignment.job_id),
          worker_id: String(assignment.worker_id),
          worker_name: worker?.full_name ?? "Worker",
          worker_role: worker?.primary_role ?? null,
          assignment_status: assignment.assignment_status,
          requested_by_client: Boolean(assignment.requested_by_client),
          requested_rank: assignment.requested_rank ?? null,
          payment_cycle: summary.paymentCycle,
          payment_status: summary.paymentStatus,
          last_payment_date: summary.lastPaymentDate,
          next_payment_due_date: summary.nextPaymentDueDate,
          day_rate: summary.dayRate || assignment.day_rate,
          worked_days_current_cycle: summary.workedDays,
          estimated_amount_due: summary.estimatedAmountDue,
          payment_receipt_status: summary.paymentStatus === "paid" ? "received" : "pending",
          preliminary_payment_notice_status: assignment.preliminary_notice_sent_at ? "sent" : "not_sent",
          payment_notes: assignment.payment_notes,
          cycle_start: summary.cycleStart,
          cycle_end: summary.cycleEnd,
          is_estimated: summary.isEstimated,
          alert_due: summary.alertDue,
        };
      });

      return {
        job_id: String(job.id),
        provider_id: job.provider_id ?? null,
        job_title: job.title,
        company_name: providerNameById.get(String(job.provider_id ?? "")) ?? "",
        provider_email:
          providers.find((providerRow) => providerRow.id === String(job.provider_id ?? ""))?.email ?? null,
        provider_payment_reliability_status: providerPaymentReliabilityById.get(String(job.provider_id ?? "")) ?? "limited_data",
        area: normalizedLocation.area,
        postcode: normalizedLocation.postcode ?? "",
        start_date: job.starts_at ? String(job.starts_at).slice(0, 10) : "",
        workers_required: Number(job.headcount_required ?? 0),
        workers_confirmed: workersConfirmed,
        workersConfirmed,
        confirmed_workforce_count: workersConfirmed,
        confirmedWorkerIds: liveAcceptedWorkerIds.length ? liveAcceptedWorkerIds : confirmedWorkforce.map((worker) => worker.id),
        confirmed_worker_ids: liveAcceptedWorkerIds.length ? liveAcceptedWorkerIds : confirmedWorkforce.map((worker) => worker.id),
        confirmedWorkforce,
        confirmed_workers: confirmedWorkforce,
        acceptedWorkforce,
        acceptedWorkers: acceptedWorkforce,
        accepted_workers: acceptedWorkforce,
        confirmedWorkerNames,
        confirmed_worker_names: confirmedWorkerNames,
        broadcast_status: broadcastStatus,
        payment_status: job.payment_status,
        job_status: job.job_status,
        created_at: String(job.created_at),
        trade_type: job.required_role,
        skill_tags: selectedKeywords.length ? selectedKeywords : skillsRequired,
        certificates_required: job.certificates_required ? [job.certificates_required] : ticketsRequired,
        fill_status: getFillStatus({
          job_status: job.job_status,
          workers_required: Number(job.headcount_required ?? 0),
          workers_confirmed: workersConfirmed,
        }),
        matching_workers: matchingForJob,
        requestedWorkforce,
        requested_workforce: requestedWorkforce,
        requestedWorkers: requestedWorkforce,
        requested_workers: requestedWorkforce,
        client_requested_workforce: requestedWorkforce,
        requestedWorkerIds: requestedWorkerIds,
        pay_rate: job.pay_rate ?? null,
        pay_rate_amount: job.pay_rate_amount ?? null,
        pay_rate_unit: job.pay_rate_unit ?? null,
        job_category: job.alert_type ?? null,
        job_type: job.payment_type ?? null,
        site_name: null,
        dbs_required: Boolean(job.dbs_required || (job.dbs_requirement && job.dbs_requirement !== "None")),
        short_description: toDispatchSummary(job),
        alert_type: job.alert_type ?? null,
        core_role: job.core_role ?? null,
        selected_role: job.selected_role ?? null,
        trade: job.trade ?? null,
        location_label: job.location_label ?? null,
        location_confirmed: Boolean(job.location_confirmed),
        time_window: job.time_window ?? null,
        duration: job.duration ?? null,
        end_date: job.end_date ?? null,
        end_time: job.end_time ?? null,
        start_time: job.start_time ?? (job.starts_at ? String(job.starts_at).slice(11, 16) : null),
        pay_rate_display: payRateDisplay,
        duties: job.duties ?? null,
        dbs_requirement: job.dbs_requirement ?? null,
        enhanced_dbs_required: Boolean(job.enhanced_dbs_required),
        cscs_required: Boolean(job.cscs_required),
        ipaf_required: job.ipaf_required ?? null,
        own_tools_required: job.own_tools_required ?? null,
        tools_required: job.tools_required ?? null,
        ppe_required: job.ppe_required ?? null,
        ppe_detail: job.ppe_detail ?? null,
        skills_required: skillsRequired.length ? skillsRequired : requirements,
        requirements,
        shift_pattern: job.shift_pattern ?? null,
        tickets_required: ticketsRequired,
        selected_keywords: selectedKeywords,
        optional_supporting_notes: job.optional_supporting_notes ?? null,
        payment_type: job.payment_type ?? null,
        invoice_status: job.invoice_status ?? "not_ready",
        invoice_send_date: job.invoice_send_date ?? null,
        invoice_due_date: job.invoice_due_date ?? null,
        invoice_last_sent_at: job.invoice_last_sent_at ?? null,
        invoice_notes: job.invoice_notes ?? null,
        platform_backed_job: Boolean(job.platform_backed_job),
        platform_backed_status: normalisePlatformBackedStatus(job.platform_backed_status),
        platform_backed_note: job.platform_backed_note ?? null,
        platform_backed_approved_by_admin: Boolean(job.platform_backed_approved_by_admin),
        platform_backed_payment_terms: job.platform_backed_payment_terms ?? null,
        walk_off_clause_enabled: Boolean(job.walk_off_clause_enabled),
        worker_payment_protected: Boolean(job.worker_payment_protected),
        payment_terms_days: typeof job.payment_terms_days === "number" ? job.payment_terms_days : null,
        provider_agreed_terms_verified: Boolean(job.provider_agreed_terms_verified),
        worker_agreed_terms_verified: Boolean(job.worker_agreed_terms_verified),
        labour_payments: labourPayments,
      } as JobOverviewRow;
    })
    .filter((job) => (filters.provider ? job.company_name === filters.provider : true))
    .filter((job) =>
      filters.fill_status ? job.fill_status.toLowerCase() === filters.fill_status.toLowerCase() : true,
    )
    .filter((job) =>
      filters.broadcast_status
        ? job.broadcast_status.toLowerCase() === getBroadcastStatusLabel(filters.broadcast_status).toLowerCase()
        : true,
    );

  console.log("[loadJobsOverview] loaded broadcast statuses", jobs.map((job) => ({
    id: job.job_id,
    title: job.job_title,
    rawBroadcastStatus: (jobRows ?? []).find((row) => String((row as JobRow).id) === job.job_id)?.broadcast_status,
    normalizedBroadcastStatus: job.broadcast_status,
  })));

  console.log("[loadJobsOverview] accepted counts", {
    jobIds,
    acceptedAssignments: acceptedAssignmentsResult.data ?? [],
    acceptedCountByJobId: Object.fromEntries(acceptedCountByJobId),
  });

  console.log("[loadJobsOverview] jobs confirmed counts", jobs.map((job) => ({
    id: job.job_id,
    title: job.job_title,
    workers_confirmed: job.workers_confirmed,
    workersConfirmed: job.workersConfirmed,
    confirmed_workforce_count: job.confirmed_workforce_count,
  })));

  console.log("[loadJobsOverview] success", {
    jobsCount: jobs.length,
    providersCount: providers.length,
    invoiceFeaturesEnabled,
  });

  return {
    jobs,
    providers,
    warning: schemaWarning ?? "",
    capabilities: {
      invoices: invoiceFeaturesEnabled,
    },
  };
}
