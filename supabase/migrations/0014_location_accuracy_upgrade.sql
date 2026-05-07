alter table if exists public.jobs
  add column if not exists location_text text,
  add column if not exists formatted_address text,
  add column if not exists place_id text,
  add column if not exists locality text,
  add column if not exists administrative_area text,
  add column if not exists country text;

alter table if exists public.workers
  add column if not exists location_text text,
  add column if not exists formatted_address text,
  add column if not exists place_id text,
  add column if not exists locality text,
  add column if not exists administrative_area text,
  add column if not exists country text;

create index if not exists idx_jobs_place_id on public.jobs(place_id);
create index if not exists idx_workers_place_id on public.workers(place_id);
create index if not exists idx_jobs_locality_postcode on public.jobs(locality, postcode);
create index if not exists idx_workers_locality_postcode on public.workers(locality, postcode);

notify pgrst, 'reload schema';
