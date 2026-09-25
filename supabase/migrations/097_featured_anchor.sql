-- ============================================================
-- FYLYMPITCH — Migration 097: Featured queue anchor
--
-- The queue plays one card a day, but which day counted as
-- position one came from the absolute date, so a card an admin
-- dragged to the top might not appear for another two days. The
-- list they arranged was not the list they got.
--
-- An anchor fixes that: position one is the day the queue was
-- last arranged. Row one in the admin list is today, row two is
-- tomorrow, and the cycle repeats from there.
--
-- Reset whenever the queue's shape changes — a card added,
-- removed or reordered. NOT when a card's own content is edited:
-- fixing a typo should not move everything.
-- ============================================================

create table if not exists public.featured_config (
  id          boolean primary key default true check (id),
  anchor_date date not null default current_date,
  updated_at  timestamptz not null default now()
);

insert into public.featured_config (id) values (true)
on conflict (id) do nothing;

alter table public.featured_config enable row level security;

revoke insert, update, delete on public.featured_config from anon;
grant  select on public.featured_config to anon, authenticated;

-- The homepage reads this for every logged-out visitor.
drop policy if exists "read featured config" on public.featured_config;
create policy "read featured config"
  on public.featured_config for select
  to anon, authenticated
  using (true);

drop policy if exists "admin writes featured config" on public.featured_config;
create policy "admin writes featured config"
  on public.featured_config for all
  using      (public.is_admin())
  with check (public.is_admin());

-- ---------- Check ----------
select 'anchor' as item, anchor_date::text as detail from public.featured_config
union all
select 'policies', count(*)::text from pg_policies where tablename = 'featured_config';
