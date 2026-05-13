begin;

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'profile-pictures',
  'profile-pictures',
  true,
  5242880,
  array[
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif'
  ]::text[]
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

alter table if exists public.project_management_accounts
  add column if not exists profile_image_url text,
  add column if not exists profile_image_path text;

alter table if exists public.job_providers
  add column if not exists profile_image_url text,
  add column if not exists profile_image_path text;

alter table if exists public.profiles
  add column if not exists avatar_url text,
  add column if not exists avatar_path text;

drop policy if exists "profile pictures are publicly readable"
on storage.objects;

create policy "profile pictures are publicly readable"
on storage.objects
for select
to public
using (
  bucket_id = 'profile-pictures'
);

drop policy if exists "users can upload own profile pictures"
on storage.objects;

create policy "users can upload own profile pictures"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'profile-pictures'
  and (storage.foldername(name))[1] = auth.uid()::text
  and lower(storage.extension(name)) in ('jpg', 'jpeg', 'png', 'webp', 'gif')
);

drop policy if exists "users can update own profile pictures"
on storage.objects;

create policy "users can update own profile pictures"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'profile-pictures'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'profile-pictures'
  and (storage.foldername(name))[1] = auth.uid()::text
  and lower(storage.extension(name)) in ('jpg', 'jpeg', 'png', 'webp', 'gif')
);

drop policy if exists "users can delete own profile pictures"
on storage.objects;

create policy "users can delete own profile pictures"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'profile-pictures'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create or replace function public.sync_project_account_profile_image_to_job_provider()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.job_providers jp
  set
    profile_image_url = new.profile_image_url,
    profile_image_path = new.profile_image_path
  where
    new.email is not null
    and jp.email is not null
    and lower(jp.email) = lower(new.email);

  return new;
end;
$$;

drop trigger if exists trg_sync_project_account_profile_image_to_job_provider
on public.project_management_accounts;

create trigger trg_sync_project_account_profile_image_to_job_provider
after insert or update of profile_image_url, profile_image_path, email
on public.project_management_accounts
for each row
execute function public.sync_project_account_profile_image_to_job_provider();

commit;
