import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          // Write cookies to the request first (makes them readable in SSR)
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          // Then rebuild the response and set on it so the browser receives them
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Refresh the session (extends expiry, rotates token if needed).
  // getUser() is the authoritative check — never rely on the session object alone.
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;

  // Routes that require a valid session
  const isProtected =
    path.startsWith("/dashboard") ||
    path.startsWith("/admin") ||
    path.startsWith("/onboarding");

  // Routes that authenticated users shouldn't linger on
  const isAuthPage = path === "/login" || path === "/signup";

  // If session is broken / expired and we're on a protected route,
  // redirect to login and carry the attempted path so we can return after re-auth.
  if (isProtected && (!user || error)) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    // Don't propagate /onboarding as a ?next= target — that causes a loop
    // where a stale-session user keeps bouncing back to onboarding.
    loginUrl.searchParams.set(
      "next",
      path.startsWith("/onboarding") ? "/dashboard" : path
    );
    loginUrl.search = loginUrl.search; // keep existing params
    return NextResponse.redirect(loginUrl);
  }

  // Authenticated users don't need to see login/signup — send them home.
  // Exception: if they're mid-onboarding they're already handled above.
  if (isAuthPage && user && !error) {
    const dashUrl = request.nextUrl.clone();
    dashUrl.pathname = "/dashboard";
    dashUrl.search = "";
    return NextResponse.redirect(dashUrl);
  }

  return response;
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/admin/:path*",
    "/onboarding/:path*",
    "/onboarding",
    "/login",
    "/signup",
  ],
};
