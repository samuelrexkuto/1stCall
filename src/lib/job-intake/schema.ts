import { z } from "zod";
import type { CreateJobInput } from "@/lib/validation/schemas";

const nullableString = z
  .union([z.string(), z.null(), z.undefined()])
  .transform((value) => {
    if (typeof value !== "string") return null;
    const trimmed = value.trim();
    return trimmed ? trimmed : null;
  });

export const structuredJobIntakeSchema = z.object({
  alert_type: nullableString,
  job_title: nullableString,
  core_role: nullableString,
  headcount_required: z
    .union([z.number().int().positive(), z.null(), z.undefined()])
    .transform((value) => (typeof value === "number" ? value : null)),
  location: nullableString,
  start_date: nullableString,
  end_date: nullableString,
  duration: nullableString,
  pay_rate: nullableString,
  duties: nullableString,
  dbs_requirement: z.enum(["None", "DBS Required", "Enhanced DBS Required"]).nullable().default(null),
  ipaf_required: z.union([z.boolean(), z.null(), z.undefined()]).transform((value) => (typeof value === "boolean" ? value : null)),
  own_tools_required: z.union([z.boolean(), z.null(), z.undefined()]).transform((value) => (typeof value === "boolean" ? value : null)),
  ppe_required: z.union([z.boolean(), z.null(), z.undefined()]).transform((value) => (typeof value === "boolean" ? value : null)),
  skills_required: z.array(z.string().trim().min(1)).default([]),
  payment_type: nullableString,
  shift_pattern: nullableString,
  tickets_required: z.array(z.string().trim().min(1)).default([]),
  optional_supporting_notes: nullableString,
  missing_fields: z.array(z.string().trim().min(1)).default([]),
  selected_keywords: z.array(z.string().trim().min(1)).default([]),
});

export type StructuredJobAlert = z.infer<typeof structuredJobIntakeSchema>;
export type StructuredJobIntake = StructuredJobAlert;

export const structuredJobIntakeJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    alert_type: { type: ["string", "null"] },
    job_title: { type: ["string", "null"] },
    core_role: { type: ["string", "null"] },
    headcount_required: { type: ["integer", "null"], minimum: 1 },
    location: { type: ["string", "null"] },
    start_date: { type: ["string", "null"] },
    end_date: { type: ["string", "null"] },
    duration: { type: ["string", "null"] },
    pay_rate: { type: ["string", "null"] },
    duties: { type: ["string", "null"] },
    dbs_requirement: { type: ["string", "null"], enum: ["None", "DBS Required", "Enhanced DBS Required", null] },
    ipaf_required: { type: ["boolean", "null"] },
    own_tools_required: { type: ["boolean", "null"] },
    ppe_required: { type: ["boolean", "null"] },
    skills_required: {
      type: "array",
      items: { type: "string" },
    },
    payment_type: { type: ["string", "null"] },
    shift_pattern: { type: ["string", "null"] },
    tickets_required: {
      type: "array",
      items: { type: "string" },
    },
    optional_supporting_notes: { type: ["string", "null"] },
    missing_fields: {
      type: "array",
      items: { type: "string" },
    },
    selected_keywords: {
      type: "array",
      items: { type: "string" },
    },
  },
  required: [
    "alert_type",
    "job_title",
    "core_role",
    "headcount_required",
    "location",
    "start_date",
    "end_date",
    "duration",
    "pay_rate",
    "duties",
    "dbs_requirement",
    "ipaf_required",
    "own_tools_required",
    "ppe_required",
    "skills_required",
    "payment_type",
    "shift_pattern",
    "tickets_required",
    "optional_supporting_notes",
    "missing_fields",
    "selected_keywords",
  ],
} as const;

export const jobIntakeDraftSchema = z.object({
  raw_text_input: nullableString,
  raw_audio_url: nullableString,
  transcript_text: nullableString,
  ai_structured_job_json: structuredJobIntakeSchema.nullable(),
  final_user_approved_job_json: structuredJobIntakeSchema.nullable(),
});

export type JobIntakeDraftInput = z.infer<typeof jobIntakeDraftSchema>;

function mergeNotes(parts: Array<string | null | undefined>) {
  return parts
    .map((value) => value?.trim())
    .filter(Boolean)
    .join("\n");
}

export function mapStructuredJobToJobForm(
  job: StructuredJobIntake,
): Partial<CreateJobInput> {
  const locationDisplay = job.location ?? "";
  const descriptionNotes = mergeNotes([
    job.duration ? `Duration: ${job.duration}` : null,
    job.shift_pattern ? `Shift pattern: ${job.shift_pattern}` : null,
    job.pay_rate ? `Pay rate: ${job.pay_rate}` : null,
    job.payment_type ? `Payment type: ${job.payment_type}` : null,
    job.duties ? `Duties: ${job.duties}` : null,
    job.dbs_requirement ? `DBS Requirement: ${job.dbs_requirement}` : null,
    job.ipaf_required !== null ? `IPAF required: ${job.ipaf_required ? "Yes" : "No"}` : null,
    job.own_tools_required !== null ? `Own tools required: ${job.own_tools_required ? "Yes" : "No"}` : null,
    job.ppe_required !== null ? `PPE required: ${job.ppe_required ? "Yes" : "No"}` : null,
    job.skills_required.length ? `Skills required: ${job.skills_required.join(", ")}` : null,
    job.tickets_required.length ? `Tickets required: ${job.tickets_required.join(", ")}` : null,
    job.optional_supporting_notes,
    job.selected_keywords.length ? `Keywords: ${job.selected_keywords.join(", ")}` : null,
  ]);

  const startsAt = (() => {
    if (!job.start_date) return "";
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(job.start_date)) {
      return job.start_date.slice(0, 16);
    }
    if (/^\d{4}-\d{2}-\d{2}$/.test(job.start_date)) {
      return `${job.start_date}T08:00`;
    }
    return "";
  })();

  return {
    title: job.job_title ?? job.core_role ?? "",
    required_role: job.core_role ?? "",
    location_text: locationDisplay,
    location_display: locationDisplay,
    location_query: locationDisplay,
    location_precision: "custom_address",
    postcode: "",
    area: locationDisplay,
    headcount_required: job.headcount_required ?? 1,
    starts_at: startsAt,
    notes: descriptionNotes,
    skill_tags: job.selected_keywords,
    alert_type: job.alert_type ?? "Job Alert",
    core_role: job.core_role ?? "",
    duration: job.duration ?? "",
    end_date: job.end_date ?? "",
    pay_rate: job.pay_rate ?? "",
    duties: job.duties ?? "",
    dbs_requirement: job.dbs_requirement ?? "None",
    ipaf_required: job.ipaf_required ?? false,
    own_tools_required: job.own_tools_required ?? false,
    ppe_required: job.ppe_required ?? false,
    skills_required: job.skills_required,
    shift_pattern: job.shift_pattern ?? "",
    tickets_required: job.tickets_required,
    optional_supporting_notes: job.optional_supporting_notes ?? "",
    payment_type: job.payment_type ?? "",
  };
}
