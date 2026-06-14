-- Migration 013: Protect email column from the permissive profile SELECT policy
--
-- PROBLEM:
--   'read public industry identity' ON profiles uses `USING (true)`, which grants
--   SELECT on ALL columns — including `email` — to every authenticated user.
--   Any logged-in user can run: SELECT email FROM profiles WHERE id = <any_uuid>
--   and retrieve any other user's email address. This is a PII leak.
--
-- SOLUTION:
--   1. REVOKE the email column from the `authenticated` role so it is never
--      returned in any query, even SELECT *.
--   2. Create a SECURITY DEFINER function `profile_email(uuid)` that returns
--      the email only if the caller is the profile owner or an admin.
--      Server actions that legitimately need a user's email (e.g. approval
--      notifications) call this function via supabase.rpc() instead of
--      selecting the column directly.
--
-- IMPACT ON EXISTING CODE:
--   - SELECT * FROM profiles → email column silently omitted (no error).
--   - SELECT email FROM profiles → 403 permission denied.
--   - The one place that explicitly selects email is approveOrDeclineProducer
--     in lib/actions.ts — updated in the same commit to use profile_email().
--   - completeOnboarding reads own email from auth.getUser(), not profiles —
--     unaffected.

-- Step 1: Remove direct email access for the authenticated role
REVOKE SELECT (email) ON public.profiles FROM authenticated;

-- Step 2: A safe, owner-or-admin accessor function
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
  'Returns the email for the given profile ID only if the caller is
   the owner (auth.uid() = target_id) or an admin. Safe to expose
   via PostgREST / supabase.rpc().';

-- Grant execute to authenticated users (row-level check is inside the function)
GRANT EXECUTE ON FUNCTION public.profile_email(uuid) TO authenticated;
