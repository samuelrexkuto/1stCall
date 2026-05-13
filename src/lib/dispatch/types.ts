import { z } from "zod";

export const dispatchChannelSchema = z.enum(["whatsapp", "sms", "call", "email"]);

const nullableNumberLike = z
  .union([z.number(), z.string().trim(), z.null(), z.undefined()])
  .transform((value) => {
    if (value === null || value === undefined || value === "") {
      return null;
    }

    const parsed = typeof value === "number" ? value : Number(value);
    return Number.isNaN(parsed) ? null : parsed;
  });

export const dispatchPayloadSchema = z.object({
  job_id: z.string().uuid("job_id must be a valid UUID"),
  worker_ids: z.array(z.string().uuid("worker_ids must contain valid UUIDs")).min(1),
  channels: z.array(dispatchChannelSchema).min(1),
  alert_style: z.string().trim().min(1),
  message_preview: z.string().trim().min(1),
  job_context: z
    .object({
      job_title: z.string().trim().min(1),
      alert_type: z.string().trim().optional().nullable(),
      core_role: z.string().trim().optional().nullable(),
      headcount_required: nullableNumberLike,
      location: z.string().trim().optional().nullable(),
      duration: z.string().trim().optional().nullable(),
      end_date: z.string().trim().optional().nullable(),
      role: z.string().trim().optional().nullable(),
      area: z.string().trim().optional().nullable(),
      postcode: z.string().trim().optional().nullable(),
      start_date: z.string().trim().optional().nullable(),
      start_time: z.string().trim().optional().nullable(),
      pay_rate: nullableNumberLike,
      pay_rate_display: z.string().trim().optional().nullable(),
      payment_type: z.string().trim().optional().nullable(),
      duties: z.string().trim().optional().nullable(),
      dbs_requirement: z.string().trim().optional().nullable(),
      ipaf_required: z.boolean().optional().nullable(),
      own_tools_required: z.boolean().optional().nullable(),
      ppe_required: z.boolean().optional().nullable(),
      skills_required: z.array(z.string()).optional(),
      shift_pattern: z.string().trim().optional().nullable(),
      tickets_required: z.array(z.string()).optional(),
      optional_supporting_notes: z.string().trim().optional().nullable(),
    })
    .passthrough(),
});

export type DispatchPayload = z.infer<typeof dispatchPayloadSchema>;
