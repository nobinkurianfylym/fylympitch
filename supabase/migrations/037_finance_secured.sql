-- ============================================================
-- FYLYMPITCH — Migration 037: finance_secured_usd
-- Adds finance_secured_usd to projects table.
-- Run once in Supabase SQL Editor.
-- ============================================================

alter table public.projects
  add column if not exists finance_secured_usd numeric(14,2)
    check (finance_secured_usd is null or finance_secured_usd >= 0);

comment on column public.projects.finance_secured_usd is
  'Amount of financing already secured/raised by the filmmaker (USD). Optional.';
