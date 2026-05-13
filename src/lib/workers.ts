import type { DispatchJobOption } from "@/components/workers/WorkerBroadcastModal";
import { query } from "@/lib/db";
import { deriveWhatsappNumber } from "@/lib/phone";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import {
  buildWorkerCredentialsCompliance,
  buildWorkerCredentialsSummary,
  buildWorkerFeedbackHighlights,
  buildWorkerPerformanceSummary,
  buildWorkerPortfolio,
  buildWorkerStatHubData,
  buildWorkerStatHubMeta,
  deriveWorkerProfileClassification,
} from "@/lib/workers/intelligence";
import { getWorkerReadiness } from "@/lib/workers/getWorkerReadiness";
import type { WorkerOverviewRow } from "@/lib/workers/types";
import { isSchemaColumnMissing, normalizeWorkerLocationRecord } from "@/lib/location-records";

export interface WorkersOverviewFilters {
  name: string;
  worker_type: string;
  primary_role: string;
  location: string;
  available_today: string;
}

export interface WorkersOverviewPayload {
  workers: WorkerOverviewRow[];
}

interface CompletedJobEvidenceRow {
  worker_id: string;
  job_id: string;
  job_title: string;
  provider_name: string | null;
  required_role: string | null;
  completed_at: string | null;
  booking_status: string;
}

interface ResponseTimeRow {
  worker_id: string;
  avg_response_minutes: number | null;
}

interface ComplianceEvidenceRow {
  worker_id: string;
  contract_signed: boolean | null;
  right_to_work_file: string | null;
  dbs_file: string | null;
  insurance_file: string | null;
}

interface WorkerDocumentSummaryRow {
  worker_id: string;
  document_type: string;
  document_count: number;
}

interface WorkerImageDocumentRow {
  worker_id: string;
  document_type: string;
  file_url: string | null;
  mime_type: string | null;
  file_name: string | null;
  created_at: string | null;
}

async function loadCompletedJobEvidence() {
  const queries = [
    `
      select
        b.worker_id::text as worker_id,
        j.id::text as job_id,
        coalesce(j.title, 'Untitled job') as job_title,
        p.name as provider_name,
        j.required_role,
        coalesce(b.check_out, b.confirmed_time, j.starts_at, b.created_at)::text as completed_at,
        b.booking_status
      from public.bookings b
      join public.jobs j on j.id = b.job_id
      left join public.job_providers p on p.id = j.provider_id
      where b.booking_status in ('checked_out', 'completed')
      order by completed_at desc nulls last
    `,
    `
      select
        b.worker_id::text as worker_id,
        j.job_id::text as job_id,
        coalesce(j.job_title, 'Untitled job') as job_title,
        p.company_name as provider_name,
        j.trade_type as required_role,
        coalesce(b.check_out, b.confirmed_time, j.start_date::timestamptz, b.created_at)::text as completed_at,
        b.booking_status
      from public.bookings b
      join public.jobs j on j.job_id = b.job_id
      left join public.job_providers p on p.provider_id = j.provider_id
      where b.booking_status in ('checked_out', 'completed')
      order by completed_at desc nulls last
    `,
  ];

  for (const sql of queries) {
    try {
      const result = await query<CompletedJobEvidenceRow>(sql);
      return result.rows;
    } catch {
      continue;
    }
  }

  return [] as CompletedJobEvidenceRow[];
}

async function loadResponseTimeEvidence() {
  const queries = [
    `
      select
        rl.worker_id::text as worker_id,
        avg(extract(epoch from (rl.response_time - rl.sent_time)) / 60.0)::float8 as avg_response_minutes
      from public.response_log rl
      where rl.response_time is not null
        and rl.sent_time is not null
      group by rl.worker_id
    `,
    `
      select
        rl.worker_id::text as worker_id,
        avg(extract(epoch from (rl.response_time - rl.sent_time)) / 60.0)::float8 as avg_response_minutes
      from response_log rl
      where rl.response_time is not null
        and rl.sent_time is not null
      group by rl.worker_id
    `,
  ];

  for (const sql of queries) {
    try {
      const result = await query<ResponseTimeRow>(sql);
      return result.rows;
    } catch {
      continue;
    }
  }

  return [] as ResponseTimeRow[];
}

