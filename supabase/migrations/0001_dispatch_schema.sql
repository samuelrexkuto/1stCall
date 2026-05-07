-- Workforce dispatch baseline schema for Supabase/Postgres.
-- The table names use lower_snake_case for consistency with Postgres tooling.

create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create table if not exists public.job_providers (
  provider_id uuid primary key default gen_random_uuid(),
  company_name text not null,
  trading_name text,
  contact_name text not null,
  contact_role text,
  company_type text,
  industry text,
  phone text,
  whatsapp text,
  email text,
  office_address text,
  site_address text,
  preferred_contact_method text check (preferred_contact_method in ('phone', 'whatsapp', 'email', 'sms')),
  charge_rate_agreement numeric(10, 2),
  payment_terms text,
  deposit_required boolean not null default false,
  credit_limit numeric(12, 2) not null default 0,
  payment_tier text,
  risk_rating text,
  client_contract_signed boolean not null default false,
  contract_signed_date date,
  non_circumvention boolean not null default false,
  personal_guarantee boolean not null default false,
  escrow_required boolean not null default false,
  first_job_date date,
  last_job_date date,
  total_jobs integer not null default 0 check (total_jobs >= 0),
  total_revenue numeric(12, 2) not null default 0,
  reliability_score numeric(5, 2) not null default 0 check (reliability_score between 0 and 100),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.jobs (
  job_id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references public.job_providers(provider_id) on delete restrict,
  job_title text not null,
  job_category text,
  trade_type text,
  job_type text,
  site_name text,
  site_contact text,
  site_phone text,
  address text not null,
  postcode text not null,
  area text,
  travel_radius integer check (travel_radius >= 0),
  start_date date not null,
  end_date date,
  start_time time,
  end_time time,
  workers_required integer not null default 1 check (workers_required > 0),
  workers_confirmed integer not null default 0 check (workers_confirmed >= 0),
  skill_tags text[] not null default '{}',
  certificates_required text[] not null default '{}',
  dbs_required boolean not null default false,
  worker_type text,
  pay_rate numeric(10, 2) not null default 0,
  charge_rate numeric(10, 2) not null default 0,
  margin numeric(10, 2) generated always as (charge_rate - pay_rate) stored,
  broadcast_status text not null default 'draft' check (broadcast_status in ('draft', 'queued', 'broadcasting', 'completed', 'failed', 'cancelled')),
  broadcast_time timestamptz,
  deposit_received boolean not null default false,
  escrow_in_place boolean not null default false,
  invoice_sent boolean not null default false,
  payment_status text not null default 'pending' check (payment_status in ('pending', 'part_paid', 'paid', 'overdue', 'written_off')),
  job_status text not null default 'open' check (job_status in ('draft', 'open', 'broadcasting', 'partially_filled', 'filled', 'in_progress', 'completed', 'cancelled')),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint jobs_end_after_start check (end_date is null or end_date >= start_date),
  constraint jobs_time_window_valid check (
    end_date is distinct from start_date
    or end_time is null
    or start_time is null
    or end_time >= start_time
  )
);

create table if not exists public.staff_subs (
  worker_id uuid primary key default gen_random_uuid(),
  full_name text not null,
  mobile text not null,
  whatsapp text,
  email text,
  postcode text not null,
  town text,
  worker_type text,
  status text not null default 'active' check (status in ('active', 'inactive', 'suspended', 'archived')),
  available_today boolean not null default false,
  travel_radius integer not null default 0 check (travel_radius >= 0),
  primary_role text,
  skill_tags text[] not null default '{}',
  experience_years numeric(4, 1) not null default 0 check (experience_years >= 0),
  right_to_work boolean not null default false,
  dbs_status text,
  cscs_status text,
  contract_signed boolean not null default false,
  min_day_rate numeric(10, 2) not null default 0,
  expected_rate numeric(10, 2) not null default 0,
  reliability_score numeric(5, 2) not null default 0 check (reliability_score between 0 and 100),
  no_show_count integer not null default 0 check (no_show_count >= 0),
  cancellation_count integer not null default 0 check (cancellation_count >= 0),
  priority_tier text not null default 'standard' check (priority_tier in ('standard', 'preferred', 'vip', 'restricted')),
  whatsapp_opt_in boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.response_log (
  response_id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs(job_id) on delete cascade,
  worker_id uuid not null references public.staff_subs(worker_id) on delete cascade,
  sent_time timestamptz not null default timezone('utc', now()),
  channel text not null check (channel in ('whatsapp', 'sms', 'ivr', 'email', 'manual')),
  delivered boolean not null default false,
  read boolean not null default false,
  response_type text check (response_type in ('accepted', 'declined', 'callback', 'no_response', 'expired')),
  response_time timestamptz,
  response_rank integer,
  selected boolean not null default false,
  reserve boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  unique (job_id, worker_id)
);

create table if not exists public.bookings (
  booking_id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs(job_id) on delete cascade,
  worker_id uuid not null references public.staff_subs(worker_id) on delete restrict,
  booking_status text not null default 'pending' check (booking_status in ('pending', 'confirmed', 'reserve', 'checked_in', 'checked_out', 'completed', 'cancelled', 'no_show')),
  confirmed_time timestamptz,
  check_in timestamptz,
  check_out timestamptz,
  timesheet_received boolean not null default false,
  worker_paid boolean not null default false,
  client_paid boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  unique (job_id, worker_id)
);

create table if not exists public.compliance_legal (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid references public.job_providers(provider_id) on delete cascade,
  worker_id uuid references public.staff_subs(worker_id) on delete cascade,
  contract_signed boolean not null default false,
  non_circumvention boolean not null default false,
  right_to_work_file text,
  dbs_file text,
  insurance_file text,
  expiry_date date,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint compliance_single_owner check ((provider_id is not null) <> (worker_id is not null))
);

create index if not exists idx_jobs_provider_id on public.jobs(provider_id);
create index if not exists idx_jobs_status_dates on public.jobs(job_status, start_date, postcode);
create index if not exists idx_jobs_skill_tags on public.jobs using gin (skill_tags);
create index if not exists idx_staff_subs_status_availability on public.staff_subs(status, available_today, worker_type);
create index if not exists idx_staff_subs_skill_tags on public.staff_subs using gin (skill_tags);
create index if not exists idx_staff_subs_postcode on public.staff_subs(postcode);
create index if not exists idx_response_log_job_response_time on public.response_log(job_id, response_time);
create index if not exists idx_response_log_worker on public.response_log(worker_id);
create index if not exists idx_bookings_job_status on public.bookings(job_id, booking_status);
create index if not exists idx_compliance_provider on public.compliance_legal(provider_id);
create index if not exists idx_compliance_worker on public.compliance_legal(worker_id);

create or replace function public.recalculate_response_ranks(target_job_id uuid)
returns void
language sql
as $$
  with ranked as (
    select
      response_id,
      case
        when response_time is null then null
        else row_number() over (order by response_time asc, created_at asc)
      end as computed_rank
    from public.response_log
    where job_id = target_job_id
  )
  update public.response_log rl
  set response_rank = ranked.computed_rank
  from ranked
  where rl.response_id = ranked.response_id;
$$;

create or replace function public.handle_response_ranking()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'DELETE' then
    perform public.recalculate_response_ranks(old.job_id);
    return old;
  end if;

  if tg_op = 'UPDATE' and new.job_id is distinct from old.job_id then
    perform public.recalculate_response_ranks(old.job_id);
  end if;

  perform public.recalculate_response_ranks(new.job_id);
  return coalesce(new, old);
end;
$$;

create or replace function public.sync_workers_confirmed()
returns trigger
language plpgsql
as $$
declare
  target_job_id uuid;
begin
  if tg_op = 'DELETE' then
    target_job_id = old.job_id;
  else
    target_job_id = new.job_id;
  end if;

  update public.jobs j
  set workers_confirmed = (
    select count(*)
    from public.bookings b
    where b.job_id = target_job_id
      and b.booking_status in ('confirmed', 'checked_in', 'checked_out', 'completed')
  )
  where j.job_id = target_job_id;

  if tg_op = 'UPDATE' and new.job_id is distinct from old.job_id then
    update public.jobs j
    set workers_confirmed = (
      select count(*)
      from public.bookings b
      where b.job_id = old.job_id
        and b.booking_status in ('confirmed', 'checked_in', 'checked_out', 'completed')
    )
    where j.job_id = old.job_id;
  end if;

  return coalesce(new, old);
end;
$$;

create or replace function public.update_provider_metrics()
returns trigger
language plpgsql
as $$
declare
  target_provider_id uuid;
begin
  if tg_op = 'DELETE' then
    target_provider_id = old.provider_id;
  else
    target_provider_id = new.provider_id;
  end if;

  update public.job_providers p
  set
    total_jobs = (
      select count(*) from public.jobs j where j.provider_id = target_provider_id
    ),
    total_revenue = coalesce((
      select sum(coalesce(j.charge_rate, 0) * coalesce(j.workers_confirmed, 0))
      from public.jobs j
      where j.provider_id = target_provider_id
    ), 0),
    first_job_date = (
      select min(j.start_date) from public.jobs j where j.provider_id = target_provider_id
    ),
    last_job_date = (
      select max(j.start_date) from public.jobs j where j.provider_id = target_provider_id
    )
  where p.provider_id = target_provider_id;

  if tg_op = 'UPDATE' and new.provider_id is distinct from old.provider_id then
    update public.job_providers p
    set
      total_jobs = (
        select count(*) from public.jobs j where j.provider_id = old.provider_id
      ),
      total_revenue = coalesce((
        select sum(coalesce(j.charge_rate, 0) * coalesce(j.workers_confirmed, 0))
        from public.jobs j
        where j.provider_id = old.provider_id
      ), 0),
      first_job_date = (
        select min(j.start_date) from public.jobs j where j.provider_id = old.provider_id
      ),
      last_job_date = (
        select max(j.start_date) from public.jobs j where j.provider_id = old.provider_id
      )
    where p.provider_id = old.provider_id;
  end if;

  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_job_providers_set_updated_at on public.job_providers;
create trigger trg_job_providers_set_updated_at
before update on public.job_providers
for each row
execute function public.set_updated_at();

drop trigger if exists trg_jobs_set_updated_at on public.jobs;
create trigger trg_jobs_set_updated_at
before update on public.jobs
for each row
execute function public.set_updated_at();

drop trigger if exists trg_staff_subs_set_updated_at on public.staff_subs;
create trigger trg_staff_subs_set_updated_at
before update on public.staff_subs
for each row
execute function public.set_updated_at();

drop trigger if exists trg_compliance_legal_set_updated_at on public.compliance_legal;
create trigger trg_compliance_legal_set_updated_at
before update on public.compliance_legal
for each row
execute function public.set_updated_at();

drop trigger if exists trg_response_log_rank on public.response_log;
create trigger trg_response_log_rank
after insert or update of response_time or job_id or created_at or response_type or selected on public.response_log
for each row
execute function public.handle_response_ranking();

drop trigger if exists trg_response_log_rank_delete on public.response_log;
create trigger trg_response_log_rank_delete
after delete on public.response_log
for each row
execute function public.handle_response_ranking();

drop trigger if exists trg_bookings_sync_confirmed on public.bookings;
create trigger trg_bookings_sync_confirmed
after insert or update of booking_status or job_id or worker_id or confirmed_time or check_in or check_out or timesheet_received on public.bookings
for each row
execute function public.sync_workers_confirmed();

drop trigger if exists trg_bookings_sync_confirmed_delete on public.bookings;
create trigger trg_bookings_sync_confirmed_delete
after delete on public.bookings
for each row
execute function public.sync_workers_confirmed();

drop trigger if exists trg_jobs_update_provider_metrics on public.jobs;
create trigger trg_jobs_update_provider_metrics
after insert or update or delete on public.jobs
for each row
execute function public.update_provider_metrics();

-- Optional matching view for future automation workers.
create or replace view public.worker_match_candidates as
select
  j.job_id,
  s.worker_id,
  s.full_name,
  s.worker_type,
  s.available_today,
  s.postcode as worker_postcode,
  j.postcode as job_postcode,
  s.travel_radius,
  j.skill_tags as job_skill_tags,
  s.skill_tags as worker_skill_tags,
  s.right_to_work,
  s.contract_signed,
  (
    select count(*)
    from unnest(j.skill_tags) as required_skill
    where required_skill = any (s.skill_tags)
  ) as matched_skill_count
from public.jobs j
join public.staff_subs s on true
where s.status = 'active'
  and s.right_to_work = true
  and s.contract_signed = true;
