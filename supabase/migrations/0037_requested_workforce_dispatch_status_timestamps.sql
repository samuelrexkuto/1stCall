alter table public.job_worker_assignments
  add column if not exists accepted_at timestamptz,
  add column if not exists declined_at timestamptz,
  add column if not exists dispatched_at timestamptz,
  add column if not exists no_response_at timestamptz,
  add column if not exists dispatch_notes text,
  add column if not exists dispatch_status text default 'requested',
  add column if not exists requested_by_client boolean not null default false,
  add column if not exists requested_by_client_at timestamptz,
  add column if not exists requested_rank integer,
  add column if not exists payment_cycle text default 'weekly',
  add column if not exists payment_status text default 'not_ready',
  add column if not exists updated_at timestamptz default now();

create unique index if not exists job_worker_assignments_job_worker_unique
  on public.job_worker_assignments (job_id, worker_id);

create index if not exists idx_job_worker_assignments_job_requested_dispatch
  on public.job_worker_assignments (job_id, requested_by_client, dispatch_status);
