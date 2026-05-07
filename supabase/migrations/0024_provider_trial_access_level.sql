alter table public.job_providers
  add column if not exists trial_access_level text;

update public.job_providers
set trial_access_level = 'full_access'
where coalesce(trial_granted_by_admin, false) = true
  and trial_status = 'active'
  and trial_access_level is null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'job_providers_trial_access_level_check'
  ) then
    alter table public.job_providers
      add constraint job_providers_trial_access_level_check
      check (trial_access_level is null or trial_access_level in ('preview', 'full_access'));
  end if;
end $$;
