create table if not exists public.project_management_accounts (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references public.job_providers(id) on delete cascade,
  name text not null,
  email text not null,
  password_hash text not null,
  account_status text not null default 'active' check (account_status in ('active', 'inactive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_project_management_accounts_email
  on public.project_management_accounts (lower(email));

create unique index if not exists idx_project_management_accounts_provider_id
  on public.project_management_accounts (provider_id);
