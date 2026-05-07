alter table if exists public.jobs
  add column if not exists broadcast_status text not null default 'broadcast ready',
  add column if not exists broadcast_time timestamptz;

alter table if exists public.jobs
  drop constraint if exists jobs_broadcast_status_check;

update public.jobs
set broadcast_status = 'broadcast ready'
where broadcast_status is null
   or broadcast_status in ('draft', 'queued');

update public.jobs
set broadcast_status = 'awaiting response'
where broadcast_status in ('broadcasting', 'sent');

alter table if exists public.jobs
  alter column broadcast_status set default 'broadcast ready';

alter table if exists public.jobs
  add constraint jobs_broadcast_status_check
  check (broadcast_status in ('broadcast ready', 'awaiting response', 'completed', 'failed', 'cancelled'));

select pg_notify('pgrst', 'reload schema');
