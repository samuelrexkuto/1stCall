alter table public.job_providers
  add column if not exists trial_granted_by text,
  add column if not exists trial_granted_at timestamptz,
  add column if not exists trial_notes text;

do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conname = 'job_providers_trial_status_check'
  ) then
    alter table public.job_providers
      drop constraint job_providers_trial_status_check;
  end if;

  alter table public.job_providers
    add constraint job_providers_trial_status_check
    check (trial_status in ('none', 'active', 'expired', 'revoked'));
end $$;
