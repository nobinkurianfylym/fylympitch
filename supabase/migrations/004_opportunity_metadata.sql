-- ============================================================
-- FYLYMPITCH — Migration 004: Opportunity metadata
-- Run once in Supabase SQL Editor (after 003_fylympitch_engine.sql).
--
-- Adds the remaining MASTER_DATA columns not covered by 003
-- (career_stages/match_weight), plus a unique constraint on
-- opportunities.title so 005_master_data_seed.sql can use
-- ON CONFLICT (title) DO NOTHING and be safely re-run.
-- ============================================================

alter table public.opportunities
  add column if not exists gender_focus text,
  add column if not exists copro_required boolean not null default false,
  add column if not exists festival_affiliated boolean not null default false,
  add column if not exists ott_affiliated boolean not null default false,
  add column if not exists contact_email text,
  add column if not exists contact_phone text,
  add column if not exists key_person text,
  add column if not exists app_link text,
  -- Free-text deadline cycle (e.g. "Annual — Jan/Feb. Check thewhickers.com").
  -- opportunities.deadline stays a real `date`/null for matching's
  -- deadline-awareness logic; this is supplementary display text.
  add column if not exists deadline_note text;

-- Required for ON CONFLICT (title) DO NOTHING in 005. If this fails,
-- find and resolve duplicate titles first:
--   select title, count(*) from public.opportunities group by title having count(*) > 1;
alter table public.opportunities
  add constraint opportunities_title_unique unique (title);
