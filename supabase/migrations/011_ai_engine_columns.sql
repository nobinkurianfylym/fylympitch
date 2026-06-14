-- ============================================================
-- FYLYMPITCH — Migration 011: AI Engine enhanced columns
-- Run once in Supabase SQL Editor (after 010).
--
-- Adds columns to store the AI layer's output on top of the
-- existing rule-based engine results. All new columns are
-- nullable/defaulted so existing project_intelligence rows
-- remain valid — they'll just show empty AI sections until
-- the engine is re-run for those projects.
-- ============================================================

-- ── project_intelligence: AI enhancement fields ────────────────
alter table public.project_intelligence
  -- Semantic profile extracted from logline + synopsis + director's statement
  add column if not exists project_profile     jsonb not null default '{}',
  -- Semantic alignment scores per opportunity (AI layer)
  add column if not exists semantic_matches    jsonb not null default '[]',
  -- AI-detected obstacles (narrative-aware, beyond rule-based checks)
  add column if not exists ai_obstacles        jsonb not null default '[]',
  -- Market intelligence: positioning, timing, comparable films
  add column if not exists market_intelligence jsonb not null default '{}',
  -- Enhanced EP brief: strategic summary + immediate actions + 6-month roadmap
  add column if not exists enhanced_ep_brief   jsonb not null default '{}',
  -- Which engine version produced this row
  add column if not exists engine_version      text not null default 'v1_hybrid';

-- ── matches: semantic layer scores ────────────────────────────
alter table public.matches
  add column if not exists semantic_score   int,
  add column if not exists semantic_insight text,
  add column if not exists hybrid_score     int;

comment on column public.matches.semantic_score   is 'AI semantic alignment score 0-100';
comment on column public.matches.semantic_insight is 'One-sentence AI strategic insight for this match';
comment on column public.matches.hybrid_score     is 'Weighted blend: rule_score*0.6 + semantic_score*0.4';
