import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { unstable_noStore as noStore } from "next/cache";
import {
  formatLimitedLocation,
  getOutwardPostcode,
  maskTradeIdentity,
} from "@/lib/provider-access";
import { runSchemaSafeQuery } from "@/lib/supabase/schema-safe";
import type { WorkerDocumentType } from "@/lib/worker-documents";
import { normaliseWorkforceGrouping } from "@/lib/workforce-grouping";
import { loadRequestedWorkforceForJob } from "@/lib/jobs/loadRequestedWorkforce";
import { calculateWorkerPaymentSummary } from "@/lib/labour-payments";
import { normaliseBroadcastStatus } from "@/lib/dispatch/broadcast-status";
import { formatProviderRequestedNames } from "@/lib/provider-requested-workforce";

export type AlertItemType =
  | "job_broadcast_ready"
  | "job_awaiting_response"
  | "job_unfilled"
  | "client_invoice_unpaid"
  | "client_invoice_required"
  | "labour_payment_due"
  | "missing_worker_documents"
  | "dispatch_request_pending"
  | "job_missing_required_fields";

export interface DashboardAlertItem {
  type: AlertItemType;
  label: string;
  detail: string;
  actionLabel?: string;
}

export interface DashboardAlertSection {
  id: string;
  type: string;
  entityType: "job" | "worker";
  entityId: string;
  title: string;
  subtitle?: string;
  severity: "info" | "warning" | "critical";
  status: "open" | "dismissed" | "resolved";
  items: DashboardAlertItem[];
  primaryAction?: string;
  createdAt?: string;
  dueAt?: string | null;
}

export interface DashboardAlertsPayload {
  summary: {
    unfilledJobs: number;
    dispatchRequests: number;
    broadcastReady: number;
    awaitingResponse: number;
    invoiceRequired: number;
    unpaidIncome: number;
    workersMissingDocuments: number;
    startingSoonUnfilled: number;
    total: number;
  };
  alerts: DashboardAlertSection[];
  message: string;
}

export interface DashboardMapJobPin {
  id: string;
  title: string;
  required_role: string | null;
  broadcast_status: string | null;
  location_display: string | null;
  area: string | null;
  postcode: string | null;
  job_status: string;
  headcount_required: number | null;
  headcount_confirmed: number | null;
  latitude: number;
  longitude: number;
}

export interface DashboardMapWorkerPin {
  id: string;
  full_name: string;
  primary_role: string | null;
  workerType?: "tradesman" | "contractor";
  contractorType?: "multi_discipline" | "specialist" | null;
  specialistArea?: string | null;
  location_display: string | null;
  town: string | null;
  postcode: string | null;
  status: string;
  available_today: boolean;
  latitude: number;
  longitude: number;
}

export interface DashboardMapDataPayload {
  jobs: DashboardMapJobPin[];
  jobs_needing_location: Array<Omit<DashboardMapJobPin, "latitude" | "longitude">>;
  workers: DashboardMapWorkerPin[];
  missing_coordinates: {
    jobs: number;
    workers: number;
  };
  message: string;
}

type DashboardJobRow = {
  id: string;
  title: string;
  provider_id?: string | null;
  required_role: string | null;
  broadcast_status?: string | null;
  location_display?: string | null;
  location_resolved?: boolean | null;
  area: string | null;
  postcode: string | null;
  job_status: string;
  payment_status: string | null;
  headcount_required: number | null;
  headcount_confirmed: number | null;
  starts_at: string | null;
  invoice_generated?: boolean | null;
  invoice_generated_at?: string | null;
  latitude?: number | null;
  longitude?: number | null;
};

type DashboardAssignmentRow = {
  id: string;
  job_id: string;
  worker_id: string;
  payment_cycle: string | null;
  payment_cycle_anchor_date: string | null;
  confirmed_start_date: string | null;
  confirmed_end_date: string | null;
  day_rate: number | null;
  worked_days_current_cycle: number | null;
  payment_status: string | null;
  last_payment_date: string | null;
  next_payment_due_date: string | null;
  created_at: string;
  requested_by_client?: boolean | null;
  requested_rank?: number | null;
};

