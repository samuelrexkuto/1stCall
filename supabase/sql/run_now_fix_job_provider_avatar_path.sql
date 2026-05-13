-- RUN THIS IN SUPABASE SQL EDITOR IF THE LIVE APP STILL SAYS:
-- "Could not find the 'avatar_path' column of 'job_providers' in the schema cache"

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

notify pgrst, 'reload schema';

select pg_notification_queue_usage();

select
  table_schema,
  table_name,
  column_name,
  data_type,
  is_nullable
from information_schema.columns
where
  table_schema = 'public'
  and table_name = 'job_providers'
  and column_name in (
    'profile_image_url',
    'profile_image_path',
    'avatar_url',
    'avatar_path'
  )
order by column_name;
