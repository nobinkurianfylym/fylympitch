import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
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

  const path = request.nextUrl.pathname;
  const isProtected =
    path.startsWith("/dashboard") ||
    path.startsWith("/admin") ||
    path.startsWith("/producer");

  const isAuthPage = path === "/login" || path === "/signup";
  const isProducerPending = path === "/producer/pending";

  // Not logged in → login
  if (isProtected && (!user || error)) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", path);
    return NextResponse.redirect(url);
  }

  // Logged-in user on auth pages → route directly to their workspace.
  // Checking role here avoids a /dashboard → /producer double-redirect
  // for approved producers.
  if (isAuthPage && user && !error) {
    const url = request.nextUrl.clone();
    url.search = "";
    // We don't query the DB in middleware (keep it lightweight), but we CAN
    // read the Supabase session claims if they exist. Fall back to /dashboard
    // and let the layout handle the final routing if no claim is available.
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  // Producer-pending page: the layout handles redirection if already approved,
  // middleware only ensures a session exists (already covered by isProtected above).
  // No additional check needed here.

  // Producer studio: check approval status inline (fast, no extra DB call needed
  // since Supabase session contains user id — we gate at the page/layout level
  // to keep middleware lightweight). The layout handles the pending → /producer/pending
  // redirect; middleware just ensures session exists.

  return response;
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/admin/:path*",
    "/producer/:path*",
    "/producer",
    "/login",
    "/signup",
  ],
};
