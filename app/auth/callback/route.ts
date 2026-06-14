import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  const rawNext = searchParams.get("next") ?? "/dashboard";
  const next =
    rawNext.startsWith("/") &&
    !rawNext.startsWith("/login") &&
    !rawNext.startsWith("/signup") &&
    !rawNext.startsWith("/auth")
      ? rawNext
      : "/dashboard";

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
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        },
      },
    }
  );

  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error || !data.user) {
    console.error("[auth/callback] exchange error:", error?.message);
    return NextResponse.redirect(`${origin}/login?error=auth`);
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("onboarded_at, role, approval_status")
    .eq("id", data.user.id)
    .single();

  // New user — send through onboarding
  if (!profile || !profile.onboarded_at) {
    const dest = next !== "/dashboard"
      ? `${origin}/onboarding?next=${encodeURIComponent(next)}`
      : `${origin}/onboarding`;
    return NextResponse.redirect(dest);
  }

  // Approved producer → Producer Studio
  if (profile.role === "producer" && profile.approval_status === "approved") {
    return NextResponse.redirect(`${origin}/producer`);
  }

  // Pending producer → waiting room
  if (profile.role === "producer" && profile.approval_status === "pending") {
    return NextResponse.redirect(`${origin}/producer/pending`);
  }

  // Filmmaker / admin → requested destination or dashboard
  return NextResponse.redirect(`${origin}${next}`);
}
