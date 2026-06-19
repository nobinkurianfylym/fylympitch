export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { sanitizeNext } from "@/lib/sanitizeNext";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = sanitizeNext(searchParams.get("next"));

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=cancelled`);
  }

  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll(cookiesToSet: { name: string; value: string; options?: any }[]) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        },
      },
    }
  );

  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error || !data.user) {
    console.error("[auth/callback] exchange error:", error?.message);
    return NextResponse.redirect(`${origin}/login?error=auth`);
  }

  // ── Role claim for Google OAuth signups ──────────────────────
  // If the user selected a role before the Google redirect, a short-lived
  // 'signup_role' cookie was set client-side. We claim it here via a
  // security-definer RPC (bypasses the "no self-promote" RLS check),
  // but the RPC itself only acts within 5 minutes of account creation.
  const signupRole = cookieStore.get("signup_role")?.value;
  if (signupRole && ["filmmaker", "producer"].includes(signupRole)) {
    await supabase.rpc("claim_signup_role", { desired_role: signupRole });
    // Clear the cookie
    cookieStore.set("signup_role", "", { maxAge: 0, path: "/" });
  }

  return NextResponse.redirect(`${origin}${next}`);
}
