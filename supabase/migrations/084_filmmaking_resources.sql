-- ============================================================================
-- FYLYMPITCH - Migration 084: Filmmaking Resources
--
-- Admin-curated links to services filmmakers use: software, labs, rental
-- houses, insurers, festivals-adjacent tools. Admin creates them; published
-- ones appear in the filmmaker dashboard sidebar and on /dashboard/resources.
-- ============================================================================

create table if not exists public.filmmaking_resources (
  id           uuid        primary key default gen_random_uuid(),
  title        text        not null check (trim(title) <> ''),
  -- Deliberately capped. This renders in a 190px sidebar and in a card; a
  -- 400-word blurb would break both layouts rather than being truncated
  -- somewhere the admin cannot see.
  description  text        not null check (trim(description) <> '' and length(description) <= 280),
  url          text        not null check (url ~* '^https?://'),
  image_url    text,
  category     text,
  sort_order   int         not null default 0,
  is_published boolean     not null default false,
  created_by   uuid        references public.profiles(id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- Ordering key for both surfaces: manual sort first, then newest.
create index if not exists idx_resources_published
  on public.filmmaking_resources (is_published, sort_order, created_at desc);

alter table public.filmmaking_resources enable row level security;

-- 083 revoked anon writes by default privilege, so a new table no longer
-- inherits them. SELECT is still granted by default; state both explicitly
-- rather than depending on what the default happens to be.
revoke insert, update, delete on public.filmmaking_resources from anon;
grant  select on public.filmmaking_resources to anon, authenticated;

-- Signed-in users see published resources only. Unpublished rows are drafts
-- and must not leak: the anon key is public, so "we just don't query them"
-- is not a control.
drop policy if exists "read published resources" on public.filmmaking_resources;
create policy "read published resources"
  on public.filmmaking_resources for select
  to authenticated
  using (is_published);

-- Admins do everything, through the ordinary server client (same as the rest
-- of the admin UI -- no service_role on this path).
drop policy if exists "admin manages resources" on public.filmmaking_resources;
create policy "admin manages resources"
  on public.filmmaking_resources for all
  using      (public.is_admin())
  with check (public.is_admin());

-- updated_at maintenance
create or replace function public.touch_filmmaking_resources()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists trg_touch_filmmaking_resources on public.filmmaking_resources;
create trigger trg_touch_filmmaking_resources
  before update on public.filmmaking_resources
  for each row execute function public.touch_filmmaking_resources();


-- ---------- Storage: resource images ----------
-- Public bucket, 2 MB, images only. Same shape as 'avatars' (021).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('resource-images', 'resource-images', true, 2097152,
        array['image/jpeg','image/png','image/webp','image/svg+xml','image/gif'])
on conflict (id) do nothing;

drop policy if exists "resource images public read" on storage.objects;
create policy "resource images public read"
  on storage.objects for select
  using (bucket_id = 'resource-images');

-- Only admins write here. Unlike avatars, there is no per-user folder to key
-- on: every object in this bucket is site content.
drop policy if exists "admin uploads resource images" on storage.objects;
create policy "admin uploads resource images"
  on storage.objects for insert
  with check (bucket_id = 'resource-images' and public.is_admin());

drop policy if exists "admin updates resource images" on storage.objects;
create policy "admin updates resource images"
  on storage.objects for update
  using (bucket_id = 'resource-images' and public.is_admin());

drop policy if exists "admin deletes resource images" on storage.objects;
create policy "admin deletes resource images"
  on storage.objects for delete
  using (bucket_id = 'resource-images' and public.is_admin());


-- ---------- Check ----------
select 'table'  as check, count(*)::text as detail from public.filmmaking_resources
union all
select 'bucket', coalesce(string_agg(id, ', '), 'MISSING')
  from storage.buckets where id = 'resource-images'
union all
select 'policies', count(*)::text
  from pg_policies where tablename = 'filmmaking_resources';
-- Expected: table 0, bucket resource-images, policies 2.
