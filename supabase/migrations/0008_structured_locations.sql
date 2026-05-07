alter table if exists public.workers
  add column if not exists location_display text,
  add column if not exists location_query text,
  add column if not exists location_precision text;

alter table if exists public.jobs
  add column if not exists location_display text,
  add column if not exists location_query text,
  add column if not exists location_precision text;
