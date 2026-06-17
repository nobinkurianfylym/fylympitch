-- ============================================================
-- Migration 017: Filmmaker onboarding profile fields
-- ============================================================
-- Adds:
--   profiles.career_stage         text  (debut | emerging | established)
--   profiles.filmmaker_formats    text[] (documentary | narrative | both)
--   profiles.profile_completed    bool  (true once 3-step onboarding done)
--   rematch_queue table           (queues re-scoring when new opps added)
--   trigger: trg_opportunity_rematch
-- ============================================================

-- ── 1. Profile fields ─────────────────────────────────────────────────────────

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS career_stage text
    CHECK (career_stage IN ('debut', 'emerging', 'established')),
  ADD COLUMN IF NOT EXISTS filmmaker_formats text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS profile_completed boolean NOT NULL DEFAULT false;

-- Mark all existing users as already completed (they predate the new onboarding)
UPDATE public.profiles
SET profile_completed = true
WHERE created_at < now() - interval '5 minutes';

-- Update handle_new_user: new signups get profile_completed = false
-- so they are routed through the 3-step onboarding
CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (
    id, role, full_name, approval_status, onboarded_at, profile_completed
  ) VALUES (
    NEW.id,
    'filmmaker',
    COALESCE(
      NEW.raw_user_meta_data->>'full_name',
      NEW.raw_user_meta_data->>'name',
      SPLIT_PART(NEW.email, '@', 1)
    ),
    'approved',
    NOW(),
    false   -- ← new: must complete 3-step onboarding
  );
  RETURN NEW;
END $$;

-- ── 2. Re-match queue ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.rematch_queue (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id uuid       NOT NULL REFERENCES public.opportunities(id) ON DELETE CASCADE,
  status        text        NOT NULL DEFAULT 'pending'
                              CHECK (status IN ('pending', 'processing', 'done', 'failed')),
  created_at    timestamptz NOT NULL DEFAULT now(),
  processed_at  timestamptz
);

CREATE INDEX IF NOT EXISTS rematch_queue_status_idx ON public.rematch_queue (status, created_at);

-- RLS: service role only
ALTER TABLE public.rematch_queue ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_only" ON public.rematch_queue
  USING (auth.role() = 'service_role');

-- ── 3. Trigger: queue re-match when opportunity becomes active ────────────────

CREATE OR REPLACE FUNCTION public.queue_opportunity_rematch()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  -- Fires on INSERT (new active opp) or UPDATE (opp toggled to active)
  IF (TG_OP = 'INSERT' AND NEW.is_active = true) OR
     (TG_OP = 'UPDATE' AND NEW.is_active = true AND OLD.is_active = false) THEN
    INSERT INTO public.rematch_queue (opportunity_id)
    VALUES (NEW.id);
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_opportunity_rematch ON public.opportunities;
CREATE TRIGGER trg_opportunity_rematch
  AFTER INSERT OR UPDATE OF is_active ON public.opportunities
  FOR EACH ROW EXECUTE FUNCTION public.queue_opportunity_rematch();
