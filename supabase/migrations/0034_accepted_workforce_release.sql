alter table public.job_worker_assignments
  add column if not exists accepted_by_worker boolean not null default false,
  add column if not exists accepted_by_worker_at timestamptz,
  add column if not exists broadcast_completed boolean not null default false,
  add column if not exists released_to_client boolean not null default false,
  add column if not exists released_to_client_at timestamptz;

update public.job_worker_assignments
set
  accepted_by_worker = coalesce(accepted_by_worker, false),
  broadcast_completed = coalesce(broadcast_completed, false),
  released_to_client = coalesce(released_to_client, false);

create index if not exists idx_job_worker_assignments_accepted_by_worker
  on public.job_worker_assignments(accepted_by_worker);

create index if not exists idx_job_worker_assignments_released_to_client
  on public.job_worker_assignments(released_to_client);

create index if not exists idx_job_worker_assignments_job_released
  on public.job_worker_assignments(job_id, released_to_client);

select pg_notify('pgrst', 'reload schema');
