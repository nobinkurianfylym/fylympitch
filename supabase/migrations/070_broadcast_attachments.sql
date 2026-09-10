-- ============================================================================
-- FYLYMPITCH — Migration 070: broadcast-attachments bucket
-- Run once in the Supabase SQL Editor.
--
-- Admin announcements can carry files (a submission form, a deadline calendar,
-- a programme PDF). Those links go out inside an email, so they have to still
-- work when someone opens that email next month — which rules out signed URLs.
--
-- The bucket is therefore PUBLIC: anyone holding the link can open the file.
-- Paths carry a random uuid, so links are unguessable, but this is the wrong
-- place for anything confidential. Admin broadcasts are announcements; treat
-- attachments as material you would publish.
--
-- Only admins can upload or delete. Recipients only ever read.
-- ============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'broadcast-attachments',
  'broadcast-attachments',
  true,
  26214400,  -- 25 MB, matching the ceiling the composer enforces
  array[
    'application/pdf',
    'image/jpeg', 'image/png', 'image/webp', 'image/gif',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'text/plain', 'text/csv',
    'application/zip', 'application/x-zip-compressed'
  ]
)
on conflict (id) do update set
  public             = excluded.public,
  file_size_limit    = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Policies are re-runnable: drop before create.
drop policy if exists "admin uploads broadcast attachment"  on storage.objects;
drop policy if exists "admin deletes broadcast attachment"  on storage.objects;
drop policy if exists "public reads broadcast attachment"   on storage.objects;

create policy "admin uploads broadcast attachment"
  on storage.objects for insert
  with check (bucket_id = 'broadcast-attachments' and public.is_admin());

create policy "admin deletes broadcast attachment"
  on storage.objects for delete
  using (bucket_id = 'broadcast-attachments' and public.is_admin());

-- Reading is open, which is what makes the link in an email work months later.
create policy "public reads broadcast attachment"
  on storage.objects for select
  using (bucket_id = 'broadcast-attachments');

-- ── Check ──────────────────────────────────────────────────────────────────
select id, public, file_size_limit
from   storage.buckets
where  id = 'broadcast-attachments';
