-- ============================================================
-- FYLYMPITCH — Migration 100: Admin pitch order
-- Run in Supabase SQL Editor BEFORE deploying the code that
-- reads it (the code falls back to newest-first if it is
-- missing, but run this first). Safe to re-run: every
-- statement is idempotent.
--
-- 1. projects.admin_rank — admin-pinned position.
--    null  = not pinned
--    lower = higher up. The admin page writes 10, 20, 30…
--
-- 2. guard_project_admin_fields() — only an admin may set
--    admin_rank. The "owner update project" policy lets a
--    filmmaker update ANY column of their own project, so without
--    this a filmmaker could pin their own pitch to the top through
--    the public API. The same hole existed for admin_hidden (a
--    filmmaker could un-hide a project an admin had hidden); the
--    guard closes both.
--
--    Non-admin changes to these two columns are silently kept at
--    their previous values rather than rejected, so an ordinary
--    project edit — or the love_count trigger (022), which updates
--    projects as the person pressing Love — never fails.
--    Service-role calls and the SQL Editor (no signed-in user)
--    are not affected.
--
-- 3. pitch_order_config — what comes after the pinned pitches:
--    'newest' (default) or 'likes' (most-loved first, then newest).
--    One row, readable by everyone (listings read it), written by
--    admins only. Same shape as featured_config (097).
-- ============================================================

-- ---------- 1. Column ----------
alter table public.projects
  add column if not exists admin_rank integer;

create index if not exists idx_projects_admin_rank
  on public.projects (admin_rank)
  where admin_rank is not null;

-- ---------- 2. Guard ----------
create or replace function public.guard_project_admin_fields()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  -- No signed-in user: service role, Edge Functions, SQL Editor.
  if auth.uid() is null or public.is_admin() then
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.admin_rank   := null;
    new.admin_hidden := false;
    return new;
  end if;

  new.admin_rank   := old.admin_rank;
  new.admin_hidden := old.admin_hidden;
  return new;
end;
$$;

drop trigger if exists trg_guard_project_admin_fields on public.projects;
create trigger trg_guard_project_admin_fields
  before insert or update on public.projects
  for each row execute function public.guard_project_admin_fields();

-- ---------- 3. Order mode after the pinned pitches ----------
create table if not exists public.pitch_order_config (
  id          boolean primary key default true check (id),
  mode        text not null default 'newest' check (mode in ('newest', 'likes')),
  updated_at  timestamptz not null default now(),
  updated_by  uuid references public.profiles(id) on delete set null
);

insert into public.pitch_order_config (id) values (true)
on conflict (id) do nothing;

alter table public.pitch_order_config enable row level security;

revoke insert, update, delete on public.pitch_order_config from anon;
grant  select on public.pitch_order_config to anon, authenticated;

drop policy if exists "read pitch order config" on public.pitch_order_config;
create policy "read pitch order config"
  on public.pitch_order_config for select
  to anon, authenticated
  using (true);

drop policy if exists "admin writes pitch order config" on public.pitch_order_config;
create policy "admin writes pitch order config"
  on public.pitch_order_config for all
  using      (public.is_admin())
  with check (public.is_admin());

-- Most-loved ordering reads love_count (kept in sync by migration 022).
create index if not exists idx_projects_love_count
  on public.projects (love_count desc, created_at desc);

-- ---------- 4. Verify (optional) ----------
-- select column_name from information_schema.columns
--  where table_schema = 'public' and table_name = 'projects' and column_name = 'admin_rank';
-- select tgname from pg_trigger
--  where tgrelid = 'public.projects'::regclass and tgname = 'trg_guard_project_admin_fields';
-- select mode from public.pitch_order_config;   -- expect: newest
