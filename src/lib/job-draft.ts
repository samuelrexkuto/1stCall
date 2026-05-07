import type { EditableResolvedLocation } from "@/components/forms/LocationAutocompleteInput";
import type { StructuredJobIntake } from "@/lib/job-intake/schema";
import type { CreateJobInput } from "@/lib/validation/schemas";
import type { WorkerAlertDraft } from "@/lib/worker-alert/formatWorkerAlert";
import { normaliseStringList } from "@/lib/stringLists";

export type PayRateUnit = "hourly" | "daily" | "weekly" | "fixed" | null;

export type JobDraft = {
  title: string;
  alert_type: string | null;
  core_role: string | null;
  selected_role: string | null;
  required_role: string | null;
  trade: string | null;
  workers_required: number | null;
  location_label: string | null;
  area: string | null;
  postcode: string | null;
  place_id: string | null;
  latitude: number | null;
  longitude: number | null;
  location_confirmed: boolean;
  start_date: string | null;
  end_date: string | null;
  duration: string | null;
  start_time: string | null;
  end_time: string | null;
  time_window: string | null;
  pay_rate: string | null;
  pay_rate_amount: number | null;
  pay_rate_unit: PayRateUnit;
  skills_required: string[];
  requirements: string[];
  ppe_required: boolean | null;
  ppe_detail: string | null;
  dbs_required: boolean | null;
  dbs_requirement: string | null;
  enhanced_dbs_required: boolean | null;
  cscs_required: boolean | null;
  ipaf_required: boolean | null;
  own_tools_required: boolean | null;
  tools_required: string | null;
  certificates_required: string | null;
  duties: string | null;
  shift_pattern: string | null;
  optional_supporting_notes: string | null;
  selected_keywords: string[];
  broadcast_status: string;
  job_status: "open" | "in_progress" | "completed" | "cancelled";
  payment_status: "unpaid" | "part_paid" | "paid" | "overdue";
};

function splitStart(value?: string | null) {
  if (!value) return { startDate: null, startTime: null };
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(value)) {
    return { startDate: value.slice(0, 10), startTime: value.slice(11, 16) };
  }
  return { startDate: value.slice(0, 10), startTime: null };
}

function parsePayRate(value: string | null | undefined) {
  const text = value?.trim() || null;
  if (!text) return { payRate: null, amount: null, unit: null as PayRateUnit };
  const amountMatch = text.match(/(\d+(?:\.\d+)?)/);
  const amount = amountMatch ? Number(amountMatch[1]) : null;
  const lower = text.toLowerCase();
  const unit: PayRateUnit =
    lower.includes("hour") || lower.includes("/hr") ? "hourly" :
    lower.includes("week") ? "weekly" :
    lower.includes("fixed") || lower.includes("price") ? "fixed" :
    lower.includes("day") || lower.includes("daily") ? "daily" :
    null;
  return { payRate: text, amount, unit };
}

function list(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.map((value) => value?.trim()).filter(Boolean) as string[]));
}

function postcodeOutward(postcode: string | null | undefined) {
  const normalized = postcode?.trim().toUpperCase() ?? "";
  return normalized.split(/\s+/)[0] || null;
}

function toCreateJobDbsRequirement(value: string | null | undefined): "None" | "DBS Required" | "Enhanced DBS Required" {
  if (/enhanced/i.test(value ?? "")) return "Enhanced DBS Required";
  if (/dbs/i.test(value ?? "")) return "DBS Required";
  return "None";
}

export function createJobDraftFromStructuredJob(
  structured: StructuredJobIntake,
  location: EditableResolvedLocation,
): JobDraft {
  const { startDate, startTime } = splitStart(structured.start_date);
  const pay = parsePayRate(structured.pay_rate);
  const requirements = list([
    ...structured.skills_required,
    ...structured.tickets_required,
    structured.dbs_requirement && structured.dbs_requirement !== "None" ? structured.dbs_requirement : null,
    structured.ppe_required ? "PPE required" : null,
    structured.own_tools_required ? "Own tools required" : null,
    structured.ipaf_required ? "IPAF required" : null,
  ]);
  const locationLabel =
    location.formatted_address ||
    location.location_display ||
    location.location_text ||
    structured.location ||
    null;

  return {
    title: structured.job_title ?? structured.core_role ?? "Job Alert",
    alert_type: structured.alert_type ?? null,
    core_role: structured.core_role ?? null,
    selected_role: structured.core_role ?? null,
    required_role: structured.core_role ?? structured.job_title ?? null,
    trade: structured.core_role ?? null,
    workers_required: structured.headcount_required ?? 1,
    location_label: locationLabel,
    area: location.locality || structured.location || null,
    postcode: location.postcode || postcodeOutward(structured.location) || null,
    place_id: location.place_id || null,
    latitude: location.latitude ?? null,
    longitude: location.longitude ?? null,
    location_confirmed: Boolean(location.place_id || (location.latitude != null && location.longitude != null)),
    start_date: startDate,
    end_date: structured.end_date ?? null,
    duration: structured.duration ?? null,
    start_time: startTime,
    end_time: null,
    time_window: startTime ? `From ${startTime}` : null,
    pay_rate: pay.payRate,
    pay_rate_amount: pay.amount,
    pay_rate_unit: pay.unit,
    skills_required: structured.skills_required,
    requirements,
    ppe_required: structured.ppe_required,
    ppe_detail: structured.ppe_required ? "PPE required" : null,
    dbs_required: structured.dbs_requirement ? structured.dbs_requirement !== "None" : null,
    dbs_requirement: structured.dbs_requirement ?? null,
    enhanced_dbs_required: structured.dbs_requirement ? /enhanced/i.test(structured.dbs_requirement) : null,
    cscs_required: requirements.some((item) => /cscs/i.test(item)),
    ipaf_required: structured.ipaf_required,
    own_tools_required: structured.own_tools_required,
    tools_required: structured.own_tools_required ? "Own tools required" : null,
    certificates_required: structured.tickets_required.length ? structured.tickets_required.join(", ") : null,
    duties: structured.duties ?? null,
    shift_pattern: structured.shift_pattern ?? null,
    optional_supporting_notes: structured.optional_supporting_notes ?? null,
    selected_keywords: structured.selected_keywords,
    broadcast_status: "broadcast ready",
    job_status: "open",
    payment_status: "unpaid",
  };
}