type DashboardWorkerRow = {
  id: string;
  full_name: string;
  primary_role: string | null;
  worker_type?: "tradesman" | "contractor" | null;
  contractor_type?: "multi_discipline" | "specialist" | null;
  specialist_area?: string | null;
  location_display?: string | null;
  town: string | null;
  postcode: string | null;
  status: string;
  available_today: boolean | null;
  latitude?: number | null;
  longitude?: number | null;
};

function getRequiredDocumentTypesForRole(primaryRole: string | null): WorkerDocumentType[] {
  const normalizedRole = (primaryRole ?? "").trim().toLowerCase();

  const isConstructionRole = [
    "construction",
    "labour",
    "labourer",
    "labor",
    "laborer",
    "builder",
    "skilled labourer",
    "skilled laborer",
    "general labourer",
    "general laborer",
    "site operative",
  ].some((keyword) => normalizedRole.includes(keyword));

  const isSecurityRole = [
    "security",
    "door supervisor",
    "guard",
    "cctv",
    "sia",
  ].some((keyword) => normalizedRole.includes(keyword));

  if (isSecurityRole) {
    return ["sia_badge", "enhanced_dbs", "dbs"];
  }

  if (isConstructionRole) {
    return ["cscs_card", "enhanced_dbs", "dbs"];
  }

  return [];
}

async function loadDashboardJobs(viewerProviderId?: string) {
  const supabase = createAdminSupabaseClient();
  const runQuery = async (select: string) => {
    const queryBuilder = supabase
      .from("jobs")
      .select(select);

    return (viewerProviderId
      ? queryBuilder.eq("provider_id", viewerProviderId)
      : queryBuilder)
      .order("starts_at", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: false });
  };
  const result = await runSchemaSafeQuery<DashboardJobRow[]>([
    {
      label: "jobs-modern",
      missingColumns: ["broadcast_status", "invoice_generated", "invoice_generated_at", "location_display", "location_resolved", "latitude", "longitude"],
      query: async () =>
        await runQuery(
          "id, provider_id, title, required_role, broadcast_status, location_display, location_resolved, area, postcode, job_status, payment_status, headcount_required, headcount_confirmed, starts_at, invoice_generated, invoice_generated_at, latitude, longitude",
        ),
    },
    {
      label: "jobs-modern-no-broadcast",
      missingColumns: ["invoice_generated", "invoice_generated_at", "location_display", "location_resolved", "latitude", "longitude"],
      query: async () =>
        await runQuery(
          "id, provider_id, title, required_role, broadcast_status, location_display, location_resolved, area, postcode, job_status, payment_status, headcount_required, headcount_confirmed, starts_at, invoice_generated, invoice_generated_at, latitude, longitude",
        ),
    },
    {
      label: "jobs-coordinates",
      missingColumns: ["broadcast_status", "invoice_generated", "invoice_generated_at"],
      query: async () =>
        await runQuery(
          "id, provider_id, title, required_role, broadcast_status, area, postcode, job_status, payment_status, headcount_required, headcount_confirmed, starts_at, invoice_generated, invoice_generated_at, latitude, longitude",
        ),
    },
    {
      label: "jobs-coordinates-no-broadcast",
      missingColumns: ["invoice_generated", "invoice_generated_at"],
      query: async () =>
        await runQuery(
          "id, provider_id, title, required_role, broadcast_status, area, postcode, job_status, payment_status, headcount_required, headcount_confirmed, starts_at, invoice_generated, invoice_generated_at, latitude, longitude",
        ),
    },
    {
      label: "jobs-legacy",
      missingColumns: ["broadcast_status"],
      query: async () =>
        await runQuery(
          "id, provider_id, title, required_role, broadcast_status, area, postcode, job_status, payment_status, headcount_required, headcount_confirmed, starts_at",
        ),
    },
    {
      label: "jobs-minimal",
      query: async () =>
        await runQuery(
          "id, provider_id, title, required_role, area, postcode, job_status, payment_status, headcount_required, headcount_confirmed, starts_at",
        ),
    },
  ]);

  if (result.error) {
    throw new Error(result.error.message);
  }

  return {
    jobs: (result.data ?? []) as DashboardJobRow[],
    invoiceTrackingAvailable: result.attempt.startsWith("jobs-modern") || result.attempt.startsWith("jobs-coordinates"),
    coordinatesAvailable: result.attempt !== "jobs-legacy" && result.attempt !== "jobs-minimal",
  };
}

