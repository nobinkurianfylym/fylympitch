-- ============================================================
-- FYLYMPITCH — Migration 100: Admin pitch order
-- Run once in Supabase SQL Editor, BEFORE deploying the code
-- that reads projects.admin_rank (the code falls back to
-- newest-first if the column is missing, but run this first).
--
-- 1. projects.admin_rank — admin-pinned position.
--    null  = not pinned (listed after pinned pitches, newest first)
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
--    project edit that happens to send them never fails.
--    Service-role calls and the SQL Editor (no signed-in user)
--    are not affected.
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

-- ---------- 3. Verify (optional) ----------
-- select column_name from information_schema.columns
--  where table_schema = 'public' and table_name = 'projects' and column_name = 'admin_rank';
-- select tgname from pg_trigger
--  where tgrelid = 'public.projects'::regclass and tgname = 'trg_guard_project_admin_fields';
