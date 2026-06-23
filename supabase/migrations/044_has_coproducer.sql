-- 044_has_coproducer.sql
-- Add co-producer attachment flag to projects.
-- Filmmakers tick this on submission when a co-producer is already attached.
-- Used by the matching engine to boost score against opportunities that have
-- copro_required = true, and to generate accurate fund requirement warnings.

ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS has_coproducer BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN projects.has_coproducer IS
  'True when the filmmaker has confirmed a co-producer is attached at submission time.
   Used as a matching signal against opportunities.copro_required.';
