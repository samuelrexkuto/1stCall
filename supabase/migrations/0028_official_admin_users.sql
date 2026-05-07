create table if not exists public.admin_users (
  id uuid default gen_random_uuid(),
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  role text not null default 'admin',
  is_active boolean not null default true,
  display_name text,
  notes text,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_by uuid,
  updated_at timestamptz not null default now(),
  revoked_at timestamptz,
  revoked_by uuid,
  last_login_at timestamptz,
  login_count integer not null default 0,
  constraint admin_users_role_check check (role in ('owner', 'admin', 'support'))
);

create table if not exists public.admin_action_events (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid,
  actor_email text,
  actor_role text,
  action_type text not null,
  target_table text,
  target_id text,
  target_email text,
  target_name text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_admin_action_events_actor
  on public.admin_action_events (actor_user_id, created_at desc);

create index if not exists idx_admin_action_events_target
  on public.admin_action_events (target_table, target_id, created_at desc);

insert into public.admin_users (user_id, email, role, is_active, display_name)
select id, email, 'owner', true, 'Dose Group Admin'
from auth.users
where lower(email) = 'hello@dosegroup.org'
on conflict (user_id) do update
set
  email = excluded.email,
  display_name = 'Dose Group Admin',
  role = 'owner',
  is_active = true,
  updated_at = now();

create or replace function public.is_admin_user(user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.admin_users au
    where au.user_id = is_admin_user.user_id
      and au.is_active = true
      and au.role in ('owner', 'admin', 'support')
  );
$$;

create or replace function public.current_user_is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_admin_user(auth.uid());
$$;

create or replace function public.current_admin_profile()
returns table (
  user_id uuid,
  email text,
  role text,
  is_active boolean,
  display_name text
)
language sql
stable
security definer
set search_path = public
as $$
  select au.user_id, au.email, au.role, au.is_active, au.display_name
  from public.admin_users au
  where au.user_id = auth.uid()
    and au.is_active = true
    and au.role in ('owner', 'admin', 'support')
  limit 1;
$$;
