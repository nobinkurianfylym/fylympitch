-- ============================================================
-- FYLYMPITCH — Migration 041 FIX: Drop + recreate function
-- Run in Supabase SQL Editor to replace the broken version.
-- Change: removed invalid 'festival' enum value from query.
-- ============================================================

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
  SELECT COUNT(*)
    INTO v_active_opps
    FROM public.opportunities
   WHERE is_active = true;

  SELECT GREATEST(
    (SELECT COUNT(*) FROM public.funding_sources WHERE crawl_active = true),
    (SELECT COUNT(DISTINCT COALESCE(organization_name, ''))
       FROM public.opportunities
      WHERE is_active = true AND organization_name IS NOT NULL)
  )
    INTO v_partner_orgs;

  -- festival_affiliated = true only (no 'festival' opp_type enum value exists)
  SELECT COUNT(*)
    INTO v_festivals
    FROM public.opportunities
   WHERE is_active = true
     AND festival_affiliated = true;

  SELECT COUNT(*)
    INTO v_markets
    FROM public.opportunities
   WHERE is_active = true
     AND opp_type = 'market';

  SELECT COALESCE(SUM(max_award_usd), 0)
    INTO v_funding_usd
    FROM public.opportunities
   WHERE is_active = true;

  SELECT COUNT(*)
    INTO v_projects
    FROM public.projects
   WHERE is_public = true;

  SELECT COUNT(*)
    INTO v_producers
    FROM public.profiles
   WHERE role = 'producer';

  INSERT INTO public.platform_metrics (
    computed_at, active_opportunities, partner_organizations,
    festivals, markets, funding_tracked_usd,
    total_projects, total_verified_producers
  ) VALUES (
    now(), v_active_opps, v_partner_orgs,
    v_festivals, v_markets, v_funding_usd,
    v_projects, v_producers
  );

  DELETE FROM public.platform_metrics
   WHERE computed_at < now() - INTERVAL '90 days';
END;
$$;

-- Seed the first real snapshot
SELECT public.refresh_platform_metrics();