async function loadDashboardWorkers() {
  const supabase = createAdminSupabaseClient();
  const runQuery = (select: string) =>
    supabase.from("workers").select(select).order("created_at", { ascending: false });

  const result = await runSchemaSafeQuery<DashboardWorkerRow[]>([
    {
      label: "workers-modern",
      missingColumns: ["worker_type", "contractor_type", "specialist_area", "location_display", "latitude", "longitude"],
      query: async () =>
        await runQuery(
          "id, full_name, primary_role, worker_type, contractor_type, specialist_area, location_display, town, postcode, status, available_today, latitude, longitude",
        ),
    },
    {
      label: "workers-no-type",
      missingColumns: ["location_display", "latitude", "longitude"],
      query: async () =>
        await runQuery(
          "id, full_name, primary_role, town, postcode, status, available_today, latitude, longitude",
        ),
    },
    {
      label: "workers-minimal",
      query: async () =>
        await runQuery("id, full_name, primary_role, town, postcode, status, available_today"),
    },
  ]);

  if (result.error) {
    throw new Error(result.error.message);
  }

  return {
    workers: (result.data ?? []) as DashboardWorkerRow[],
    coordinatesAvailable: result.attempt !== "workers-minimal",
  };
}

async function loadDashboardAssignments(jobIds: string[]) {
  if (jobIds.length === 0) return [] as DashboardAssignmentRow[];
  const supabase = createAdminSupabaseClient();
  const result = await supabase
    .from("job_worker_assignments")
    .select("id, job_id, worker_id, payment_cycle, payment_cycle_anchor_date, confirmed_start_date, confirmed_end_date, day_rate, worked_days_current_cycle, payment_status, last_payment_date, next_payment_due_date, requested_by_client, requested_rank, created_at")
    .in("job_id", jobIds);

  if (result.error) return [];
  return (result.data ?? []) as DashboardAssignmentRow[];
}

async function loadProviderRequestedNamesByJobId(jobIds: string[]) {
  const namesByJobId = new Map<string, string[]>();
  if (jobIds.length === 0) return namesByJobId;

  const supabase = createAdminSupabaseClient();
  await Promise.all(jobIds.map(async (jobId) => {
    try {
      const requestedWorkforce = await loadRequestedWorkforceForJob(supabase, jobId);
      const names = requestedWorkforce.map((worker) => worker.name).filter(Boolean);
      if (names.length > 0) {
        namesByJobId.set(jobId, names);
      }
    } catch (error) {
      console.warn("[dashboard] requested workforce lookup failed", { jobId, error });
    }
  }));

  return namesByJobId;
}

function upsertJobAlertGroup(
  groups: Map<string, DashboardAlertSection>,
  job: DashboardJobRow,
  item: DashboardAlertItem,
  providerNameById: Map<string, string>,
  severity: DashboardAlertSection["severity"] = "warning",
) {
  const id = `job:${job.id}`;
  const providerName = providerNameById.get(String(job.provider_id ?? "")) || "Unassigned provider";
  const location = [job.area, job.postcode].filter(Boolean).join(" ");
  const group = groups.get(id) ?? {
    id,
    type: "job",
    entityType: "job" as const,
    entityId: String(job.id),
    title: `${job.required_role || job.title || "Job"} needs admin action`,
    subtitle: "",
    severity,
    status: "open" as const,
    items: [],
    primaryAction: "Open job",
    createdAt: job.starts_at ?? undefined,
  };

  group.items.push(item);
  group.severity = group.severity === "critical" || severity === "critical" ? "critical" : severity;
  group.subtitle = `${providerName} · ${location || "Location TBC"} · ${group.items.length} action${group.items.length === 1 ? "" : "s"} needed`;
  groups.set(id, group);
}

