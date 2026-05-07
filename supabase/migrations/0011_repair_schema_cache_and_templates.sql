create extension if not exists pgcrypto;

create table if not exists public.message_templates (
  id uuid primary key default gen_random_uuid(),
  template_type text not null,
  template_name text not null,
  channel text not null default 'whatsapp',
  subject text,
  body text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table if exists public.message_templates
  alter column channel set default 'whatsapp';

create unique index if not exists message_templates_type_channel_key
  on public.message_templates (template_type, channel);

drop trigger if exists trg_message_templates_set_updated_at on public.message_templates;
create trigger trg_message_templates_set_updated_at
before update on public.message_templates
for each row
execute function public.set_updated_at();

alter table if exists public.jobs
  add column if not exists alert_type text,
  add column if not exists core_role text,
  add column if not exists duration text,
  add column if not exists end_date date,
  add column if not exists pay_rate_display text,
  add column if not exists duties text,
  add column if not exists dbs_requirement text,
  add column if not exists ipaf_required boolean,
  add column if not exists own_tools_required boolean,
  add column if not exists ppe_required boolean,
  add column if not exists skills_required jsonb not null default '[]'::jsonb,
  add column if not exists shift_pattern text,
  add column if not exists tickets_required jsonb not null default '[]'::jsonb,
  add column if not exists optional_supporting_notes text,
  add column if not exists payment_type text,
  add column if not exists alert_preview_json jsonb;

insert into public.message_templates (template_type, template_name, channel, subject, body)
values
  (
    'recruiter_onboarding',
    'Recruiter Onboarding',
    'whatsapp',
    null,
    'Hello [First Name],

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

[Your Company Name]'
  ),
  (
    'worker_onboarding',
    'Worker Onboarding',
    'whatsapp',
    null,
    'Hello [First Name],

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

[Your Company Name]'
  )
on conflict (template_type, channel) do update
set
  template_name = excluded.template_name,
  subject = excluded.subject,
  body = public.message_templates.body;

notify pgrst, 'reload schema';
