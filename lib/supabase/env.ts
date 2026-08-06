// Centralised, fail-fast access to Supabase environment variables.
//
// Why this exists: passing `process.env.X!` straight into the Supabase SDK
// yields the cryptic runtime crash "Your project's URL and Key are required to
// create a Supabase client!" whenever a var is missing. These helpers throw a
// named, actionable error instead — and deliberately do NOT fall back to
// hard-coded defaults, which would mask misconfiguration and (for the service
// role key) leak a full-access secret.
//
// Inlining note: NEXT_PUBLIC_* are inlined into the bundle at BUILD time by
// Next.js via *static* `process.env.NEXT_PUBLIC_...` references. The references
// below are static (not dynamic `process.env[name]`), so inlining still works.
// SUPABASE_SERVICE_ROLE_KEY has no NEXT_PUBLIC_ prefix: it is never inlined and
// is read at runtime from the Worker env (Cloudflare Secret) — server-only.

export function supabaseUrl(): string {
  const v = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!v) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL. This is inlined at build time — set it " +
        "in .env.local (local/deploy build) or your CI build environment."
    );
  }
  return v;
}

export function supabaseAnonKey(): string {
  const v = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!v) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_ANON_KEY. This is inlined at build time — set " +
        "it in .env.local (local/deploy build) or your CI build environment."
    );
  }
  return v;
}

// Server-only. Bypasses RLS — never expose to the browser. Read at runtime, so
// it must exist in the Worker env. Store it as a Cloudflare *Secret* so that
// `opennextjs-cloudflare deploy` does not wipe it (plain vars are overwritten
// unless deployed with --keep-vars).
export function supabaseServiceRoleKey(): string {
  const v = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!v) {
    throw new Error(
      "Missing SUPABASE_SERVICE_ROLE_KEY. Set it as a Cloudflare Secret (runtime) " +
        "and in .env.local for local development. Never prefix it with NEXT_PUBLIC_."
    );
  }
  return v;
}
