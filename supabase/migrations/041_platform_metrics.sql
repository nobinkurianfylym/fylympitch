-- ============================================================
-- FYLYMPITCH — Migration 041: Platform Metrics
-- Run once in Supabase SQL Editor.
--
-- 1. platform_metrics table — daily snapshot of key counters
-- 2. refresh_platform_metrics() — computes live + inserts row
-- 3. RLS — public read, no direct write
-- 4. Initial seed — run once after migration
--
-- Called automatically by the funding-intelligence Edge Function
-- at the end of each nightly crawl (02:00 UTC).
-- ============================================================

-- ─── 1. TABLE ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.platform_metrics (
  id                      serial        PRIMARY KEY,
  computed_at             timestamptz   NOT NULL DEFAULT now(),
  active_opportunities    integer       NOT NULL DEFAULT 0,
  partner_organizations   integer       NOT NULL DEFAULT 0,
  festivals               integer       NOT NULL DEFAULT 0,
  markets                 integer       NOT NULL DEFAULT 0,
  funding_tracked_usd     bigint        NOT NULL DEFAULT 0,
  total_projects          integer       NOT NULL DEFAULT 0,
  total_verified_producers integer      NOT NULL DEFAULT 0
);

-- ─── 2. RLS ──────────────────────────────────────────────────
ALTER TABLE public.platform_metrics ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can read platform metrics" ON public.platform_metrics;
CREATE POLICY "Public can read platform metrics"
  ON public.platform_metrics FOR SELECT
  USING (true);

-- ─── 3. REFRESH FUNCTION ─────────────────────────────────────
CREATE OR REPLACE FUNCTION public.refresh_platform_metrics()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_active_opps      integer;
  v_partner_orgs     integer;
  v_festivals        integer;
  v_markets          integer;
  v_funding_usd      bigint;
  v_projects         integer;
  v_producers        integer;
BEGIN
  -- Active opportunities: all live entries
  SELECT COUNT(*)
    INTO v_active_opps
    FROM public.opportunities
   WHERE is_active = true;

  -- Partner organizations: distinct organisations tracked in funding_sources
  -- Falls back to distinct organization_name in opportunities if sources empty
  SELECT GREATEST(
    (SELECT COUNT(*) FROM public.funding_sources WHERE crawl_active = true),
    (SELECT COUNT(DISTINCT COALESCE(organization_name, ''))
       FROM public.opportunities
      WHERE is_active = true AND organization_name IS NOT NULL)
  )
    INTO v_partner_orgs;

  -- Festivals: festival-affiliated opportunities
  SELECT COUNT(*)
    INTO v_festivals
    FROM public.opportunities
   WHERE is_active = true
     AND festival_affiliated = true;

  -- Markets: co-production & pitch markets
  SELECT COUNT(*)
    INTO v_markets
    FROM public.opportunities
   WHERE is_active = true
     AND opp_type = 'market';

  -- Funding tracked: sum of max_award_usd across all active opportunities
  SELECT COALESCE(SUM(max_award_usd), 0)
    INTO v_funding_usd
    FROM public.opportunities
   WHERE is_active = true;

  -- Total public projects on the platform
  SELECT COUNT(*)
    INTO v_projects
    FROM public.projects
   WHERE is_public = true;

  -- Verified producers
  SELECT COUNT(*)
    INTO v_producers
    FROM public.profiles
   WHERE role = 'producer';

  -- Insert new snapshot (keep history; page reads latest row)
  INSERT INTO public.platform_metrics (
    computed_at,
    active_opportunities,
    partner_organizations,
    festivals,
    markets,
    funding_tracked_usd,
    total_projects,
    total_verified_producers
  ) VALUES (
    now(),
    v_active_opps,
    v_partner_orgs,
    v_festivals,
    v_markets,
    v_funding_usd,
    v_projects,
    v_producers
  );

  -- Prune old snapshots — keep last 90 days only
  DELETE FROM public.platform_metrics
   WHERE computed_at < now() - INTERVAL '90 days';
END;
$$;

-- ─── 4. SEED — compute first snapshot immediately ─────────────
SELECT public.refresh_platform_metrics();
