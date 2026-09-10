"use server";

import { createClient } from "@/lib/supabase/server";

/** Persist a backfilled share card path. RLS ensures only the project owner
 *  (or admin) can update the row. */
export async function saveShareCard(
  projectId: string,
  cardPath: string,
): Promise<{ ok: true } | { error: string }> {
  if (!projectId || !cardPath) return { error: "missing args" };
  const supabase = await createClient();
  const { error } = await supabase
    .from("projects")
    .update({ share_card_path: cardPath })
    .eq("id", projectId);
  if (error) return { error: error.message };
  return { ok: true };
}
