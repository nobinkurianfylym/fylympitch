-- ============================================================
-- FYLYMPITCH — Migration 003: FYLYMPITCH ENGINE
-- Run once in Supabase SQL Editor (after schema.sql and 002).
--
-- Adds the data model needed by services/fylympitchEngine.ts:
--   - matches.tier                       (hybrid match tier, cached)
--   - projects.career_stage              (hybrid matching input)
--   - opportunities.career_stages/.match_weight (MASTER_DATA import columns)
--   - profiles industry-matching fields  (producer/investor/org matching)
--   - project_intelligence               (cached full engine output)
-- ============================================================

-- ---------- MATCHES: cache the hybrid tier alongside score ----------
alter table public.matches
  add column if not exists tier text not null default 'possible'
    check (tier in ('excellent','strong','possible','hidden'));

-- ---------- PROJECTS: optional career-stage for hybrid bonus ----------
alter table public.projects
  add column if not exists career_stage text;
-- e.g. 'First-time', 'Emerging', 'Established' — matches MASTER_DATA "CAREER STAGE"

-- ---------- OPPORTUNITIES: MASTER_DATA hybrid-matching extras ----------
alter table public.opportunities
  add column if not exists career_stages text[] not null default '{}',
  add column if not exists match_weight text
    check (match_weight is null or match_weight in ('high','medium','low'));

-- ---------- PROFILES: producer/investor/organization matching fields ----------
-- Only meaningful for role in ('producer','investor','organization'); left
-- empty/null for filmmakers. rankProducerMatches() in fylympitchEngine.ts
-- excludes any profile with no signal across these fields at all.
alter table public.profiles
  add column if not exists industry_genres text[] not null default '{}',
  add column if not exists industry_formats project_format[] not null default '{}',
  add column if not exists industry_countries text[] not null default '{}',
  add column if not exists min_budget_usd numeric,
  add column if not exists max_budget_usd numeric,
  add column if not exists available_funding_usd numeric,
  add column if not exists festival_track_record boolean not null default false;

-- ---------- PROJECT INTELLIGENCE (computed once at submission) ----------
-- One row per project, written by createProject() right after the hybrid
-- match cache. The project page reads from here — no recompute on load,
-- no "Sharpen with AI" button.
create table public.project_intelligence (
  project_id uuid primary key references public.projects(id) on delete cascade,
  funding_readiness jsonb not null default '{}',
  funding_discovery jsonb not null default '{}',
  obstacles jsonb not null default '[]',
  roadmap jsonb not null default '{}',
  producer_matches jsonb not null default '[]',
  executive_producer jsonb not null default '{}',
  dream_scenario jsonb not null default '{}',
  generated_by text not null default 'heuristic' check (generated_by in ('openai','heuristic')),
  generated_at timestamptz not null default now()
);

alter table public.project_intelligence enable row level security;

create policy "own project intelligence" on public.project_intelligence for select
  using (exists (select 1 from public.projects pr where pr.id = project_id and pr.owner_id = auth.uid()) or public.is_admin());
create policy "owner write project intelligence" on public.project_intelligence for insert
  with check (exists (select 1 from public.projects pr where pr.id = project_id and pr.owner_id = auth.uid()));
create policy "owner update project intelligence" on public.project_intelligence for update
  using (exists (select 1 from public.projects pr where pr.id = project_id and pr.owner_id = auth.uid()));
