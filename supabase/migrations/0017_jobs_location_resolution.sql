alter table if exists public.jobs
  add column if not exists place_id text,
  add column if not exists latitude double precision,
  add column if not exists longitude double precision,
  add column if not exists location_resolved boolean not null default false;

create index if not exists jobs_lat_lng_idx
on public.jobs (latitude, longitude);

notify pgrst, 'reload schema';
