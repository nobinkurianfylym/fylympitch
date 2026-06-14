-- ============================================================
-- FYLYMPITCH — Migration 008: Onboarding flag
-- Run once in Supabase SQL Editor (after 007).
--
-- Adds onboarded_at to profiles. NULL = new user who hasn't
-- completed the onboarding flow. After completing onboarding
-- (role selection + name confirmation), the server action sets
-- this to now(). The auth callback uses it to decide whether
-- to send the user to /onboarding or /dashboard.
--
-- All existing profiles are marked as already onboarded so they
-- are not sent through onboarding again.
-- ============================================================

alter table public.profiles
  add column if not exists onboarded_at timestamptz;

-- Mark all existing users as already onboarded
update public.profiles
  set onboarded_at = now()
  where onboarded_at is null;
