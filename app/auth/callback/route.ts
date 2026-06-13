import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Roles a user can request via "?role=" on /login or /signup (e.g. the
// homepage's "I'm a producer / investor" links). Only applied when the
// signed-in profile is still the default 'filmmaker' — handle_new_user()
// creates every account as 'filmmaker' first, regardless of provider.
const ASSIGNABLE_ROLES = new Set(["producer", "investor", "organization"]);

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";
  const requestedRole = searchParams.get("role");

  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      if (requestedRole && ASSIGNABLE_ROLES.has(requestedRole) && data.user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", data.user.id)
          .single();
        if (profile?.role === "filmmaker") {
          await supabase
            .from("profiles")
            .update({ role: requestedRole, approval_status: "pending" })
            .eq("id", data.user.id);
        }
      }
      return NextResponse.redirect(`${origin}${next.startsWith("/") ? next : "/dashboard"}`);
    }
  }
  return NextResponse.redirect(`${origin}/login?error=auth`);
}
