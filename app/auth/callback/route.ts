import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  // `next` is where to redirect after successful login.
  // Sanitise it: must start with "/" and must NOT be /login, /signup or /auth/*
  // to avoid open-redirect and login loops.
  const rawNext = searchParams.get("next") ?? "/dashboard";
  const next =
    rawNext.startsWith("/") &&
    !rawNext.startsWith("/login") &&
    !rawNext.startsWith("/signup") &&
    !rawNext.startsWith("/auth")
      ? rawNext
      : "/dashboard";

  if (!code) {
    // No code in the URL — most likely the user cancelled the OAuth flow.
    return NextResponse.redirect(`${origin}/login?error=cancelled`);
  }

  const cookieStore = await cookies();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        },
      },
    }
  );

  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error || !data.user) {
    console.error("[auth/callback] exchangeCodeForSession error:", error?.message);
    return NextResponse.redirect(`${origin}/login?error=auth`);
  }

  // Check whether this user has completed onboarding. New users have
  // onboarded_at = null (existing users were back-filled in migration 008).
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("onboarded_at, role")
    .eq("id", data.user.id)
    .single();

  if (profileError && profileError.code !== "PGRST116") {
    // PGRST116 = row not found (race: trigger hasn't fired yet).
    // Any other DB error: log and fall through to dashboard safely.
    console.error("[auth/callback] profile fetch error:", profileError.message);
  }

  // New user: no profile row yet, or profile exists but onboarding not done.
  const isNewUser = !profile || profile.onboarded_at === null;

  if (isNewUser) {
    // Preserve ?next= so after onboarding we redirect to the right place.
    const onboardingUrl =
      next !== "/dashboard"
        ? `${origin}/onboarding?next=${encodeURIComponent(next)}`
        : `${origin}/onboarding`;
    return NextResponse.redirect(onboardingUrl);
  }

  return NextResponse.redirect(`${origin}${next}`);
}
