// app/api/proofs/[proofId]/certificate/route.ts
// Returns a signed short-lived URL for downloading the .ots certificate
// Validates the requesting user owns the project

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";

export const runtime = "edge";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ proofId: string }> }
) {
  try {
    const { proofId } = await params;
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name) { return req.cookies.get(name)?.value; },
        },
      }
    );

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Fetch the proof and verify ownership
    const serviceSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: proof } = await serviceSupabase
      .from("project_proofs")
      .select(`
        id,
        ots_anchored_path,
        ots_pending_path,
        ots_status,
        projects!inner (owner_id)
      `)
      .eq("id", proofId)
      .single();

    if (!proof) {
      return NextResponse.json({ error: "Proof not found" }, { status: 404 });
    }

    const project = Array.isArray(proof.projects)
      ? proof.projects[0]
      : proof.projects;

    // Only the filmmaker who owns the project can download
    if (project.owner_id !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const path = proof.ots_anchored_path || proof.ots_pending_path;
    if (!path) {
      return NextResponse.json({ error: "Certificate not yet available" }, { status: 404 });
    }

    // Generate signed URL valid for 1 hour
    const { data: signedUrl, error } = await serviceSupabase.storage
      .from("proofs")
      .createSignedUrl(path, 3600);

    if (error || !signedUrl) {
      return NextResponse.json({ error: "Could not generate download URL" }, { status: 500 });
    }

    return NextResponse.json({
      url: signedUrl.signedUrl,
      status: proof.ots_status,
      filename: `fylym-proof-${proofId.slice(0, 8)}.ots`,
    });
  } catch (err) {
    console.error("[/api/proofs/certificate]", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
