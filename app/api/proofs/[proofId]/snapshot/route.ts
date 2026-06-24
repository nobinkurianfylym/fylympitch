// app/api/proofs/[proofId]/snapshot/route.ts
// Serves the stored project snapshot JSON for independent verification
// Auth required — filmmaker only

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export const runtime = "edge";

export async function GET(
  req: NextRequest,
  { params }: { params: { proofId: string } }
) {
  try {
    const cookieStore = cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { get(name) { return cookieStore.get(name)?.value; } } }
    );

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const serviceSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Verify ownership
    const { data: proof } = await serviceSupabase
      .from("project_proofs")
      .select("id, proof_type, sha256_hash, projects!inner(owner_id, title)")
      .eq("id", params.proofId)
      .single();

    if (!proof) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const project = Array.isArray(proof.projects) ? proof.projects[0] : proof.projects;
    if (project.owner_id !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (proof.proof_type !== "snapshot") {
      return NextResponse.json({ error: "Not a snapshot proof" }, { status: 400 });
    }

    // Fetch snapshot JSON from storage
    const snapshotPath = `${(proof as any).project_id}/${proof.id}/snapshot.json`;
    const { data, error } = await serviceSupabase.storage
      .from("proofs")
      .download(snapshotPath);

    if (error || !data) {
      return NextResponse.json({ error: "Snapshot not available" }, { status: 404 });
    }

    const text = await data.text();

    return new NextResponse(text, {
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="fylym-snapshot-${proof.id.slice(0, 8)}.json"`,
      },
    });
  } catch (err) {
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
