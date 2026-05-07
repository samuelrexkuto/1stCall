create extension if not exists pgcrypto;

create table if not exists public.worker_documents (
  id uuid primary key default gen_random_uuid(),
  worker_id uuid not null references public.workers(id) on delete cascade,
  document_type text not null check (document_type in ('cscs_card', 'portfolio', 'certificate', 'sia_badge', 'enhanced_dbs', 'dbs')),
  file_name text not null,
  file_path text not null,
  file_url text,
  mime_type text,
  created_at timestamptz not null default now()
);

create index if not exists idx_worker_documents_worker_id
  on public.worker_documents(worker_id);

insert into storage.buckets (id, name, public)
values ('worker-documents', 'worker-documents', true)
on conflict (id) do nothing;
