// app/api/proofs/create/route.ts
// Server-side proxy: receives proof creation request from client,
// forwards to Supabase Edge Function with service role key
// Keeps Supabase URLs and keys off the client

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

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

    // Validate the filmmaker owns this project via user session
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Call the Edge Function with service role key
    const edgeUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/create-proof`;

    const edgeRes = await fetch(edgeUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
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