function upsertWorkerAlertGroup(
  groups: Map<string, DashboardAlertSection>,
  worker: DashboardWorkerRow,
  item: DashboardAlertItem,
) {
  const id = `worker:${worker.id}`;
  const group = groups.get(id) ?? {
    id,
    type: "worker",
    entityType: "worker" as const,
    entityId: String(worker.id),
    title: `${worker.full_name} needs compliance action`,
    subtitle: [worker.primary_role, worker.town, worker.postcode].filter(Boolean).join(" · "),
    severity: "warning" as const,
    status: "open" as const,
    items: [],
    primaryAction: "Open worker",
  };
  group.items.push(item);
  groups.set(id, group);
}

export async function getDashboardAlerts(viewerProviderId?: string): Promise<DashboardAlertsPayload> {
  noStore();
  const supabase = createAdminSupabaseClient();
  const { jobs, invoiceTrackingAvailable } = await loadDashboardJobs(viewerProviderId);
  const now = Date.now();
  const next24Hours = now + 24 * 60 * 60 * 1000;
  const providerNameById = new Map<string, string>();

  if (!viewerProviderId) {
    const providersQuery = await supabase
      .from("job_providers")
      .select("id, name");

    if (!providersQuery.error) {
      for (const provider of providersQuery.data ?? []) {
        providerNameById.set(String(provider.id), String(provider.name ?? ""));
      }
    }
  }

  const alertGroups = new Map<string, DashboardAlertSection>();
  const providerRequestedNamesByJobId = !viewerProviderId
    ? await loadProviderRequestedNamesByJobId(jobs.map((job) => String(job.id)))
    : new Map<string, string[]>();
  let dispatchRequestCount = 0;
  if (!viewerProviderId) {
    const dispatchEvents = await supabase
      .from("provider_audit_events")
      .select("provider_id, metadata, created_at")
      .eq("event_type", "dispatch_requested")
      .order("created_at", { ascending: false })
      .limit(10);

    if (!dispatchEvents.error) {
      dispatchRequestCount = (dispatchEvents.data ?? []).length;
      for (const event of dispatchEvents.data ?? []) {
        const providerName = providerNameById.get(String(event.provider_id ?? "")) || "Provider";
        const metadata = event.metadata && typeof event.metadata === "object" ? event.metadata as Record<string, unknown> : {};
        const count = typeof metadata.count === "number" ? metadata.count : null;
        const source = typeof metadata.access_source === "string" ? metadata.access_source : "dispatch";
        const jobId = typeof metadata.job_id === "string" ? metadata.job_id : null;
        if (!jobId) continue;
        const job = jobs.find((row) => row.id === jobId);
        if (!job) continue;
        upsertJobAlertGroup(alertGroups, job, {
          type: "dispatch_request_pending",
          label: "Dispatch request pending",
          detail: `${providerName}: ${count ?? "New"} workforce dispatch request${count === 1 ? "" : "s"} (${source})`,
          actionLabel: "Review dispatch",
        }, providerNameById);
      }
    }
  }

  const actionableJobs = jobs.filter((job) => {
    const status = (job.job_status ?? "").toLowerCase();
    return !["completed", "cancelled"].includes(status);
  });
  const broadcastReadyJobs = viewerProviderId
    ? []
    : actionableJobs.filter(
        (job) => normaliseBroadcastStatus(job.broadcast_status) === "broadcast ready",
      );
  const awaitingResponseJobs = viewerProviderId
    ? []
    : actionableJobs.filter((job) => {
        const broadcastStatus = normaliseBroadcastStatus(job.broadcast_status);
        return broadcastStatus === "awaiting response";
      });
  const unfilledJobs = actionableJobs.filter(
    (job) => Number(job.headcount_confirmed ?? 0) < Number(job.headcount_required ?? 0),
  );
  const invoiceRequiredJobs = invoiceTrackingAvailable
    ? jobs.filter(
        (job) => {
          const status = (job.job_status ?? "").toLowerCase();
          return (status === "completed" || status === "filled") && job.invoice_generated !== true;
        },
      )
    : [];
  const unpaidIncomeJobs = jobs.filter((job) => {
    const status = (job.job_status ?? "").toLowerCase();
    const paymentStatus = (job.payment_status ?? "").toLowerCase();
    return !["cancelled"].includes(status) && ["unpaid", "overdue"].includes(paymentStatus);
  });
  const startingSoonUnfilledJobs = actionableJobs.filter((job) => {
    if (!job.starts_at) return false;
    const startsAt = new Date(job.starts_at).getTime();
    return (
      startsAt >= now &&
      startsAt <= next24Hours &&
      Number(job.headcount_confirmed ?? 0) < Number(job.headcount_required ?? 0)
    );
  });

  let workersMissingDocumentsCount = 0;
  let workersMissingDocumentsItems: string[] = [];

  if (!viewerProviderId) {
    const documentsQuery = await supabase
      .from("worker_documents")
      .select("worker_id, document_type");

    if (!documentsQuery.error) {
      const { workers } = await loadDashboardWorkers();
      const documentTypesByWorkerId = new Map<string, Set<string>>();

      for (const row of documentsQuery.data ?? []) {
        const workerId = String(row.worker_id);
        const set = documentTypesByWorkerId.get(workerId) ?? new Set<string>();
        set.add(String(row.document_type));
        documentTypesByWorkerId.set(workerId, set);
      }

      const workersMissingDocuments = workers
        .map((worker) => {
          const requiredTypes = getRequiredDocumentTypesForRole(worker.primary_role);
          const uploadedTypes = documentTypesByWorkerId.get(worker.id) ?? new Set<string>();
          const missingTypes = requiredTypes.filter((documentType) => !uploadedTypes.has(documentType));
          return { worker, missingTypes };
        })
        .filter((entry) => entry.missingTypes.length > 0);

      workersMissingDocumentsCount = workersMissingDocuments.length;
      workersMissingDocumentsItems = workersMissingDocuments
        .slice(0, 5)
        .map(
          ({ worker, missingTypes }) =>
            `${worker.full_name} is missing ${missingTypes.join(", ").replaceAll("_", " ")}`,
        );
      for (const { worker, missingTypes } of workersMissingDocuments) {
        upsertWorkerAlertGroup(alertGroups, worker, {
          type: "missing_worker_documents",
          label: "Missing worker documents",
          detail: `${worker.full_name} is missing ${missingTypes.join(", ").replaceAll("_", " ")}`,
          actionLabel: "Review credentials",
        });
      }
    }
  }

  if (!viewerProviderId && broadcastReadyJobs.length > 0) {
    for (const job of broadcastReadyJobs) {
      const providerName = providerNameById.get(String(job.provider_id ?? "")) || "Unassigned provider";
      const requestedNames = providerRequestedNamesByJobId.get(String(job.id)) ?? [];
      const requestedText = formatProviderRequestedNames(requestedNames);
      upsertJobAlertGroup(alertGroups, job, {
        type: "job_broadcast_ready",
        label: "Broadcast / dispatch ready",
        detail: `${providerName}: ${job.title} is ready for platform dispatch${requestedText ? `. Provider requested: ${requestedText}.` : ""}`,
        actionLabel: requestedNames.length > 0 ? "Open job overview to dispatch requested workforce" : "Open dispatch",
      }, providerNameById);
    }
  }

  if (!viewerProviderId && awaitingResponseJobs.length > 0) {
    for (const job of awaitingResponseJobs) {
      const providerName = providerNameById.get(String(job.provider_id ?? "")) || "Unassigned provider";
      upsertJobAlertGroup(alertGroups, job, {
        type: "job_awaiting_response",
        label: "Awaiting response",
        detail: `${providerName}: ${job.title} has been dispatched and is awaiting responses`,
        actionLabel: "Review dispatch",
      }, providerNameById);
    }
  }

  if (unfilledJobs.length > 0) {
    for (const job of unfilledJobs) {
      const needed = Number(job.headcount_required ?? 0) - Number(job.headcount_confirmed ?? 0);
      upsertJobAlertGroup(alertGroups, job, {
        type: "job_unfilled",
        label: `Needs ${needed} more worker(s)`,
        detail: `${job.title} needs ${needed} more worker(s)`,
        actionLabel: "Open matching",
      }, providerNameById);
    }
  }

  if (invoiceRequiredJobs.length > 0) {
    for (const job of invoiceRequiredJobs) {
      upsertJobAlertGroup(alertGroups, job, {
        type: "client_invoice_required",
        label: "Client invoice required",
        detail: `${job.title} is ready for invoicing`,
        actionLabel: "Open invoice",
      }, providerNameById);
    }
  }

  if (unpaidIncomeJobs.length > 0) {
    for (const job of unpaidIncomeJobs) {
      upsertJobAlertGroup(alertGroups, job, {
        type: "client_invoice_unpaid",
        label: `Client payment follow-up: ${job.payment_status ?? "unpaid"}`,
        detail: `${job.title} is marked ${job.payment_status ?? "unpaid"}`,
        actionLabel: "Open invoice",
      }, providerNameById);
    }
  }

  if (startingSoonUnfilledJobs.length > 0) {
    for (const job of startingSoonUnfilledJobs) {
      upsertJobAlertGroup(alertGroups, job, {
        type: "job_unfilled",
        label: "Starts soon and still unfilled",
        detail: `${job.title} starts at ${job.starts_at}`,
        actionLabel: "Open matching",
      }, providerNameById, "critical");
    }
  }

  const assignments = await loadDashboardAssignments(jobs.map((job) => String(job.id)));
  for (const assignment of assignments) {
    const job = jobs.find((row) => row.id === String(assignment.job_id));
    if (!job) continue;
    const summary = calculateWorkerPaymentSummary({
      assignment: assignment as unknown as Record<string, unknown>,
      job: job as unknown as Record<string, unknown>,
    });
    if (!summary.alertDue) continue;
    upsertJobAlertGroup(alertGroups, job, {
      type: "labour_payment_due",
      label: "Labour payment due",
      detail: `Worker payment is due ${summary.nextPaymentDueDate} (${summary.workedDays} day(s), £${summary.estimatedAmountDue}).`,
      actionLabel: "Open labour payments",
    }, providerNameById, "critical");
  }

  const alerts = Array.from(alertGroups.values()).sort((a, b) => {
    if (a.entityType !== b.entityType) return a.entityType === "job" ? -1 : 1;
    return b.items.length - a.items.length;
  });

  const summary = {
    unfilledJobs: unfilledJobs.length,
    dispatchRequests: dispatchRequestCount,
    broadcastReady: broadcastReadyJobs.length,
    awaitingResponse: awaitingResponseJobs.length,
    invoiceRequired: invoiceRequiredJobs.length,
    unpaidIncome: unpaidIncomeJobs.length,
    workersMissingDocuments: workersMissingDocumentsCount,
    startingSoonUnfilled: startingSoonUnfilledJobs.length,
    total:
      broadcastReadyJobs.length +
      awaitingResponseJobs.length +
      dispatchRequestCount +
      unfilledJobs.length +
      invoiceRequiredJobs.length +
      unpaidIncomeJobs.length +
      workersMissingDocumentsCount +
      startingSoonUnfilledJobs.length,
  };

  return {
    summary,
    alerts,
    message: alerts.length === 0 ? "No outstanding dispatch tasks." : "",
  };
}

