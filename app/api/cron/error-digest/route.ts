import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { sendErrorDigestEmail } from "@/lib/email";

// Daily error digest.
//
// platform_errors has collected errors since migration 057 and /admin/errors
// displays them, but nothing ever told anyone. An outage was found by opening
// the admin page, or by a user saying something was broken.
//
// Called once a day by pg_cron. Reads the last 24 hours, groups identical
// messages, and emails every admin. Sends NOTHING when there are no errors --
// a mail that arrives every day saying "all fine" is a mail nobody opens, and
// then the one that matters is not read either.

export const dynamic = "force-dynamic";

/** Shared secret, set as CRON_SECRET in the Worker's environment. Without it
 *  this route is a public button that emails your admins on demand. */
function authorized(req: NextRequest): boolean {
  const expected = process.env.CRON_SECRET;
  if (!expected) return false;
  const got = req.headers.get("authorization") ?? "";
  return got === `Bearer ${expected}`;
}

export async function POST(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // Service client: platform_errors is admin-read under RLS, and this runs as
  // nobody. The route is already behind the shared secret.
  const admin = createServiceClient();
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const { data: rows, error } = await admin
    .from("platform_errors")
    .select("id, created_at, source, severity, message")
    .gte("created_at", since)
    .eq("resolved", false)
    .order("created_at", { ascending: false })
    .limit(500);

  if (error) {
    console.error("[error-digest] query failed:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const errors = rows ?? [];
  if (errors.length === 0) {
    return NextResponse.json({ sent: false, reason: "no unresolved errors in 24h" });
  }

  // Group identical source+message so 400 repeats of one fault read as one
  // line with a count, not 400 lines.
  const groups = new Map<string, { source: string; severity: string; message: string; count: number; last: string }>();
  for (const e of errors) {
    const key = `${e.source}|${e.message}`;
    const g = groups.get(key);
    if (g) {
      g.count += 1;
      if (e.created_at > g.last) g.last = e.created_at;
    } else {
      groups.set(key, {
        source: e.source ?? "unknown",
        severity: e.severity ?? "error",
        message: e.message ?? "(no message)",
        count: 1,
        last: e.created_at,
      });
    }
  }

  const summary = [...groups.values()].sort((a, b) => b.count - a.count);

  const { data: admins } = await admin
    .from("profiles").select("email, full_name").eq("role", "admin");

  const recipients = (admins ?? [])
    .map((a: { email?: string | null }) => (a.email ?? "").trim())
    .filter(Boolean);

  if (recipients.length === 0) {
    console.error("[error-digest] no admin email addresses on file");
    return NextResponse.json({ sent: false, reason: "no admin recipients" });
  }

  await sendErrorDigestEmail({ to: recipients, total: errors.length, groups: summary });

  return NextResponse.json({ sent: true, total: errors.length, distinct: summary.length });
}
