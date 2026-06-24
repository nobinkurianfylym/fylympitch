-- ============================================================
-- FYLYMPITCH — Migration 055: Producer-posted opportunities
-- Verified producers (and admin) can post their own briefs to
-- the public Opportunities page. Filmmaker submissions to those
-- briefs are treated as exclusive pitches to that producer
-- (equivalent to submitting via the producer's public profile).
-- Run once in Supabase SQL Editor.
-- ============================================================

-- ── 1. Extend opportunities table ───────────────────────────

ALTER TABLE public.opportunities
  ADD COLUMN IF NOT EXISTS posted_by_producer_id uuid
    REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS poster_url              text,
  ADD COLUMN IF NOT EXISTS is_producer_post        boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.opportunities.posted_by_producer_id IS
  'When set, this opportunity was created by a verified producer — not admin-curated.';
COMMENT ON COLUMN public.opportunities.poster_url IS
  'Public URL of the poster/cover image uploaded by the producer.';
COMMENT ON COLUMN public.opportunities.is_producer_post IS
  'TRUE for producer-created briefs; FALSE for admin/curated fund data.';

CREATE INDEX IF NOT EXISTS idx_opps_producer_post
  ON public.opportunities(posted_by_producer_id)
  WHERE posted_by_producer_id IS NOT NULL;

-- ── 2. RLS — producers can INSERT their own opportunities ───

-- Verified producers (approval_status = 'approved') may insert
-- as long as they set posted_by_producer_id = their own uid
CREATE POLICY "producer insert own opportunity"
  ON public.opportunities
  FOR INSERT
  TO authenticated
  WITH CHECK (
    posted_by_producer_id = auth.uid()
    AND is_producer_post = true
    AND is_active = true
    AND opp_approval_status = 'approved'
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
        AND role IN ('producer', 'admin')
        AND approval_status = 'approved'
    )
  );

-- Producers may update/delete their own posted opportunities
CREATE POLICY "producer update own opportunity"
  ON public.opportunities
  FOR UPDATE
  USING (posted_by_producer_id = auth.uid())
  WITH CHECK (posted_by_producer_id = auth.uid());

CREATE POLICY "producer delete own opportunity"
  ON public.opportunities
  FOR DELETE
  USING (posted_by_producer_id = auth.uid());

-- ── 3. Opportunity-posters storage bucket ───────────────────

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'opportunity-posters',
  'opportunity-posters',
  true,
  5242880,  -- 5 MB
  ARRAY['image/jpeg','image/png','image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- Public read
CREATE POLICY "opportunity posters public read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'opportunity-posters');

-- Authenticated producers upload under their own uid folder
CREATE POLICY "producers upload opportunity posters"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'opportunity-posters'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "producers update opportunity posters"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'opportunity-posters'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "producers delete opportunity posters"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'opportunity-posters'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );
