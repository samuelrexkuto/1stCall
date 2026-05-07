alter table public.job_worker_assignments
  add column if not exists accepted_at timestamptz,
  add column if not exists selected_for_release_at timestamptz,
  add column if not exists released_by_admin uuid,
  add column if not exists requested_by_client boolean default false,
  add column if not exists requested_by_client_at timestamptz,
  add column if not exists requested_rank integer,
  add column if not exists updated_at timestamptz default now();

update public.job_worker_assignments
set
  accepted_at = coalesce(accepted_at, accepted_by_worker_at),
  selected_for_release_at = case
    when assignment_status = 'selected_for_release' then coalesce(selected_for_release_at, updated_at, now())
    else selected_for_release_at
  end,
  released_to_client_at = case
    when released_to_client = true or assignment_status = 'released_to_client'
      then coalesce(released_to_client_at, updated_at, now())
    else released_to_client_at
  end,
  assignment_status = case
    when assignment_status = 'worker_accepted' then 'accepted'
    when assignment_status = 'worker_declined' then 'rejected'
    when released_to_client = true then 'released_to_client'
    else assignment_status
  end,
  requested_by_client = coalesce(requested_by_client, false),
  updated_at = coalesce(updated_at, now());

alter table public.job_worker_assignments
  drop constraint if exists job_worker_assignments_assignment_status_check;

alter table public.job_worker_assignments
  add constraint job_worker_assignments_assignment_status_check
  check (
    assignment_status in (
      'pending',
      'accepted',
      'selected_for_release',
      'released_to_client',
      'rejected',
      'requested',
      'admin_reviewing',
      'sent_to_worker',
      'worker_accepted',
      'worker_declined',
      'filled',
      'completed',
      'cancelled'
    )
  );

create index if not exists idx_job_worker_assignments_job_status
  on public.job_worker_assignments(job_id, assignment_status);

create index if not exists idx_job_worker_assignments_job_released_status
  on public.job_worker_assignments(job_id, released_to_client_at)
  where assignment_status = 'released_to_client' or released_to_client_at is not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'job_worker_assignments_unique_job_worker'
  ) then
    alter table public.job_worker_assignments
      add constraint job_worker_assignments_unique_job_worker unique (job_id, worker_id);
  end if;
end $$;

alter table public.job_worker_assignments enable row level security;

drop policy if exists job_worker_assignments_admin_all on public.job_worker_assignments;
create policy job_worker_assignments_admin_all
  on public.job_worker_assignments
  for all
  to authenticated
  using (public.current_user_is_admin())
  with check (public.current_user_is_admin());

drop policy if exists job_worker_assignments_provider_released_select on public.job_worker_assignments;
create policy job_worker_assignments_provider_released_select
  on public.job_worker_assignments
  for select
  to authenticated
  using (
    (
      assignment_status = 'released_to_client'
      or released_to_client_at is not null
    )
    and exists (
      select 1
      from public.jobs j
      where j.id = job_worker_assignments.job_id
        and j.provider_id::text = coalesce(
          auth.jwt() ->> 'provider_id',
          auth.jwt() -> 'app_metadata' ->> 'provider_id',
          auth.jwt() -> 'user_metadata' ->> 'provider_id'
        )
    )
  );

select pg_notify('pgrst', 'reload schema');