export async function getDashboardMapData(options?: {
  viewerProviderId?: string;
  limitedProviderView?: boolean;
  includeJobs?: boolean;
}): Promise<DashboardMapDataPayload> {
  const viewerProviderId = options?.viewerProviderId;
  const limitedProviderView = options?.limitedProviderView ?? false;
  const includeJobs = options?.includeJobs ?? true;
  const [{ jobs, coordinatesAvailable: jobsCoordinatesAvailable }, { workers, coordinatesAvailable: workersCoordinatesAvailable }] =
    await Promise.all([
      includeJobs
        ? loadDashboardJobs(viewerProviderId)
        : Promise.resolve({ jobs: [] as DashboardJobRow[], coordinatesAvailable: true }),
      loadDashboardWorkers(),
    ]);

  const jobPins = includeJobs ? jobs
    .filter(
      (job) =>
        job.location_resolved !== false &&
        typeof job.latitude === "number" &&
        typeof job.longitude === "number",
    )
    .map((job) => ({
      id: job.id,
      title: job.title,
      required_role: job.required_role,
      broadcast_status: job.broadcast_status ?? null,
      location_display: limitedProviderView
        ? formatLimitedLocation({
            locationDisplay: job.location_display ?? null,
            town: job.area,
            postcode: job.postcode,
          })
        : job.location_display ?? null,
      area: job.area,
      postcode: limitedProviderView ? getOutwardPostcode(job.postcode) : job.postcode,
      job_status: job.job_status,
      headcount_required: job.headcount_required,
      headcount_confirmed: job.headcount_confirmed,
      latitude: Number(job.latitude),
      longitude: Number(job.longitude),
    })) : [];

  const jobsNeedingLocation = includeJobs ? jobs
    .filter(
      (job) =>
        !(
          job.location_resolved !== false &&
          typeof job.latitude === "number" &&
          typeof job.longitude === "number"
        ),
    )
    .map((job) => ({
      id: job.id,
      title: job.title,
      required_role: job.required_role,
      broadcast_status: job.broadcast_status ?? null,
      location_display: limitedProviderView
        ? formatLimitedLocation({
            locationDisplay: job.location_display ?? null,
            town: job.area,
            postcode: job.postcode,
          })
        : job.location_display ?? null,
      area: job.area,
      postcode: limitedProviderView ? getOutwardPostcode(job.postcode) : job.postcode,
      job_status: job.job_status,
      headcount_required: job.headcount_required,
      headcount_confirmed: job.headcount_confirmed,
    })) : [];

  const workerPins = workers
    .filter(
      (worker) => typeof worker.latitude === "number" && typeof worker.longitude === "number",
    )
    .map((worker) => {
      const grouping = normaliseWorkforceGrouping({
        full_name: worker.full_name,
        worker_type: worker.worker_type,
        contractor_type: worker.contractor_type,
        primary_role: worker.primary_role,
        specialistArea: worker.specialist_area,
      });
      const workerType = grouping === "Contractor" ? "contractor" : "tradesman";

      return {
        id: worker.id,
        full_name: limitedProviderView
          ? maskTradeIdentity({
              fullName: worker.full_name,
              workerType,
              contractorType: worker.contractor_type ?? null,
              specialistArea: worker.specialist_area ?? null,
            }).replace(/^(Tradesman|Contractor):\s*/, "")
          : worker.full_name,
        primary_role: worker.primary_role,
        workerType: workerType as "contractor" | "tradesman",
        contractorType: worker.contractor_type ?? null,
        specialistArea: worker.specialist_area ?? null,
        location_display: limitedProviderView
          ? formatLimitedLocation({
              locationDisplay: worker.location_display ?? null,
              town: worker.town,
              postcode: worker.postcode,
            })
          : worker.location_display ?? null,
        town: worker.town,
        postcode: limitedProviderView ? getOutwardPostcode(worker.postcode) : worker.postcode,
        status: worker.status,
        available_today: Boolean(worker.available_today),
        latitude: Number(worker.latitude),
        longitude: Number(worker.longitude),
      };
    });

  const missing_coordinates = {
    jobs: includeJobs ? (jobsCoordinatesAvailable ? jobs.length - jobPins.length : jobs.length) : 0,
    workers: workersCoordinatesAvailable ? workers.length - workerPins.length : workers.length,
  };

  const someMissing = missing_coordinates.jobs > 0 || missing_coordinates.workers > 0;
  const noPins = jobPins.length === 0 && workerPins.length === 0;

  return {
    jobs: jobPins,
    jobs_needing_location: jobsNeedingLocation,
    workers: workerPins,
    missing_coordinates,
    message: noPins
      ? "No map coordinates are available yet."
      : someMissing
        ? "Some records need location confirmation before they can appear on the map."
        : "",
  };
}
