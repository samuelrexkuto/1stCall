-- Diagnostic: confirm profile/avatar columns on public.job_providers

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

-- Also confirm the table exists in public schema.
select
  table_schema,
  table_name
from information_schema.tables
where
  table_schema = 'public'
  and table_name = 'job_providers';

-- Refresh PostgREST schema cache.
notify pgrst, 'reload schema';

-- Optional queue check.
select pg_notification_queue_usage();