export function jobDraftToCreateJobInput(
  draft: JobDraft,
  providerId: string,
): CreateJobInput {
  const startsAt = draft.start_date ? `${draft.start_date}T${draft.start_time ?? "08:00"}` : "";
  return {
    provider_id: providerId,
    title: draft.title,
    required_role: draft.required_role ?? draft.core_role ?? "",
    area: draft.area ?? draft.location_label ?? "",
    postcode: draft.postcode ?? "",
    location_text: draft.location_label ?? "",
    location_display: draft.location_label ?? "",
    location_query: draft.location_label ?? "",
    formatted_address: draft.location_label ?? "",
    place_id: draft.place_id ?? "",
    locality: draft.area ?? "",
    administrative_area: "",
    country: "",
    location_resolved: draft.location_confirmed,
    location_precision: "custom_address",
    latitude: draft.latitude,
    longitude: draft.longitude,
    headcount_required: draft.workers_required ?? 1,
    headcount_confirmed: 0,
    starts_at: startsAt,
    alert_type: draft.alert_type ?? "Job Alert",
    core_role: draft.core_role ?? "",
    selected_role: draft.selected_role ?? "",
    trade: draft.trade ?? "",
    location_label: draft.location_label ?? "",
    location_confirmed: draft.location_confirmed,
    start_time: draft.start_time ?? "",
    end_time: draft.end_time ?? "",
    time_window: draft.time_window ?? "",
    duration: draft.duration ?? "",
    end_date: draft.end_date ?? "",
    pay_rate: draft.pay_rate ?? "",
    pay_rate_amount: draft.pay_rate_amount,
    pay_rate_unit: draft.pay_rate_unit,
    duties: draft.duties ?? "",
    dbs_required: draft.dbs_required ?? false,
    dbs_requirement: toCreateJobDbsRequirement(draft.dbs_requirement),
    enhanced_dbs_required: draft.enhanced_dbs_required ?? false,
    cscs_required: draft.cscs_required ?? false,
    ipaf_required: draft.ipaf_required ?? false,
    own_tools_required: draft.own_tools_required ?? false,
    tools_required: draft.tools_required ?? "",
    ppe_required: draft.ppe_required ?? false,
    ppe_detail: draft.ppe_detail ?? "",
    skills_required: normaliseStringList(draft.skills_required),
    requirements: normaliseStringList(draft.requirements),
    shift_pattern: draft.shift_pattern ?? "",
    tickets_required: draft.certificates_required ? [draft.certificates_required] : [],
    certificates_required: draft.certificates_required ?? "",
    optional_supporting_notes: draft.optional_supporting_notes ?? "",
    selected_keywords: normaliseStringList(draft.selected_keywords),
    payment_type: draft.pay_rate_unit ?? "",
    notes: "",
    job_status: draft.job_status,
    payment_status: draft.payment_status,
    skill_tags: normaliseStringList(draft.selected_keywords),
    fill_status: "unfilled",
    platform_backed_job: false,
    platform_backed_status: "none",
    platform_backed_note: "",
    platform_backed_approved_by_admin: false,
    platform_backed_payment_terms: "",
    walk_off_clause_enabled: false,
    worker_payment_protected: false,
    payment_terms_days: null,
    provider_agreed_terms_verified: false,
    worker_agreed_terms_verified: false,
  };
}

export function jobDraftToWorkerAlertDraft(draft: JobDraft): WorkerAlertDraft {
  return {
    title: draft.title,
    role: draft.selected_role ?? draft.required_role ?? draft.core_role ?? draft.title,
    primaryRole: draft.core_role ?? undefined,
    location: draft.location_label ?? undefined,
    postcode: draft.postcode ?? undefined,
    payRate: draft.pay_rate_amount ?? draft.pay_rate ?? undefined,
    payType: draft.pay_rate_unit === "daily" ? "day" : draft.pay_rate_unit ?? undefined,
    startDate: draft.start_date ?? undefined,
    startTime: draft.start_time ?? undefined,
    duration: draft.duration ?? undefined,
    headcount: draft.workers_required ?? undefined,
    skills: draft.skills_required.length ? draft.skills_required : draft.requirements,
    duties: draft.duties ?? undefined,
    ppe: draft.ppe_required ? draft.ppe_detail ?? "PPE required" : undefined,
    compliance: draft.requirements,
    requirements: draft.requirements,
    cscsRequired: Boolean(draft.cscs_required),
    dbsRequired: Boolean(draft.dbs_required),
    enhancedDbsRequired: Boolean(draft.enhanced_dbs_required),
    ipafRequired: Boolean(draft.ipaf_required),
  };
}
