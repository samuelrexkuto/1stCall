alter table public.job_worker_assignments
  add column if not exists provider_id uuid,
  add column if not exists requested_by_client boolean not null default false,
  add column if not exists requested_by_client_at timestamptz,
  add column if not exists requested_rank integer,
  add column if not exists dispatch_status text,
  add column if not exists payment_cycle text default 'weekly',
  add column if not exists payment_status text default 'not_ready',
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

create unique index if not exists job_worker_assignments_job_worker_unique
  on public.job_worker_assignments (job_id, worker_id);

create index if not exists idx_job_worker_assignments_requested_job_rank
  on public.job_worker_assignments (job_id, requested_by_client, requested_rank);

select pg_notify('pgrst', 'reload schema');
