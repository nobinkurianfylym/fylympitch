-- ============================================================
-- Migration 057: Hardening
-- 1. Message content length cap (10 000 chars)
-- 2. Error log table for Edge Function / cron observability
-- ============================================================


-- ── 1. Message content length ─────────────────────────────────────────────────
-- Frontend enforces limits but the DB had no upper bound.
-- 10 000 chars is ~1 800 words — well above any legitimate message.

ALTER TABLE public.messages
  ADD CONSTRAINT chk_message_length
    CHECK (message IS NULL OR char_length(message) <= 10000);


-- ── 2. Platform error log ─────────────────────────────────────────────────────
-- Lightweight append-only table for Edge Function / cron / crawler errors.
-- No external service required. Admin can query or set up pg_cron alerts.

CREATE TABLE IF NOT EXISTS public.platform_errors (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at   timestamptz NOT NULL DEFAULT now(),
  source       text        NOT NULL,   -- e.g. 'check-proof-status', 'funding-intelligence'
  severity     text        NOT NULL DEFAULT 'error'
                           CHECK (severity IN ('warn', 'error', 'critical')),
  message      text        NOT NULL,
  context      jsonb,                  -- arbitrary structured data (proof_id, project_id, etc.)
  resolved     boolean     NOT NULL DEFAULT false
);

-- Only admins can read; edge functions insert via service role (RLS bypassed)
ALTER TABLE public.platform_errors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins read errors"
  ON public.platform_errors
  FOR SELECT
  USING (public.is_admin());

-- No INSERT policy needed — inserts come from service-role Edge Functions only


-- ── Index for recent-errors admin query ──────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_platform_errors_created
  ON public.platform_errors (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_platform_errors_source_severity
  ON public.platform_errors (source, severity)
  WHERE resolved = false;
