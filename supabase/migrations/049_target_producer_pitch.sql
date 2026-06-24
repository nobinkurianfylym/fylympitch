-- 049_target_producer_pitch.sql
-- Allow filmmakers to pitch directly to a specific producer via their public profile.
-- target_producer_id is set when the submission form is opened from /u/[username]
-- with ?producer=[username]. The producer can then see these exclusive pitches
-- at the top of their Discovery page regardless of is_public or admin_hidden.

ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS target_producer_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_projects_target_producer ON public.projects(target_producer_id)
  WHERE target_producer_id IS NOT NULL;

-- Producers can read projects pitched directly to them (even private)
CREATE POLICY "producer reads own pitched projects"
  ON public.projects
  FOR SELECT
  USING (target_producer_id = auth.uid());

COMMENT ON COLUMN public.projects.target_producer_id IS
  'Set when a filmmaker submits via a producer public profile. Unlocks exclusive discovery for that producer.';
