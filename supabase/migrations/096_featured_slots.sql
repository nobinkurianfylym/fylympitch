-- ============================================================
-- FYLYMPITCH — Migration 096: Featured slots
--
-- One card beside the hero, changing every 24 hours between a
-- fund, a producer, a project and anything the admin adds by
-- hand. The schedule is the date: nothing is stored about what
-- was shown yesterday, so the card cannot get stuck, cannot go
-- stale, and is identical on every render of a given day.
--
-- A row either points at something already on the platform
-- (ref_id) or carries its own content. Overrides win over the
-- referenced record in both cases, so an admin can correct a
-- title without editing the fund itself.
-- ============================================================

create table if not exists public.featured_slots (
  id          uuid primary key default gen_random_uuid(),
  kind        text not null check (kind in ('fund','producer','project','custom')),

  -- opportunity / profile / project. Null for 'custom'.
  ref_id      uuid,

  -- Overrides, and the whole content for 'custom'. Capped because
  -- this renders in a 316px column: an over-long title breaks the
  -- layout somewhere the admin never sees.
  title       text check (title is null or length(title) <= 60),
  subtitle    text check (subtitle is null or length(subtitle) <= 60),
  hook        text check (hook is null or length(hook) <= 120),
  image_url   text,
  link_url    text check (link_url is null or link_url ~* '^(https?://|/)'),
  cta_label   text check (cta_label is null or length(cta_label) <= 28),

  -- [{ "label": "Up to", "value": "$120,000", "gold": true }]
  rows        jsonb not null default '[]'::jsonb,

  sort_order  int not null default 0,
  is_active   boolean not null default true,
  created_by  uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  constraint featured_slots_custom_needs_title
    check (kind <> 'custom' or nullif(trim(title), '') is not null),
  constraint featured_slots_ref_required
    check (kind = 'custom' or ref_id is not null)
);

create index if not exists idx_featured_active
  on public.featured_slots (is_active, kind, sort_order, created_at);

alter table public.featured_slots enable row level security;

revoke insert, update, delete on public.featured_slots from anon;
grant  select on public.featured_slots to anon, authenticated;

-- The card is on the public homepage, so anonymous visitors must be
-- able to read it. Inactive rows are the queue and stay private.
drop policy if exists "read active featured slots" on public.featured_slots;
create policy "read active featured slots"
  on public.featured_slots for select
  to anon, authenticated
  using (is_active);

drop policy if exists "admin manages featured slots" on public.featured_slots;
create policy "admin manages featured slots"
  on public.featured_slots for all
  using      (public.is_admin())
  with check (public.is_admin());

create or replace function public.touch_featured_slots()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_touch_featured_slots on public.featured_slots;
create trigger trg_touch_featured_slots
  before update on public.featured_slots
  for each row execute function public.touch_featured_slots();

-- ---------- Storage: featured images ----------
-- Same shape as resource-images (084). Public bucket, admin write.
-- 4 MB rather than 2, because a poster is the point of this one.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('featured-images', 'featured-images', true, 4194304,
        array['image/jpeg','image/png','image/webp','image/gif'])
on conflict (id) do nothing;

drop policy if exists "featured images public read" on storage.objects;
create policy "featured images public read"
  on storage.objects for select
  using (bucket_id = 'featured-images');

drop policy if exists "admin uploads featured images" on storage.objects;
create policy "admin uploads featured images"
  on storage.objects for insert
  with check (bucket_id = 'featured-images' and public.is_admin());

drop policy if exists "admin updates featured images" on storage.objects;
create policy "admin updates featured images"
  on storage.objects for update
  using (bucket_id = 'featured-images' and public.is_admin());

drop policy if exists "admin deletes featured images" on storage.objects;
create policy "admin deletes featured images"
  on storage.objects for delete
  using (bucket_id = 'featured-images' and public.is_admin());

-- ---------- Check ----------
select 'table'    as item, count(*)::text as detail from public.featured_slots
union all
select 'bucket',  coalesce(string_agg(id, ', '), 'MISSING')
  from storage.buckets where id = 'featured-images'
union all
select 'policies', count(*)::text
  from pg_policies where tablename = 'featured_slots';
