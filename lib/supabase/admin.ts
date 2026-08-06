// Service-role Supabase client — server-side only.
// Use only when you need to bypass RLS (e.g. reading another user's contact email).
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { supabaseUrl, supabaseServiceRoleKey } from "./env";

export function createAdminClient() {
  return createSupabaseClient(supabaseUrl(), supabaseServiceRoleKey(), {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
