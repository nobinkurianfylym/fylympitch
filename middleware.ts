import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { supabaseUrl, supabaseAnonKey } from "@/lib/supabase/env";

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;

  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    supabaseUrl(),
    supabaseAnonKey(),
    {
      cookies: {
        getAll() { return request.cookies.getAll(); },
        setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    }
  );

  const { data: { user }, error } = await supabase.auth.getUser();

  const isProtected =
    path.startsWith("/dashboard") ||
    path.startsWith("/admin") ||
    path.startsWith("/producerstudio") ||
    path.startsWith("/apply-packet");

  const isAuthPage = path === "/login" || path === "/signup";
  // Not logged in → login
  if (isProtected && (!user || error)) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", path);
    return NextResponse.redirect(url);
  }

  // Logged in but profile not completed → role-aware onboarding
  // Producers go to /producerstudio/onboarding, filmmakers to /onboarding
  if (user && !error && isProtected &&
      !path.startsWith("/onboarding") &&
      !path.startsWith("/producerstudio/onboarding")) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("profile_completed, role")
      .eq("id", user.id)
      .single();
    if (profile && profile.role !== "admin" && profile.profile_completed === false) {
      const url = request.nextUrl.clone();
      url.pathname = profile.role === "producer" ? "/producerstudio/onboarding" : "/onboarding";
      return NextResponse.redirect(url);
    }
  }

  // Logged-in user on auth page → send them to their intended destination.
  // This handles the homepage toggle: /login?next=/producerstudio goes to /producerstudio,
  // plain /login goes to /dashboard.
  if (isAuthPage && user && !error) {
    const rawNext = request.nextUrl.searchParams.get("next") ?? "";
    // Inline sanitize (edge-compatible — no Node.js APIs)
    const safe =
      rawNext.length > 0 &&
      rawNext.length <= 200 &&
      rawNext.startsWith("/") &&
      !rawNext.startsWith("//") &&
      !rawNext.startsWith("/login") &&
      !rawNext.startsWith("/signup") &&
      !rawNext.startsWith("/auth");
    const destination = safe ? rawNext : "/dashboard";
    const url = request.nextUrl.clone();
    url.search = "";
    url.pathname = destination;
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  // "/" is deliberately NOT here.
  //
  // This middleware exists to make auth decisions: redirect anonymous users
  // away from protected routes, push incomplete profiles into onboarding, and
  // bounce signed-in users off /login and /signup. The homepage triggers none
  // of those — isProtected and isAuthPage are both false for it — so the
  // supabase.auth.getUser() call above ran on every homepage request and the
  // result was thrown away.
  //
  // That call is a network round trip to Supabase Auth, which sits in another
  // region: measured at ~200ms, and it was the entire gap between the homepage
  // (~430ms) and /opportunities or /filmprojects (~215ms), neither of which is
  // matched here. The homepage calls getUser() itself for rendering, exactly
  // as those two pages already do.
  matcher: [
    "/dashboard/:path*",
    "/admin/:path*",
    "/producerstudio/:path*",
    "/producerstudio",
    "/apply-packet/:path*",
    "/onboarding",
    "/login",
    "/signup",
  ],
};
