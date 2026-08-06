import { NextRequest, NextResponse } from "next/server";
import { supabaseUrl as getSupabaseUrl, supabaseAnonKey as getSupabaseAnonKey, supabaseServiceRoleKey as getSupabaseServiceRoleKey } from "@/lib/supabase/env";
import { createClient } from "@supabase/supabase-js";

// Returns the role of an existing account for a given email, or null if not found.
// Used by AuthForm to warn users attempting to sign up with a conflicting role.
export async function GET(req: NextRequest) {
  const email = req.nextUrl.searchParams.get("email")?.trim().toLowerCase();
  if (!email) return NextResponse.json({ role: null });

  const supabase = createClient(
    getSupabaseUrl(),
    getSupabaseServiceRoleKey(),
    { auth: { persistSession: false } }
  );

  const { data: { users } } = await supabase.auth.admin.listUsers({ perPage: 1000 });
  const match = (users ?? []).find((u: any) => u.email?.toLowerCase() === email);
  if (!match) return NextResponse.json({ role: null });

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", match.id)
    .single();

  return NextResponse.json({ role: profile?.role ?? null });
}
