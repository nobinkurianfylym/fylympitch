-- ============================================================
-- FYLYMPITCH — Migration 031: Producer network listing
-- Run once in Supabase SQL Editor.
--
-- Verified + public producers are auto-listed in opportunities
-- as opp_type='producer' entries, appearing on the /funds page
-- under Production > Producer.
--
-- 1. opportunities.producer_user_id  — FK to the producer
-- 2. Unique index (one opportunity row per producer)
-- ============================================================

-- ---------- 1. Foreign key column ----------
alter table public.opportunities
  add column if not exists producer_user_id uuid
  references public.profiles(id) on delete set null;

-- ---------- 2. One row per producer ----------
create unique index if not exists opp_producer_user_unique
  on public.opportunities (producer_user_id)
  where producer_user_id is not null;
