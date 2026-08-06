// app/api/proofs/create/route.ts
// Server-side proxy: receives proof creation request from client,
// forwards to Supabase Edge Function with service role key.
// Keeps Supabase service key off the client.

import { NextRequest, NextResponse } from "next/server";
import { supabaseUrl as getSupabaseUrl, supabaseAnonKey as getSupabaseAnonKey, supabaseServiceRoleKey as getSupabaseServiceRoleKey } from "@/lib/supabase/env";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";

export const runtime = "edge";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { project_id, sha256_hash, file_name, proof_type, version } = body;

    if (!project_id || !sha256_hash) {
      return NextResponse.json(
        { error: "project_id and sha256_hash required" },
        { status: 400 }
      );
    }

    // ── Auth: verify session cookie ───────────────────────────────────────────
    const supabaseAnon = createServerClient(
      getSupabaseUrl(),
      getSupabaseAnonKey(),
      {
        cookies: {
          get(name) {
            return req.cookies.get(name)?.value;
          },
        },
      }
    );

    const { data: { user }, error: authError } = await supabaseAnon.auth.getUser();
    if (!user || authError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // ── Ownership: verify this user owns the project ──────────────────────────
    const serviceSupabase = createClient(
      getSupabaseUrl(),
      getSupabaseServiceRoleKey()
    );

    const { data: project } = await serviceSupabase
      .from("projects")
      .select("id, owner_id")
      .eq("id", project_id)
      .single();

    if (!project || project.owner_id !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // ── Forward to Edge Function ──────────────────────────────────────────────
    const edgeUrl = `${getSupabaseUrl()}/functions/v1/create-proof`;

    const edgeRes = await fetch(edgeUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${getSupabaseServiceRoleKey()}`,
      },
      body: JSON.stringify({ project_id, sha256_hash, file_name, proof_type, version }),
    });

    const data = await edgeRes.json();

    if (!edgeRes.ok) {
      return NextResponse.json(data, { status: edgeRes.status });
    }

    return NextResponse.json(data);
  } catch (err) {
    console.error("[/api/proofs/create]", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
