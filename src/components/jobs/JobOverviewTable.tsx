"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import {
  CalendarIcon,
  CheckCircledIcon,
  ClockIcon,
  EnvelopeClosedIcon,
  FileTextIcon,
  IdCardIcon,
  MobileIcon,
  PersonIcon,
  ReaderIcon,
  SewingPinIcon,
} from "@radix-ui/react-icons";
import { Box, Button, Checkbox, ScrollArea, Table, Tabs } from "@radix-ui/themes";
import { InvoiceEmailModal } from "@/components/jobs/InvoiceEmailModal";
import { BroadcastModal, type BroadcastJobOption } from "@/components/messaging/BroadcastModal";
import { Modal } from "@/components/ui/Modal";
import { WorkerGridCard } from "@/components/workforce/WorkerGridCard";
import { WorkerProfileModal } from "@/components/workers/WorkerProfileModal";
import { getInvoiceReminder } from "@/lib/invoices/getInvoiceReminder";
import { resolveRequestedWorkforce, type NormalisedRequestedWorkforce } from "@/lib/jobs/normaliseRequestedWorkforce";
import { formatLocation } from "@/lib/jobs/mergeRequestedWorkforce";
import { formatLabourPaymentStatus, type LabourPaymentCycle, type LabourPaymentStatus } from "@/lib/labour-payments";
import {
  getProviderFacingDisplayName,
  getProviderFacingLocationLabel,
} from "@/lib/provider-access";
import {
  BROADCAST_STATUS_LABELS,
  BROADCAST_STATUS_OPTIONS,
  isBroadcastStatus,
  normaliseBroadcastStatus,
  type BroadcastStatus,
} from "@/lib/dispatch/broadcast-status-constants";
import type {
  PlatformBackedStatus,
  ProviderPaymentReliabilityStatus,
} from "@/lib/provider-trust";
import { normaliseStringList } from "@/lib/stringLists";
import type { WorkerOverviewRow } from "@/lib/workers/types";

export interface MatchingWorker {
  id?: string;
  worker_id: string;
  workerId?: string;
  full_name: string;
  phone: string | null;
  primary_role: string | null;
  worker_type?: "tradesman" | "contractor" | null;
  contractor_type?: "multi_discipline" | "specialist" | null;
  specialist_area?: string | null;
  skill_tags?: string[];
  town: string | null;
  postcode: string;
  location_display?: string | null;
  available_today: boolean;
  priority_tier: string;
  whatsapp_opt_in: boolean;
  right_to_work: boolean;
  contract_signed: boolean;
  site_score: number | null;
  verified_bookings: number;
  match_strength?: number;
  match_reason?: string;
  role_score?: number;
  skills_score?: number;
  compliance_score?: number;
  location_score?: number;
  availability_score?: number;
  performance_score?: number;
  match_reasons?: string[];
  match_gaps?: string[];
  distance_label?: string;
  card_image_url?: string;
  profile_image_url?: string;
  subtitle?: string;
  grouping_detail_label?: string;
  grouping_detail_value?: string;
  site_score_status_label?: string;
  requested_by_client?: boolean;
  requested_rank?: number | null;
  assignment_status?: string | null;
  dispatchStatus?: string | null;
  dispatch_status?: string | null;
  requestedByClient?: boolean;
  isClientRequested?: boolean;
  is_client_requested?: boolean;
  accepted_by_worker?: boolean;
  accepted_by_worker_at?: string | null;
  broadcast_completed?: boolean;
  released_to_client?: boolean;
  released_to_client_at?: string | null;
}

interface AcceptedWorkforceRow {
  assignment_id: string;
  worker_id: string;
  assignment_status: string;
  accepted_at: string | null;
  selected_for_release_at: string | null;
  released_to_client_at: string | null;
  worker: {
    name: string;
    role: string | null;
    workforce_type: string;
    location: string | null;
    postcode: string | null;
    phone: string | null;
    email: string | null;
    site_score: number | null;
    compliance_summary: string[];
  };
}

export interface LabourPaymentRow {
  assignment_id: string;
  job_id: string;
  worker_id: string;
  worker_name: string;
  worker_role: string | null;
  assignment_status: string;
  requested_by_client: boolean;
  requested_rank: number | null;
  payment_cycle: LabourPaymentCycle;
  payment_status: LabourPaymentStatus;
  last_payment_date: string | null;
  next_payment_due_date: string | null;
  day_rate: number | null;
  worked_days_current_cycle: number;
  estimated_amount_due: number;
  payment_receipt_status: string | null;
  preliminary_payment_notice_status: string;
  payment_notes: string | null;
  cycle_start?: string | null;
  cycle_end?: string | null;
  is_estimated?: boolean;
  alert_due?: boolean;
}

export interface JobOverviewRow {
  job_id: string;
  provider_id?: string | null;
  job_title: string;
  company_name: string;
  area: string | null;
  postcode: string;
  start_date: string;
  start_time: string | null;
  end_time: string | null;
  workers_required: number;
  workers_confirmed: number;
  workersConfirmed?: number;
  confirmed_workforce_count?: number;
  confirmedWorkerIds?: string[];
  confirmed_worker_ids?: string[];
  confirmedWorkforce?: NormalisedRequestedWorkforce[];
  confirmed_workers?: NormalisedRequestedWorkforce[];
  acceptedWorkforce?: NormalisedRequestedWorkforce[];
  acceptedWorkers?: NormalisedRequestedWorkforce[];
  accepted_workers?: NormalisedRequestedWorkforce[];
  confirmedWorkerNames?: string[];
  confirmed_workforce_names?: string[];
  confirmed_worker_names?: string[];
  broadcast_status: string;
  broadcastStatus?: string | null;
  dispatch_status?: string | null;
  payment_status: string;
  job_status: string;
  created_at: string;
  trade_type: string | null;
  skill_tags: string[];
  certificates_required: string[];
  fill_status: string;
  matching_workers: MatchingWorker[];
  matchingWorkers?: MatchingWorker[];
  matches?: MatchingWorker[];
  matchedWorkers?: MatchingWorker[];
  matched_workers?: MatchingWorker[];
  contractors?: MatchingWorker[];
  requestedWorkforce?: NormalisedRequestedWorkforce[];
  requested_workforce?: NormalisedRequestedWorkforce[];
  requestedWorkers?: NormalisedRequestedWorkforce[];
  requested_workers?: NormalisedRequestedWorkforce[];
  client_requested_workforce?: NormalisedRequestedWorkforce[];
  requestedWorkerIds?: string[];
  pay_rate?: string | null;
  pay_rate_amount?: number | null;
  pay_rate_unit?: string | null;
  job_category?: string | null;
  job_type?: string | null;
  site_name?: string | null;
  dbs_required?: boolean;
  short_description?: string;
  alert_type?: string | null;
  core_role?: string | null;
  selected_role?: string | null;
  trade?: string | null;
  location_label?: string | null;
  location_confirmed?: boolean | null;
  time_window?: string | null;
  duration?: string | null;
  end_date?: string | null;
  pay_rate_display?: string | null;
  duties?: string | null;
  requirements?: string[];
  dbs_requirement?: string | null;
  enhanced_dbs_required?: boolean | null;
  ipaf_required?: boolean | null;
  own_tools_required?: boolean | null;
  tools_required?: string | null;
  ppe_required?: boolean | null;
  ppe_detail?: string | null;
  skills_required?: string[];
  shift_pattern?: string | null;
  tickets_required?: string[];
  selected_keywords?: string[];
  optional_supporting_notes?: string | null;
  payment_type?: string | null;
  provider_email?: string | null;
  invoice_status?: string | null;
  invoice_send_date?: string | null;
  invoice_due_date?: string | null;
  invoice_last_sent_at?: string | null;
  invoice_notes?: string | null;
  provider_payment_reliability_status?: ProviderPaymentReliabilityStatus;
  platform_backed_job?: boolean;
  platform_backed_status?: PlatformBackedStatus;
  platform_backed_note?: string | null;
  platform_backed_approved_by_admin?: boolean;
  platform_backed_payment_terms?: string | null;
  walk_off_clause_enabled?: boolean;
  worker_payment_protected?: boolean;
  cscs_required?: boolean | null;
  payment_terms_days?: number | null;
  provider_agreed_terms_verified?: boolean;
  worker_agreed_terms_verified?: boolean;
  labour_payments?: LabourPaymentRow[];
}

function formatDetailValue(value: string | number | boolean | null | undefined) {
  if (value === null || value === undefined || value === "" || value === "-") return "Not provided";
  return String(value);
}

function formatBooleanValue(value: boolean | null | undefined) {
  if (value === null || value === undefined) return null;
  return value ? "Yes" : "No";
}

function formatListValue(value: string[] | null | undefined) {
  if (!Array.isArray(value) || value.length === 0) return null;
  return value.join(", ");
}

function normaliseToArray(value: unknown) {
  return normaliseStringList(value);
}

function formatPercentMatch(value: number | null | undefined) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return "Match pending";
  const numeric = Number(value);
  const percentage = numeric > 0 && numeric <= 1 ? numeric * 100 : numeric;
  return `${Math.round(percentage)}% match`;
}

function buildFallbackAvatar(label: string) {
  const initials = label
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("") || "RD";

  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="420" viewBox="0 0 600 420">
      <rect width="600" height="420" fill="#eff6ff"/>
      <circle cx="300" cy="166" r="74" fill="#dbeafe"/>
      <path d="M150 360c35-74 90-112 150-112s115 38 150 112" fill="#dbeafe"/>
      <text x="300" y="192" text-anchor="middle" fill="#0f172a" font-size="76" font-family="Arial, sans-serif" font-weight="700">${initials}</text>
    </svg>`,
  )}`;
}

function getMatchingWorkerId(worker: MatchingWorker) {
  return worker.worker_id || worker.id || worker.workerId || "";
}

function getDisplayName(worker: MatchingWorker | NormalisedRequestedWorkforce | AcceptedWorkforceRow) {
  const anyWorker = worker as any;
  return (
    anyWorker.company_name ||
    anyWorker.business_name ||
    anyWorker.full_name ||
    anyWorker.name ||
    anyWorker.worker?.name ||
    "Unnamed contractor"
  );
}

function getAvatar(worker: MatchingWorker | NormalisedRequestedWorkforce | AcceptedWorkforceRow) {
  const anyWorker = worker as any;
  const name = getDisplayName(worker);
  return (
    anyWorker.avatar_url ||
    anyWorker.image_url ||
    anyWorker.profile_image ||
    anyWorker.card_image_url ||
    anyWorker.profile_image_url ||
    anyWorker.avatarUrl ||
    anyWorker.worker?.avatar_url ||
    buildFallbackAvatar(name)
  );
}

function getWorkerRole(worker: MatchingWorker | NormalisedRequestedWorkforce | AcceptedWorkforceRow) {
  const anyWorker = worker as any;
  return (
    anyWorker.primary_trade ||
    anyWorker.primaryRole ||
    anyWorker.primary_role ||
    anyWorker.role ||
    anyWorker.trade ||
    anyWorker.worker_type ||
    anyWorker.workforceType ||
    anyWorker.worker?.role ||
    "General workforce"
  );
}

function getAcceptedStatus(worker: NormalisedRequestedWorkforce | AcceptedWorkforceRow) {
  const anyWorker = worker as any;
  const status = anyWorker.assignment_status || anyWorker.dispatchStatus || anyWorker.dispatch_status;
  return ["accepted", "confirmed", "selected_for_release", "released_to_client"].includes(status) ? "Accepted" : "Accepted";
}

function hasAcceptedStatus(worker: NormalisedRequestedWorkforce | AcceptedWorkforceRow) {
  const anyWorker = worker as any;
  const status = anyWorker.assignment_status || anyWorker.dispatchStatus || anyWorker.dispatch_status;
  return ["accepted", "confirmed", "selected_for_release", "released_to_client"].includes(String(status ?? ""));
}

function buildProfileWorkerFromMatch(worker: MatchingWorker): WorkerOverviewRow {
  const name = getDisplayName(worker);
  const imageUrl = getAvatar(worker);
  const role = getWorkerRole(worker);

  return {
    worker_id: getMatchingWorkerId(worker) || worker.worker_id,
    full_name: name,
    phone: worker.phone,
    whatsapp_number: null,
    email: null,
    primary_role: role,
    skill_tags: worker.skill_tags ?? [],
    workerType: worker.worker_type === "contractor" ? "contractor" : "tradesman",
    contractorType: worker.contractor_type ?? null,
    specialistArea: worker.specialist_area ?? null,
    skillTag: role,
    languagesSpoken: [],
    avgResponseTimeLabel: null,
    location_display: worker.location_display ?? ([worker.town, worker.postcode].filter(Boolean).join(" ") || null),
    town: worker.town,
    postcode: worker.postcode,
    status: "active",
    available_today: worker.available_today,
    right_to_work: worker.right_to_work,
    contract_signed: worker.contract_signed,
    contract_status: null,
    contract_signed_at: null,
    onboarding_status: null,
    id_document_uploaded: false,
    cscs_uploaded: false,
    portfolio_uploaded: false,
    certificates_uploaded: false,
    profileImageUrl: imageUrl,
    cardImageUrl: imageUrl,
    work_readiness: null,
    priority_tier: worker.priority_tier,
    whatsapp_opt_in: worker.whatsapp_opt_in,
    expected_rate: 0,
    reliability_score: 0,
    created_at: "",
    stathub: {
      status: "insufficient",
      overallScore: worker.site_score,
      reliabilityScore: null,
      siteConductScore: null,
      workQualityScore: null,
      internalScoreSnapshot: worker.site_score,
      verifiedBookingsCount: worker.verified_bookings,
      nextReleaseAt: null,
    },
    statHubMeta: {
      verifiedCompletedJobsCount: worker.verified_bookings,
      reviewedJobsCount: 0,
      portfolioBackedJobsCount: 0,
      repeatBookedCount: 0,
      status: "insufficient",
    },
    performanceSummary: {},
    portfolio: [],
    credentialsSummary: [],
    credentialsCompliance: {
      cscsVerified: false,
      rightToWorkVerified: worker.right_to_work,
    },
    clientFeedbackHighlights: [],
    completed_jobs_count: worker.verified_bookings,
    recent_completed_jobs: [],
  };
}

