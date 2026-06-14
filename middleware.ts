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
    path.startsWith("/onboarding") ||
    path.startsWith("/producer");

  const isAuthPage = path === "/login" || path === "/signup";
  const isProducerPending = path === "/producer/pending";

  // Not logged in → login
  if (isProtected && (!user || error)) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", path.startsWith("/onboarding") ? "/dashboard" : path);
    return NextResponse.redirect(url);
  }

  // Logged-in user on auth pages → home
  if (isAuthPage && user && !error) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    url.search = "";
    return NextResponse.redirect(url);
  }

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
    "/onboarding/:path*",
    "/onboarding",
    "/producer/:path*",
    "/producer",
    "/login",
    "/signup",
  ],
};
