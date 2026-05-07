alter table public.job_worker_assignments
  add column if not exists confirmed_for_job boolean not null default false;

alter table public.job_worker_assignments
  add column if not exists confirmed_at timestamptz;

alter table public.job_worker_assignments
  add column if not exists released_to_client boolean not null default false;

alter table public.job_worker_assignments
  add column if not exists released_to_client_at timestamptz;

alter table public.jobs
  add column if not exists workers_confirmed integer not null default 0;

alter table public.jobs
  add column if not exists confirmed_worker_ids uuid[] default '{}';

alter table public.jobs
  add column if not exists confirmed_workforce_count integer not null default 0;

alter table public.jobs
  add column if not exists updated_at timestamptz default now();
