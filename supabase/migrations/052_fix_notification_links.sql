-- ============================================================
-- FYLYMPITCH — Migration 052: Fix all broken notification links
-- Run once in Supabase SQL Editor.
--
-- Fixes two classes of bad links already in the notifications table:
--   1. '/producer/projects'  (migration 029 — route was renamed)
--   2. '/projects'           (migration 035 — route doesn't exist)
--
-- Also replaces both notification functions with role-correct links:
--   - broadcast_new_project  → producers  → /producerstudio/projects/{id}
--   - notify_producer_interest → filmmaker → /dashboard/projects/{id}
-- ============================================================

-- ── Patch existing bad rows ──────────────────────────────────────────────────

-- /producer/projects was the old Producer Studio route (pre-rename)
UPDATE public.notifications
  SET link = '/producerstudio/projects'
  WHERE link = '/producer/projects';

-- /projects never existed as a route; these are new_project notifications
-- sent to producers. Best we can do without a stored project_id is send
-- them to the producer's browse-all page.
UPDATE public.notifications
  SET link = '/producerstudio/projects'
  WHERE link = '/projects';

-- /filmprojects/{uuid} was set by migration 051 for broadcast_new_project
-- (sent to producers). Rewrite to /producerstudio/projects/{uuid}.
UPDATE public.notifications
  SET link = replace(link, '/filmprojects/', '/producerstudio/projects/')
  WHERE link LIKE '/filmprojects/%'
    AND kind = 'new_project';

-- /filmprojects/{uuid} set by migration 051 for notify_producer_interest
-- (sent to filmmakers). Rewrite to /dashboard/projects/{uuid}.
UPDATE public.notifications
  SET link = replace(link, '/filmprojects/', '/dashboard/projects/')
  WHERE link LIKE '/filmprojects/%'
    AND kind = 'producer_interest';

-- ── Replace broadcast_new_project ───────────────────────────────────────────
-- Producers receive this notification → link to Producer Studio project view.
CREATE OR REPLACE FUNCTION public.broadcast_new_project(p_project_id uuid)
  RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_title     text;
  v_genre     text;
  v_format    text;
  v_filmmaker text;
BEGIN
  SELECT p.title, p.genre, p.format, pr.full_name
    INTO v_title, v_genre, v_format, v_filmmaker
  FROM public.projects p
  JOIN public.profiles pr ON pr.id = p.owner_id
  WHERE p.id              = p_project_id
    AND p.owner_id        = auth.uid()
    AND p.is_public       = true
    AND p.target_producer_id IS NULL;   -- never broadcast exclusive pitches

  IF v_title IS NULL THEN RETURN; END IF;

  INSERT INTO public.notifications (user_id, kind, title, body, link, project_id)
  SELECT pp.user_id,
    'new_project',
    'New project: ' || v_title,
    v_filmmaker || ' submitted a new '
      || COALESCE(v_genre, '') || ' ' || COALESCE(v_format, '')
      || '. Discover it in your feed.',
    '/producerstudio/projects/' || p_project_id::text,
    p_project_id
  FROM public.producer_profiles pp
  JOIN public.profiles pr ON pr.id = pp.user_id
  WHERE pr.approval_status = 'approved'
  LIMIT 1000;
END;
$$;

-- ── Replace notify_producer_interest ────────────────────────────────────────
-- Filmmaker receives this notification → link to their dashboard project view.
CREATE OR REPLACE FUNCTION public.notify_producer_interest(p_project_id uuid)
  RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_title              text;
  v_owner_id           uuid;
  v_producer_name      text;
  v_is_public          boolean;
  v_target_producer_id uuid;
BEGIN
  IF NOT public.is_approved_industry() THEN RETURN; END IF;

  SELECT p.title, p.owner_id, p.is_public, p.target_producer_id
    INTO v_title, v_owner_id, v_is_public, v_target_producer_id
  FROM public.projects p
  WHERE p.id = p_project_id;

  IF v_owner_id IS NULL THEN RETURN; END IF;
  IF v_owner_id = auth.uid() THEN RETURN; END IF;

  -- Never notify for private or exclusive-pitch projects
  IF NOT COALESCE(v_is_public, false) THEN RETURN; END IF;
  IF v_target_producer_id IS NOT NULL THEN RETURN; END IF;

  SELECT COALESCE(company, full_name) INTO v_producer_name
  FROM public.profiles WHERE id = auth.uid();

  INSERT INTO public.notifications (user_id, kind, title, body, link, project_id)
  VALUES (
    v_owner_id,
    'producer_interest',
    v_producer_name || ' is interested in "' || v_title || '"',
    'They added your project to their pipeline.',
    '/dashboard/projects/' || p_project_id::text,
    p_project_id
  );
END;
$$;
