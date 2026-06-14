-- ============================================================
-- Migration 014: Fix project RLS so public projects are truly
-- public (readable by unauthenticated users in the showcase),
-- and wrap private projects for owner/admin only.
-- ============================================================

-- Drop the single combined policy that blocked anon reads
drop policy if exists "owner full read" on public.projects;

-- Anyone (including unauthenticated) can read public projects.
-- This powers the /projects showcase page.
create policy "public projects readable" on public.projects
  for select using (is_public = true);

-- Owners can always read their own projects (public or private).
create policy "owner reads own projects" on public.projects
  for select using (owner_id = auth.uid());

-- Admins can read everything.
create policy "admin reads all projects" on public.projects
  for select using (public.is_admin());
