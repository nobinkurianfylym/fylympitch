-- ============================================================
-- FYLYMPITCH — Migration 007: Project thumbnails
-- Run once in Supabase SQL Editor (after 006).
--
-- Adds poster_path to projects and creates a public-read
-- `thumbnails` storage bucket so tile images are accessible
-- without a signed URL on the public /projects gallery.
-- ============================================================

alter table public.projects
  add column if not exists poster_path text;

-- Public thumbnails bucket (images are intended to be seen by everyone)
insert into storage.buckets (id, name, public)
  values ('thumbnails', 'thumbnails', true)
  on conflict (id) do nothing;

-- Owners can upload/delete their own thumbnails
create policy "owner uploads thumbnails"
  on storage.objects for insert
  with check (bucket_id = 'thumbnails' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "owner deletes thumbnails"
  on storage.objects for delete
  using (bucket_id = 'thumbnails' and (storage.foldername(name))[1] = auth.uid()::text);

-- Anyone can read (bucket is public, but belt-and-suspenders RLS)
create policy "public thumbnail read"
  on storage.objects for select
  using (bucket_id = 'thumbnails');
