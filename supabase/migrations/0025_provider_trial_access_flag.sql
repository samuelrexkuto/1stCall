alter table public.job_providers
  add column if not exists trial_access boolean default false;

update public.job_providers
set
  trial_access = true,
  trial_access_level = coalesce(trial_access_level, 'full_access')
where trial_status = 'active'
  and trial_start_date is not null
  and trial_end_date is not null
  and coalesce(trial_granted_by_admin, false) = true;
