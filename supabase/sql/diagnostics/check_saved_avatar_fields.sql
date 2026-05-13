-- Check whether avatar/profile image fields exist and contain values.

select
  table_schema,
  table_name,
  column_name,
  data_type
from information_schema.columns
where
  table_schema = 'public'
  and table_name in (
    'profiles',
    'project_management_accounts',
    'job_providers'
  )
  and column_name in (
    'avatar_url',
    'avatar_path',
    'profile_image_url',
    'profile_image_path'
  )
order by table_name, column_name;

-- Replace the email below with the account email you are testing.
select
  'project_management_accounts' as source_table,
  id::text as id,
  email,
  name,
  profile_image_url,
  profile_image_path
from public.project_management_accounts
where lower(email) = lower('pwconstruct@gmail.com');

select
  'job_providers' as source_table,
  id::text as id,
  email,
  name,
  profile_image_url,
  profile_image_path,
  avatar_url,
  avatar_path
from public.job_providers
where lower(email) = lower('pwconstruct@gmail.com');

select
  'profiles' as source_table,
  id::text as id,
  email,
  avatar_url,
  avatar_path
from public.profiles
where lower(email) = lower('pwconstruct@gmail.com');

notify pgrst, 'reload schema';
