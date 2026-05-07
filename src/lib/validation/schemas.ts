import { z } from "zod";

const tagArray = z.array(z.string().trim().min(1)).default([]);
const optionalStringArray = z.array(z.string().trim().min(1)).default([]);
const optionalText = z.string().trim().optional().or(z.literal(""));
const optionalNullableText = z.string().trim().optional().or(z.literal("")).nullable();
const nullableDateTime = z.string().trim().optional().or(z.literal("")).nullable();
const nullableCoordinate = z
  .union([z.number(), z.string().trim(), z.null(), z.undefined()])
  .transform((value, ctx) => {
    if (value === null || value === undefined || value === "") {
      return null;
    }

    const parsed = typeof value === "number" ? value : Number(value);

    if (Number.isNaN(parsed)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Coordinate must be numeric",
      });
      return z.NEVER;
    }

    return parsed;
  });

function deriveFillStatus(
  jobStatus: string,
  headcountRequired: number,
  headcountConfirmed: number,
) {
  if (jobStatus === "cancelled") return "cancelled";
  if (jobStatus === "completed") return "filled";
  if (headcountConfirmed >= headcountRequired) return "filled";
  if (headcountConfirmed > 0) return "part_filled";
  return "unfilled";
}

export const createJobProviderSchema = z.object({
  name: z.string().trim().min(2, "Provider name is required"),
  email: z.string().trim().email("Use a valid email").optional().or(z.literal("")),
  phone: optionalText,
  town: optionalText,
  postcode: optionalText,
  account_tier: z
    .enum(["free_preview", "trial_full_access", "payg", "monthly_full_access", "manual_full_access"])
    .default("free_preview"),
  billing_status: z.enum(["trial", "active", "inactive", "past_due", "expired"]).default("trial"),
  payg_pack_type: z.enum(["payg_3", "payg_5", "payg_10"]).nullable().optional(),
  payg_dispatch_allowance_total: z.coerce.number().int().min(0).default(0),
  payg_dispatch_allowance_remaining: z.coerce.number().int().min(0).default(0),
  usage_today: z.coerce.number().int().min(0).default(0),
  monthly_renewal_date: z.string().trim().optional().or(z.literal("")).nullable(),
  monthly_active: z.boolean().default(false),
  is_trial_month: z.boolean().default(false),
  trial_granted_by_admin: z.boolean().default(false),
  trial_start_date: z.string().trim().optional().or(z.literal("")).nullable(),
  trial_end_date: z.string().trim().optional().or(z.literal("")).nullable(),
  trial_status: z.enum(["none", "active", "expired", "revoked"]).default("none"),
  internal_billing_note: optionalText,
  success_fee_status: optionalText,
  payment_reliability_status: z
    .enum(["limited_data", "strong", "moderate", "at_risk", "under_review"])
    .default("limited_data"),
  invoices_issued_count: z.coerce.number().int().min(0).default(0),
  invoices_paid_on_time_count: z.coerce.number().int().min(0).default(0),
  invoices_paid_late_count: z.coerce.number().int().min(0).default(0),
  unpaid_invoices_count: z.coerce.number().int().min(0).default(0),
  part_paid_invoices_count: z.coerce.number().int().min(0).default(0),
  average_days_to_pay: z.coerce.number().min(0).optional().nullable(),
  longest_payment_delay_days: z.coerce.number().int().min(0).default(0),
  current_overdue_count: z.coerce.number().int().min(0).default(0),
  payment_disputes_count: z.coerce.number().int().min(0).default(0),
  contractor_payout_delay_incidents_count: z.coerce.number().int().min(0).default(0),
  last_payment_received_date: z.string().trim().optional().or(z.literal("")).nullable(),
  payment_reliability_note: optionalText,
  payment_reliability_last_reviewed_at: z.string().trim().optional().or(z.literal("")).nullable(),
});

