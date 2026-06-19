-- ============================================================
-- Migration 023: Ensure handle_new_user trigger on auth.users
-- ============================================================
-- Previous migrations kept updating the trigger FUNCTION but
-- never explicitly re-registered the TRIGGER itself. If the
-- trigger was missing or broken, new signups would have an
-- auth.users row but no profiles row — causing FK violations
-- on any table that references profiles.id (projects, etc).
--
-- This migration also refreshes the function to include all
-- columns added since 012 (email, onboarded_at, profile_completed).
-- ============================================================

-- Drop and recreate the function with all current columns
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (
    id,
    role,
    full_name,
    email,
    approval_status,
    onboarded_at,
    profile_completed
  )
  VALUES (
    NEW.id,
    'filmmaker',
    COALESCE(
      NEW.raw_user_meta_data->>'full_name',
      NEW.raw_user_meta_data->>'name',
      SPLIT_PART(NEW.email, '@', 1)
    ),
    NEW.email,
    'approved',
    NOW(),
    false
  )
  ON CONFLICT (id) DO UPDATE SET
    email        = EXCLUDED.email,
    full_name    = COALESCE(profiles.full_name, EXCLUDED.full_name);
  RETURN NEW;
END;
$$;

-- Re-register the trigger (idempotent — drop first)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Back-fill any auth users who have no profiles row
-- (covers users whose signup predated a working trigger)
INSERT INTO public.profiles (id, role, full_name, email, approval_status, onboarded_at, profile_completed)
SELECT
  u.id,
  'filmmaker',
  COALESCE(u.raw_user_meta_data->>'full_name', u.raw_user_meta_data->>'name', SPLIT_PART(u.email,'@',1)),
  u.email,
  'approved',
  NOW(),
  true   -- existing users are considered onboarded
FROM auth.users u
LEFT JOIN public.profiles p ON p.id = u.id
WHERE p.id IS NULL;
