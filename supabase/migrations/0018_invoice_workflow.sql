alter table if exists public.job_providers
  add column if not exists email text;

alter table if exists public.jobs
  add column if not exists invoice_status text not null default 'not_ready',
  add column if not exists invoice_send_date date,
  add column if not exists invoice_due_date date,
  add column if not exists invoice_last_sent_at timestamptz,
  add column if not exists invoice_notes text;

notify pgrst, 'reload schema';
