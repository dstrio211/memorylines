-- Memory Gallery — Supabase setup
-- Run this in Supabase SQL Editor after creating the project.
-- The Storage bucket itself is created in the Dashboard as a PUBLIC bucket
-- named: memories

create table if not exists public.memories (
  id uuid primary key default gen_random_uuid(),
  title text,
  storage_path text not null,
  created_at timestamptz not null default now()
);

alter table public.memories enable row level security;

-- Public gallery: anyone can read memory metadata.
drop policy if exists "Anyone can view memories" on public.memories;
create policy "Anyone can view memories"
on public.memories
for select
to anon
using (true);

-- Public gallery: anyone can create a memory record.
drop policy if exists "Anyone can upload memories" on public.memories;
create policy "Anyone can upload memories"
on public.memories
for insert
to anon
with check (true);

-- Least-privilege Data API grants for the anonymous browser client.
grant select, insert on public.memories to anon;

-- Storage: allow anonymous users to upload files only into the memories bucket.
drop policy if exists "Anyone can upload memory files" on storage.objects;
create policy "Anyone can upload memory files"
on storage.objects
for insert
to anon
with check (
  bucket_id = 'memories'
);

-- Intentionally NO UPDATE or DELETE policies for anon.
-- The memories bucket is public, so image retrieval does not need a SELECT
-- policy on storage.objects.
