-- ============================================================
-- Migration 058: Queued proof status + snapshot_json column
-- Decouples OTS submission from Cloudflare Worker lifecycle.
-- ============================================================

-- ── 1. Add 'queued' to ots_status ────────────────────────────────────────────
-- Proofs are inserted as 'queued' by the Worker (fast, local work only).
-- The process-queued-proofs cron promotes them to 'pending' after OTS submission.
ALTER TABLE public.project_proofs
  DROP CONSTRAINT IF EXISTS project_proofs_ots_status_check;

ALTER TABLE public.project_proofs
  ADD CONSTRAINT project_proofs_ots_status_check
    CHECK (ots_status IN ('queued', 'pending', 'anchored', 'failed'));


-- ── 2. Inline snapshot JSON ───────────────────────────────────────────────────
-- Avoids a Storage upload inside the Worker after() callback.
-- snapshot/route.ts reads this column first, falls back to Storage for old rows.
ALTER TABLE public.project_proofs
  ADD COLUMN IF NOT EXISTS snapshot_json text;


-- ── 3. Index for queued rows ─────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_project_proofs_queued
  ON public.project_proofs (created_at ASC)
  WHERE ots_status = 'queued';


-- ── 4. pg_cron: process queued proofs every 5 minutes ────────────────────────
-- Requires pg_cron + pg_net enabled.
-- Calls process-queued-proofs Edge Function which handles the slow OTS
-- calendar network calls entirely outside the Cloudflare Worker lifecycle.

SELECT cron.unschedule('process-queued-proofs')
WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'process-queued-proofs'
);

SELECT cron.schedule(
  'process-queued-proofs',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url     := 'https://hwwilevvoinecedexmok.supabase.co/functions/v1/process-queued-proofs',
    headers := jsonb_build_object(
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh3d2lsZXZ2b2luZWNlZGV4bW9rIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MTI3NjY5NCwiZXhwIjoyMDk2ODUyNjk0fQ.zORR-B4ChE-0V4zBI0h4L4tNNXe7GMYM3yDOTtOjnlE',
      'Content-Type', 'application/json'
    ),
    body    := '{}'::jsonb
  )
  $$
);

-- Verify
SELECT jobname, schedule FROM cron.job WHERE jobname = 'process-queued-proofs';
