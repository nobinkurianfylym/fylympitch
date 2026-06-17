-- ============================================================
-- Migration 018: EP Brief async job queue
-- ============================================================
-- Tracks EP Brief generation requests so the Supabase Edge
-- Function can process them asynchronously after project creation.
-- The results page polls project_intelligence until ep_brief_status
-- changes from 'pending' → 'done'.
-- ============================================================

-- Add EP brief status to project_intelligence so the results page
-- knows whether to show a skeleton or the real brief
ALTER TABLE public.project_intelligence
  ADD COLUMN IF NOT EXISTS ep_brief_status text NOT NULL DEFAULT 'done'
    CHECK (ep_brief_status IN ('pending', 'processing', 'done', 'failed'));

-- Mark all existing rows as done (they were computed synchronously)
UPDATE public.project_intelligence
SET ep_brief_status = 'done'
WHERE ep_brief_status != 'done';

-- ── EP Brief job queue ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.ep_brief_queue (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  uuid        NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  status      text        NOT NULL DEFAULT 'pending'
                            CHECK (status IN ('pending', 'processing', 'done', 'failed')),
  error       text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz
);

CREATE INDEX IF NOT EXISTS ep_brief_queue_status_idx ON public.ep_brief_queue (status, created_at);
CREATE INDEX IF NOT EXISTS ep_brief_queue_project_idx ON public.ep_brief_queue (project_id);

-- RLS: service role only
ALTER TABLE public.ep_brief_queue ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_only" ON public.ep_brief_queue
  USING (auth.role() = 'service_role');
