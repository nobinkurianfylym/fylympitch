-- 050_exclusive_pitch_rls.sql
-- Tighten project visibility so exclusively-pitched projects
-- (target_producer_id IS NOT NULL) are invisible to everyone except:
--   1. The filmmaker who owns them
--   2. The specific target producer
--   3. Admins

-- Drop and recreate the two policies that could leak exclusive pitches

DROP POLICY IF EXISTS "public readable non-hidden" ON public.projects;
DROP POLICY IF EXISTS "verified producer reads non-hidden" ON public.projects;

-- Public: only non-exclusive, public, non-hidden projects
CREATE POLICY "public readable non-hidden"
  ON public.projects FOR SELECT
  USING (
    is_public = true
    AND admin_hidden = false
    AND target_producer_id IS NULL
  );

-- Verified producers: non-exclusive, non-hidden projects
CREATE POLICY "verified producer reads non-hidden"
  ON public.projects FOR SELECT
  USING (
    public.is_verified_producer()
    AND admin_hidden = false
    AND target_producer_id IS NULL
  );
