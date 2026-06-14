-- ============================================================
-- FYLYMPITCH — Migration 006: Projects showcase visibility
-- Run once in Supabase SQL Editor (after 005_master_data_seed.sql).
--
-- Makes is_public=true projects readable by anyone — including
-- anonymous/logged-out visitors and search engines. Owners and
-- admins retain full read access as before.
-- ============================================================

drop policy if exists "owner full read" on public.projects;

create policy "owner full read" on public.projects for select
  using (owner_id = auth.uid() or public.is_admin() or is_public);
