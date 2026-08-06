export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { supabaseUrl as getSupabaseUrl, supabaseAnonKey as getSupabaseAnonKey, supabaseServiceRoleKey as getSupabaseServiceRoleKey } from "@/lib/supabase/env";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { sanitizeNext } from "@/lib/sanitizeNext";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code  = searchParams.get("code");
  const next  = sanitizeNext(searchParams.get("next"));

  if (!code) return NextResponse.redirect(`${origin}/login?error=cancelled`);

  const cookieStore = await cookies();
  const supabase = createServerClient(
    getSupabaseUrl(),
    getSupabaseAnonKey(),
    {
      cookies: {
        getAll()      { return cookieStore.getAll(); },
        setAll(list: { name: string; value: string; options?: any }[]) {
          list.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        },
      },
    }
  );

  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error || !data.user) {
    console.error("[auth/callback]", error?.message);
    return NextResponse.redirect(`${origin}/login?error=auth`);
  }

  // ── Claim signup role (Google OAuth cookie) ──────────────────
  const signupRole = cookieStore.get("signup_role")?.value;
  if (signupRole && ["filmmaker", "producer"].includes(signupRole)) {
    await supabase.rpc("claim_signup_role", { desired_role: signupRole });
  }

  // ── Fetch profile for routing ────────────────────────────────
  const { data: profile } = await supabase
    .from("profiles")
    .select("role, approval_status")
    .eq("id", data.user.id)
    .single();

  const role      = (profile as any)?.role ?? "filmmaker";
  const approval  = (profile as any)?.approval_status ?? "approved";
  const isNewUser = (Date.now() - new Date(data.user.created_at).getTime()) < 120_000;

  // ── If caller specified a deep link and it's a returning user, honour it
  const defaultDests = ["/dashboard", "/producerstudio", "/admin", "/"];
  const hasDeepLink  = next && !defaultDests.includes(next) && !isNewUser;
  if (hasDeepLink) return NextResponse.redirect(`${origin}${next}`);

  // ── Route by role ────────────────────────────────────────────
  if (role === "admin")    return NextResponse.redirect(`${origin}/admin`);

  if (role === "producer") {
    if (isNewUser)                    return NextResponse.redirect(`${origin}/producerstudio/pending`);
    if (approval === "approved")      return NextResponse.redirect(`${origin}/producerstudio`);
    return NextResponse.redirect(`${origin}/producerstudio/pending`);
  }

  // filmmaker (default)
  if (isNewUser) return NextResponse.redirect(`${origin}/onboarding`);
  return NextResponse.redirect(`${origin}/dashboard`);
}
