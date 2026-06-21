-- ============================================================
-- FYLYMPITCH — Funding Intelligence: Daily Cron Setup
-- Run ONCE manually in Supabase SQL Editor.
-- Requires pg_cron extension enabled (Dashboard → Database → Extensions).
--
-- Schedules the funding-intelligence Edge Function to run
-- every day at 02:00 UTC.
--
-- The function URL format:
--   https://<project-ref>.supabase.co/functions/v1/funding-intelligence
--
-- Replace <PROJECT_REF> and <SERVICE_ROLE_KEY> below.
-- ============================================================

-- Enable pg_cron if not already enabled
create extension if not exists pg_cron;

-- Remove any existing schedule for this job
select cron.unschedule('funding-intelligence-daily')
where exists (
  select 1 from cron.job where jobname = 'funding-intelligence-daily'
);

-- Schedule daily crawl at 02:00 UTC
select cron.schedule(
  'funding-intelligence-daily',
  '0 2 * * *',   -- every day at 02:00 UTC
  $$
  select net.http_post(
    url     := 'https://<PROJECT_REF>.supabase.co/functions/v1/funding-intelligence',
    headers := jsonb_build_object(
      'Authorization', 'Bearer <SERVICE_ROLE_KEY>',
      'Content-Type',  'application/json'
    ),
    body    := '{}'::jsonb
  )
  $$
);

-- Verify it was scheduled
select jobname, schedule, command
from cron.job
where jobname = 'funding-intelligence-daily';