async function loadComplianceEvidence() {
  const queries = [
    `
      select
        c.worker_id::text as worker_id,
        c.contract_signed,
        c.right_to_work_file,
        c.dbs_file,
        c.insurance_file
      from public.compliance_legal c
      where c.worker_id is not null
      order by c.updated_at desc nulls last, c.created_at desc nulls last
    `,
    `
      select
        c.worker_id::text as worker_id,
        c.contract_signed,
        c.right_to_work_file,
        c.dbs_file,
        c.insurance_file
      from compliance_legal c
      where c.worker_id is not null
      order by c.updated_at desc nulls last, c.created_at desc nulls last
    `,
  ];

  for (const sql of queries) {
    try {
      const result = await query<ComplianceEvidenceRow>(sql);
      return result.rows;
    } catch {
      continue;
    }
  }

  return [] as ComplianceEvidenceRow[];
}

async function loadWorkerDocumentSummary() {
  const queries = [
    `
      select
        wd.worker_id::text as worker_id,
        wd.document_type,
        count(*)::int as document_count
      from public.worker_documents wd
      group by wd.worker_id, wd.document_type
    `,
    `
      select
        wd.worker_id::text as worker_id,
        wd.document_type,
        count(*)::int as document_count
      from worker_documents wd
      group by wd.worker_id, wd.document_type
    `,
  ];

  for (const sql of queries) {
    try {
      const result = await query<WorkerDocumentSummaryRow>(sql);
      return result.rows;
    } catch {
      continue;
    }
  }

  return [] as WorkerDocumentSummaryRow[];
}

async function loadWorkerImageDocuments(supabase: ReturnType<typeof createAdminSupabaseClient>) {
  try {
    const { data, error } = await supabase
      .from("worker_documents")
      .select("worker_id, document_type, file_url, mime_type, file_name, created_at")
      .eq("document_type", "portfolio")
      .not("file_url", "is", null)
      .order("created_at", { ascending: false });

    if (!error && Array.isArray(data)) {
      return data
        .map((row) => ({
          worker_id: String(row.worker_id),
          document_type: String(row.document_type),
          file_url: typeof row.file_url === "string" ? row.file_url : null,
          mime_type: typeof row.mime_type === "string" ? row.mime_type : null,
          file_name: typeof row.file_name === "string" ? row.file_name : null,
          created_at: typeof row.created_at === "string" ? row.created_at : null,
        }))
        .filter((row) => {
          const mimeType = row.mime_type ?? "";
          const fileName = row.file_name ?? "";
          return mimeType.startsWith("image/") || /\.(png|jpe?g|webp|gif|bmp|svg)$/i.test(fileName);
        });
    }
  } catch {
    // Fall back to the SQL helper below for local compatibility.
  }

  const queries = [
    `
      select
        wd.worker_id::text as worker_id,
        wd.document_type,
        wd.file_url,
        wd.mime_type,
        wd.file_name,
        wd.created_at::text as created_at
      from public.worker_documents wd
      where wd.file_url is not null
        and wd.document_type = 'portfolio'
      order by wd.created_at desc nulls last
    `,
    `
      select
        wd.worker_id::text as worker_id,
        wd.document_type,
        wd.file_url,
        wd.mime_type,
        wd.file_name,
        wd.created_at::text as created_at
      from worker_documents wd
      where wd.file_url is not null
        and wd.document_type = 'portfolio'
      order by wd.created_at desc nulls last
    `,
  ];

  for (const sql of queries) {
    try {
      const result = await query<WorkerImageDocumentRow>(sql);
      return result.rows.filter((row) => {
        const mimeType = row.mime_type ?? "";
        const fileName = row.file_name ?? "";
        return mimeType.startsWith("image/") || /\.(png|jpe?g|webp|gif|bmp|svg)$/i.test(fileName);
      });
    } catch {
      continue;
    }
  }

  return [] as WorkerImageDocumentRow[];
}

function formatAvgResponseTimeLabel(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value) || value <= 0) return "Not recorded";
  if (value < 60) return `${Math.max(1, Math.round(value))} min`;

  const hours = value / 60;
  if (hours < 24) return `${Math.max(1, Math.round(hours))} hr`;

  const days = hours / 24;
  return `${Math.max(1, Math.round(days))} day${days >= 1.5 ? "s" : ""}`;
}

