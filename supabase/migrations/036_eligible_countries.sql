-- ============================================================
-- FYLYMPITCH — Migration 036: eligible_countries
-- Adds eligible_countries text[] to opportunities table.
-- Run once in Supabase SQL Editor.
-- ============================================================

alter table public.opportunities
  add column if not exists eligible_countries text[] not null default '{}';

comment on column public.opportunities.eligible_countries is
  'Countries whose filmmakers/projects are eligible to apply. Empty array = worldwide / no restriction.';
