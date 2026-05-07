create extension if not exists pgcrypto;

create table if not exists public.provider_audit_events (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null,
  actor_user_id uuid,
  event_type text not null,
  entity_type text,
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.provider_audit_events
  add column if not exists provider_id uuid,
  add column if not exists actor_user_id uuid,
  add column if not exists event_type text,
  add column if not exists entity_type text,
  add column if not exists entity_id uuid,
  add column if not exists metadata jsonb not null default '{}'::jsonb,
  add column if not exists created_at timestamptz not null default now();

alter table public.provider_audit_events
  alter column metadata set default '{}'::jsonb,
  alter column created_at set default now(),
  alter column created_at set not null;

do $$
begin
  if not exists (select 1 from public.provider_audit_events where provider_id is null) then
    alter table public.provider_audit_events alter column provider_id set not null;
  end if;

  if not exists (select 1 from public.provider_audit_events where event_type is null) then
    alter table public.provider_audit_events alter column event_type set not null;
  end if;

  update public.provider_audit_events
  set metadata = '{}'::jsonb
  where metadata is null;

  if not exists (select 1 from public.provider_audit_events where metadata is null) then
    alter table public.provider_audit_events alter column metadata set not null;
  end if;
end $$;

create index if not exists provider_audit_events_provider_created_idx
  on public.provider_audit_events (provider_id, created_at desc);

create index if not exists provider_audit_events_event_type_idx
  on public.provider_audit_events (event_type);

create index if not exists provider_audit_events_entity_idx
  on public.provider_audit_events (entity_type, entity_id);

alter table public.provider_audit_events enable row level security;

drop policy if exists provider_audit_events_admin_all on public.provider_audit_events;
create policy provider_audit_events_admin_all
  on public.provider_audit_events
  for all
  to authenticated
  using (public.current_user_is_admin())
  with check (public.current_user_is_admin());

drop policy if exists provider_audit_events_provider_select on public.provider_audit_events;
create policy provider_audit_events_provider_select
  on public.provider_audit_events
  for select
  to authenticated
  using (
    provider_id::text = coalesce(
      auth.jwt() ->> 'provider_id',
      auth.jwt() -> 'app_metadata' ->> 'provider_id',
      auth.jwt() -> 'user_metadata' ->> 'provider_id'
    )
  );

drop policy if exists provider_audit_events_provider_insert on public.provider_audit_events;
create policy provider_audit_events_provider_insert
  on public.provider_audit_events
  for insert
  to authenticated
  with check (
    provider_id::text = coalesce(
      auth.jwt() ->> 'provider_id',
      auth.jwt() -> 'app_metadata' ->> 'provider_id',
      auth.jwt() -> 'user_metadata' ->> 'provider_id'
    )
  );

select pg_notify('pgrst', 'reload schema');
