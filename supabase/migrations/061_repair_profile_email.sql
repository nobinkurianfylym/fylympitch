-- Migration 061: Repair profile_email() and resync profiles.email
--
-- SYMPTOM
--   The admin profile page reported:
--     "Could not find the function public.profile_email(target_id)
--      in the schema cache"
--   intermittently — for some profiles and not others, on some loads and not
--   others.
--
-- CAUSE
--   Not the signup method. auth.users.email is populated identically for magic
--   link, Google OAuth and password accounts, so how a user joined has no
--   bearing on this. The error is PostgREST failing to *resolve the function*,
--   which happens when either:
--     (a) migration 013 was never applied to this database, so profile_email()
--         does not exist; or
--     (b) it exists, but PostgREST's schema cache has not picked it up. Supabase
--         runs more than one PostgREST instance, and a stale cache on one of
--         them produces exactly this: same query, same row, works on one request
--         and fails on the next. That is the intermittency.
--   Either way the caller received null and rendered it as "no email on record",
--   which is a different and much more misleading statement.
--
-- FIX
--   1. Recreate the function idempotently, so (a) cannot be the cause.
--   2. Force a schema cache reload, so (b) cannot be the cause.
--   3. Resync profiles.email from auth.users, since the cached copy is written
--      once at onboarding and drifts.
--
--   Application code no longer depends on this function — lib/admin-email.ts
--   reads auth.users through the service-role client instead. It is repaired
--   here because it is the correct accessor for any non-admin, RLS-bound caller
--   that needs it later, and a broken function in the schema is a trap.

-- 1. The accessor. Owner-or-admin only; the check lives inside the function
--    because SECURITY DEFINER bypasses RLS.
CREATE OR REPLACE FUNCTION public.profile_email(target_id uuid)
RETURNS text
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT email
  FROM   public.profiles
  WHERE  id = target_id
    AND  (target_id = auth.uid() OR public.is_admin());
$$;

COMMENT ON FUNCTION public.profile_email(uuid) IS
  'Returns the email for the given profile ID only if the caller is the owner
   (auth.uid() = target_id) or an admin. Safe to expose via PostgREST.
   NOTE: reads profiles.email, which is a cached copy of auth.users.email.
   Admin surfaces should prefer lib/admin-email.ts, which reads auth.users.';

REVOKE ALL     ON FUNCTION public.profile_email(uuid) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.profile_email(uuid) TO authenticated;

-- 2. Re-assert the column revoke from 013 in case that migration never ran.
--    Without this, any authenticated user can read every other user's address.
REVOKE SELECT (email) ON public.profiles FROM authenticated;

-- 3. Resync the cached copy from the authoritative source.
--    profiles.email is written once during onboarding; rows created before
--    onboarding completed have null, and rows where the user later changed
--    their address in Supabase Auth have gone stale.
UPDATE public.profiles p
SET    email = u.email
FROM   auth.users u
WHERE  u.id = p.id
  AND  u.email IS NOT NULL
  AND  p.email IS DISTINCT FROM u.email;

-- 4. Force every PostgREST instance to re-read the schema. This is what clears
--    the "not found in the schema cache" error for a function that does exist.
NOTIFY pgrst, 'reload schema';

-- 5. Verification (run manually after applying):
--
-- -- The function resolves and is owner-or-admin gated:
-- SELECT public.profile_email('<some-user-uuid>');   -- as an admin: returns the address
--
-- -- No profile is out of sync with auth:
-- SELECT p.id, p.email AS profile_email, u.email AS auth_email
-- FROM   public.profiles p
-- JOIN   auth.users u ON u.id = p.id
-- WHERE  p.email IS DISTINCT FROM u.email;
-- -- Expected: zero rows.
--
-- -- Accounts with no address anywhere (should be none):
-- SELECT id FROM auth.users WHERE email IS NULL;
