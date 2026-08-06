import { NextRequest, NextResponse } from "next/server";
import { supabaseUrl as getSupabaseUrl, supabaseAnonKey as getSupabaseAnonKey, supabaseServiceRoleKey as getSupabaseServiceRoleKey } from "@/lib/supabase/env";
import { createClient } from "@supabase/supabase-js";

/**
 * GET /api/autofill/context
 * Authorization: Bearer <supabase_access_token>
 *
 * Returns all filmmaker projects + all one_click opportunities with field maps.
 * Called by the PITCH.FYLYM Chrome extension to populate its local cache.
 *
 * CORS-enabled: the extension is a non-origin context.
 * No engine/matching/email imports — safe for Cloudflare Workers cold start.
 */

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

export async function GET(req: NextRequest) {
  // ── Auth ──────────────────────────────────────────────────────
  const bearer = req.headers.get("authorization") ?? "";
  const token  = bearer.startsWith("Bearer ") ? bearer.slice(7).trim() : "";
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: CORS });
  }

  // Verify token against Supabase (anon key + user JWT)
  const supabase = createClient(
    getSupabaseUrl(),
    getSupabaseAnonKey()
  );
  const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
  if (!user || authErr) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: CORS });
  }

  // ── Data ──────────────────────────────────────────────────────
  const [{ data: projects, error: projErr }, { data: opps, error: oppErr }] =
    await Promise.all([
      supabase
        .from("projects")
        .select(
          `id, title, logline, synopsis, director_statement,
           stage, genre, format, language, country,
           budget_usd, director_name, writer_name,
           has_coproducer, has_script_doc, has_budget_doc, has_lookbook`
        )
        .eq("owner_id", user.id)
        .order("created_at", { ascending: false }),

      supabase
        .from("opportunities")
        .select("id, title, form_url, form_field_map")
        .eq("apply_method", "one_click")
        .eq("is_active", true)
        .not("form_url", "is", null),
    ]);

  if (projErr || oppErr) {
    console.error("autofill context error", projErr ?? oppErr);
    return NextResponse.json(
      { error: "Failed to fetch data" },
      { status: 500, headers: CORS }
    );
  }

  return NextResponse.json(
    { projects: projects ?? [], opportunities: opps ?? [] },
    { headers: CORS }
  );
}
