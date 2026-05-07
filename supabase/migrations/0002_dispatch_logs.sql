create table if not exists dispatch_logs (
  dispatch_log_id uuid primary key default gen_random_uuid(),
  dispatch_id uuid not null,
  job_id uuid not null references jobs(job_id) on delete cascade,
  worker_id uuid not null references staff_subs(worker_id) on delete cascade,
  channel text not null check (channel in ('whatsapp', 'sms', 'call')),
  phone text,
  provider text not null,
  status text not null check (status in ('pending', 'sent', 'failed')),
  error_message text,
  sent_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  unique (dispatch_id, worker_id, channel)
);

create index if not exists idx_dispatch_logs_dispatch_id on dispatch_logs(dispatch_id, channel);
create index if not exists idx_dispatch_logs_job_id on dispatch_logs(job_id, created_at desc);