function mapWorker(worker: Record<string, unknown>): WorkerOverviewRow {
  const location = normalizeWorkerLocationRecord(worker);
  const phone = typeof worker.phone === "string" ? worker.phone : null;
  const whatsappOptIn = Boolean(worker.whatsapp_opt_in);
  const skillTags = Array.isArray(worker.skill_tags) ? worker.skill_tags.map(String).filter(Boolean) : [];
  const baseWorker = {
    worker_id: String(worker.id),
    full_name: String(worker.full_name ?? ""),
    phone,
    whatsapp_number: deriveWhatsappNumber(phone, whatsappOptIn),
    email: typeof worker.email === "string" ? worker.email : null,
    primary_role: typeof worker.primary_role === "string" ? worker.primary_role : null,
    skill_tags: skillTags,
    worker_type: typeof worker.worker_type === "string" ? worker.worker_type : null,
    contractor_type: typeof worker.contractor_type === "string" ? worker.contractor_type : null,
    specialist_area: typeof worker.specialist_area === "string" ? worker.specialist_area : null,
    location_display: location.location_display,
    town: location.town,
    postcode: location.postcode ?? "",
    latitude: typeof worker.latitude === "number" ? worker.latitude : null,
    longitude: typeof worker.longitude === "number" ? worker.longitude : null,
    status: typeof worker.status === "string" ? worker.status : "active",
    available_today: Boolean(worker.available_today),
    right_to_work: Boolean(worker.right_to_work),
    contract_signed: Boolean(worker.contract_signed),
    contract_status: typeof worker.contract_status === "string" ? worker.contract_status : null,
    contract_signed_at: typeof worker.contract_signed_at === "string" ? worker.contract_signed_at : null,
    onboarding_status: typeof worker.onboarding_status === "string" ? worker.onboarding_status : null,
    id_document_uploaded: Boolean(worker.id_document_uploaded),
    cscs_uploaded: Boolean(worker.cscs_uploaded),
    portfolio_uploaded: Boolean(worker.portfolio_uploaded),
    certificates_uploaded: Boolean(worker.certificates_uploaded),
    profileImageUrl: null,
    cardImageUrl: null,
    work_readiness: getWorkerReadiness(worker),
    priority_tier: typeof worker.priority_tier === "string" ? worker.priority_tier : "standard",
    whatsapp_opt_in: whatsappOptIn,
    expected_rate: 0,
    reliability_score:
      typeof worker.reliability_score === "number" ? worker.reliability_score : 0,
    created_at: String(worker.created_at ?? ""),
  };
  const classification = deriveWorkerProfileClassification(baseWorker);
  const stathub = buildWorkerStatHubData(baseWorker);
  const statHubMeta = buildWorkerStatHubMeta({
    verifiedCompletedJobsCount: 0,
    reviewedJobsCount: 0,
    portfolioBackedJobsCount: 0,
    repeatBookedCount: 0,
  });
  const performanceSummary = buildWorkerPerformanceSummary(baseWorker, stathub);
  const portfolio = buildWorkerPortfolio(baseWorker, stathub);
  const credentialsCompliance = buildWorkerCredentialsCompliance({ worker: baseWorker });

  return {
    ...baseWorker,
    ...classification,
    languagesSpoken: Array.isArray(worker.languages_spoken)
      ? worker.languages_spoken.map(String).filter(Boolean)
      : [],
    avgResponseTimeLabel: "Not recorded",
    stathub,
    statHubMeta,
    performanceSummary,
    portfolio,
    credentialsSummary: buildWorkerCredentialsSummary(baseWorker),
    credentialsCompliance,
    clientFeedbackHighlights: buildWorkerFeedbackHighlights(stathub, performanceSummary, statHubMeta),
    completed_jobs_count: 0,
    recent_completed_jobs: [],
  };
}

