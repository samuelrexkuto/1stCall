import { createAdminSupabaseClient } from "@/lib/supabase/admin";

function schemaNotReadyMessage() {
  return "Templates are not ready yet. Please run the latest database migration and reload the PostgREST schema cache.";
}

function normalizeTemplateError(message: string) {
  const lower = message.toLowerCase();

  if (
    lower.includes("schema cache") ||
    lower.includes("message_templates") ||
    lower.includes("could not find the table") ||
    lower.includes("relation \"public.message_templates\" does not exist")
  ) {
    return schemaNotReadyMessage();
  }

  return message;
}

export interface MessageTemplateRecord {
  id?: string;
  template_type: "recruiter_onboarding" | "worker_onboarding";
  template_name: string;
  channel: "whatsapp";
  subject: string | null;
  body: string;
}

export function getDefaultRecruiterOnboardingTemplate(): MessageTemplateRecord {
  return {
    template_type: "recruiter_onboarding",
    template_name: "Recruiter Onboarding",
    channel: "whatsapp",
    subject: null,
    body: `Hello [First Name],

We help recruiters and contractors fill roles faster through a structured dispatch system that improves speed, visibility, and worker coordination.

Our service can support with:

- job broadcast and worker dispatch
- fast candidate matching
- clearer job briefs
- availability coordination
- compliance visibility
- organised follow-ups

We also build in added protection through clear legal agreements and escrow/payment security options where required, helping reduce risk for both sides.

If useful, we can support one-off roles, urgent call-outs, or ongoing labour supply.

Let me know if you would like a quick overview of how the system works.

Kind regards,

[Your Company Name]`,
  };
}

export function getDefaultWorkerOnboardingTemplate(): MessageTemplateRecord {
  return {
    template_type: "worker_onboarding",
    template_name: "Worker Onboarding",
    channel: "whatsapp",
    subject: null,
    body: `Hello [First Name],

Thanks for your interest in working with us.

We aim to make job dispatch clearer, faster, and more secure for workers by providing:

- structured job alerts
- clearer role expectations
- organised communication
- legal agreement support
- escrow/payment security options where applicable
- smoother coordination with recruiters and contractors

Our goal is to reduce confusion, protect both sides, and make it easier for workers to understand exactly what is required before accepting a role.

We will also aim to make sure job messages are clear on:

- role
- pay
- location
- start date
- duration
- required tools/tickets/PPE
- key duties

Reply to this message if you would like to be added to suitable future job alerts.

Kind regards,

[Your Company Name]`,
  };
}

export async function loadMessageTemplate(
  templateType: MessageTemplateRecord["template_type"],
) {
  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("message_templates")
    .select("id, template_type, template_name, channel, subject, body")
    .eq("template_type", templateType)
    .maybeSingle();

  if (error) {
    throw new Error(normalizeTemplateError(error.message));
  }

  return (data as MessageTemplateRecord | null) ?? null;
}

export async function saveMessageTemplate(template: MessageTemplateRecord) {
  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("message_templates")
    .upsert(template, { onConflict: "template_type,channel" })
    .select("id, template_type, template_name, channel, subject, body")
    .single();

  if (error) {
    throw new Error(normalizeTemplateError(error.message));
  }

  return data as MessageTemplateRecord;
}
