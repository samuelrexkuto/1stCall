alter table public.job_providers
  add column if not exists account_tier text default 'free',
  add column if not exists billing_status text default 'trial',
  add column if not exists monthly_active boolean default false,
  add column if not exists payg_pack text default 'None',
  add column if not exists payg_allowance_total integer default 0,
  add column if not exists payg_allowance_remaining integer default 0,
  add column if not exists usage_today integer default 0,
  add column if not exists monthly_renewal_date date,
  add column if not exists is_trial_month boolean default false,
  add column if not exists trial_start_date date,
  add column if not exists trial_end_date date,
  add column if not exists trial_status text default 'none',
  add column if not exists trial_granted_by_admin boolean default false,
  add column if not exists internal_billing_note text,
  add column if not exists payg_pack_type text,
  add column if not exists payg_dispatch_allowance_total integer default 0,
  add column if not exists payg_dispatch_allowance_remaining integer default 0;

update public.job_providers
set
  account_tier = coalesce(account_tier, 'free'),
  billing_status = coalesce(billing_status, 'trial'),
  monthly_active = coalesce(monthly_active, false),
  payg_pack = coalesce(payg_pack, payg_pack_type, 'None'),
  payg_allowance_total = coalesce(payg_allowance_total, payg_dispatch_allowance_total, 0),
  payg_allowance_remaining = coalesce(payg_allowance_remaining, payg_dispatch_allowance_remaining, 0),
  usage_today = coalesce(usage_today, 0),
  is_trial_month = coalesce(is_trial_month, false),
  trial_status = coalesce(trial_status, case when coalesce(is_trial_month, false) then 'active' else 'none' end),
  trial_granted_by_admin = coalesce(trial_granted_by_admin, false),
  payg_pack_type = coalesce(payg_pack_type, nullif(payg_pack, 'None')),
  payg_dispatch_allowance_total = coalesce(payg_dispatch_allowance_total, payg_allowance_total, 0),
  payg_dispatch_allowance_remaining = coalesce(payg_dispatch_allowance_remaining, payg_allowance_remaining, 0);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'job_providers_account_tier_check'
  ) then
    alter table public.job_providers
      add constraint job_providers_account_tier_check
      check (account_tier in ('free', 'payg', 'monthly'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'job_providers_billing_status_check'
  ) then
    alter table public.job_providers
      add constraint job_providers_billing_status_check
      check (billing_status in ('trial', 'active', 'inactive', 'expired'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'job_providers_trial_status_check'
  ) then
    alter table public.job_providers
      add constraint job_providers_trial_status_check
      check (trial_status in ('none', 'active', 'expired'));
  end if;
end $$;