export async function loadWorkersOverview(
  filters: WorkersOverviewFilters,
): Promise<WorkersOverviewPayload> {
  console.log("[loadWorkersOverview] start", { filters });
  const supabase = createAdminSupabaseClient();
  const primarySelect =
    "id, full_name, phone, email, primary_role, worker_type, contractor_type, specialist_area, skill_tags, languages_spoken, insurance_verified, insurance_types, enhanced_dbs, first_aid_certified, companies_house_verified, companies_house_number, constructionline_member, qualification_label, accreditations, town, postcode, location_text, location_display, location_query, formatted_address, place_id, locality, administrative_area, country, location_precision, latitude, longitude, status, available_today, right_to_work, contract_signed, contract_status, contract_signed_at, onboarding_status, id_document_uploaded, cscs_uploaded, portfolio_uploaded, certificates_uploaded, whatsapp_opt_in, priority_tier, reliability_score, created_at";
  const compatibilitySelect =
    "id, full_name, phone, email, primary_role, skill_tags, town, postcode, location_text, location_display, location_query, formatted_address, place_id, locality, administrative_area, country, location_precision, latitude, longitude, status, available_today, right_to_work, contract_signed, contract_status, contract_signed_at, onboarding_status, id_document_uploaded, cscs_uploaded, portfolio_uploaded, certificates_uploaded, whatsapp_opt_in, priority_tier, created_at";
  const fallbackSelect =
    "id, full_name, phone, email, primary_role, town, postcode, location_display, location_query, location_precision, latitude, longitude, status, available_today, right_to_work, contract_signed, whatsapp_opt_in, priority_tier, created_at";

  async function runQuery(selectClause: string) {
    let query = supabase.from("workers").select(selectClause).order("created_at", { ascending: false });

    if (filters.name) query = query.ilike("full_name", `%${filters.name}%`);
    if (filters.primary_role) query = query.ilike("primary_role", `%${filters.primary_role}%`);
    if (filters.location) {
      query = query.or(
        `location_display.ilike.%${filters.location}%,town.ilike.%${filters.location}%,postcode.ilike.%${filters.location}%`,
      );
    }
    if (filters.available_today) query = query.eq("available_today", filters.available_today === "true");

    return query;
  }

  let { data, error } = await runQuery(primarySelect);

  if (error && isSchemaColumnMissing(error.message, "workers")) {
    ({ data, error } = await runQuery(compatibilitySelect));
  }

  if (error && isSchemaColumnMissing(error.message, "workers")) {
    ({ data, error } = await runQuery(fallbackSelect));
  }

  if (error) {
    console.error("[loadWorkersOverview] failed", error);
    throw new Error(error.message);
  }

  const workers = Array.isArray(data)
    ? ((data as unknown) as Array<Record<string, unknown>>).map(mapWorker)
    : [];
  const completedJobEvidence = await loadCompletedJobEvidence();
  const responseTimeEvidence = await loadResponseTimeEvidence();
  const complianceEvidence = await loadComplianceEvidence();
  const workerDocumentSummary = await loadWorkerDocumentSummary();
  const workerImageDocuments = await loadWorkerImageDocuments(supabase);
  const completedJobsByWorkerId = new Map<string, CompletedJobEvidenceRow[]>();
  const avgResponseByWorkerId = new Map<string, number | null>();
  const complianceByWorkerId = new Map<string, ComplianceEvidenceRow>();
  const documentSummaryByWorkerId = new Map<string, Map<string, number>>();
  const cardImageByWorkerId = new Map<string, string>();

  for (const row of completedJobEvidence) {
    const existing = completedJobsByWorkerId.get(row.worker_id) ?? [];
    existing.push(row);
    completedJobsByWorkerId.set(row.worker_id, existing);
  }

  for (const row of responseTimeEvidence) {
    avgResponseByWorkerId.set(row.worker_id, row.avg_response_minutes);
  }

  for (const row of complianceEvidence) {
    if (!complianceByWorkerId.has(row.worker_id)) {
      complianceByWorkerId.set(row.worker_id, row);
    }
  }

  for (const row of workerDocumentSummary) {
    const existing = documentSummaryByWorkerId.get(row.worker_id) ?? new Map<string, number>();
    existing.set(row.document_type, row.document_count);
    documentSummaryByWorkerId.set(row.worker_id, existing);
  }

  for (const row of workerImageDocuments) {
    if (!row.file_url) continue;
    if (row.document_type === "portfolio" && !cardImageByWorkerId.has(row.worker_id)) {
      cardImageByWorkerId.set(row.worker_id, row.file_url);
    }
  }

  const enrichedWorkers = workers.map((worker) => {
    const completedJobs = completedJobsByWorkerId.get(worker.worker_id) ?? [];
    const completedJobsCount = completedJobs.length;
    const repeatBookedCount = (() => {
      const counts = new Map<string, number>();
      for (const job of completedJobs) {
        const key = (job.provider_name ?? "").trim();
        if (!key) continue;
        counts.set(key, (counts.get(key) ?? 0) + 1);
      }
      return Array.from(counts.values()).filter((count) => count > 1).length;
    })();
    const documentCounts = documentSummaryByWorkerId.get(worker.worker_id) ?? new Map<string, number>();
    const reviewedJobsCount = completedJobsCount;
    const portfolioBackedJobsCount =
      worker.portfolio_uploaded ? Math.min(completedJobsCount, Math.max(1, documentCounts.get("portfolio") ?? 0)) : 0;
    const statHubMeta = buildWorkerStatHubMeta({
      verifiedCompletedJobsCount: completedJobsCount,
      reviewedJobsCount,
      portfolioBackedJobsCount,
      repeatBookedCount,
    });
    const stathub = buildWorkerStatHubData(worker, {
      verifiedBookingsCount: completedJobsCount,
      reviewedJobsCount,
    });
    const lastCompletedAt = completedJobs[0]?.completed_at ?? worker.performanceSummary.lastBookingCompletedAt ?? null;
    const performanceSummary = buildWorkerPerformanceSummary(worker, stathub, completedJobsCount);
    const cardImageUrl = cardImageByWorkerId.get(worker.worker_id) ?? null;
    const portfolio = buildWorkerPortfolio(worker, stathub).map((item, index) =>
      index === 0 && cardImageUrl
        ? { ...item, mediaUrls: [cardImageUrl] }
        : item,
    );
    const compliance = complianceByWorkerId.get(worker.worker_id);
    const credentialsCompliance = buildWorkerCredentialsCompliance({
      worker,
      insuranceVerified:
        typeof (worker as unknown as Record<string, unknown>).insurance_verified === "boolean"
          ? Boolean((worker as unknown as Record<string, unknown>).insurance_verified)
          : Boolean(compliance?.insurance_file),
      insuranceTypes: Array.isArray((worker as unknown as Record<string, unknown>).insurance_types)
        ? ((worker as unknown as Record<string, unknown>).insurance_types as unknown[]).map(String).filter(Boolean)
        : compliance?.insurance_file
          ? ["Public Liability"]
          : [],
      enhancedDbs:
        typeof (worker as unknown as Record<string, unknown>).enhanced_dbs === "boolean"
          ? Boolean((worker as unknown as Record<string, unknown>).enhanced_dbs)
          : (documentCounts.get("enhanced_dbs") ?? 0) > 0,
      firstAidCertified: Boolean((worker as unknown as Record<string, unknown>).first_aid_certified),
      companiesHouseVerified:
        typeof (worker as unknown as Record<string, unknown>).companies_house_verified === "boolean"
          ? Boolean((worker as unknown as Record<string, unknown>).companies_house_verified)
          : worker.workerType === "contractor"
            ? false
            : undefined,
      companiesHouseNumber:
        typeof (worker as unknown as Record<string, unknown>).companies_house_number === "string"
          ? String((worker as unknown as Record<string, unknown>).companies_house_number)
          : null,
      constructionlineMember: Boolean((worker as unknown as Record<string, unknown>).constructionline_member),
      qualificationLabel:
        typeof (worker as unknown as Record<string, unknown>).qualification_label === "string"
          ? String((worker as unknown as Record<string, unknown>).qualification_label)
          : (documentCounts.get("certificate") ?? 0) > 0
          ? "Certificates / qualifications on file"
          : null,
      accreditations: Array.isArray((worker as unknown as Record<string, unknown>).accreditations)
        ? ((worker as unknown as Record<string, unknown>).accreditations as unknown[]).map(String).filter(Boolean)
        : (documentCounts.get("certificate") ?? 0) > 0
          ? ["Certificates on file"]
          : [],
    });

    return {
      ...worker,
      stathub,
      statHubMeta,
      avgResponseTimeLabel: formatAvgResponseTimeLabel(avgResponseByWorkerId.get(worker.worker_id)),
      completed_jobs_count: completedJobsCount,
      profileImageUrl: cardImageUrl,
      cardImageUrl,
      portfolio,
      credentialsCompliance,
      credentialsSummary: buildWorkerCredentialsSummary(worker),
      recent_completed_jobs: completedJobs.slice(0, 5).map((job) => ({
        jobId: job.job_id,
        jobTitle: job.job_title,
        providerName: job.provider_name ?? "Unassigned provider",
        requiredRole: job.required_role,
        completedAt: job.completed_at,
        bookingStatus: job.booking_status,
      })),
      performanceSummary: {
        ...performanceSummary,
        repeatClientsCount: repeatBookedCount,
        lastBookingCompletedAt: lastCompletedAt,
      },
      clientFeedbackHighlights: buildWorkerFeedbackHighlights(stathub, performanceSummary, statHubMeta),
    };
  }).filter((worker) => {
    if (!filters.worker_type) return true;
    if (filters.worker_type === "specialist_contractor") {
      return worker.workerType === "contractor" && worker.contractorType === "specialist";
    }
    if (filters.worker_type === "contractor") {
      return worker.workerType === "contractor" && worker.contractorType !== "specialist";
    }
    return worker.workerType === filters.worker_type;
  });

  console.log("[loadWorkersOverview] success", { count: enrichedWorkers.length });

  return { workers: enrichedWorkers };
}

