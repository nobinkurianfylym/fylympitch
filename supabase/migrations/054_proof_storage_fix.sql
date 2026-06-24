-- 054_proof_storage_fix.sql
-- Fix storage RLS to use project ownership (not user folder)
-- Add JSON MIME type for snapshot files

-- ── 1. Fix storage policy ─────────────────────────────────────
-- Original policy checked folder[1] = auth.uid() but paths use projectId not userId

DROP POLICY IF EXISTS "filmmaker_read_own_proofs" ON storage.objects;

CREATE POLICY "filmmaker_read_own_proof_files"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'proofs'
    AND EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id::text = (storage.foldername(name))[1]
      AND p.owner_id = auth.uid()
    )
  );

-- ── 2. Allow JSON MIME type for snapshot files ────────────────
UPDATE storage.buckets
SET allowed_mime_types = ARRAY[
  'application/octet-stream',
  'application/x-ots',
  'application/json'
]
WHERE id = 'proofs';
