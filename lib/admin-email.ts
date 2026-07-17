// Admin-only email resolution. Server-side use only — never import from a
// Client Component.
//
// WHY THIS EXISTS
// ---------------
// profiles.email is a *cached copy* of auth.users.email, written once during
// onboarding (completeOnboarding / the createProject safety net). It can be
// null (profile row created before onboarding finished) or stale (user later
// changed their address in Supabase Auth). auth.users.email is the only
// authoritative source, and it is populated identically regardless of how the
// account signed in — magic link, Google OAuth or password.
//
// The previous approach called the profile_email() SECURITY DEFINER function
// over PostgREST. That adds a failure mode with no upside for a caller that is
// already admin-gated server-side: if the function is missing, or PostgREST's
// schema cache is stale, the call fails with
// "Could not find the function public.profile_email(target_id) in the schema
// cache" — and every caller then reads a null email as "no email on record".
// Reading auth.users through the service-role client has neither problem.

export type EmailLookup = {
  /** Best available address, or null if the account genuinely has none. */
  email: string | null;
  /** Where `email` came from. auth.users is authoritative; profiles is a fallback copy. */
  source: "auth" | "profiles" | null;
  /** Set only when the lookup itself failed. Distinct from "no email exists". */
  error: string | null;
  /** profiles.email, when it disagrees with auth.users.email — the cached copy has drifted. */
  staleProfileEmail: string | null;
};

const EMPTY: EmailLookup = { email: null, source: null, error: null, staleProfileEmail: null };

/**
 * Resolve a single user's email address from auth.users, with the profiles
 * copy as a fallback. Requires SUPABASE_SERVICE_ROLE_KEY. Callers must have
 * already established that the requester is an admin.
 */
export async function lookupUserEmail(userId: string): Promise<EmailLookup> {
  try {
    const { createAdminClient } = await import("@/lib/supabase/admin");
    const admin = createAdminClient();

    const [authRes, profRes] = await Promise.all([
      admin.auth.admin.getUserById(userId),
      // Service role is not the `authenticated` role, so the column-level
      // REVOKE from migration 013 does not apply here.
      admin.from("profiles").select("email").eq("id", userId).maybeSingle(),
    ]);

    if (authRes.error) throw new Error(`auth.users lookup failed: ${authRes.error.message}`);

    const authEmail    = authRes.data?.user?.email ?? null;
    const profileEmail = (profRes.data as any)?.email ?? null;

    return {
      email:  authEmail ?? profileEmail,
      source: authEmail ? "auth" : profileEmail ? "profiles" : null,
      error:  null,
      staleProfileEmail:
        authEmail && profileEmail && authEmail !== profileEmail ? profileEmail : null,
    };
  } catch (err: any) {
    return { ...EMPTY, error: err?.message ?? String(err) };
  }
}

/**
 * Batch variant. Returns a Map keyed by user id; ids with no entry could not
 * be resolved. Used where a list needs addresses without N round trips.
 */
export async function lookupUserEmails(userIds: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (!userIds.length) return out;

  try {
    const { createAdminClient } = await import("@/lib/supabase/admin");
    const admin = createAdminClient();
    const { data } = await admin.from("profiles").select("id, email").in("id", userIds);
    for (const row of (data ?? []) as any[]) {
      if (row.email) out.set(row.id, row.email);
    }
  } catch {
    // Caller decides how to handle a partial/empty map.
  }
  return out;
}
