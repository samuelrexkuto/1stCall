alter table if exists public.jobs
  add column if not exists selected_role text,
  add column if not exists trade text,
  add column if not exists location_label text,
  add column if not exists start_time text,
  add column if not exists end_time text,
  add column if not exists time_window text,
  add column if not exists pay_rate_amount numeric,
  add column if not exists pay_rate_unit text,
  add column if not exists requirements jsonb not null default '[]'::jsonb,
  add column if not exists cscs_required boolean not null default false,
  add column if not exists ppe_detail text,
  add column if not exists enhanced_dbs_required boolean not null default false,
  add column if not exists certificates_required text,
  add column if not exists tools_required text,
  add column if not exists selected_keywords jsonb not null default '[]'::jsonb,
  add column if not exists location_confirmed boolean not null default false,
  add column if not exists project_management_account_id uuid references public.project_management_accounts(id) on delete set null;

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
  updated_at timestamptz not null default now(),
  constraint job_worker_assignments_unique_job_worker unique (job_id, worker_id),
  constraint job_worker_assignments_payment_cycle_check check (payment_cycle in ('weekly', 'fortnightly')),
  constraint job_worker_assignments_payment_status_check check (
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
  constraint job_worker_assignments_assignment_status_check check (
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
  )
);

create index if not exists idx_job_worker_assignments_job_id
  on public.job_worker_assignments(job_id);

create index if not exists idx_job_worker_assignments_worker_id
  on public.job_worker_assignments(worker_id);

create index if not exists idx_job_worker_assignments_payment_status
  on public.job_worker_assignments(payment_status);

create index if not exists idx_job_worker_assignments_next_payment_due_date
  on public.job_worker_assignments(next_payment_due_date);

create index if not exists idx_job_worker_assignments_requested_by_client
  on public.job_worker_assignments(requested_by_client);
