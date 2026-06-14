-- ============================================================
-- FYLYMPITCH — Migration 006: Projects showcase visibility
-- Run once in Supabase SQL Editor (after 005_master_data_seed.sql).
--
-- Powers the new /projects (showcase) and /projects/[id] pages: any
-- signed-in user (not just approved producer/investor/organization
-- accounts, and NOT anonymous/logged-out visitors) can read projects
-- marked is_public = true. Owners and admins keep full read access
-- as before. The previous is_approved_industry() carve-out is now
-- subsumed by "any authenticated user", which is strictly broader.
--
-- Note: this means a project's synopsis, director's statement and
-- producer info become readable by any registered member once its
-- owner marks it Public — a meaningful widening from "approved
-- industry only". This applies retroactively to existing is_public
-- projects.
-- ============================================================

drop policy if exists "owner full read" on public.projects;

create policy "owner full read" on public.projects for select
  using (owner_id = auth.uid() or public.is_admin() or (is_public and auth.uid() is not null));
