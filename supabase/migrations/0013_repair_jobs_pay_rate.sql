alter table if exists public.jobs
  add column if not exists alert_type text,
  add column if not exists core_role text,
  add column if not exists headcount_required integer,
  add column if not exists duration text,
  add column if not exists end_date timestamptz,
  add column if not exists pay_rate text,
  add column if not exists payment_type text,
  add column if not exists duties text,
  add column if not exists dbs_requirement text,
  add column if not exists ipaf_required boolean,
  add column if not exists own_tools_required boolean,
  add column if not exists ppe_required boolean,
  add column if not exists shift_pattern text,
  add column if not exists optional_supporting_notes text;

alter table if exists public.jobs
  add column if not exists skills_required jsonb not null default '[]'::jsonb,
  add column if not exists tickets_required jsonb not null default '[]'::jsonb;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'jobs'
      and column_name = 'pay_rate_display'
  ) and exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'jobs'
      and column_name = 'pay_rate'
  ) then
    execute '
      update public.jobs
      set pay_rate = coalesce(pay_rate, pay_rate_display)
      where pay_rate is null
        and pay_rate_display is not null
    ';
  end if;
end $$;

notify pgrst, 'reload schema';
