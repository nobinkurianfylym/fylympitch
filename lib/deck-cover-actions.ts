"use server";

import { createClient } from "@/lib/supabase/server";

/** Persist a backfilled deck cover path. RLS ensures only the project owner
 * (or admin) can update the row. */
export async function saveDeckCover(
  projectId: string,
  coverPath: string,
): Promise<{ ok: true } | { error: string }> {
  if (!projectId || !coverPath) return { error: "missing args" };
  const supabase = await createClient();
  const { error } = await supabase
    .from("projects")
    .update({ deck_cover_path: coverPath })
    .eq("id", projectId);
  if (error) return { error: error.message };
  return { ok: true };
}
