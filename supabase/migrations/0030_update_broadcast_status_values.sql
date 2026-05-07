-- Update broadcast_status constraint to use new status values
-- This migration updates the jobs table broadcast_status check constraint
-- to support the new broadcast status flow: broadcast ready -> awaiting response -> completed

alter table if exists public.jobs
  drop constraint if exists jobs_broadcast_status_check;

alter table if exists public.jobs
  add constraint jobs_broadcast_status_check
  check (broadcast_status in ('broadcast ready', 'awaiting response', 'completed', 'failed', 'cancelled'));

-- Update any existing statuses to match the new values
update public.jobs
set broadcast_status = 'broadcast ready'
where broadcast_status in ('draft', 'queued');

update public.jobs
set broadcast_status = 'awaiting response'
where broadcast_status in ('broadcasting', 'sent');

-- Note: 'completed' status remains the same

-- Reload schema cache for PostgREST
select pg_notify('pgrst', 'reload schema');