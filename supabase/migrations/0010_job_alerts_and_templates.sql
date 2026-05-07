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

create table if not exists public.message_templates (
  id uuid primary key default gen_random_uuid(),
  template_type text not null unique,
  template_name text not null,
  channel text not null,
  subject text,
  body text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
