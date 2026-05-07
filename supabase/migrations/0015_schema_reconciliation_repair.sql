alter table if exists public.jobs
  add column if not exists location_text text,
  add column if not exists formatted_address text,
  add column if not exists place_id text,
  add column if not exists locality text,
  add column if not exists administrative_area text,
  add column if not exists country text,
  add column if not exists latitude double precision,
  add column if not exists longitude double precision;

alter table if exists public.workers
  add column if not exists location_text text,
  add column if not exists formatted_address text,
  add column if not exists place_id text,
  add column if not exists locality text,
  add column if not exists administrative_area text,
  add column if not exists country text,
  add column if not exists latitude double precision,
  add column if not exists longitude double precision;

update public.jobs
set
  location_text = coalesce(location_text, location_display),
  locality = coalesce(locality, area)
where location_text is null
   or locality is null;

update public.workers
set
  location_text = coalesce(location_text, location_display),
  locality = coalesce(locality, town)
where location_text is null
   or locality is null;

create index if not exists idx_jobs_place_id_repair on public.jobs(place_id);
create index if not exists idx_workers_place_id_repair on public.workers(place_id);

notify pgrst, 'reload schema';
