alter table if exists public.workers
  add column if not exists worker_type text,
  add column if not exists contractor_type text,
  add column if not exists specialist_area text,
  add column if not exists skill_tags text[] not null default '{}',
  add column if not exists languages_spoken text[] not null default '{}',
  add column if not exists insurance_verified boolean not null default false,
  add column if not exists insurance_types text[] not null default '{}',
  add column if not exists enhanced_dbs boolean not null default false,
  add column if not exists first_aid_certified boolean not null default false,
  add column if not exists companies_house_verified boolean not null default false,
  add column if not exists companies_house_number text,
  add column if not exists constructionline_member boolean not null default false,
  add column if not exists qualification_label text,
  add column if not exists accreditations text[] not null default '{}';

notify pgrst, 'reload schema';
