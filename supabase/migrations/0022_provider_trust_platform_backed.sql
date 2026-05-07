alter table public.job_providers
  add column if not exists payment_reliability_status text default 'limited_data',
  add column if not exists invoices_issued_count integer default 0,
  add column if not exists invoices_paid_on_time_count integer default 0,
  add column if not exists invoices_paid_late_count integer default 0,
  add column if not exists unpaid_invoices_count integer default 0,
  add column if not exists part_paid_invoices_count integer default 0,
  add column if not exists average_days_to_pay numeric,
  add column if not exists longest_payment_delay_days integer default 0,
  add column if not exists current_overdue_count integer default 0,
  add column if not exists payment_disputes_count integer default 0,
  add column if not exists contractor_payout_delay_incidents_count integer default 0,
  add column if not exists last_payment_received_date date,
  add column if not exists payment_reliability_note text,
  add column if not exists payment_reliability_last_reviewed_at timestamptz;

update public.job_providers
set
  payment_reliability_status = coalesce(payment_reliability_status, 'limited_data'),
  invoices_issued_count = coalesce(invoices_issued_count, 0),
  invoices_paid_on_time_count = coalesce(invoices_paid_on_time_count, 0),
  invoices_paid_late_count = coalesce(invoices_paid_late_count, 0),
  unpaid_invoices_count = coalesce(unpaid_invoices_count, 0),
  part_paid_invoices_count = coalesce(part_paid_invoices_count, 0),
  longest_payment_delay_days = coalesce(longest_payment_delay_days, 0),
  current_overdue_count = coalesce(current_overdue_count, 0),
  payment_disputes_count = coalesce(payment_disputes_count, 0),
  contractor_payout_delay_incidents_count = coalesce(contractor_payout_delay_incidents_count, 0);

alter table public.jobs
  add column if not exists platform_backed_job boolean default false,
  add column if not exists platform_backed_status text default 'none',
  add column if not exists platform_backed_note text,
  add column if not exists platform_backed_approved_by_admin boolean default false,
  add column if not exists platform_backed_payment_terms text,
  add column if not exists walk_off_clause_enabled boolean default false,
  add column if not exists worker_payment_protected boolean default false,
  add column if not exists payment_terms_days integer,
  add column if not exists provider_agreed_terms_verified boolean default false,
  add column if not exists worker_agreed_terms_verified boolean default false;

update public.jobs
set
  platform_backed_job = coalesce(platform_backed_job, false),
  platform_backed_status = coalesce(platform_backed_status, 'none'),
  platform_backed_approved_by_admin = coalesce(platform_backed_approved_by_admin, false),
  walk_off_clause_enabled = coalesce(walk_off_clause_enabled, false),
  worker_payment_protected = coalesce(worker_payment_protected, false),
  provider_agreed_terms_verified = coalesce(provider_agreed_terms_verified, false),
  worker_agreed_terms_verified = coalesce(worker_agreed_terms_verified, false);

create table if not exists public.provider_audit_events (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid references public.job_providers(id) on delete cascade,
  event_type text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'job_providers_payment_reliability_status_check'
  ) then
    alter table public.job_providers
      add constraint job_providers_payment_reliability_status_check
      check (payment_reliability_status in ('limited_data', 'strong', 'moderate', 'at_risk', 'under_review'));
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'jobs_platform_backed_status_check'
  ) then
    alter table public.jobs
      add constraint jobs_platform_backed_status_check
      check (platform_backed_status in ('none', 'proposed', 'approved', 'active', 'completed', 'revoked'));
  end if;
end $$;