function hasValue(values: string | string[] | null | undefined, target: string) {
  return normaliseToArray(values).some((item) => item.toLowerCase() === target.toLowerCase());
}

function getAdditionalSkillTags(skillTags: string[], skillsRequired: string[]) {
  const requiredValues = new Set(skillsRequired.map((item) => item.toLowerCase()));
  return skillTags.filter((tag) => !requiredValues.has(tag.toLowerCase()));
}

function formatCscsRequired(job: Pick<JobOverviewRow, "cscs_required" | "skill_tags" | "skills_required">) {
  if (job.cscs_required === true) return "Yes";
  if (job.cscs_required === false) return "No";

  return hasValue(job.skill_tags, "CSCS") || hasValue(job.skills_required, "CSCS") ? "Yes" : "No";
}

function formatDbsRequired(job: Pick<JobOverviewRow, "dbs_required" | "enhanced_dbs_required" | "dbs_requirement">) {
  if (job.enhanced_dbs_required === true) {
    return "Yes — Enhanced DBS required";
  }

  if (job.dbs_required === true) {
    return job.dbs_requirement ? `Yes — ${job.dbs_requirement}` : "Yes";
  }

  if (job.dbs_required === false) {
    return "No";
  }

  if (job.dbs_requirement) {
    return `Yes — ${job.dbs_requirement}`;
  }

  return null;
}

