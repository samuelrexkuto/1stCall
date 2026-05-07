create extension if not exists pgcrypto;

create table if not exists public.job_providers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text,
  phone text,
  town text,
  postcode text,
  created_at timestamptz not null default now()
);

create table if not exists public.workers (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  phone text,
  email text,
  primary_role text,
  status text default 'active',
  town text,
  postcode text,
  available_today boolean default false,
  right_to_work boolean default false,
  contract_signed boolean default false,
  whatsapp_opt_in boolean default false,
  priority_tier text,
  created_at timestamptz not null default now()
);

create table if not exists public.jobs (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  required_role text,
  area text,
  postcode text,
  provider_id uuid references public.job_providers(id) on delete set null,
  job_status text default 'open',
  fill_status text default 'unfilled',
  payment_status text default 'unpaid',
  headcount_required integer default 1,
  headcount_confirmed integer default 0,
  starts_at timestamptz,
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists idx_jobs_provider_id on public.jobs(provider_id);
create index if not exists idx_jobs_status on public.jobs(job_status, fill_status, payment_status);
create index if not exists idx_workers_status on public.workers(status, available_today, primary_role);
