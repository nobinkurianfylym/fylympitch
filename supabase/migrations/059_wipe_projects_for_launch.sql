-- FYLYMPITCH — Migration 059: Wipe all project data for public launch
-- Run manually in the Supabase SQL Editor.
--
-- Deletes every row in `projects`. All dependent rows are removed or
-- nulled automatically via existing foreign-key ON DELETE rules:
--   CASCADE   -> project_intelligence, producer_studio pipeline/offer rows,
--                ep_brief_queue, project_loves, messaging_v2 conversations,
--                project_proofs (and proof_notifications beneath it)
--   SET NULL  -> notifications.project_id, saved_opportunities.project_id
--
-- This does NOT touch: opportunities, producer/filmmaker profiles, auth users,
-- platform_metrics history, or platform_errors.
--
-- NOTE: Any pitch deck / poster files in Supabase Storage buckets are NOT
-- removed by this script (Storage objects aren't governed by these FKs).
-- Clear the relevant storage buckets separately if a full wipe is needed.

BEGIN;

DELETE FROM public.projects;

COMMIT;