function parseDisplayDate(value: Date | string | null | undefined) {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;

  const dateOnlyMatch = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (dateOnlyMatch) {
    const [, year, month, day] = dateOnlyMatch;
    return new Date(Number(year), Number(month) - 1, Number(day));
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function getInvoiceDispatchDate(startDateValue: string | null | undefined) {
  const start = parseDisplayDate(startDateValue);
  if (!start) return null;

  const day = start.getDay();
  const daysUntilFriday = (5 - day + 7) % 7;
  const dispatchDate = new Date(start);
  dispatchDate.setDate(start.getDate() + daysUntilFriday);

  return dispatchDate;
}

function addDays(date: Date | null, days: number) {
  if (!date) return null;

  const result = new Date(date);
  result.setDate(result.getDate() + days);

  return result;
}

function formatDisplayDate(dateValue: Date | string | null | undefined) {
  const date = parseDisplayDate(dateValue);
  if (!date) return "Not provided";

  return new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function formatJobPayRate(job: Pick<JobOverviewRow, "pay_rate_display" | "pay_rate">) {
  return job.pay_rate_display ?? job.pay_rate ?? null;
}

function formatCanonicalPayRate(job: Pick<JobOverviewRow, "pay_rate_display" | "pay_rate" | "pay_rate_amount" | "pay_rate_unit">) {
  if (job.pay_rate) return job.pay_rate;
  if (job.pay_rate_amount != null) return `£${job.pay_rate_amount}${job.pay_rate_unit ? ` ${job.pay_rate_unit}` : ""}`;
  return job.pay_rate_display ?? null;
}

function formatJobDuration(job: Pick<JobOverviewRow, "duration" | "start_date" | "end_date">) {
  if (job.duration) return job.duration;
  if (!job.end_date) return null;

  const startDate = parseDisplayDate(job.start_date);
  const endDate = parseDisplayDate(job.end_date);
  if (!startDate || !endDate) return null;

  return `${formatDisplayDate(startDate)} to ${formatDisplayDate(endDate)}`;
}

function getDetailIcon(label: string) {
  const normalized = label.toLowerCase();
  if (normalized.includes("phone") || normalized.includes("mobile")) return <MobileIcon />;
  if (normalized.includes("email")) return <EnvelopeClosedIcon />;
  if (normalized.includes("area") || normalized.includes("postcode") || normalized.includes("location")) return <SewingPinIcon />;
  if (normalized.includes("role") || normalized.includes("trade") || normalized.includes("worker") || normalized.includes("workforce")) return <PersonIcon />;
  if (normalized.includes("date") || normalized.includes("duration")) return <CalendarIcon />;
  if (normalized.includes("time") || normalized.includes("window")) return <ClockIcon />;
  if (normalized.includes("invoice") || normalized.includes("payment")) return <FileTextIcon />;
  if (normalized.includes("status") || normalized.includes("confirmed") || normalized.includes("compliance")) return <CheckCircledIcon />;
  if (normalized.includes("skill") || normalized.includes("certificate") || normalized.includes("cscs") || normalized.includes("dbs")) return <IdCardIcon />;
  return <ReaderIcon />;
}

function DetailField({ label, value }: { label: string; value: string | number | boolean | null | undefined }) {
  return (
    <div className="rd-detail-field">
      <div className="rd-detail-label">
        <span className="rd-detail-label-icon" aria-hidden="true">{getDetailIcon(label)}</span>
        <span>{label}</span>
      </div>
      <div className="rd-detail-value">{formatDetailValue(value)}</div>
    </div>
  );
}

function DetailGrid({
  fields,
  className = "",
}: {
  fields: Array<[string, string | number | boolean | null | undefined]>;
  className?: string;
}) {
  return (
    <div className={`rd-detail-grid${className ? ` ${className}` : ""}`}>
      {fields.map(([label, value]) => (
        <DetailField key={label} label={label} value={value} />
      ))}
    </div>
  );
}

function CollapsibleSection({
  title,
  defaultOpen = false,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <section className="job-detail-accordion-card" data-open={open}>
      <button
        type="button"
        className="job-detail-accordion-trigger"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
      >
        <span className="job-detail-accordion-title-wrap">
          <span className="job-detail-accordion-title">{title}</span>
        </span>
        <span className="job-detail-accordion-chevron" aria-hidden="true">
          {open ? "⌃" : "⌄"}
        </span>
      </button>

      {open ? <div className="job-detail-accordion-body">{children}</div> : null}
    </section>
  );
}

export function JobOverviewTable({
  jobs,
  invoiceFeaturesEnabled = false,
  onDeleteSuccess,
  mode = "admin",
  onBroadcastStatusUpdated,
  onJobUpdated,
}: {
  jobs: JobOverviewRow[];
  invoiceFeaturesEnabled?: boolean;
  onDeleteSuccess?: (jobId: string) => void;
  onBroadcastStatusUpdated?: (jobId: string, status: BroadcastStatus) => void;
  onJobUpdated?: (job: JobOverviewRow) => void;
  mode?: "admin" | "job_provider";
}) {
  const router = useRouter();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [activeJob, setActiveJob] = useState<JobOverviewRow | null>(null);
  const [invoiceJob, setInvoiceJob] = useState<JobOverviewRow | null>(null);
  const [pageError, setPageError] = useState("");
  const [busyBroadcastJobId, setBusyBroadcastJobId] = useState<string | null>(null);

  const isAdmin = mode === "admin";

  function toggleSelection(jobId: string) {
    setPageError("");
    setSelectedIds((current) =>
      current.includes(jobId)
        ? current.filter((id) => id !== jobId)
        : [...current, jobId],
    );
  }

  async function openJob(job: JobOverviewRow) {
    setActiveJob(job);
    if (isAdmin && process.env.NODE_ENV === "development") {
      console.log("[admin-jobs] opening job", job.job_id, {
        listRequestedWorkforce: job.requestedWorkforce || job.requestedWorkers || job.requested_workers,
      });
    }
    try {
      const response = await fetch(`/api/jobs/${job.job_id}`, { cache: "no-store" });
      const payload = await response.json().catch(() => null);
      if (response.ok && payload?.job) {
        const refreshedRequested =
          payload.job.requestedWorkforce ||
          payload.job.requested_workers ||
          payload.job.requestedWorkers ||
          payload.job.client_requested_workforce ||
          [];
        if (isAdmin && process.env.NODE_ENV === "development") {
          console.log("[admin-jobs] refreshed job requested workforce", {
            jobId: job.job_id,
            requestedWorkforce: refreshedRequested,
          });
        } else if (process.env.NODE_ENV === "development") {
          console.log("[client-jobs] refreshed job requested workforce", {
            jobId: job.job_id,
            requestedWorkforce: refreshedRequested,
          });
        }
        const refreshedJob = {
          ...job,
          ...payload.job,
          workers_confirmed: Number(payload.job.workersConfirmed ?? payload.job.workers_confirmed ?? payload.job.confirmed_workforce_count ?? job.workers_confirmed ?? 0),
          workersConfirmed: Number(payload.job.workersConfirmed ?? payload.job.workers_confirmed ?? payload.job.confirmed_workforce_count ?? job.workersConfirmed ?? job.workers_confirmed ?? 0),
          confirmed_workforce_count: Number(payload.job.confirmed_workforce_count ?? payload.job.workersConfirmed ?? payload.job.workers_confirmed ?? job.confirmed_workforce_count ?? 0),
          matchingWorkers:
            (payload.job.matchingWorkers?.length ? payload.job.matchingWorkers : null) ||
            (payload.job.matching_workers?.length ? payload.job.matching_workers : null) ||
            (job.matchingWorkers?.length ? job.matchingWorkers : null) ||
            (job.matching_workers?.length ? job.matching_workers : null) ||
            [],
          matching_workers:
            (payload.job.matching_workers?.length ? payload.job.matching_workers : null) ||
            (payload.job.matchingWorkers?.length ? payload.job.matchingWorkers : null) ||
            (job.matching_workers?.length ? job.matching_workers : null) ||
            (job.matchingWorkers?.length ? job.matchingWorkers : null) ||
            [],
          requestedWorkforce: refreshedRequested,
          requestedWorkers: payload.job.requestedWorkers || refreshedRequested,
          requested_workers: payload.job.requested_workers || refreshedRequested,
          client_requested_workforce: payload.job.client_requested_workforce || refreshedRequested,
          requestedWorkerIds: payload.job.requestedWorkerIds || refreshedRequested.map((worker: { id?: string }) => worker.id).filter(Boolean),
        } as JobOverviewRow;
        setActiveJob((current) => ({
          ...refreshedJob,
          matchingWorkers:
            refreshedJob.matchingWorkers?.length
              ? refreshedJob.matchingWorkers
              : current?.matchingWorkers || refreshedJob.matchingWorkers || [],
          matching_workers:
            refreshedJob.matching_workers?.length
              ? refreshedJob.matching_workers
              : current?.matching_workers || refreshedJob.matching_workers || [],
        }));
        onJobUpdated?.(refreshedJob);
      }
    } catch (error) {
      if (process.env.NODE_ENV !== "production") {
        console.error(isAdmin ? "[admin-jobs] failed to refresh requested workforce" : "[client-jobs] failed to refresh requested workforce", error);
      }
    }
  }

  async function handleDelete(jobId: string, jobTitle: string) {
    const confirmed = window.confirm(`Delete job "${jobTitle}"? This cannot be undone.`);
    if (!confirmed) return;

    const response = await fetch(`/api/jobs/${jobId}`, { method: "DELETE" });
    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      window.alert(payload.error ?? "Unable to delete job.");
      return;
    }

    onDeleteSuccess?.(jobId);
    router.refresh();
  }

  function formatBroadcastStatusError(payload: unknown) {
    const error = payload && typeof payload === "object" && "error" in payload
      ? (payload as { error?: unknown }).error
      : null;

    if (error && typeof error === "object") {
      const value = error as { message?: unknown; code?: unknown; details?: unknown; hint?: unknown };
      const message = typeof value.message === "string" ? value.message : "Unable to update broadcast status.";
      const code = typeof value.code === "string" ? value.code : null;
      const details = typeof value.details === "string" ? value.details : null;
      const hint = typeof value.hint === "string" ? value.hint : null;
      const schemaText = `${message} ${details ?? ""} ${hint ?? ""}`.toLowerCase();

      if (schemaText.includes("schema cache") || schemaText.includes("could not find") || schemaText.includes("does not exist")) {
        return "Broadcast status could not be updated because the database schema is out of date. Run the latest migration and reload the PostgREST schema cache.";
      }

      if (schemaText.includes("check constraint") || code === "23514") {
        return "Broadcast status could not be updated because this status is not allowed by the database constraint.";
      }

      if (message.toLowerCase().includes("admin access")) {
        return "Broadcast status could not be updated because you do not have admin permission.";
      }

      return [message, code ? `Code: ${code}` : null, details, hint ? `Hint: ${hint}` : null]
        .filter(Boolean)
        .join(" ");
    }

    if (payload && typeof payload === "object" && "error" in payload && typeof (payload as { error?: unknown }).error === "string") {
      return (payload as { error: string }).error;
    }

    return "Unable to update broadcast status.";
  }

  async function handleBroadcastStatusChange(jobId: string, newStatus: string) {
    if (!isBroadcastStatus(newStatus)) {
      setPageError("Invalid broadcast status.");
      return;
    }

    setPageError("");
    setBusyBroadcastJobId(jobId);

    let response: Response;
    let payload: unknown;
    try {
      response = await fetch(`/api/jobs/${jobId}/broadcast-status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ broadcast_status: newStatus }),
      });
      payload = await response.json().catch(() => ({}));
    } catch (error) {
      setBusyBroadcastJobId(null);
      setPageError(error instanceof Error ? error.message : "Unable to update broadcast status.");
      return;
    }
    setBusyBroadcastJobId(null);

    const resultFlags = payload && typeof payload === "object"
      ? (payload as { success?: unknown; ok?: unknown })
      : {};
    if (!response.ok || resultFlags.ok !== true) {
      setPageError(formatBroadcastStatusError(payload));
      return;
    }

    const updatedJob = payload && typeof payload === "object" && "job" in payload
      ? (payload as { job?: { id?: unknown; broadcast_status?: unknown } }).job
      : null;
    const updatedStatus = normaliseBroadcastStatus(
      typeof updatedJob?.broadcast_status === "string" ? updatedJob.broadcast_status : newStatus,
    );
    const updatedJobId = typeof updatedJob?.id === "string" ? updatedJob.id : jobId;
    onBroadcastStatusUpdated?.(updatedJobId, updatedStatus);
    router.refresh();
  }

  function openInvoiceModal(job: JobOverviewRow) {
    setPageError("");
    setInvoiceJob(job);
  }

  function handleOpenInvoiceEmail() {
    setPageError("");

    if (!invoiceFeaturesEnabled) {
      setPageError("Invoice email is unavailable until the latest invoice migration has been applied.");
      return;
    }

    const selectedJobs = jobs.filter((job) => selectedIds.includes(job.job_id));

    if (selectedJobs.length === 0) {
      setPageError("Select at least one job to prepare an invoice email.");
      return;
    }

    if (selectedJobs.length > 1) {
      setPageError("Please select one job at a time for invoice email.");
      return;
    }

    openInvoiceModal(selectedJobs[0]);
  }

  return (
    <>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "1rem",
          flexWrap: "wrap",
          marginBottom: "1rem",
        }}
      >
        <p style={{ margin: 0 }}>Selected jobs: {selectedIds.length}</p>
        <div className="ml-auto flex items-center gap-2">
          {isAdmin ? (
            <button
              type="button"
              disabled={selectedIds.length === 0 || !invoiceFeaturesEnabled}
              onClick={handleOpenInvoiceEmail}
            >
              Invoice Email
            </button>
          ) : null}
        </div>
      </div>

      {pageError ? (
        <div
          style={{
            marginBottom: "1rem",
            padding: "0.75rem 1rem",
            borderRadius: 8,
            border: "1px solid #fecaca",
            background: "#fff1f2",
            color: "#991b1b",
          }}
        >
          {pageError}
        </div>
      ) : null}

      <div className="desktop-overview-table-shell" style={{ overflowX: "auto" }}>
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            background: "var(--rd-bg-elevated)",
          }}
        >
          <thead>
            <tr>
              <th style={{ textAlign: "left", padding: "0.75rem", borderBottom: "1px solid var(--rd-border)" }}>
                <Checkbox
                  checked={
                    jobs.length > 0 && selectedIds.length === jobs.length
                      ? true
                      : selectedIds.length > 0
                        ? "indeterminate"
                        : false
                  }
                  onCheckedChange={(checked) => {
                    setSelectedIds(checked === true ? jobs.map((job) => job.job_id) : []);
                  }}
                  aria-label="Select all jobs"
                  color="blue"
                  variant="soft"
                  size="2"
                />
              </th>
              <th style={{ textAlign: "left", padding: "0.75rem", borderBottom: "1px solid var(--rd-border)" }}>Title</th>
              <th style={{ textAlign: "left", padding: "0.75rem", borderBottom: "1px solid var(--rd-border)" }}>Provider</th>
              <th style={{ textAlign: "left", padding: "0.75rem", borderBottom: "1px solid var(--rd-border)" }}>Area</th>
              <th style={{ textAlign: "left", padding: "0.75rem", borderBottom: "1px solid var(--rd-border)" }}>Postcode</th>
              <th style={{ textAlign: "left", padding: "0.75rem", borderBottom: "1px solid var(--rd-border)" }}>Start Date</th>
              <th style={{ textAlign: "left", padding: "0.75rem", borderBottom: "1px solid var(--rd-border)" }}>Required</th>
              <th style={{ textAlign: "left", padding: "0.75rem", borderBottom: "1px solid var(--rd-border)" }}>Confirmed</th>
              <th style={{ textAlign: "left", padding: "0.75rem", borderBottom: "1px solid var(--rd-border)" }}>Broadcast</th>
              <th style={{ textAlign: "left", padding: "0.75rem", borderBottom: "1px solid var(--rd-border)" }}>Payment</th>
              <th style={{ textAlign: "left", padding: "0.75rem", borderBottom: "1px solid var(--rd-border)" }}>Job Status</th>
              <th style={{ textAlign: "left", padding: "0.75rem", borderBottom: "1px solid var(--rd-border)" }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {jobs.map((job) => {
              const workersConfirmed =
                Number(
                  job.workersConfirmed ??
                  job.workers_confirmed ??
                  job.confirmed_workforce_count ??
                  job.acceptedWorkforce?.length ??
                  0,
                );
              const confirmedNames =
                job.confirmedWorkerNames ||
                job.confirmed_worker_names ||
                job.confirmed_workforce_names ||
                job.confirmedWorkforce?.map((worker) => worker.name).filter(Boolean) ||
                job.acceptedWorkforce?.map((worker) => worker.name).filter(Boolean) ||
                [];

              return (
              <tr key={job.job_id}>
                <td style={{ padding: "0.75rem", borderBottom: "1px solid var(--rd-border)" }}>
                  <Checkbox
                    checked={selectedIds.includes(job.job_id)}
                    onCheckedChange={() => toggleSelection(job.job_id)}
                    aria-label={`Select ${job.job_title}`}
                    color="blue"
                    variant="soft"
                    size="2"
                  />
                </td>
                <td style={{ padding: "0.75rem", borderBottom: "1px solid var(--rd-border)" }}>
                  <button
                    type="button"
                    onClick={() => openJob(job)}
                    style={{
                      background: "none",
                      border: "none",
                      padding: 0,
                      color: "var(--rd-text)",
                      textDecoration: "underline",
                      cursor: "pointer",
                      font: "inherit",
                    }}
                  >
                    {job.job_title}
                  </button>
                </td>
                <td style={{ padding: "0.75rem", borderBottom: "1px solid var(--rd-border)" }}>{job.company_name}</td>
                <td style={{ padding: "0.75rem", borderBottom: "1px solid var(--rd-border)" }}>{job.area ?? "-"}</td>
                <td style={{ padding: "0.75rem", borderBottom: "1px solid var(--rd-border)" }}>{job.postcode}</td>
                <td style={{ padding: "0.75rem", borderBottom: "1px solid var(--rd-border)" }}>{job.start_date}</td>
                <td style={{ padding: "0.75rem", borderBottom: "1px solid var(--rd-border)" }}>{job.workers_required}</td>
                <td style={{ padding: "0.75rem", borderBottom: "1px solid var(--rd-border)" }}>
                  <span>{workersConfirmed}</span>
                  {confirmedNames.length > 0 ? (
                    <span style={{ display: "block", color: "var(--rd-text-muted)", fontSize: "0.78rem", marginTop: 2 }}>
                      {confirmedNames.join(", ")}
                    </span>
                  ) : null}
                </td>
                <td style={{ padding: "0.75rem", borderBottom: "1px solid var(--rd-border)" }}>
                  {isAdmin ? (
                    <select
                      value={normaliseBroadcastStatus(job.broadcast_status)}
                      disabled={busyBroadcastJobId === job.job_id}
                      onChange={(event) => handleBroadcastStatusChange(job.job_id, event.target.value)}
                      style={{ fontSize: "0.875rem", padding: "0.25rem" }}
                    >
                      {BROADCAST_STATUS_OPTIONS.map((status) => (
                        <option key={status} value={status}>{BROADCAST_STATUS_LABELS[status]}</option>
                      ))}
                    </select>
                  ) : (
                    BROADCAST_STATUS_LABELS[normaliseBroadcastStatus(job.broadcast_status)]
                  )}
                </td>
                <td style={{ padding: "0.75rem", borderBottom: "1px solid var(--rd-border)" }}>{job.payment_status}</td>
                <td style={{ padding: "0.75rem", borderBottom: "1px solid var(--rd-border)" }}>{job.job_status}</td>
                <td style={{ padding: "0.75rem", borderBottom: "1px solid var(--rd-border)" }}>
                  {isAdmin && invoiceFeaturesEnabled
                    ? (() => {
                        const invoiceReminder = getInvoiceReminder(job);
                        return invoiceReminder ? (
                          <span
                            style={{
                              display: "inline-block",
                              marginBottom: "0.5rem",
                              padding: "0.2rem 0.5rem",
                              borderRadius: 999,
                              background: "#fee2e2",
                              color: "#b91c1c",
                              fontSize: 12,
                              fontWeight: 600,
                            }}
                          >
                            {invoiceReminder.text}
                          </span>
                        ) : null;
                      })()
                    : null}
                  <div className="flex flex-col gap-2">
                    <Link href={`/jobs/${job.job_id}/edit`}>Edit</Link>
                    <button type="button" onClick={() => handleDelete(job.job_id, job.job_title)}>
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <Box className="mobile-radix-table-shell">
        <ScrollArea type="auto" scrollbars="horizontal" className="mobile-radix-table-scroll">
          <Table.Root
            variant="surface"
            size="1"
            layout="fixed"
            className="mobile-radix-overview-table"
          >
            <Table.Header>
              <Table.Row>
                <Table.ColumnHeaderCell width="48px">
                  <Checkbox
                    checked={
                      jobs.length > 0 && selectedIds.length === jobs.length
                        ? true
                        : selectedIds.length > 0
                          ? "indeterminate"
                          : false
                    }
                    onCheckedChange={(checked) => {
                      setSelectedIds(checked === true ? jobs.map((job) => job.job_id) : []);
                    }}
                    aria-label="Select all jobs"
                    color="blue"
                    variant="soft"
                    size="2"
                  />
                </Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell width="130px">Title</Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell width="110px">Provider</Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell width="90px">Area</Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell width="88px">Postcode</Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell width="105px">Start Date</Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell width="82px">Required</Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell width="110px">Confirmed</Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell width="130px">Broadcast</Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell width="95px">Payment</Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell width="100px">Job Status</Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell width="90px">Actions</Table.ColumnHeaderCell>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {jobs.map((job) => {
                const workersConfirmed = Number(
                  job.workersConfirmed ??
                    job.workers_confirmed ??
                    job.confirmed_workforce_count ??
                    job.acceptedWorkforce?.length ??
                    0,
                );
                const confirmedNames =
                  job.confirmedWorkerNames ||
                  job.confirmed_worker_names ||
                  job.confirmed_workforce_names ||
                  job.confirmedWorkforce?.map((worker) => worker.name).filter(Boolean) ||
                  job.acceptedWorkforce?.map((worker) => worker.name).filter(Boolean) ||
                  [];

                return (
                  <Table.Row key={job.job_id}>
                    <Table.Cell>
                      <Checkbox
                        checked={selectedIds.includes(job.job_id)}
                        onCheckedChange={() => toggleSelection(job.job_id)}
                        aria-label={`Select ${job.job_title}`}
                        color="blue"
                        variant="soft"
                        size="2"
                      />
                    </Table.Cell>
                    <Table.RowHeaderCell>
                      <button
                        type="button"
                        onClick={() => openJob(job)}
                        style={{
                          background: "none",
                          border: "none",
                          padding: 0,
                          color: "var(--rd-text)",
                          textDecoration: "underline",
                          cursor: "pointer",
                          font: "inherit",
                        }}
                      >
                        {job.job_title}
                      </button>
                    </Table.RowHeaderCell>
                    <Table.Cell>{job.company_name}</Table.Cell>
                    <Table.Cell>{job.area ?? "-"}</Table.Cell>
                    <Table.Cell>{job.postcode}</Table.Cell>
                    <Table.Cell>{job.start_date}</Table.Cell>
                    <Table.Cell>{job.workers_required}</Table.Cell>
                    <Table.Cell>
                      <span>{workersConfirmed}</span>
                      {confirmedNames.length > 0 ? (
                        <span style={{ display: "block", color: "var(--rd-text-muted)", fontSize: "0.78rem", marginTop: 2 }}>
                          {confirmedNames.join(", ")}
                        </span>
                      ) : null}
                    </Table.Cell>
                    <Table.Cell>
                      {isAdmin ? (
                        <select
                          value={normaliseBroadcastStatus(job.broadcast_status)}
                          disabled={busyBroadcastJobId === job.job_id}
                          onChange={(event) => handleBroadcastStatusChange(job.job_id, event.target.value)}
                          style={{ fontSize: "0.875rem", padding: "0.25rem" }}
                        >
                          {BROADCAST_STATUS_OPTIONS.map((status) => (
                            <option key={status} value={status}>{BROADCAST_STATUS_LABELS[status]}</option>
                          ))}
                        </select>
                      ) : (
                        BROADCAST_STATUS_LABELS[normaliseBroadcastStatus(job.broadcast_status)]
                      )}
                    </Table.Cell>
                    <Table.Cell>{job.payment_status}</Table.Cell>
                    <Table.Cell>{job.job_status}</Table.Cell>
                    <Table.Cell>
                      {isAdmin && invoiceFeaturesEnabled
                        ? (() => {
                            const invoiceReminder = getInvoiceReminder(job);
                            return invoiceReminder ? (
                              <span
                                style={{
                                  display: "inline-block",
                                  marginBottom: "0.5rem",
                                  padding: "0.2rem 0.5rem",
                                  borderRadius: 999,
                                  background: "#fee2e2",
                                  color: "#b91c1c",
                                  fontSize: 12,
                                  fontWeight: 600,
                                }}
                              >
                                {invoiceReminder.text}
                              </span>
                            ) : null;
                          })()
                        : null}
                      <div className="flex flex-col gap-2">
                        <Link href={`/jobs/${job.job_id}/edit`}>Edit</Link>
                        <button type="button" onClick={() => handleDelete(job.job_id, job.job_title)}>
                          Delete
                        </button>
                      </div>
                    </Table.Cell>
                  </Table.Row>
                );
              })}
            </Table.Body>
          </Table.Root>
        </ScrollArea>
      </Box>

      <JobDetailModal
        job={activeJob}
        open={Boolean(activeJob)}
        onClose={() => setActiveJob(null)}
        mode={mode}
        onJobUpdated={onJobUpdated}
      />
      {isAdmin && invoiceFeaturesEnabled ? (
        <InvoiceEmailModal
          job={invoiceJob}
          open={Boolean(invoiceJob)}
          onClose={() => setInvoiceJob(null)}
          onSaved={() => router.refresh()}
        />
      ) : null}
    </>
  );
}

export function JobDetailModal({
  job,
  open,
  onClose,
  mode = "admin",
  initialSection,
  onJobUpdated,
}: {
  job: JobOverviewRow | null;
  open: boolean;
  onClose: () => void;
  mode?: "admin" | "job_provider";
  initialSection?: "summary" | "skills" | "invoice" | "labour" | "dispatch";
  onJobUpdated?: (job: JobOverviewRow) => void;
}) {
  const router = useRouter();
  const isAdmin = mode === "admin";
  const [busyAssignmentId, setBusyAssignmentId] = useState<string | null>(null);
  const [localJob, setLocalJob] = useState<JobOverviewRow | null>(job);
  const [requestedSelectionIds, setRequestedSelectionIds] = useState<string[]>([]);
  const [requestedSaveBusy, setRequestedSaveBusy] = useState(false);
  const [requestedSaveMessage, setRequestedSaveMessage] = useState("");
  const [dispatchRequestedOpen, setDispatchRequestedOpen] = useState(false);
  const [completeReleaseBusy, setCompleteReleaseBusy] = useState(false);
  const [completeReleaseMessage, setCompleteReleaseMessage] = useState("");
  const [acceptedWorkers, setAcceptedWorkers] = useState<AcceptedWorkforceRow[]>([]);
  const [acceptedWorkersLoading, setAcceptedWorkersLoading] = useState(false);
  const [releaseSelectionIds, setReleaseSelectionIds] = useState<string[]>([]);
  const [attachReleaseBusy, setAttachReleaseBusy] = useState(false);
  const [attachReleaseMessage, setAttachReleaseMessage] = useState("");
  const [requestedStatusUpdating, setRequestedStatusUpdating] = useState<Record<string, boolean>>({});
  const [requestedStatusError, setRequestedStatusError] = useState("");
  const [selectedAcceptedWorker, setSelectedAcceptedWorker] = useState<NormalisedRequestedWorkforce | null>(null);
  const [selectedProfileWorker, setSelectedProfileWorker] = useState<WorkerOverviewRow | null>(null);
  const [selectedProfileRevealsContact, setSelectedProfileRevealsContact] = useState(false);
  const [requestedDispatchRecipients, setRequestedDispatchRecipients] = useState<Array<{
    id: string;
    name: string;
    phone?: string | null;
    email?: string | null;
    requestedByClient?: boolean;
  }>>([]);

  useEffect(() => {
    setLocalJob(job);
  }, [job]);

  const activeJob = localJob ?? job;
  const requestedDispatchStatuses = new Set([
    "requested",
    "client_requested",
    "requested_by_client",
    "dispatched",
    "accepted",
    "declined",
    "no_response",
  ]);

  useEffect(() => {
    if (!open || !activeJob) {
      setRequestedSelectionIds([]);
      setRequestedSaveMessage("");
      return;
    }

    setRequestedSelectionIds(
      (activeJob.matching_workers ?? [])
        .filter((worker) => worker.requested_by_client)
        .map((worker) => worker.worker_id),
    );
    setRequestedSaveMessage("");
    setCompleteReleaseMessage("");
    setAttachReleaseMessage("");
    setRequestedStatusError("");
    setSelectedAcceptedWorker(null);
    setSelectedProfileWorker(null);
    setSelectedProfileRevealsContact(false);
  }, [activeJob?.job_id, open]);

  useEffect(() => {
    if (!open || !activeJob || !isAdmin) {
      setAcceptedWorkers([]);
      setReleaseSelectionIds([]);
      return;
    }

    let cancelled = false;
    const jobId = activeJob.job_id;
    async function loadAcceptedWorkers() {
      setAcceptedWorkersLoading(true);
      try {
        const response = await fetch(`/api/jobs/${jobId}/accepted-workers`, { cache: "no-store" });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok || payload?.ok !== true) {
          throw new Error(payload?.message ?? "Unable to load accepted workforce.");
        }
        if (cancelled) return;
        const rows = Array.isArray(payload.workers) ? payload.workers as AcceptedWorkforceRow[] : [];
        setAcceptedWorkers(rows);
        setReleaseSelectionIds(
          rows
            .filter((row) => row.assignment_status === "selected_for_release" || row.assignment_status === "released_to_client")
            .map((row) => row.worker_id),
        );
      } catch (error) {
        if (!cancelled) {
          setAcceptedWorkers([]);
          setAttachReleaseMessage(error instanceof Error ? error.message : "Unable to load accepted workforce.");
        }
      } finally {
        if (!cancelled) setAcceptedWorkersLoading(false);
      }
    }

    void loadAcceptedWorkers();
    return () => {
      cancelled = true;
    };
  }, [activeJob?.job_id, isAdmin, open]);

  const requestedDispatchJob = activeJob
    ? ({
        job_id: activeJob.job_id,
        provider_id: activeJob.provider_id ?? null,
        provider_name: activeJob.company_name,
        job_title: activeJob.job_title,
        trade_type: activeJob.trade_type,
        area: activeJob.area,
        postcode: activeJob.postcode,
        start_date: activeJob.start_date,
        start_time: activeJob.start_time,
        end_time: activeJob.end_time,
        workers_required: activeJob.workers_required,
        pay_rate: activeJob.pay_rate ?? null,
        short_description: activeJob.short_description ?? "",
        alert_type: activeJob.alert_type ?? null,
        core_role: activeJob.core_role ?? null,
        duration: activeJob.duration ?? null,
        end_date: activeJob.end_date ?? null,
        pay_rate_display: activeJob.pay_rate_display ?? activeJob.pay_rate ?? null,
        duties: activeJob.duties ?? null,
        dbs_requirement: activeJob.dbs_requirement ?? null,
        dbs_required: activeJob.dbs_required,
        ipaf_required: activeJob.ipaf_required ?? null,
        own_tools_required: activeJob.own_tools_required ?? null,
        ppe_required: activeJob.ppe_required ?? null,
        skills_required: activeJob.skills_required ?? [],
        shift_pattern: activeJob.shift_pattern ?? null,
        tickets_required: activeJob.tickets_required ?? [],
        optional_supporting_notes: activeJob.optional_supporting_notes ?? null,
        payment_type: activeJob.payment_type ?? null,
        broadcast_status: activeJob.broadcast_status ?? null,
        provider_payment_reliability_status: activeJob.provider_payment_reliability_status,
        platform_backed_job: activeJob.platform_backed_job,
        platform_backed_status: activeJob.platform_backed_status,
        worker_payment_protected: activeJob.worker_payment_protected,
      } satisfies BroadcastJobOption)
    : null;

  async function saveProviderRequestedWorkers() {
    if (!activeJob) return;
    setRequestedSaveBusy(true);
    setRequestedSaveMessage("");

    try {
      const response = await fetch(`/api/jobs/${activeJob.job_id}/requested-workers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ worker_ids: requestedSelectionIds }),
      });
      const text = await response.text();
      let payload: any = null;
      try {
        payload = text ? JSON.parse(text) : null;
      } catch {
        payload = { error: text };
      }
      if (!response.ok || payload?.ok !== true) {
        console.error("[requested-workers] save failed", {
          status: response.status,
          statusText: response.statusText,
          result: payload,
        });
        throw new Error(
          payload?.error ||
          payload?.message ||
          `Unable to update requested workforce. Server returned ${response.status}.`,
        );
      }

      const returnedRequested = payload.requestedWorkforce ?? payload.requestedWorkers ?? payload.requested_workers ?? [];
      const savedWorkerIds = Array.isArray(payload.requestedWorkerIds)
        ? payload.requestedWorkerIds
        : payload.requested_worker_ids ?? requestedSelectionIds;
      const requestedSet = new Set<string>(savedWorkerIds);
      const returnedIds = new Set(
        (Array.isArray(returnedRequested) ? returnedRequested : [])
          .map((worker: any) => worker?.id || worker?.worker_id || worker?.workerId)
          .filter(Boolean),
      );
      setLocalJob((current) => {
        if (!current) return current;
        const previousMatching =
          current.matching_workers?.length
            ? current.matching_workers
            : current.matchingWorkers || [];
        const updatedMatching = previousMatching.map((worker) => {
          const id = worker.worker_id || worker.id || worker.workerId;
          const isRequested = Boolean(id && (returnedIds.has(id) || requestedSet.has(id)));

          if (!isRequested) {
            return {
              ...worker,
              requestedByClient: false,
              requested_by_client: false,
              isClientRequested: false,
              is_client_requested: false,
              dispatchStatus: worker.dispatchStatus ?? null,
              dispatch_status: worker.dispatch_status ?? null,
              requested_rank: null,
              assignment_status: worker.assignment_status === "requested" ? null : worker.assignment_status ?? null,
            };
          }

          return {
            ...worker,
            requestedByClient: true,
            requested_by_client: true,
            isClientRequested: true,
            is_client_requested: true,
            dispatchStatus: "requested",
            dispatch_status: "requested",
            requested_rank: savedWorkerIds.indexOf(id) + 1,
            assignment_status: "requested",
          };
        });

        return {
            ...current,
            requestedWorkforce: Array.isArray(returnedRequested) ? returnedRequested : [],
            requestedWorkers: Array.isArray(returnedRequested) ? returnedRequested : [],
            requested_workforce: Array.isArray(returnedRequested) ? returnedRequested : [],
            requested_workers: Array.isArray(returnedRequested) ? returnedRequested : [],
            requestedWorkerIds: savedWorkerIds,
            matchingWorkers: updatedMatching,
            matching_workers: updatedMatching,
          };
      });
      setRequestedSaveMessage("Requested workforce saved for admin dispatch review.");
      router.refresh();
    } catch (error) {
      setRequestedSaveMessage(error instanceof Error ? error.message : "Unable to save requested workforce.");
    } finally {
      setRequestedSaveBusy(false);
    }
  }

  function getRequestedWorkerId(worker: NormalisedRequestedWorkforce | MatchingWorker | null | undefined) {
    if (!worker) return null;
    return worker.id || worker.workerId || ("worker_id" in worker ? worker.worker_id : undefined) || null;
  }

  function formatDispatchStatus(status: string | null | undefined) {
    const value = status || "requested";
    const labels: Record<string, string> = {
      requested: "Requested",
      dispatched: "Dispatched",
      accepted: "Accepted",
      declined: "Declined",
      no_response: "No response",
    };

    return labels[value] || "Requested";
  }

  function updateRequestedStatusList<T extends Record<string, any>>(list: T[] | undefined, workerId: string, dispatchStatus: string) {
    return (list ?? []).map((item) => {
      const id = item.id || item.workerId || item.worker_id;
      if (id !== workerId) return item;
      return {
        ...item,
        dispatchStatus,
        dispatch_status: dispatchStatus,
        assignment_status: item.assignment_status === "requested" || item.assignment_status === dispatchStatus
          ? dispatchStatus
          : item.assignment_status,
      };
    });
  }

  function updateLocalRequestedWorkerStatus(workerId: string, dispatchStatus: string) {
    setLocalJob((current) => {
      if (!current) return current;
      const requestedWorkforce = updateRequestedStatusList(current.requestedWorkforce, workerId, dispatchStatus);
      const requestedWorkers = updateRequestedStatusList(current.requestedWorkers, workerId, dispatchStatus);
      const requested_workforce = updateRequestedStatusList(current.requested_workforce, workerId, dispatchStatus);
      const requested_workers = updateRequestedStatusList(current.requested_workers, workerId, dispatchStatus);
      const client_requested_workforce = updateRequestedStatusList(current.client_requested_workforce, workerId, dispatchStatus);
      const acceptedWorkforce = (requestedWorkforce.length ? requestedWorkforce : requestedWorkers).filter((item) => {
        const status = item.dispatchStatus || item.dispatch_status;
        return status === "accepted";
      });
      const workersConfirmed =
        (requestedWorkforce.length || requestedWorkers.length)
          ? acceptedWorkforce.length
          :
        Number(current.workers_confirmed || current.workersConfirmed || current.confirmed_workforce_count || 0);

      return {
        ...current,
        workers_confirmed: workersConfirmed,
        workersConfirmed,
        confirmed_workforce_count: workersConfirmed,
        acceptedWorkforce,
        acceptedWorkers: acceptedWorkforce,
        accepted_workers: acceptedWorkforce,
        confirmedWorkforce: acceptedWorkforce,
        confirmed_workers: acceptedWorkforce,
        confirmedWorkerIds: acceptedWorkforce.map((worker) => worker.id),
        confirmed_worker_ids: acceptedWorkforce.map((worker) => worker.id),
        requestedWorkforce,
        requestedWorkers,
        requested_workforce,
        requested_workers,
        client_requested_workforce,
        matchingWorkers: updateRequestedStatusList(current.matchingWorkers, workerId, dispatchStatus),
        matching_workers: updateRequestedStatusList(current.matching_workers, workerId, dispatchStatus),
        matchedWorkers: updateRequestedStatusList(current.matchedWorkers, workerId, dispatchStatus),
        matched_workers: updateRequestedStatusList(current.matched_workers, workerId, dispatchStatus),
        matches: updateRequestedStatusList(current.matches, workerId, dispatchStatus),
        contractors: updateRequestedStatusList(current.contractors, workerId, dispatchStatus),
      };
    });
  }

  async function updateRequestedWorkerDispatchStatus(worker: NormalisedRequestedWorkforce, dispatchStatus: string) {
    if (!activeJob) return;
    const workerId = getRequestedWorkerId(worker);
    if (!workerId) return;

    setRequestedStatusUpdating((current) => ({ ...current, [workerId]: true }));
    setRequestedStatusError("");

    try {
      const response = await fetch(`/api/jobs/${activeJob.job_id}/requested-workers/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workerId, dispatchStatus }),
      });
      const text = await response.text();
      let payload: any = null;
      try {
        payload = text ? JSON.parse(text) : null;
      } catch {
        payload = { error: text };
      }

      if (!response.ok || payload?.ok !== true) {
        console.error("[requested-workers/status] update failed", {
          status: response.status,
          result: payload,
        });
        throw new Error(payload?.error || `Unable to update dispatch status. Server returned ${response.status}.`);
      }

      updateLocalRequestedWorkerStatus(workerId, dispatchStatus);
      setLocalJob((current) => current
        ? {
            ...current,
            workers_confirmed: Number(payload.workersConfirmed ?? current.workers_confirmed ?? 0),
            workersConfirmed: Number(payload.workersConfirmed ?? current.workersConfirmed ?? current.workers_confirmed ?? 0),
            confirmed_workforce_count: Number(payload.confirmedWorkforceCount ?? payload.workersConfirmed ?? current.confirmed_workforce_count ?? 0),
            confirmedWorkerIds: Array.isArray(payload.confirmedWorkerIds) ? payload.confirmedWorkerIds : current.confirmedWorkerIds,
            confirmed_worker_ids: Array.isArray(payload.confirmedWorkerIds) ? payload.confirmedWorkerIds : current.confirmed_worker_ids,
          }
        : current);
      const updatedJob = {
        ...activeJob,
        workers_confirmed: Number(payload.workersConfirmed ?? activeJob.workers_confirmed ?? 0),
        workersConfirmed: Number(payload.workersConfirmed ?? activeJob.workersConfirmed ?? activeJob.workers_confirmed ?? 0),
        confirmed_workforce_count: Number(payload.confirmedWorkforceCount ?? payload.workersConfirmed ?? activeJob.confirmed_workforce_count ?? 0),
        confirmedWorkerIds: Array.isArray(payload.confirmedWorkerIds) ? payload.confirmedWorkerIds : activeJob.confirmedWorkerIds,
        confirmed_worker_ids: Array.isArray(payload.confirmedWorkerIds) ? payload.confirmedWorkerIds : activeJob.confirmed_worker_ids,
      };
      onJobUpdated?.(updatedJob);
      if (dispatchStatus === "accepted") {
        setAcceptedWorkers((current) => {
          if (current.some((row) => row.worker_id === workerId)) return current;
          return [
            ...current,
            {
              assignment_id: payload.assignment?.id ?? `requested-${workerId}`,
              worker_id: workerId,
              assignment_status: "accepted",
              accepted_at: payload.assignment?.accepted_at ?? payload.assignment?.updated_at ?? new Date().toISOString(),
              selected_for_release_at: null,
              released_to_client_at: null,
              worker: {
                name: worker.name,
                role: worker.primaryRole,
                workforce_type: worker.workforceType,
                location: worker.locationLabel || formatLocation(worker.area, worker.postcode),
                postcode: worker.postcode,
                phone: worker.phone ?? null,
                email: worker.email ?? null,
                site_score: null,
                compliance_summary: [],
              },
            },
          ];
        });
      } else {
        setAcceptedWorkers((current) => current.filter((row) => row.worker_id !== workerId));
      }
      router.refresh();
    } catch (error) {
      setRequestedStatusError(error instanceof Error ? error.message : "Unable to update dispatch status. Please try again.");
    } finally {
      setRequestedStatusUpdating((current) => ({ ...current, [workerId]: false }));
    }
  }

  function openRequestedWorkforceDispatch(workers: NormalisedRequestedWorkforce[]) {
    const recipients = workers
      .map((worker) => {
        const id = getRequestedWorkerId(worker);
        if (!id) return null;
        return {
          id,
          name: worker.name,
          phone: worker.phone ?? null,
          email: worker.email ?? null,
          requestedByClient: true,
        };
      })
      .filter(Boolean) as Array<{ id: string; name: string; phone?: string | null; email?: string | null; requestedByClient?: boolean }>;

    if (recipients.length === 0) return;
    setRequestedDispatchRecipients(recipients);
    setDispatchRequestedOpen(true);
  }

  function openAcceptedWorkerDetails(worker: NormalisedRequestedWorkforce) {
    const dispatchStatus = worker.dispatchStatus || worker.dispatch_status || "requested";
    if (isAdmin || dispatchStatus !== "accepted") return;
    setSelectedAcceptedWorker(worker);
  }

  async function openWorkerProfile(workerId: string | null | undefined, fallback: WorkerOverviewRow, revealContactDetails = false) {
    setSelectedProfileRevealsContact(revealContactDetails);
    setSelectedProfileWorker(fallback);

    if (!workerId) return;

    try {
      const response = await fetch(`/api/workers/${workerId}`, { cache: "no-store" });
      const payload = await response.json().catch(() => ({}));
      if (response.ok && payload?.success && payload.worker) {
        setSelectedProfileWorker(payload.worker as WorkerOverviewRow);
      }
    } catch (error) {
      if (process.env.NODE_ENV !== "production") {
        console.warn("[JobDetailModal] failed to hydrate worker profile", error);
      }
    }
  }

  async function completeBroadcastAndReleaseDetails() {
    if (!activeJob) return;
    if (acceptedWorkers.length === 0) {
      setCompleteReleaseMessage("No workforce has accepted this dispatch yet.");
      return;
    }
    if (!acceptedWorkers.some((worker) => worker.assignment_status === "selected_for_release")) {
      setCompleteReleaseMessage("Select accepted workforce before releasing details to the client.");
      return;
    }
    setCompleteReleaseBusy(true);
    setCompleteReleaseMessage("");

    try {
      const response = await fetch(`/api/jobs/${activeJob.job_id}/complete-broadcast-release`, {
        method: "POST",
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || payload?.ok !== true) {
        const message =
          payload?.message ??
          "Unable to complete broadcast and release accepted workforce details.";
        throw new Error(message);
      }

      const releasedWorkerIds = Array.isArray(payload?.released_worker_ids)
        ? payload.released_worker_ids.map((workerId: unknown) => String(workerId))
        : [];
      const releasedSet = new Set(releasedWorkerIds);
      const releasedRows = Array.isArray(payload.workers) ? payload.workers as AcceptedWorkforceRow[] : [];
      if (releasedRows.length > 0) {
        setAcceptedWorkers((current) =>
          current.map((worker) => releasedSet.has(worker.worker_id)
            ? releasedRows.find((row) => row.worker_id === worker.worker_id) ?? {
                ...worker,
                assignment_status: "released_to_client",
                released_to_client_at: new Date().toISOString(),
              }
            : worker),
        );
      }
      setLocalJob((current) => current
        ? {
            ...current,
            broadcast_status: "completed",
            matching_workers: (current.matching_workers ?? []).map((worker) => ({
              ...worker,
              broadcast_completed: worker.accepted_by_worker ? true : worker.broadcast_completed,
              released_to_client: releasedSet.has(worker.worker_id) ? true : worker.released_to_client,
              released_to_client_at: releasedSet.has(worker.worker_id)
                ? new Date().toISOString()
                : worker.released_to_client_at ?? null,
            })),
          }
        : current);
      setCompleteReleaseMessage(payload.message ?? "Broadcast completed. Selected workforce details have been released to the client.");
      router.refresh();
    } catch (error) {
      setCompleteReleaseMessage(
        error instanceof Error
          ? error.message
          : "Unable to complete broadcast and release accepted workforce details.",
      );
    } finally {
      setCompleteReleaseBusy(false);
    }
  }

  async function attachSelectedAcceptedWorkers() {
    if (!activeJob) return;
    if (releaseSelectionIds.length === 0) {
      setAttachReleaseMessage("Select accepted workforce before attaching them to this job.");
      return;
    }
    setAttachReleaseBusy(true);
    setAttachReleaseMessage("");

    try {
      const response = await fetch(`/api/jobs/${activeJob.job_id}/select-accepted-workers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workerIds: releaseSelectionIds }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || payload?.ok !== true) {
        throw new Error(payload?.error ?? payload?.message ?? "Unable to attach selected workforce.");
      }
      const selectedRows = Array.isArray(payload.workers) ? payload.workers as AcceptedWorkforceRow[] : [];
      const selectedByWorkerId = new Map(selectedRows.map((row) => [row.worker_id, row]));
      setAcceptedWorkers((current) =>
        current.map((worker) => selectedByWorkerId.get(worker.worker_id) ?? worker),
      );
      setLocalJob((current) => {
        if (!current) return current;
        const confirmedWorkerIds = Array.isArray(payload.confirmedWorkerIds)
          ? payload.confirmedWorkerIds.map((workerId: unknown) => String(workerId))
          : releaseSelectionIds;
        const workersConfirmed = Number(payload.workersConfirmed ?? payload.confirmedWorkforceCount ?? confirmedWorkerIds.length);
        const currentAccepted =
          current.acceptedWorkforce ||
          current.acceptedWorkers ||
          current.accepted_workers ||
          current.requestedWorkforce?.filter((worker) => (worker.dispatchStatus || worker.dispatch_status) === "accepted") ||
          [];
        return {
          ...current,
          ...(payload.job ?? {}),
          workers_confirmed: workersConfirmed,
          workersConfirmed,
          confirmed_workforce_count: workersConfirmed,
          confirmedWorkerIds,
          confirmed_worker_ids: confirmedWorkerIds,
          confirmedWorkforce: current.confirmedWorkforce || current.confirmed_workers || currentAccepted,
          confirmed_workers: current.confirmed_workers || current.confirmedWorkforce || currentAccepted,
        };
      });
      setAttachReleaseMessage("Selected accepted workforce has been attached to this job.");
      setCompleteReleaseMessage("");
    } catch (error) {
      setAttachReleaseMessage(error instanceof Error ? error.message : "Unable to attach selected workforce.");
    } finally {
      setAttachReleaseBusy(false);
    }
  }

  async function updateLabourPayment(assignmentId: string, patch: Record<string, unknown>) {
    if (!activeJob) return;
    setBusyAssignmentId(assignmentId);
    const response = await fetch(`/api/jobs/${activeJob.job_id}/labour-payments/${assignmentId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    const payload = await response.json().catch(() => ({}));
    setBusyAssignmentId(null);
    if (!response.ok || !payload.success) {
      window.alert(payload.error ?? "Unable to update labour payment.");
      return;
    }
    setLocalJob((current) => current
      ? {
          ...current,
          labour_payments: (current.labour_payments ?? []).map((row) =>
            row.assignment_id === assignmentId ? { ...row, ...payload.labourPayment } : row,
          ),
        }
      : current);
    router.refresh();
  }

  return (
    <Modal
      open={open}
      title={activeJob?.job_title ?? "Job Details"}
      onClose={onClose}
    >
      {activeJob ? (() => {
        const invoiceDispatchDate = getInvoiceDispatchDate(activeJob.start_date);
        const invoiceDueDate = addDays(invoiceDispatchDate, 14);
        const skillTags = normaliseToArray(activeJob.skill_tags);
        const skillsRequired = normaliseToArray(activeJob.skills_required);
        const additionalSkillTags = getAdditionalSkillTags(skillTags, skillsRequired);
        const openInvoice = initialSection === "invoice";
        const openLabour = initialSection === "labour";
        const openDispatch = initialSection === "dispatch";
        const openSkills = initialSection === "skills";
        const broadcastStatus =
          activeJob.broadcast_status ||
          activeJob.broadcastStatus ||
          activeJob.dispatch_status ||
          "broadcast ready";
        const explicitRequested = [
          activeJob.requestedWorkforce,
          activeJob.requestedWorkers,
          activeJob.requested_workforce,
          activeJob.requested_workers,
          activeJob.client_requested_workforce,
        ].filter(Array.isArray).flat();
        const matchingWorkersForRequestedFallback = [
          activeJob.matchingWorkers,
          activeJob.matching_workers,
          activeJob.matchedWorkers,
          activeJob.matched_workers,
          activeJob.matches,
          activeJob.contractors,
        ].filter(Array.isArray).flat();
        const requestedWorkforce = resolveRequestedWorkforce(activeJob);
        const modalMatchingWorkers =
          activeJob.matching_workers?.length
            ? activeJob.matching_workers
            : activeJob.matchingWorkers || [];
        const fallbackRequested = Array.isArray(matchingWorkersForRequestedFallback)
          ? matchingWorkersForRequestedFallback.filter((worker: any) =>
              worker?.requestedByClient === true ||
              worker?.requested_by_client === true ||
              worker?.isClientRequested === true ||
              worker?.is_client_requested === true ||
              requestedDispatchStatuses.has(worker?.dispatchStatus) ||
              requestedDispatchStatuses.has(worker?.dispatch_status) ||
              requestedDispatchStatuses.has(worker?.status) ||
              requestedDispatchStatuses.has(worker?.assignment_status)
            )
          : [];
        if (isAdmin && process.env.NODE_ENV === "development") {
          console.log("[JobDetailModal] admin requested workforce resolved", {
            jobId: activeJob.job_id,
            role: "admin",
            explicitRequested,
            resolvedRequestedWorkforce: requestedWorkforce,
            rawRequestedFields: {
              requestedWorkforce: activeJob.requestedWorkforce,
              requested_workforce: activeJob.requested_workforce,
              requestedWorkers: activeJob.requestedWorkers,
              requested_workers: activeJob.requested_workers,
              client_requested_workforce: activeJob.client_requested_workforce,
              requestedWorkerIds: activeJob.requestedWorkerIds,
            },
          });
        }
        const acceptedRequestedWorkers = requestedWorkforce.filter((worker) => {
          const status = worker.dispatchStatus || worker.dispatch_status;
          return status === "accepted";
        });
        const acceptedRequestedIds = new Set(
          acceptedRequestedWorkers.map((worker) => getRequestedWorkerId(worker)).filter(Boolean),
        );
        const acceptedRows = [
          ...acceptedWorkers,
          ...acceptedRequestedWorkers
            .filter((worker) => {
              const workerId = getRequestedWorkerId(worker);
              return Boolean(workerId && !acceptedWorkers.some((row) => row.worker_id === workerId));
            })
            .map((worker) => ({
              assignment_id: worker.assignmentId ?? `requested-${getRequestedWorkerId(worker)}`,
              worker_id: getRequestedWorkerId(worker) ?? worker.id,
              assignment_status: "accepted",
              accepted_at: worker.requestedAt ?? null,
              selected_for_release_at: null,
              released_to_client_at: null,
              worker: {
                name: worker.name,
                role: worker.primaryRole,
                workforce_type: worker.workforceType,
                location: worker.locationLabel || formatLocation(worker.area, worker.postcode),
                postcode: worker.postcode,
                phone: worker.phone ?? null,
                email: worker.email ?? null,
                site_score: null,
                compliance_summary: [],
              },
            } satisfies AcceptedWorkforceRow)),
        ];
        const acceptedWorkforce = acceptedRequestedWorkers;
        const workersConfirmed =
          acceptedWorkforce.length ||
          Number(activeJob.workers_confirmed || activeJob.workersConfirmed || activeJob.confirmed_workforce_count || 0);
        const requestedWorkerIds = new Set(requestedWorkforce.map((worker) => worker.id));
        const matchingRequestedWorkers = modalMatchingWorkers.filter((worker) => {
          const dispatchStatus = worker.dispatchStatus || worker.dispatch_status || worker.assignment_status || "";
          return (
            worker.requested_by_client ||
            worker.requestedByClient ||
            worker.isClientRequested ||
            worker.is_client_requested ||
            requestedWorkerIds.has(worker.worker_id) ||
            requestedWorkerIds.has(worker.id ?? "") ||
            requestedWorkerIds.has(worker.workerId ?? "") ||
            requestedDispatchStatuses.has(dispatchStatus)
          );
        });
        const requestedMatchIds = new Set(
          matchingRequestedWorkers.map((worker) => worker.worker_id || worker.id || worker.workerId).filter(Boolean),
        );
        const automaticMatches = modalMatchingWorkers.filter(
          (worker) => !requestedMatchIds.has(worker.worker_id || worker.id || worker.workerId || ""),
        );
        const releasedWorkers = modalMatchingWorkers.filter(
          (worker) =>
            worker.released_to_client &&
            (normaliseBroadcastStatus(broadcastStatus) === "completed" || worker.released_to_client_at),
        );
        const renderWorkerMatch = (worker: MatchingWorker, selectable = false) => {
          const displayName = isAdmin
            ? worker.full_name
            : getProviderFacingDisplayName({
                full_name: worker.full_name,
                worker_type: worker.worker_type ?? null,
                contractor_type: worker.contractor_type ?? null,
                specialist_area: worker.specialist_area ?? null,
              });
          const locationLabel = isAdmin
            ? worker.location_display ?? `${worker.town ?? "-"} ${worker.postcode}`
            : getProviderFacingLocationLabel({
                location_display: worker.location_display ?? null,
                town: worker.town ?? null,
                postcode: worker.postcode,
              });
          const subtitle =
            worker.subtitle ??
            (worker.worker_type === "contractor"
              ? `Contractor${worker.contractor_type ? ` • ${worker.contractor_type === "multi_discipline" ? "Multi-Discipline" : "Specialist"}` : ""}`
              : "Tradesman");
          const workerId = getMatchingWorkerId(worker);
          const selected = requestedSelectionIds.includes(workerId);
          const status = worker.assignment_status || worker.dispatchStatus || worker.dispatch_status;

          return (
            <WorkerGridCard
              key={workerId || worker.worker_id}
              imageUrl={getAvatar(worker)}
              name={displayName}
              role={worker.primary_role ?? subtitle}
              location={locationLabel}
              pill={worker.requested_by_client || worker.requestedByClient || worker.isClientRequested || worker.is_client_requested ? "Client requested" : status ? formatDispatchStatus(status) : null}
              matchPill={formatPercentMatch(worker.match_strength)}
              selectable={selectable}
              selected={selected}
              selectButtonBelow
              onToggleSelected={() => {
                if (!workerId) return;
                setRequestedSelectionIds((current) =>
                  current.includes(workerId)
                    ? current.filter((id) => id !== workerId)
                    : [...new Set([...current, workerId])],
                );
                setRequestedSaveMessage("");
              }}
              onOpenProfile={() => {
                void openWorkerProfile(workerId, buildProfileWorkerFromMatch(worker), false);
              }}
            />
          );
        };

        const jobBrief =
          activeJob.short_description ||
          activeJob.duties ||
          activeJob.optional_supporting_notes ||
          null;
        const requiredSkillsText = formatListValue(skillsRequired.length ? skillsRequired : normaliseToArray(activeJob.requirements));
        const skillsContent = (
          <div style={{ display: "grid", gap: "0.9rem" }}>
            <DetailGrid
              fields={[
                ["Job brief / description", jobBrief || "No notes added or no description provided."],
                ["Skills required", requiredSkillsText || "No specific skills listed."],
                ...(additionalSkillTags.length > 0 ? [["Skill tags", formatListValue(additionalSkillTags)] as [string, string | number | boolean | null | undefined]] : []),
                ["CSCS Required", formatCscsRequired(activeJob)],
                ["PPE Required", activeJob.ppe_required ? activeJob.ppe_detail ?? "PPE required" : formatBooleanValue(activeJob.ppe_required)],
                ["DBS Required", formatDbsRequired(activeJob)],
                ["IPAF Required", formatBooleanValue(activeJob.ipaf_required)],
                ["Tools Required", formatBooleanValue(activeJob.own_tools_required)],
                ["Tools Detail", activeJob.tools_required],
                ["Certificates Required", formatListValue(activeJob.certificates_required)],
                ["Shift Pattern", activeJob.shift_pattern],
              ]}
            />
          </div>
        );
        const invoiceContent = (
          <DetailGrid
            fields={[
              ["Invoice Status", activeJob.invoice_status ?? "not_ready"],
              ["Invoice Dispatch Date", activeJob.invoice_send_date ?? formatDisplayDate(invoiceDispatchDate)],
              ["Invoice Due Date", activeJob.invoice_due_date ?? formatDisplayDate(invoiceDueDate)],
              ["Invoice Notes", activeJob.invoice_notes],
            ]}
          />
        );
        const labourContent = (activeJob.labour_payments ?? []).length === 0 ? (
          <p style={{ margin: 0, color: "var(--rd-text-muted)" }}>
            No worker assignments are linked to this job yet. Client-requested and confirmed workers will appear here.
          </p>
        ) : (
          <div style={{ display: "grid", gap: "0.75rem" }}>
            {(activeJob.labour_payments ?? []).map((payment) => (
              <section key={payment.assignment_id} className="rd-themed-card job-detail-mobile-card">
                <DetailGrid
                  fields={[
                    ["Worker name", payment.worker_name],
                    ["Worker role/trade", payment.worker_role],
                    ["Payment cycle", payment.payment_cycle],
                    ["Payment status", formatLabourPaymentStatus(payment.payment_status)],
                    ["Last payment date", payment.last_payment_date],
                    ["Next payment due date", payment.next_payment_due_date],
                    ["Day rate", payment.day_rate == null ? null : `£${payment.day_rate}`],
                    ["Worked days in current cycle", payment.worked_days_current_cycle],
                    ["Estimated amount due", `£${payment.estimated_amount_due}`],
                    ["Payment receipt status", payment.payment_receipt_status],
                    ["Preliminary payment notice status", payment.preliminary_payment_notice_status],
                    ["Notes", payment.payment_notes],
                  ]}
                />
              </section>
            ))}
          </div>
        );
        const requestedContent = requestedWorkforce.length === 0 ? (
          <p style={{ margin: 0, color: "var(--rd-text-muted)" }}>
            No client-requested workforce has been attached to this job yet.
          </p>
        ) : (
          <div className="job-detail-workforce-stack">
            {isAdmin ? (
              <button type="button" onClick={() => openRequestedWorkforceDispatch(requestedWorkforce)}>
                Dispatch requested workforce
              </button>
            ) : null}
            {requestedStatusError ? (
              <p style={{ margin: 0, color: "#b45309", fontWeight: 700 }}>{requestedStatusError}</p>
            ) : null}
            <div className="rd-worker-grid">
                {requestedWorkforce.map((worker) => {
                  const locationLabel = worker.locationLabel || formatLocation(worker.area, worker.postcode);
                  const workerId = getRequestedWorkerId(worker);
                  const dispatchStatus = worker.dispatchStatus || worker.dispatch_status || "requested";
                  const canViewAcceptedWorkerDetails = !isAdmin && dispatchStatus === "accepted";
                  const accepted = hasAcceptedStatus(worker);
                  return (
                    <WorkerGridCard
                      key={workerId ?? worker.id}
                      imageUrl={getAvatar(worker)}
                      name={worker.name || "Unnamed contractor"}
                      role={worker.primaryRole || worker.workforceType}
                      location={locationLabel || "Location TBC"}
                      pill={getAcceptedStatus(worker)}
                      matchPill={accepted ? null : formatPercentMatch(worker.matchPercentage)}
                      onOpenProfile={() => {
                        // TODO: replace this lightweight profile adapter with full worker row hydration when the job detail endpoint returns complete profile data.
                        const fallbackProfile = buildProfileWorkerFromMatch({
                          worker_id: workerId ?? worker.id,
                          full_name: worker.name,
                          phone: worker.phone,
                          primary_role: worker.primaryRole,
                          worker_type: worker.workforceType?.toLowerCase().includes("contractor") ? "contractor" : "tradesman",
                          contractor_type: null,
                          specialist_area: null,
                          skill_tags: [],
                          town: worker.area,
                          postcode: worker.postcode ?? "",
                          location_display: locationLabel,
                          available_today: false,
                          priority_tier: "",
                          whatsapp_opt_in: false,
                          right_to_work: false,
                          contract_signed: false,
                          site_score: null,
                          verified_bookings: 0,
                          match_strength: worker.matchPercentage ?? undefined,
                          card_image_url: worker.avatarUrl ?? undefined,
                          profile_image_url: worker.avatarUrl ?? undefined,
                        });
                        void openWorkerProfile(workerId ?? worker.id, fallbackProfile, canViewAcceptedWorkerDetails);
                      }}
                      footerAction={
                        !isAdmin ? (
                          <Button
                            type="button"
                            color="indigo"
                            variant="soft"
                            disabled={!canViewAcceptedWorkerDetails}
                            onClick={() => {
                              if (canViewAcceptedWorkerDetails) openAcceptedWorkerDetails(worker);
                            }}
                            title={!canViewAcceptedWorkerDetails ? "Contact details available after admin completion." : undefined}
                          >
                            {canViewAcceptedWorkerDetails ? "View contact details" : "Contact details available after admin completion."}
                          </Button>
                        ) : null
                      }
                    />
                  );
                })}
            </div>
          </div>
        );
        const acceptedContent = !isAdmin ? null : acceptedWorkersLoading ? (
          <p style={{ margin: 0, color: "var(--rd-text-muted)" }}>Loading accepted workforce...</p>
        ) : acceptedRows.length === 0 ? (
          <p style={{ margin: 0, color: "var(--rd-text-muted)" }}>No workforce has accepted this dispatch yet.</p>
        ) : (
          <div className="job-detail-workforce-stack">
            <h4 style={{ margin: 0, fontSize: "0.9rem" }}>Accepted workforce</h4>
            <ScrollArea type="auto" scrollbars="horizontal" className="job-detail-mobile-carousel-scroll">
              <div className="job-detail-mobile-carousel-track">
                {acceptedRows.map((assignment) => (
                  <section key={assignment.assignment_id} className="rd-themed-card job-detail-mobile-card job-detail-mobile-carousel-item job-detail-workforce-card">
                    <strong>{assignment.worker.name}</strong>
                    <DetailGrid
                      fields={[
                        ["Phone", assignment.worker.phone],
                        ["Email", assignment.worker.email],
                        ["Site score", assignment.worker.site_score ?? "Insufficient verified data"],
                        ["Compliance summary", assignment.worker.compliance_summary.length > 0 ? assignment.worker.compliance_summary.join(", ") : "Compliance summary not available"],
                        ["Accepted time", assignment.accepted_at ? new Date(assignment.accepted_at).toLocaleString("en-GB") : "Accepted"],
                        ["Release status", assignment.assignment_status.replaceAll("_", " ")],
                      ]}
                    />
                  </section>
                ))}
              </div>
            </ScrollArea>
          </div>
        );
        const confirmedContent = releasedWorkers.length === 0 ? null : (
          <div className="job-detail-workforce-stack">
            <h4 style={{ margin: 0, fontSize: "0.9rem" }}>Confirmed workforce</h4>
            <ScrollArea type="auto" scrollbars="horizontal" className="job-detail-mobile-carousel-scroll">
              <div className="job-detail-mobile-carousel-track">
                {releasedWorkers.map((worker) => {
                  const workerLocation = worker.location_display ?? [worker.town, worker.postcode].filter(Boolean).join(" ");
                  const complianceSummary = [
                    worker.right_to_work ? "Right to work" : null,
                    worker.contract_signed ? "Contract signed" : null,
                  ].filter(Boolean).join(", ");
                  return (
                    <section key={worker.worker_id} className="rd-themed-card job-detail-mobile-card job-detail-mobile-carousel-item job-detail-workforce-card">
                      <strong>{worker.full_name}</strong>
                      <DetailGrid
                        fields={[
                          ["Role/trade", worker.primary_role ?? "General workforce"],
                          ["Phone", worker.phone],
                          ["Arrival/start date", formatDisplayDate(activeJob.start_date)],
                          ["Payment cycle", "Platform managed"],
                          ["Compliance summary", complianceSummary || "Compliance summary not available"],
                          ["Location", workerLocation || "Location TBC"],
                        ]}
                      />
                    </section>
                  );
                })}
              </div>
            </ScrollArea>
          </div>
        );
        const workforceContent = (
          <div style={{ display: "grid", gap: "0.75rem" }}>
            {requestedContent}
            {acceptedContent}
            {confirmedContent}
          </div>
        );
        const matchesContent = (
          <div className="job-detail-matches">
            {modalMatchingWorkers.length === 0 ? (
              <p style={{ margin: 0, color: "var(--rd-text)" }}>No matching contractors or tradesmen found for this job yet.</p>
            ) : (
              <div style={{ display: "grid", gap: "0.85rem" }}>
                {matchingRequestedWorkers.length > 0 ? (
                  <section style={{ display: "grid", gap: "0.55rem" }}>
                    <h4 style={{ margin: 0, fontSize: "0.9rem" }}>Client requested</h4>
                    <div className="rd-worker-grid">
                      {matchingRequestedWorkers.map((worker) => renderWorkerMatch(worker, !isAdmin))}
                    </div>
                  </section>
                ) : null}
                <section style={{ display: "grid", gap: "0.55rem" }}>
                  <h4 style={{ margin: 0, fontSize: "0.9rem" }}>Matched to job brief</h4>
                  {automaticMatches.length === 0 ? (
                    <p style={{ margin: 0, color: "var(--rd-text-muted)" }}>No automatic matches found for this brief yet.</p>
                  ) : (
                    <div className="rd-worker-grid">
                      {automaticMatches.map((worker) => renderWorkerMatch(worker, !isAdmin))}
                    </div>
                  )}
                </section>
                {!isAdmin ? (
                  <div style={{ display: "flex", gap: "0.75rem", alignItems: "center", flexWrap: "wrap" }}>
                    <Button type="button" color="indigo" variant="soft" onClick={saveProviderRequestedWorkers} disabled={requestedSaveBusy}>
                      {requestedSaveBusy ? "Saving..." : `Request selected (${requestedSelectionIds.length})`}
                    </Button>
                    {requestedSaveMessage ? (
                      <span style={{ color: requestedSaveMessage.includes("saved") ? "#166534" : "#b45309", fontWeight: 600 }}>
                        {requestedSaveMessage}
                      </span>
                    ) : null}
                  </div>
                ) : null}
              </div>
            )}
          </div>
        );

        return (
          <div className="job-detail-modal-content">
            <section className="job-detail-static-section">
              <h3 className="job-detail-static-title">Job Summary</h3>
              <DetailGrid
                className="job-detail-summary-grid"
                fields={[
                  ["Provider / Client", activeJob.company_name],
                  ["Selected Role / Trade", activeJob.selected_role ?? activeJob.core_role ?? activeJob.trade ?? activeJob.trade_type ?? activeJob.job_title],
                  ["Alert Type", activeJob.alert_type ?? activeJob.job_category],
                  ["Area", activeJob.area],
                  ["Postcode", activeJob.postcode],
                  ["Start Date", formatDisplayDate(activeJob.start_date)],
                  [
                    "Time Window",
                    activeJob.time_window ?? (activeJob.start_time || activeJob.end_time
                      ? `${activeJob.start_time ?? "Not provided"} to ${activeJob.end_time ?? "Not provided"}`
                      : null),
                  ],
                  ["Duration", formatJobDuration(activeJob)],
                  ["Pay Rate", formatCanonicalPayRate(activeJob)],
                  ["Workers Required", activeJob.workers_required],
                  ["Workers Confirmed", workersConfirmed],
                  ["Job Status", activeJob.job_status],
                  ["Broadcast Status", broadcastStatus],
                ]}
              />
              {isAdmin ? (
                <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", alignItems: "center", marginTop: "0.75rem" }}>
                  <Link href={`/jobs/${activeJob.job_id}/edit`}>Edit job details</Link>
                  <button
                    type="button"
                    onClick={completeBroadcastAndReleaseDetails}
                    disabled={completeReleaseBusy || acceptedWorkersLoading}
                  >
                    {completeReleaseBusy ? "Completing..." : "Complete Broadcast & Release Details"}
                  </button>
                  {completeReleaseMessage ? (
                    <span style={{ color: completeReleaseMessage.startsWith("Broadcast completed") ? "#166534" : "#b45309", fontWeight: 700 }}>
                      {completeReleaseMessage}
                    </span>
                  ) : null}
                </div>
              ) : null}
            </section>

            <section className="job-detail-mobile-tabs-shell" aria-label="Job detail sections">
              <Tabs.Root defaultValue={openInvoice ? "invoice" : isAdmin && openLabour ? "payments" : openSkills ? "skills" : openDispatch ? "matches" : "skills"} className="job-detail-mobile-tabs">
                <ScrollArea type="auto" scrollbars="horizontal" className="job-detail-mobile-tabs-scroll">
                  <Tabs.List className="job-detail-mobile-tabs-list">
                    <Tabs.Trigger value="skills">Skills</Tabs.Trigger>
                    <Tabs.Trigger value="invoice">Invoice</Tabs.Trigger>
                    {isAdmin ? <Tabs.Trigger value="payments">Payments</Tabs.Trigger> : null}
                    <Tabs.Trigger value="workforce">Workforce</Tabs.Trigger>
                    <Tabs.Trigger value="matches">Matches</Tabs.Trigger>
                  </Tabs.List>
                </ScrollArea>
                <Box className="job-detail-mobile-dynamic-card">
                  <Tabs.Content value="skills" className="job-detail-mobile-tab-content">{skillsContent}</Tabs.Content>
                  <Tabs.Content value="invoice" className="job-detail-mobile-tab-content">{invoiceContent}</Tabs.Content>
                  {isAdmin ? <Tabs.Content value="payments" className="job-detail-mobile-tab-content">{labourContent}</Tabs.Content> : null}
                  <Tabs.Content value="workforce" className="job-detail-mobile-tab-content">{workforceContent}</Tabs.Content>
                  <Tabs.Content value="matches" className="job-detail-mobile-tab-content">{matchesContent}</Tabs.Content>
                </Box>
              </Tabs.Root>
            </section>

            <div className="job-detail-desktop-accordions">
            <CollapsibleSection title="Skills & Compliance" defaultOpen={openSkills}>
              {skillsContent}
            </CollapsibleSection>

            <CollapsibleSection title="Invoice" defaultOpen={openInvoice}>
              {invoiceContent}
            </CollapsibleSection>

            {isAdmin ? (
            <CollapsibleSection title="Labour Payments" defaultOpen={openLabour}>
              {(activeJob.labour_payments ?? []).length === 0 ? (
                <p style={{ margin: 0, color: "var(--rd-text-muted)" }}>
                  No worker assignments are linked to this job yet. Client-requested and confirmed workers will appear here.
                </p>
              ) : (
                <div style={{ display: "grid", gap: "0.75rem" }}>
                  {(activeJob.labour_payments ?? []).map((payment) => (
                    <section key={payment.assignment_id} style={{ border: "1px solid var(--rd-border)", borderRadius: 8, padding: "0.75rem" }}>
                      <DetailGrid
                        fields={[
                          ["Worker name", payment.worker_name],
                          ["Worker role/trade", payment.worker_role],
                          ["Payment cycle", payment.payment_cycle],
                          ["Payment status", formatLabourPaymentStatus(payment.payment_status)],
                          ["Last payment date", payment.last_payment_date],
                          ["Next payment due date", payment.next_payment_due_date],
                          ["Day rate", payment.day_rate == null ? null : `£${payment.day_rate}`],
                          ["Worked days in current cycle", payment.worked_days_current_cycle],
                          ["Estimated amount due", `£${payment.estimated_amount_due}`],
                          ["Payment receipt status", payment.payment_receipt_status],
                          ["Preliminary payment notice status", payment.preliminary_payment_notice_status],
                          ["Notes", payment.payment_notes],
                        ]}
                      />
                      {isAdmin ? (
                        <div style={{ display: "grid", gap: "0.55rem", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", marginTop: "0.75rem" }}>
                          <label>
                            Payment cycle
                            <select
                              value={payment.payment_cycle}
                              disabled={busyAssignmentId === payment.assignment_id}
                              onChange={(event) => updateLabourPayment(payment.assignment_id, { payment_cycle: event.target.value })}
                            >
                              <option value="weekly">Weekly</option>
                              <option value="fortnightly">Fortnightly</option>
                            </select>
                          </label>
                          <label>
                            Payment status
                            <select
                              value={payment.payment_status}
                              disabled={busyAssignmentId === payment.assignment_id}
                              onChange={(event) => updateLabourPayment(payment.assignment_id, { payment_status: event.target.value })}
                            >
                              {["not_ready", "preliminary_notice_sent", "approved_for_payment", "scheduled", "paid", "overdue", "held", "disputed", "cancelled"].map((status) => (
                                <option key={status} value={status}>{formatLabourPaymentStatus(status)}</option>
                              ))}
                            </select>
                          </label>
                          <label>
                            Last payment date
                            <input
                              type="date"
                              value={payment.last_payment_date ?? ""}
                              disabled={busyAssignmentId === payment.assignment_id}
                              onChange={(event) => updateLabourPayment(payment.assignment_id, { last_payment_date: event.target.value || null })}
                            />
                          </label>
                          <label>
                            Next payment due date
                            <input
                              type="date"
                              value={payment.next_payment_due_date ?? ""}
                              disabled={busyAssignmentId === payment.assignment_id}
                              onChange={(event) => updateLabourPayment(payment.assignment_id, { next_payment_due_date: event.target.value || null })}
                            />
                          </label>
                          <label>
                            Day rate
                            <input
                              type="number"
                              value={payment.day_rate ?? ""}
                              disabled={busyAssignmentId === payment.assignment_id}
                              onChange={(event) => updateLabourPayment(payment.assignment_id, { day_rate: event.target.value ? Number(event.target.value) : null })}
                            />
                          </label>
                          <label>
                            Notes
                            <input
                              value={payment.payment_notes ?? ""}
                              disabled={busyAssignmentId === payment.assignment_id}
                              onChange={(event) => updateLabourPayment(payment.assignment_id, { payment_notes: event.target.value })}
                            />
                          </label>
                        </div>
                      ) : null}
                    </section>
                  ))}
                </div>
              )}
            </CollapsibleSection>
            ) : null}

            <CollapsibleSection title="Requested Workforce" defaultOpen={requestedWorkforce.length > 0}>
              {requestedWorkforce.length === 0 ? (
                <p style={{ margin: 0, color: "var(--rd-text-muted)" }}>
                  No client-requested workforce has been attached to this job yet.
                </p>
              ) : (
                <div style={{ display: "grid", gap: "0.75rem" }}>
                  {isAdmin ? (
                    <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap", marginBottom: "0.25rem" }}>
                      <button
                        type="button"
                        onClick={() => openRequestedWorkforceDispatch(requestedWorkforce)}
                      >
                        Dispatch requested workforce
                      </button>
                      <span style={{ color: "var(--rd-text-muted)", fontWeight: 600 }}>
                        Dispatch will target only the client-requested workforce listed in this accordion.
                      </span>
                    </div>
                  ) : null}
                  {requestedStatusError ? (
                    <p style={{ margin: 0, color: "#b45309", fontWeight: 700 }}>{requestedStatusError}</p>
                  ) : null}
                  {requestedWorkforce.map((worker) => {
                    const locationLabel = worker.locationLabel || formatLocation(worker.area, worker.postcode);
                    const workerId = getRequestedWorkerId(worker);
                    const dispatchStatus = worker.dispatchStatus || worker.dispatch_status || "requested";
                    const canViewAcceptedWorkerDetails = !isAdmin && dispatchStatus === "accepted";
                    return (
                      <section
                        key={workerId ?? worker.id}
                        role={canViewAcceptedWorkerDetails ? "button" : undefined}
                        tabIndex={canViewAcceptedWorkerDetails ? 0 : undefined}
                        onClick={() => {
                          if (canViewAcceptedWorkerDetails) openAcceptedWorkerDetails(worker);
                        }}
                        onKeyDown={(event) => {
                          if (canViewAcceptedWorkerDetails && (event.key === "Enter" || event.key === " ")) {
                            event.preventDefault();
                            openAcceptedWorkerDetails(worker);
                          }
                        }}
                        style={{
                          border: "1px solid var(--rd-border)",
                          borderRadius: 8,
                          padding: "0.75rem",
                          cursor: canViewAcceptedWorkerDetails ? "pointer" : "default",
                        }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", gap: "0.75rem", flexWrap: "wrap", marginBottom: "0.65rem" }}>
                          <strong>{worker.name}</strong>
                          <span style={{ display: "inline-flex", gap: "0.4rem", flexWrap: "wrap" }}>
                            <span style={{ width: "fit-content", borderRadius: 999, background: "#dbeafe", color: "#1d4ed8", padding: "0.15rem 0.55rem", fontSize: 12, fontWeight: 700 }}>
                              Client requested
                            </span>
                            <span style={{ width: "fit-content", borderRadius: 999, background: "#f1f5f9", color: "#334155", padding: "0.15rem 0.55rem", fontSize: 12, fontWeight: 700 }}>
                              Dispatch status: {formatDispatchStatus(dispatchStatus)}
                            </span>
                          </span>
                        </div>
                        <DetailGrid
                          fields={[
                            ["Primary role/trade", worker.primaryRole],
                            ["Workforce type", worker.workforceType],
                            ["Area/postcode", locationLabel || "Location TBC"],
                            ["Match percentage", worker.matchPercentage == null ? null : `${worker.matchPercentage}% match`],
                            ["Requested rank", worker.requestedRank ? `Rank ${worker.requestedRank}` : "Not ranked"],
                          ]}
                        />
                        {isAdmin ? (
                          <label style={{ display: "grid", gap: "0.35rem", maxWidth: 220, marginTop: "0.75rem", color: "var(--rd-text)", fontWeight: 700 }}>
                            <span style={{ color: "var(--rd-text-muted)", fontSize: "0.78rem" }}>Dispatch status</span>
                            <select
                              value={dispatchStatus}
                              disabled={Boolean(workerId && requestedStatusUpdating[workerId])}
                              onChange={(event) => updateRequestedWorkerDispatchStatus(worker, event.target.value)}
                              style={{
                                width: "100%",
                                border: "1px solid var(--rd-border)",
                                borderRadius: 999,
                                padding: "0.5rem 0.75rem",
                                background: "var(--rd-bg-elevated)",
                                color: "var(--rd-text)",
                                fontWeight: 700,
                              }}
                            >
                              <option value="requested">Requested</option>
                              <option value="dispatched">Dispatched</option>
                              <option value="accepted">Accepted</option>
                              <option value="declined">Declined</option>
                              <option value="no_response">No response</option>
                            </select>
                          </label>
                        ) : canViewAcceptedWorkerDetails ? (
                          <Button
                            type="button"
                            color="indigo"
                            variant="soft"
                            onClick={(event) => {
                              event.stopPropagation();
                              openAcceptedWorkerDetails(worker);
                            }}
                            style={{
                              width: "fit-content",
                              marginTop: "0.75rem",
                            }}
                          >
                            View contact details
                          </Button>
                        ) : (
                          <p style={{ margin: "0.65rem 0 0", color: "var(--rd-text-muted)", fontWeight: 600 }}>
                            Contact details will be released once the worker accepts.
                          </p>
                        )}
                      </section>
                    );
                  })}
                </div>
              )}
            </CollapsibleSection>

            {isAdmin ? (
              <CollapsibleSection title="Accepted Workforce" defaultOpen={acceptedRows.length > 0}>
                {acceptedWorkersLoading ? (
                  <p style={{ margin: 0, color: "var(--rd-text-muted)" }}>Loading accepted workforce...</p>
                ) : acceptedRows.length === 0 ? (
                  <p style={{ margin: 0, color: "var(--rd-text-muted)" }}>No workforce has accepted this dispatch yet.</p>
                ) : (
                  <div style={{ display: "grid", gap: "0.75rem" }}>
                    {acceptedRows.map((assignment) => {
                      const isReleased = assignment.assignment_status === "released_to_client";
                      const selected = releaseSelectionIds.includes(assignment.worker_id);
                      const isAcceptedFromRequested = acceptedRequestedIds.has(assignment.worker_id);
                      return (
                        <section
                          key={assignment.assignment_id}
                          style={{ border: "1px solid var(--rd-border)", borderRadius: 8, padding: "0.75rem", display: "grid", gap: "0.65rem" }}
                        >
                          <label style={{ display: "flex", alignItems: "flex-start", gap: "0.55rem", fontWeight: 800, color: "var(--rd-text)" }}>
                            <input
                              type="checkbox"
                              checked={selected}
                              disabled={isReleased || attachReleaseBusy}
                              onChange={(event) => {
                                setReleaseSelectionIds((current) =>
                                  event.target.checked
                                    ? [...new Set([...current, assignment.worker_id])]
                                    : current.filter((id) => id !== assignment.worker_id),
                                );
                                setAttachReleaseMessage("");
                                setCompleteReleaseMessage("");
                              }}
                            />
                            <span>
                              {assignment.worker.name}
                              <span style={{ display: "block", marginTop: 3, color: "var(--rd-text-muted)", fontWeight: 500 }}>
                                {assignment.worker.workforce_type} · {assignment.worker.role ?? "General workforce"} · {assignment.worker.location ?? assignment.worker.postcode ?? "Location TBC"}
                                {isAcceptedFromRequested ? " · Accepted from requested workforce status" : ""}
                              </span>
                            </span>
                          </label>
                          <DetailGrid
                            fields={[
                              ["Phone", assignment.worker.phone],
                              ["Email", assignment.worker.email],
                              ["Site score", assignment.worker.site_score ?? "Insufficient verified data"],
                              ["Compliance summary", assignment.worker.compliance_summary.length > 0 ? assignment.worker.compliance_summary.join(", ") : "Compliance summary not available"],
                              ["Accepted time", assignment.accepted_at ? new Date(assignment.accepted_at).toLocaleString("en-GB") : "Accepted"],
                              ["Release status", assignment.assignment_status.replaceAll("_", " ")],
                            ]}
                          />
                        </section>
                      );
                    })}
                    <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", alignItems: "center" }}>
                      <button
                        type="button"
                        onClick={attachSelectedAcceptedWorkers}
                        disabled={attachReleaseBusy || releaseSelectionIds.length === 0}
                      >
                        {attachReleaseBusy ? "Attaching..." : "Attach selected workforce to this job"}
                      </button>
                      {attachReleaseMessage ? (
                        <span style={{ color: attachReleaseMessage.includes("attached") ? "#166534" : "#b45309", fontWeight: 700 }}>
                          {attachReleaseMessage}
                        </span>
                      ) : null}
                    </div>
                  </div>
                )}
              </CollapsibleSection>
            ) : null}

            {releasedWorkers.length > 0 ? (
              <CollapsibleSection title="Confirmed Workforce Details" defaultOpen>
                <div style={{ display: "grid", gap: "0.75rem" }}>
                  {releasedWorkers.map((worker) => {
                    const workerLocation = worker.location_display ?? [worker.town, worker.postcode].filter(Boolean).join(" ");
                    const complianceSummary = [
                      worker.right_to_work ? "Right to work" : null,
                      worker.contract_signed ? "Contract signed" : null,
                    ].filter(Boolean).join(", ");
                    return (
                      <section key={worker.worker_id} style={{ border: "1px solid var(--rd-border)", borderRadius: 8, padding: "0.75rem", display: "grid", gap: "0.5rem" }}>
                        <strong>{worker.full_name}</strong>
                        <DetailGrid
                          fields={[
                            ["Role/trade", worker.primary_role ?? "General workforce"],
                            ["Phone", worker.phone],
                            ["Arrival/start date", formatDisplayDate(activeJob.start_date)],
                            ["Payment cycle", "Platform managed"],
                            ["Compliance summary", complianceSummary || "Compliance summary not available"],
                            ["Location", workerLocation || "Location TBC"],
                          ]}
                        />
                        <p style={{ margin: 0, color: "var(--rd-text)", fontWeight: 700 }}>
                          Do not hire or re-book this worker outside the platform. Introduction fees and legal costs may apply.
                        </p>
                      </section>
                    );
                  })}
                  <section className="rd-themed-panel" style={{ padding: "0.8rem", borderColor: "#f59e0b" }}>
                    <strong>Important workforce protection notice:</strong>
                    <p style={{ margin: "0.45rem 0 0", color: "var(--rd-text)", lineHeight: 1.55 }}>
                      These workers have been introduced to you through our platform for this job only. You must not contact, hire, pay, re-book, or move this worker onto another job outside the platform without written permission from us. Doing so may breach our terms and could result in introduction fees, recovery of losses, legal costs, suspension of your account, and possible legal action.
                    </p>
                  </section>
                </div>
              </CollapsibleSection>
            ) : null}

            <CollapsibleSection title="Matching Contractors / Tradesmen" defaultOpen={openDispatch}>
              <div className="job-detail-matches">
                {modalMatchingWorkers.length === 0 ? (
                  <p style={{ margin: 0, color: "var(--rd-text)" }}>No matching contractors or tradesmen found for this job yet.</p>
                ) : (
                  <div style={{ display: "grid", gap: "0.75rem" }}>
                    <section style={{ display: "grid", gap: "0.55rem" }}>
                  <h4 style={{ margin: 0, fontSize: "0.95rem" }}>Client requested</h4>
                      {matchingRequestedWorkers.length === 0 ? (
                        <p style={{ margin: 0, color: "var(--rd-text-muted)" }}>No client-requested workforce attached yet.</p>
                      ) : (
                        <div className="rd-worker-grid">
                          {matchingRequestedWorkers.map((worker) => renderWorkerMatch(worker, !isAdmin))}
                        </div>
                      )}
                    </section>
                    <section style={{ display: "grid", gap: "0.55rem" }}>
                      <h4 style={{ margin: 0, fontSize: "0.95rem" }}>Matched to job brief</h4>
                      {automaticMatches.length === 0 ? (
                        <p style={{ margin: 0, color: "var(--rd-text-muted)" }}>No automatic matches found for this brief yet.</p>
                      ) : (
                        <div className="rd-worker-grid">
                          {automaticMatches.map((worker) => renderWorkerMatch(worker, !isAdmin))}
                        </div>
                      )}
                    </section>
                    {!isAdmin ? (
                      <div style={{ display: "flex", gap: "0.75rem", alignItems: "center", flexWrap: "wrap" }}>
                        <Button
                          type="button"
                          color="indigo"
                          variant="soft"
                          onClick={saveProviderRequestedWorkers}
                          disabled={requestedSaveBusy}
                        >
                          {requestedSaveBusy ? "Saving request..." : `Request selected workforce (${requestedSelectionIds.length})`}
                        </Button>
                        {requestedSaveMessage ? (
                          <span style={{ color: requestedSaveMessage.includes("saved") ? "#166534" : "#b45309", fontWeight: 600 }}>
                            {requestedSaveMessage}
                          </span>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                )}
              </div>
              {isAdmin ? (
                <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", marginTop: "0.75rem" }}>
                  <Link href={`/jobs/${activeJob.job_id}/broadcast`}>Open full dispatch console</Link>
                </div>
              ) : null}
            </CollapsibleSection>
            </div>
          </div>
        );
      })() : null}
      {isAdmin && requestedDispatchJob ? (
        <BroadcastModal
          open={dispatchRequestedOpen}
          title="Dispatch client-requested workforce"
          audience="workers"
          recipients={requestedDispatchRecipients}
          jobs={[{
            ...requestedDispatchJob,
            dispatchAudience: "requested_workforce",
            dispatchAudienceLabel: "Client requested workforce",
            preselectedWorkerIds: requestedDispatchRecipients.map((worker) => worker.id),
            requestedDispatchWorkerIds: requestedDispatchRecipients.map((worker) => worker.id),
          }]}
          preferredRole={requestedDispatchJob.trade_type ?? undefined}
          onboardingTemplateType="worker_onboarding"
          onboardingTitle="Worker Onboarding Template"
          onSent={() => {
            requestedDispatchRecipients.forEach((worker) => {
              updateLocalRequestedWorkerStatus(worker.id, "dispatched");
            });
          }}
          onClose={() => {
            setDispatchRequestedOpen(false);
            setRequestedDispatchRecipients([]);
          }}
        />
      ) : null}
      {selectedAcceptedWorker ? (
        <Modal
          open={Boolean(selectedAcceptedWorker)}
          title={selectedAcceptedWorker.name}
          onClose={() => setSelectedAcceptedWorker(null)}
        >
          <div style={{ display: "grid", gap: "0.9rem" }}>
            <DetailGrid
              fields={[
                ["Role / trade", selectedAcceptedWorker.primaryRole || "Not provided"],
                ["Workforce type", selectedAcceptedWorker.workforceType || "Tradesman"],
                ["Location", formatLocation(selectedAcceptedWorker.area, selectedAcceptedWorker.postcode)],
                ["Phone", selectedAcceptedWorker.phone || selectedAcceptedWorker.mobile || "Not provided"],
                ["Email", selectedAcceptedWorker.email || "Not provided"],
                ["Dispatch status", formatDispatchStatus(selectedAcceptedWorker.dispatchStatus || selectedAcceptedWorker.dispatch_status)],
              ]}
            />
            <section
              style={{
                marginTop: "0.25rem",
                padding: "0.9rem",
                borderRadius: 16,
                border: "1px solid var(--rd-border)",
                background: "var(--rd-surface-soft)",
              }}
            >
              <strong>Important workforce protection notice</strong>
              <p style={{ margin: "0.45rem 0 0", color: "var(--rd-text)", lineHeight: 1.55 }}>
                This worker has been introduced to you through our platform for this job only. Do not hire, pay, re-book, or move this worker onto another job outside the platform without written permission from us. Introduction fees, recovery of losses, legal costs, account suspension, and legal action may apply.
              </p>
            </section>
          </div>
        </Modal>
      ) : null}
      <WorkerProfileModal
        worker={selectedProfileWorker}
        open={Boolean(selectedProfileWorker)}
        onClose={() => {
          setSelectedProfileWorker(null);
          setSelectedProfileRevealsContact(false);
        }}
        mode={mode}
        revealContactDetails={selectedProfileRevealsContact}
      />
    </Modal>
  );
}
