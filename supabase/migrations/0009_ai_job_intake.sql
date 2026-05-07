create extension if not exists pgcrypto;

create table if not exists public.job_intake_drafts (
  id uuid primary key default gen_random_uuid(),
  raw_text_input text,
  raw_audio_url text,
  transcript_text text,
  ai_structured_job_json jsonb,
  final_user_approved_job_json jsonb,
  created_at timestamptz not null default now()
);

insert into storage.buckets (id, name, public)
values ('job-intake-audio', 'job-intake-audio', true)
on conflict (id) do nothing;
