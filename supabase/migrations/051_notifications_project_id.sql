-- ============================================================
-- FYLYMPITCH — Migration 051: Notifications project_id + link fixes
-- Run once in Supabase SQL Editor.
--
-- 1. Add project_id column to notifications for poster display.
-- 2. Update notify_producer_interest:
--    - Skip private projects (is_public = false)
--    - Skip exclusive pitches (target_producer_id IS NOT NULL)
--    - Link to public /filmprojects/{id}
--    - Store project_id
-- 3. Update broadcast_new_project:
--    - Skip private projects
--    - Skip exclusive pitches
--    - Link to public /filmprojects/{id}
--    - Store project_id
-- ============================================================

ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_notifications_project_id ON public.notifications(project_id)
  WHERE project_id IS NOT NULL;

-- ── 1. Producer saves a project → notify the filmmaker ──────────────────────
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
    '/filmprojects/' || p_project_id::text,
    p_project_id
  );
END;
$$;

-- ── 2. Filmmaker publishes a project → notify approved producers ─────────────
CREATE OR REPLACE FUNCTION public.broadcast_new_project(p_project_id uuid)
  RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_title   text;
  v_genre   text;
  v_format  text;
  v_filmmaker text;
BEGIN
  -- Only fire for public, non-exclusive projects owned by the caller
  SELECT p.title, p.genre, p.format, pr.full_name
    INTO v_title, v_genre, v_format, v_filmmaker
  FROM public.projects p
  JOIN public.profiles pr ON pr.id = p.owner_id
  WHERE p.id = p_project_id
    AND p.owner_id        = auth.uid()
    AND p.is_public       = true
    AND p.target_producer_id IS NULL;   -- never broadcast exclusive pitches

  IF v_title IS NULL THEN RETURN; END IF;

  INSERT INTO public.notifications (user_id, kind, title, body, link, project_id)
  SELECT pp.user_id,
    'new_project',
    'New project: ' || v_title,
    v_filmmaker || ' submitted a new ' || COALESCE(v_genre, '') || ' ' || COALESCE(v_format, '') || '. Discover it in your feed.',
    '/filmprojects/' || p_project_id::text,
    p_project_id
  FROM public.producer_profiles pp
  JOIN public.profiles pr ON pr.id = pp.user_id
  WHERE pr.approval_status = 'approved'
  LIMIT 1000;
END;
$$;
