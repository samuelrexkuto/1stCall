alter table if exists public.jobs
  add column if not exists invoice_generated boolean not null default false,
  add column if not exists invoice_generated_at timestamptz null,
  add column if not exists latitude double precision,
  add column if not exists longitude double precision;

alter table if exists public.workers
  add column if not exists latitude double precision,
  add column if not exists longitude double precision;
