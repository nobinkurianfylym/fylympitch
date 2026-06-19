-- ============================================================
-- FYLYMPITCH — Migration 027: Verified producers + admin_hidden
-- Run once in Supabase SQL Editor.
--
-- 1. profiles.is_producer_verified  — admin blue-tick flag
-- 2. projects.admin_hidden          — admin override, filmmaker cannot undo
-- 3. is_verified_producer()         — DB helper for RLS
-- 4. Updated project SELECT policies
-- ============================================================

-- ---------- 1. Profiles: producer verified flag ----------
alter table public.profiles
  add column if not exists is_producer_verified boolean not null default false;

-- ---------- 2. Projects: admin hide override ----------
alter table public.projects
  add column if not exists admin_hidden boolean not null default false;

-- ---------- 3. Helper: is_verified_producer() ----------
create or replace function public.is_verified_producer()
  returns boolean
  language sql stable security definer set search_path = public
as $$
  select exists(
    select 1 from public.profiles
    where id = auth.uid()
      and is_producer_verified = true
      and approval_status = 'approved'
  )
$$;

-- ---------- 4. Update project SELECT policies ----------
-- Drop all existing SELECT policies on projects (from migrations 009 and 014)
drop policy if exists "owner full read"           on public.projects;
drop policy if exists "public projects readable"  on public.projects;
drop policy if exists "owner reads own projects"  on public.projects;
drop policy if exists "admin reads all projects"  on public.projects;

-- Owner always sees their own (even if admin_hidden — so they can see the notice)
create policy "owner reads own projects" on public.projects
  for select using (owner_id = auth.uid());

-- Admin sees everything
create policy "admin reads all projects" on public.projects
  for select using (public.is_admin());

-- Public: must be public AND not admin-hidden
create policy "public readable non-hidden" on public.projects
  for select using (is_public = true and admin_hidden = false);

-- Verified producers: see all non-admin-hidden projects (public or private)
create policy "verified producer reads non-hidden" on public.projects
  for select using (public.is_verified_producer() and admin_hidden = false);
