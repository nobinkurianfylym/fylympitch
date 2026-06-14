import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  const path = req.nextUrl.searchParams.get("path");
  if (!path) return NextResponse.json({ error: "missing path" }, { status: 400 });

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  // Only the project owner should be able to trigger thumbnail extraction.
  // We sign for 5 minutes — just long enough for PDF.js to fetch and render.
  const { data, error } = await supabase.storage
    .from("pitch-decks")
    .createSignedUrl(path, 300);

  if (error || !data?.signedUrl) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ url: data.signedUrl });
}
