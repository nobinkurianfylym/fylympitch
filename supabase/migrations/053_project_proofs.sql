-- ============================================================
-- 048_project_proofs.sql
-- OTS + Bitcoin Proof of Existence for Pitch.Fylym
-- Every project update generates a new proof row
-- ============================================================

-- ── 1. Main proofs table ─────────────────────────────────────

CREATE TABLE IF NOT EXISTS project_proofs (
  id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id                  uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  version                     int  NOT NULL DEFAULT 1,
  file_name                   text,                          -- 'pitch_deck.pdf' or 'project_snapshot'
  proof_type                  text NOT NULL DEFAULT 'file'   -- 'file' | 'snapshot'
    CHECK (proof_type IN ('file', 'snapshot')),
  sha256_hash                 text NOT NULL,                 -- hex-encoded SHA-256
  ots_status                  text NOT NULL DEFAULT 'pending'
    CHECK (ots_status IN ('pending', 'anchored', 'failed')),
  -- Storage paths (relative to proofs bucket)
  ots_pending_path            text,
  ots_anchored_path           text,
  -- Bitcoin anchor details (populated when status = 'anchored')
  bitcoin_block_height        int,
  bitcoin_block_hash          text,
  anchored_at                 timestamptz,
  -- Which calendars responded
  calendar_responses          jsonb DEFAULT '[]'::jsonb,
  -- Upgrade attempt tracking
  last_upgrade_attempt        timestamptz,
  upgrade_attempts            int NOT NULL DEFAULT 0,
  created_at                  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_project_proofs_project_id
  ON project_proofs(project_id);

CREATE INDEX IF NOT EXISTS idx_project_proofs_pending
  ON project_proofs(ots_status, last_upgrade_attempt)
  WHERE ots_status = 'pending';

CREATE INDEX IF NOT EXISTS idx_project_proofs_hash
  ON project_proofs(sha256_hash);

-- ── 2. Proof notifications (rendered in Filmmaker Messages) ──

CREATE TABLE IF NOT EXISTS proof_notifications (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  filmmaker_id  uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id    uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  proof_id      uuid NOT NULL REFERENCES project_proofs(id) ON DELETE CASCADE,
  title         text NOT NULL,
  body          text NOT NULL,
  is_read       boolean NOT NULL DEFAULT false,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_proof_notifications_filmmaker
  ON proof_notifications(filmmaker_id, is_read, created_at DESC);

-- ── 3. RLS ───────────────────────────────────────────────────

ALTER TABLE project_proofs ENABLE ROW LEVEL SECURITY;
ALTER TABLE proof_notifications ENABLE ROW LEVEL SECURITY;

-- Filmmakers see proofs for their own projects
CREATE POLICY "filmmaker_select_own_proofs"
  ON project_proofs FOR SELECT
  USING (
    project_id IN (
      SELECT id FROM projects WHERE filmmaker_id = auth.uid()
    )
  );

-- Producers see proofs for projects in their pipeline
CREATE POLICY "producer_select_pipeline_proofs"
  ON project_proofs FOR SELECT
  USING (
    project_id IN (
      SELECT pp.project_id
      FROM pipeline_projects pp
      WHERE pp.producer_id = auth.uid()
    )
  );

-- Service role inserts/updates via Edge Function (no policy needed — bypasses RLS)

-- Filmmakers see their own notifications
CREATE POLICY "filmmaker_select_own_notifications"
  ON proof_notifications FOR SELECT
  USING (filmmaker_id = auth.uid());

CREATE POLICY "filmmaker_update_own_notifications"
  ON proof_notifications FOR UPDATE
  USING (filmmaker_id = auth.uid())
  WITH CHECK (filmmaker_id = auth.uid());

-- ── 4. Storage bucket for OTS certificates ───────────────────

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'proofs',
  'proofs',
  false,                         -- private; signed URLs only
  51200,                         -- 50KB max per certificate
  ARRAY['application/octet-stream', 'application/x-ots']
)
ON CONFLICT (id) DO NOTHING;

-- Filmmakers can read their own proof certificates
CREATE POLICY "filmmaker_read_own_proofs"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'proofs'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Service role can write (Edge Function uses service role)
CREATE POLICY "service_role_write_proofs"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'proofs');

CREATE POLICY "service_role_update_proofs"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'proofs');

-- ── 5. pg_cron job (run manually in SQL editor after deploy) ──
-- Replace YOUR_SERVICE_ROLE_KEY and YOUR_PROJECT_REF before running:
--
-- SELECT cron.schedule(
--   'check-proof-status',
--   '0 */2 * * *',
--   $$
--   SELECT net.http_post(
--     url    := 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/check-proof-status',
--     headers := jsonb_build_object(
--       'Authorization', 'Bearer YOUR_SERVICE_ROLE_KEY',
--       'Content-Type', 'application/json'
--     ),
--     body   := '{}'::jsonb
--   );
--   $$
-- );
