begin;

alter table if exists public.job_providers
  add column if not exists profile_image_url text,
  add column if not exists profile_image_path text,
  add column if not exists avatar_url text,
  add column if not exists avatar_path text;

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

commit;

notify pgrst, 'reload schema';
