create extension if not exists pgcrypto;

create table if not exists public.job_worker_assignments (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs(id) on delete cascade,
  worker_id uuid not null references public.workers(id) on delete cascade,
  assignment_status text not null default 'requested',
  requested_by_client boolean not null default false,
  requested_by_client_at timestamptz,
  requested_rank integer,
  confirmed_at timestamptz,
  confirmed_start_date date,
  confirmed_end_date date,
  payment_cycle text not null default 'weekly',
  payment_cycle_anchor_date date,
  day_rate numeric,
  worked_days_current_cycle numeric not null default 0,
  estimated_amount_due numeric not null default 0,
  payment_status text not null default 'not_ready',
  last_payment_date date,
  next_payment_due_date date,
  preliminary_notice_sent_at timestamptz,
  payment_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.job_worker_assignments
  add column if not exists job_id uuid references public.jobs(id) on delete cascade,
  add column if not exists worker_id uuid references public.workers(id) on delete cascade,
  add column if not exists provider_id uuid,
  add column if not exists assignment_status text default 'requested',
  add column if not exists requested_by_client boolean default false,
  add column if not exists requested_by_client_at timestamptz,
  add column if not exists requested_rank integer,
  add column if not exists confirmed_at timestamptz,
  add column if not exists confirmed_start_date date,
  add column if not exists confirmed_end_date date,
  add column if not exists payment_cycle text default 'weekly',
  add column if not exists payment_cycle_anchor_date date,
  add column if not exists day_rate numeric,
  add column if not exists worked_days_current_cycle numeric default 0,
  add column if not exists estimated_amount_due numeric default 0,
  add column if not exists payment_status text default 'not_ready',
  add column if not exists last_payment_date date,
  add column if not exists next_payment_due_date date,
  add column if not exists preliminary_notice_sent_at timestamptz,
  add column if not exists payment_notes text,
  add column if not exists created_at timestamptz default now(),
  add column if not exists updated_at timestamptz default now();

update public.job_worker_assignments
set
  assignment_status = coalesce(assignment_status, 'requested'),
  requested_by_client = coalesce(requested_by_client, false),
  payment_cycle = coalesce(payment_cycle, 'weekly'),
  worked_days_current_cycle = coalesce(worked_days_current_cycle, 0),
  estimated_amount_due = coalesce(estimated_amount_due, 0),
  payment_status = coalesce(payment_status, 'not_ready'),
  created_at = coalesce(created_at, now()),
  updated_at = coalesce(updated_at, now());

do $$
begin
  if not exists (select 1 from public.job_worker_assignments where job_id is null) then
    alter table public.job_worker_assignments alter column job_id set not null;
  end if;

  if not exists (select 1 from public.job_worker_assignments where worker_id is null) then
    alter table public.job_worker_assignments alter column worker_id set not null;
  end if;

  if not exists (select 1 from public.job_worker_assignments where assignment_status is null) then
    alter table public.job_worker_assignments alter column assignment_status set not null;
  end if;

  if not exists (select 1 from public.job_worker_assignments where requested_by_client is null) then
    alter table public.job_worker_assignments alter column requested_by_client set not null;
  end if;

  if not exists (select 1 from public.job_worker_assignments where payment_cycle is null) then
    alter table public.job_worker_assignments alter column payment_cycle set not null;
  end if;

  if not exists (select 1 from public.job_worker_assignments where worked_days_current_cycle is null) then
    alter table public.job_worker_assignments alter column worked_days_current_cycle set not null;
  end if;

  if not exists (select 1 from public.job_worker_assignments where estimated_amount_due is null) then
    alter table public.job_worker_assignments alter column estimated_amount_due set not null;
  end if;

  if not exists (select 1 from public.job_worker_assignments where payment_status is null) then
    alter table public.job_worker_assignments alter column payment_status set not null;
  end if;

  if not exists (select 1 from public.job_worker_assignments where created_at is null) then
    alter table public.job_worker_assignments alter column created_at set not null;
  end if;

  if not exists (select 1 from public.job_worker_assignments where updated_at is null) then
    alter table public.job_worker_assignments alter column updated_at set not null;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'job_worker_assignments_unique_job_worker'
  ) then
    alter table public.job_worker_assignments
      add constraint job_worker_assignments_unique_job_worker unique (job_id, worker_id);
  end if;
end $$;

alter table public.job_worker_assignments
  drop constraint if exists job_worker_assignments_payment_cycle_check,
  drop constraint if exists job_worker_assignments_payment_status_check,
  drop constraint if exists job_worker_assignments_assignment_status_check;

alter table public.job_worker_assignments
  add constraint job_worker_assignments_payment_cycle_check
  check (payment_cycle in ('weekly', 'fortnightly')),
  add constraint job_worker_assignments_payment_status_check
  check (
    payment_status in (
      'not_ready',
      'preliminary_notice_sent',
      'approved_for_payment',
      'scheduled',
      'paid',
      'overdue',
      'held',
      'disputed',
      'cancelled'
    )
  ),
  add constraint job_worker_assignments_assignment_status_check
  check (
    assignment_status in (
      'requested',
      'admin_reviewing',
      'sent_to_worker',
      'worker_accepted',
      'worker_declined',
      'filled',
      'completed',
      'cancelled'
    )
  );

create index if not exists idx_job_worker_assignments_job_id
  on public.job_worker_assignments(job_id);

create index if not exists idx_job_worker_assignments_worker_id
  on public.job_worker_assignments(worker_id);

create index if not exists idx_job_worker_assignments_provider_id
  on public.job_worker_assignments(provider_id);

create index if not exists idx_job_worker_assignments_requested_by_client
  on public.job_worker_assignments(requested_by_client);

create index if not exists idx_job_worker_assignments_payment_status
  on public.job_worker_assignments(payment_status);

create index if not exists idx_job_worker_assignments_next_payment_due_date
  on public.job_worker_assignments(next_payment_due_date);

select pg_notify('pgrst', 'reload schema');
