import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { supabaseUrl, supabaseAnonKey } from "./env";

/**
 * A Supabase client with NO cookie access, for use inside unstable_cache.
 *
 * lib/supabase/server.ts reads cookies() so it can carry the caller's session.
 * That is exactly right for rendering, and exactly wrong inside a cache:
 * unstable_cache forbids reading request-scoped data, so calling it there
 * throws — and if the caller wraps the query in a try/catch, the throw is
 * swallowed and the function quietly returns its empty fallback. That is how
 * every cached listing on this site started rendering "No opportunities
 * found": the pages had not got faster, they had stopped returning rows.
 *
 * Anything worth caching is the same for every visitor, so it should be read
 * as an anonymous visitor anyway — with RLS applying exactly as it does to a
 * logged-out reader. Using this client makes that explicit rather than
 * accidental.
 */
export function createAnonClient() {
  return createSupabaseClient(supabaseUrl(), supabaseAnonKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
