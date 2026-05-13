alter table if exists public.project_management_accounts
  add column if not exists profile_image_url text,
  add column if not exists profile_image_path text;

alter table if exists public.job_providers
  add column if not exists profile_image_url text,
  add column if not exists profile_image_path text,
  add column if not exists avatar_url text,
  add column if not exists avatar_path text;

alter table if exists public.profiles
  add column if not exists avatar_url text,
  add column if not exists avatar_path text;

-- Backfill job_providers compatibility fields.
update public.job_providers
set
  profile_image_url = coalesce(profile_image_url, avatar_url),
  profile_image_path = coalesce(profile_image_path, avatar_path),
  avatar_url = coalesce(avatar_url, profile_image_url),
  avatar_path = coalesce(avatar_path, profile_image_path)
where
  profile_image_url is null
  or profile_image_path is null
  or avatar_url is null
  or avatar_path is null;

-- Backfill profiles from job_providers where possible.
update public.profiles p
set
  avatar_url = coalesce(p.avatar_url, jp.profile_image_url, jp.avatar_url),
  avatar_path = coalesce(p.avatar_path, jp.profile_image_path, jp.avatar_path)
from public.job_providers jp
where
  p.email is not null
  and jp.email is not null
  and lower(p.email) = lower(jp.email)
  and (
    p.avatar_url is null
    or p.avatar_path is null
  );

-- Backfill project_management_accounts from job_providers where possible.
update public.project_management_accounts pma
set
  profile_image_url = coalesce(pma.profile_image_url, jp.profile_image_url, jp.avatar_url),
  profile_image_path = coalesce(pma.profile_image_path, jp.profile_image_path, jp.avatar_path)
from public.job_providers jp
where
  pma.email is not null
  and jp.email is not null
  and lower(pma.email) = lower(jp.email)
  and (
    pma.profile_image_url is null
    or pma.profile_image_path is null
  );

notify pgrst, 'reload schema';
