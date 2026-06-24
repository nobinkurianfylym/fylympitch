-- 047_producer_intelligence_rls.sql
-- Allow verified producers to read project_intelligence for FRS display
-- on Discover, All Projects, and Pipeline pages.
-- Without this policy, all frsMap lookups return empty and FRSButton
-- always shows "FRS —" regardless of actual engine scores.

CREATE POLICY "verified producer reads project intelligence"
  ON public.project_intelligence
  FOR SELECT
  USING (public.is_verified_producer());
