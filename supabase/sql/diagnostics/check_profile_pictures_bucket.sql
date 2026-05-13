select
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
from storage.buckets
where id = 'profile-pictures';

select
  bucket_id,
  name,
  owner,
  created_at,
  updated_at,
  metadata
from storage.objects
where bucket_id = 'profile-pictures'
order by updated_at desc
limit 20;

notify pgrst, 'reload schema';