export const createJobSchema = z
  .object({
    provider_id: z
      .string()
      .trim()
      .optional()
      .or(z.literal(""))
      .refine((value) => !value || z.uuid().safeParse(value).success, "Select a valid provider"),
    title: z.string().trim().min(2, "Job title is required"),
    required_role: optionalText,
    area: optionalText,
    postcode: optionalText,
    location_text: optionalText,
    location_display: optionalText,
    location_query: optionalText,
    formatted_address: optionalText,
    place_id: optionalText,
    locality: optionalText,
    administrative_area: optionalText,
    country: optionalText,
    location_resolved: z.boolean().optional().default(false),
    location_precision: z.enum(["full_postcode", "postcode_area", "custom_address"]).default("postcode_area"),
    headcount_required: z.coerce.number().int().min(1),
    headcount_confirmed: z.coerce.number().int().min(0),
    starts_at: nullableDateTime,
    alert_type: optionalText,
    core_role: optionalText,
    selected_role: optionalText,
    trade: optionalText,
    location_label: optionalText,
    location_confirmed: z.boolean().optional().default(false),
    start_time: optionalText,
    end_time: optionalText,
    time_window: optionalText,
    duration: optionalText,
    end_date: z.string().trim().optional().or(z.literal("")).nullable(),
    pay_rate: optionalText,
    pay_rate_amount: z.coerce.number().optional().nullable(),
    pay_rate_unit: z.enum(["hourly", "daily", "weekly", "fixed"]).optional().or(z.literal("")).nullable(),
    duties: optionalText,
    dbs_required: z.boolean().default(false),
    dbs_requirement: z.enum(["None", "DBS Required", "Enhanced DBS Required"]).default("None"),
    enhanced_dbs_required: z.boolean().default(false),
    cscs_required: z.boolean().default(false),
    ipaf_required: z.boolean().default(false),
    own_tools_required: z.boolean().default(false),
    tools_required: optionalText,
    ppe_required: z.boolean().default(false),
    ppe_detail: optionalText,
    skills_required: optionalStringArray,
    requirements: optionalStringArray,
    shift_pattern: optionalText,
    tickets_required: optionalStringArray,
    certificates_required: optionalNullableText,
    optional_supporting_notes: optionalText,
    selected_keywords: optionalStringArray,
    payment_type: optionalText,
    notes: optionalText,
    latitude: nullableCoordinate,
    longitude: nullableCoordinate,
    job_status: z.enum(["open", "in_progress", "completed", "cancelled"]).default("open"),
    payment_status: z.enum(["unpaid", "part_paid", "paid", "overdue"]).default("unpaid"),
    skill_tags: tagArray,
    fill_status: z.enum(["unfilled", "part_filled", "filled", "cancelled"]).optional(),
    platform_backed_job: z.boolean().default(false),
    platform_backed_status: z.enum(["none", "proposed", "approved", "active", "completed", "revoked"]).default("none"),
    platform_backed_note: optionalText,
    platform_backed_approved_by_admin: z.boolean().default(false),
    platform_backed_payment_terms: optionalText,
    walk_off_clause_enabled: z.boolean().default(false),
    worker_payment_protected: z.boolean().default(false),
    payment_terms_days: z.coerce.number().int().min(0).optional().nullable(),
    provider_agreed_terms_verified: z.boolean().default(false),
    worker_agreed_terms_verified: z.boolean().default(false),
  })
  .transform((data) => ({
    ...data,
    provider_id: data.provider_id || null,
    starts_at: data.starts_at || null,
    notes: data.notes || "",
    alert_type: data.alert_type || "Job Alert",
    core_role: data.core_role || data.required_role || null,
    selected_role: data.selected_role || data.core_role || data.required_role || null,
    trade: data.trade || data.core_role || data.required_role || null,
    location_label: data.location_label || data.location_display || data.formatted_address || null,
    location_confirmed: data.location_confirmed || data.location_resolved,
    start_time: data.start_time || null,
    end_time: data.end_time || null,
    time_window: data.time_window || null,
    duration: data.duration || null,
    end_date: data.end_date || null,
    pay_rate: data.pay_rate || null,
    pay_rate_amount: data.pay_rate_amount ?? null,
    pay_rate_unit: data.pay_rate_unit || null,
    duties: data.duties || null,
    dbs_required: data.dbs_required || data.dbs_requirement !== "None",
    skills_required: data.skills_required ?? [],
    requirements: data.requirements ?? data.skills_required ?? [],
    enhanced_dbs_required: data.enhanced_dbs_required || data.dbs_requirement === "Enhanced DBS Required",
    cscs_required: data.cscs_required,
    tools_required: data.tools_required || null,
    ppe_detail: data.ppe_detail || (data.ppe_required ? "PPE required" : null),
    shift_pattern: data.shift_pattern || null,
    tickets_required: data.tickets_required ?? [],
    certificates_required: data.certificates_required || (data.tickets_required ?? []).join(", ") || null,
    optional_supporting_notes: data.optional_supporting_notes || null,
    selected_keywords: data.selected_keywords ?? data.skill_tags ?? [],
    payment_type: data.payment_type || null,
    required_role: data.required_role || null,
    area: data.area || null,
    postcode: data.postcode || null,
    location_text: data.location_text || null,
    location_display: data.location_display || null,
    location_query: data.location_query || null,
    formatted_address: data.formatted_address || null,
    place_id: data.place_id || null,
    locality: data.locality || null,
    administrative_area: data.administrative_area || null,
    country: data.country || null,
    location_resolved: data.location_resolved ?? false,
    latitude: data.latitude ?? null,
    longitude: data.longitude ?? null,
    platform_backed_note: data.platform_backed_note || null,
    platform_backed_payment_terms: data.platform_backed_payment_terms || null,
    payment_terms_days: data.payment_terms_days ?? null,
    fill_status:
      data.fill_status ??
      deriveFillStatus(data.job_status, data.headcount_required, data.headcount_confirmed),
  }));

export const createWorkerSchema = z.object({
  full_name: z.string().trim().min(2, "Full name is required"),
  phone: optionalText,
  email: z.string().trim().email("Use a valid email").optional().or(z.literal("")),
  primary_role: optionalText,
  status: z.enum(["active", "inactive", "suspended", "archived"]).default("active"),
  available_today: z.boolean(),
  right_to_work: z.boolean(),
  contract_signed: z.boolean(),
  town: optionalText,
  postcode: optionalText,
  location_text: optionalText,
  location_display: optionalText,
  location_query: optionalText,
  formatted_address: optionalText,
  place_id: optionalText,
  locality: optionalText,
  administrative_area: optionalText,
  country: optionalText,
  location_precision: z.enum(["full_postcode", "postcode_district", "town"]).default("postcode_district"),
  latitude: nullableCoordinate,
  longitude: nullableCoordinate,
  whatsapp_opt_in: z.boolean(),
  priority_tier: z.enum(["standard", "preferred", "vip", "restricted"]).default("standard"),
});

export type CreateJobProviderInput = z.infer<typeof createJobProviderSchema>;
export type CreateJobInput = z.infer<typeof createJobSchema>;
export type CreateWorkerInput = z.infer<typeof createWorkerSchema>;
