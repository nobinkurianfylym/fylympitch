-- Migration 060: Fix love_count persistence
--
-- Problem: sync_project_love_count() (022, hardened in 024) is a plain
-- SECURITY INVOKER trigger. It runs as the *liking* user and issues an
-- UPDATE against public.projects. RLS on projects only permits a row owner
-- to update their own project, so when any other user loves a project the
-- UPDATE silently matches zero rows. Postgres raises no error — the
-- project_loves row inserts fine, but projects.love_count never moves.
-- Result: every public tile renders 0 loves regardless of real activity.
--
-- Fix: run the counter trigger as SECURITY DEFINER so it can maintain the
-- cached column, then rebuild love_count from the source of truth.

-- 1. Counter trigger bypasses RLS (search_path pinned, per 024's audit)
CREATE OR REPLACE FUNCTION public.sync_project_love_count()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.projects SET love_count = love_count + 1
    WHERE  id = NEW.project_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.projects SET love_count = GREATEST(0, love_count - 1)
    WHERE  id = OLD.project_id;
  END IF;
  RETURN NULL;
END;
$$;

-- SECURITY DEFINER functions must not be executable by arbitrary roles beyond
-- what the trigger needs. Ownership stays with the migration role (postgres).
REVOKE ALL ON FUNCTION public.sync_project_love_count() FROM PUBLIC;

-- 2. Ensure the trigger is actually attached (idempotent re-create)
DROP TRIGGER IF EXISTS trg_sync_love_count ON public.project_loves;
CREATE TRIGGER trg_sync_love_count
  AFTER INSERT OR DELETE ON public.project_loves
  FOR EACH ROW EXECUTE FUNCTION public.sync_project_love_count();

-- 3. Backfill: rebuild the cached column from project_loves.
--    Honest data only — this reconciles the cache to real rows, it does not
--    invent any. Projects with no loves correctly land on 0.
UPDATE public.projects p
SET    love_count = COALESCE(l.c, 0)
FROM  (SELECT id FROM public.projects) AS ids
LEFT  JOIN (
        SELECT project_id, COUNT(*)::int AS c
        FROM   public.project_loves
        GROUP  BY project_id
      ) AS l ON l.project_id = ids.id
WHERE p.id = ids.id
  AND p.love_count IS DISTINCT FROM COALESCE(l.c, 0);

-- 4. Verification (run manually after applying):
-- SELECT p.id, p.title, p.love_count, COUNT(pl.user_id) AS actual
-- FROM   public.projects p
-- LEFT   JOIN public.project_loves pl ON pl.project_id = p.id
-- GROUP  BY p.id, p.title, p.love_count
-- HAVING p.love_count <> COUNT(pl.user_id);
-- Expected: zero rows.