export async function loadWorkerOverviewById(workerId: string): Promise<WorkerOverviewRow | null> {
  const payload = await loadWorkersOverview({
    name: "",
    worker_type: "",
    primary_role: "",
    location: "",
    available_today: "",
  });

  return payload.workers.find((worker) => worker.worker_id === workerId) ?? null;
}

export function mapJobsToDispatchOptions(jobs: Array<{
  job_id: string;
  provider_id?: string | null;
  job_title: string;
  trade_type: string | null;
  area: string | null;
  postcode: string;
  start_date: string;
  start_time: string | null;
  end_time: string | null;
  workers_required: number;
  pay_rate?: string | null;
  short_description?: string;
  alert_type?: string | null;
  core_role?: string | null;
  duration?: string | null;
  end_date?: string | null;
  pay_rate_display?: string | null;
  duties?: string | null;
  dbs_requirement?: string | null;
  dbs_required?: boolean;
  ipaf_required?: boolean | null;
  own_tools_required?: boolean | null;
  ppe_required?: boolean | null;
  skills_required?: string[];
  shift_pattern?: string | null;
  tickets_required?: string[];
  optional_supporting_notes?: string | null;
  payment_type?: string | null;
  broadcast_status?: string | null;
}>): DispatchJobOption[] {
  return jobs.map((job) => ({
    job_id: job.job_id,
    provider_id: job.provider_id ?? null,
    job_title: job.job_title,
    trade_type: job.trade_type,
    area: job.area,
    postcode: job.postcode,
    start_date: job.start_date,
    start_time: job.start_time,
    end_time: job.end_time,
    workers_required: job.workers_required,
    pay_rate: job.pay_rate ?? null,
    short_description: job.short_description ?? "",
    alert_type: job.alert_type ?? null,
    core_role: job.core_role ?? null,
    duration: job.duration ?? null,
    end_date: job.end_date ?? null,
    pay_rate_display: job.pay_rate_display ?? null,
    provider_name: (job as any).company_name ?? null,
    duties: job.duties ?? null,
    dbs_requirement: job.dbs_requirement ?? null,
    dbs_required: job.dbs_required ?? false,
    ipaf_required: job.ipaf_required ?? null,
    own_tools_required: job.own_tools_required ?? null,
    ppe_required: job.ppe_required ?? null,
    skills_required: job.skills_required ?? [],
    shift_pattern: job.shift_pattern ?? null,
    tickets_required: job.tickets_required ?? [],
    optional_supporting_notes: job.optional_supporting_notes ?? null,
    payment_type: job.payment_type ?? null,
    broadcast_status: job.broadcast_status ?? null,
  }));
}
