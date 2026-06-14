import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// UUID v4 regex — storage paths are always <uuid>/<timestamp>-<filename>
const PATH_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\//i;
const MAX_PATH_LEN = 512;

export async function GET(req: NextRequest) {
  const path = req.nextUrl.searchParams.get("path");

  // Validate before touching storage: must be present, sane length,
  // UUID-prefixed, and free of traversal characters.
  if (
    !path ||
    path.length > MAX_PATH_LEN ||
    path.includes("..") ||
    path.includes("\0") ||
    !PATH_RE.test(path)
  ) {
    return NextResponse.json({ error: "invalid path" }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  // Signed URL for 5 minutes — just long enough for PDF.js to fetch and render.
  // Storage RLS enforces that only the owner, approved industry or admin can
  // access files in the pitch-decks bucket; the anon-key client respects that.
  const { data, error } = await supabase.storage
    .from("pitch-decks")
    .createSignedUrl(path, 300);

  if (error || !data?.signedUrl) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  return NextResponse.json({ url: data.signedUrl });
}
