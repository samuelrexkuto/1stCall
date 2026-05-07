alter table if exists public.project_management_accounts
  add column if not exists access_tier text not null default 'free_preview',
  add column if not exists access_status text not null default 'active',
  add column if not exists access_updated_at timestamptz,
  add column if not exists access_updated_by text,
  add column if not exists access_notes text,
  add column if not exists admin_full_access boolean not null default false,
  add column if not exists trial_access boolean not null default false,
  add column if not exists trial_status text not null default 'none',
  add column if not exists trial_access_level text,
  add column if not exists trial_start_date date,
  add column if not exists trial_end_date date,
  add column if not exists trial_granted_by text,
  add column if not exists trial_granted_at timestamptz,
  add column if not exists trial_notes text,
  add column if not exists dispatch_allowance_remaining integer not null default 0,
  add column if not exists dispatch_access_source text not null default 'free_preview';

alter table if exists public.job_providers
  add column if not exists access_tier text not null default 'free_preview',
  add column if not exists access_status text not null default 'active',
  add column if not exists access_updated_at timestamptz,
  add column if not exists access_updated_by text,
  add column if not exists access_notes text,
  add column if not exists admin_full_access boolean not null default false,
  add column if not exists trial_access boolean not null default false,
  add column if not exists trial_access_level text,
  add column if not exists dispatch_allowance_remaining integer not null default 0,
  add column if not exists dispatch_access_source text not null default 'free_preview';

update public.project_management_accounts pma
set
  access_tier = coalesce(nullif(pma.access_tier, ''), 'free_preview'),
  trial_access = coalesce(pma.trial_access, false),
  trial_status = coalesce(pma.trial_status, 'none'),
  dispatch_allowance_remaining = coalesce(pma.dispatch_allowance_remaining, 0),
  dispatch_access_source = coalesce(nullif(pma.dispatch_access_source, ''), 'free_preview');

update public.job_providers jp
set
  access_tier = coalesce(nullif(jp.access_tier, ''), 'free_preview'),
  trial_access = coalesce(jp.trial_access, false),
  trial_status = coalesce(jp.trial_status, 'none'),
  dispatch_allowance_remaining = coalesce(jp.dispatch_allowance_remaining, jp.payg_dispatch_allowance_remaining, 0),
  dispatch_access_source = coalesce(nullif(jp.dispatch_access_source, ''), 'free_preview');

create table if not exists public.account_access_events (
  id uuid primary key default gen_random_uuid(),
  account_table text not null,
  account_id uuid not null,
  account_email text,
  account_name text,
  actor_user_id text,
  actor_email text,
  actor_role text,
  event_type text not null,
  previous_access jsonb not null default '{}'::jsonb,
  new_access jsonb not null default '{}'::jsonb,
  reason text,
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists idx_account_access_events_account
  on public.account_access_events (account_table, account_id, created_at desc);
