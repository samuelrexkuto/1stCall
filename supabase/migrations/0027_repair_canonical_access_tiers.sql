alter table if exists public.project_management_accounts
  add column if not exists account_tier text not null default 'free_preview',
  add column if not exists access_tier text not null default 'free_preview';

alter table if exists public.job_providers
  add column if not exists account_tier text not null default 'free_preview',
  add column if not exists access_tier text not null default 'free_preview';

alter table if exists public.project_management_accounts
  drop constraint if exists project_management_accounts_account_tier_check,
  drop constraint if exists project_management_accounts_access_tier_check;

alter table if exists public.job_providers
  drop constraint if exists job_providers_account_tier_check,
  drop constraint if exists job_providers_access_tier_check;

update public.project_management_accounts
set
  account_tier = case lower(coalesce(nullif(account_tier, ''), access_tier, 'free_preview'))
    when 'free' then 'free_preview'
    when 'free preview' then 'free_preview'
    when 'trial' then 'trial_full_access'
    when '30-day trial - full access' then 'trial_full_access'
    when '30 day trial' then 'trial_full_access'
    when 'monthly' then 'monthly_full_access'
    when 'monthly - full access' then 'monthly_full_access'
    when 'full access' then 'manual_full_access'
    when 'admin override' then 'manual_full_access'
    when 'payg' then 'payg'
    when 'trial_full_access' then 'trial_full_access'
    when 'monthly_full_access' then 'monthly_full_access'
    when 'manual_full_access' then 'manual_full_access'
    else 'free_preview'
  end,
  access_tier = case lower(coalesce(nullif(access_tier, ''), account_tier, 'free_preview'))
    when 'free' then 'free_preview'
    when 'free preview' then 'free_preview'
    when 'trial' then 'trial_full_access'
    when '30-day trial - full access' then 'trial_full_access'
    when '30 day trial' then 'trial_full_access'
    when 'monthly' then 'monthly_full_access'
    when 'monthly - full access' then 'monthly_full_access'
    when 'full access' then 'manual_full_access'
    when 'admin override' then 'manual_full_access'
    when 'payg' then 'payg'
    when 'trial_full_access' then 'trial_full_access'
    when 'monthly_full_access' then 'monthly_full_access'
    when 'manual_full_access' then 'manual_full_access'
    else 'free_preview'
  end;

update public.job_providers
set
  account_tier = case lower(coalesce(nullif(account_tier, ''), access_tier, 'free_preview'))
    when 'free' then 'free_preview'
    when 'free preview' then 'free_preview'
    when 'trial' then 'trial_full_access'
    when '30-day trial - full access' then 'trial_full_access'
    when '30 day trial' then 'trial_full_access'
    when 'monthly' then 'monthly_full_access'
    when 'monthly - full access' then 'monthly_full_access'
    when 'full access' then 'manual_full_access'
    when 'admin override' then 'manual_full_access'
    when 'payg' then 'payg'
    when 'trial_full_access' then 'trial_full_access'
    when 'monthly_full_access' then 'monthly_full_access'
    when 'manual_full_access' then 'manual_full_access'
    else 'free_preview'
  end,
  access_tier = case lower(coalesce(nullif(access_tier, ''), account_tier, 'free_preview'))
    when 'free' then 'free_preview'
    when 'free preview' then 'free_preview'
    when 'trial' then 'trial_full_access'
    when '30-day trial - full access' then 'trial_full_access'
    when '30 day trial' then 'trial_full_access'
    when 'monthly' then 'monthly_full_access'
    when 'monthly - full access' then 'monthly_full_access'
    when 'full access' then 'manual_full_access'
    when 'admin override' then 'manual_full_access'
    when 'payg' then 'payg'
    when 'trial_full_access' then 'trial_full_access'
    when 'monthly_full_access' then 'monthly_full_access'
    when 'manual_full_access' then 'manual_full_access'
    else 'free_preview'
  end;

alter table if exists public.project_management_accounts
  add constraint project_management_accounts_account_tier_check
  check (account_tier in ('free_preview', 'trial_full_access', 'payg', 'monthly_full_access', 'manual_full_access')),
  add constraint project_management_accounts_access_tier_check
  check (access_tier in ('free_preview', 'trial_full_access', 'payg', 'monthly_full_access', 'manual_full_access'));

alter table if exists public.job_providers
  add constraint job_providers_account_tier_check
  check (account_tier in ('free_preview', 'trial_full_access', 'payg', 'monthly_full_access', 'manual_full_access')),
  add constraint job_providers_access_tier_check
  check (access_tier in ('free_preview', 'trial_full_access', 'payg', 'monthly_full_access', 'manual_full_access'));

create or replace function public.sync_account_access_tier()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    if new.access_tier is null and new.account_tier is not null then
      new.access_tier := new.account_tier;
    elsif new.account_tier is null and new.access_tier is not null then
      new.account_tier := new.access_tier;
    elsif new.access_tier is null and new.account_tier is null then
      new.access_tier := 'free_preview';
      new.account_tier := 'free_preview';
    else
      new.account_tier := new.access_tier;
    end if;
  elsif new.access_tier is distinct from old.access_tier then
    new.account_tier := new.access_tier;
  elsif new.account_tier is distinct from old.account_tier then
    new.access_tier := new.account_tier;
  end if;
  return new;
end;
$$;

drop trigger if exists sync_project_management_account_access_tier on public.project_management_accounts;
create trigger sync_project_management_account_access_tier
before insert or update on public.project_management_accounts
for each row execute function public.sync_account_access_tier();

drop trigger if exists sync_job_provider_access_tier on public.job_providers;
create trigger sync_job_provider_access_tier
before insert or update on public.job_providers
for each row execute function public.sync_account_access_tier();
