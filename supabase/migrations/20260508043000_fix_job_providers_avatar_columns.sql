-- Fix job_providers avatar/profile image compatibility columns.
-- This resolves PostgREST/Supabase API errors such as:
-- "Could not find the 'avatar_path' column of 'job_providers' in the schema cache"

alter table if exists public.job_providers
  add column if not exists profile_image_url text,
  add column if not exists profile_image_path text,
  add column if not exists avatar_url text,
  add column if not exists avatar_path text;

comment on column public.job_providers.profile_image_url is
  'Public URL for the provider/account profile image. Preferred canonical display field.';

comment on column public.job_providers.profile_image_path is
  'Storage object path for the provider/account profile image. Preferred canonical storage path field.';

comment on column public.job_providers.avatar_url is
  'Backward-compatible alias for provider/account profile image URL.';

comment on column public.job_providers.avatar_path is
  'Backward-compatible alias for provider/account profile image storage path.';

-- Backfill both old and new fields so either code path can display the image.
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

-- Make sure PostgREST/Supabase API reloads the latest table shape.
notify pgrst, 'reload schema';

-- Helps confirm the notification queue is readable and wakes the PostgREST listener.
select pg_notification_queue_usage();
