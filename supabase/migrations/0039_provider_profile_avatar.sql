alter table public.job_providers
add column if not exists avatar_url text;

alter table public.project_management_accounts
add column if not exists avatar_url text;
