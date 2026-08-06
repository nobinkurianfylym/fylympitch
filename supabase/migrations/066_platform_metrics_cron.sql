-- ============================================================
-- FYLYMPITCH — Migration 066: Daily platform-metrics snapshot cron
-- Run in Supabase SQL Editor.
--
-- WHY: refresh_platform_metrics() (migration 041) was only ever called
-- once as a seed, and again as the LAST step of the funding-intelligence
-- crawler. If the crawler stops or errors before that step, the landing-page
-- numbers freeze (last snapshot: 21 Jun 2026). This adds an INDEPENDENT daily
-- job so the snapshot refreshes every day regardless of crawler health.
--
-- Requires pg_cron (already used by 034b + 058, so it's enabled).
-- ============================================================

-- Remove any prior version of this job so re-running is safe.
SELECT cron.unschedule('platform-metrics-daily')
WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'platform-metrics-daily'
);

-- Crawler runs at 02:00 UTC; run metrics at 03:00 UTC so we capture fresh
-- crawl data on good days, but still refresh even if the crawler failed.
SELECT cron.schedule(
  'platform-metrics-daily',
  '0 3 * * *',            -- every day at 03:00 UTC
  $$ SELECT public.refresh_platform_metrics(); $$
);

-- Refresh once right now so the landing page updates immediately
-- (don't wait until the next 03:00 UTC tick).
SELECT public.refresh_platform_metrics();

-- Verify the job is registered.
SELECT jobname, schedule, active
FROM cron.job
WHERE jobname = 'platform-metrics-daily';
