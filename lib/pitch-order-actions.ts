"use server";
// lib/pitch-order-actions.ts
//
// Admin pinning and ordering of pitches (projects.admin_rank, migration 100).
// RLS ("owner update project" allows is_admin()) and the guard trigger are what
// authorise every write; assertAdmin here is so the UI gets a sentence back
// rather than a silent no-op.

import { createClient } from "@/lib/supabase/server";
import { revalidatePath, revalidateTag } from "next/cache";

async function assertAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in.", supabase: null, userId: null };
  const { data: me } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (me?.role !== "admin") return { error: "Admins only.", supabase: null, userId: null };
  return { error: null, supabase, userId: user.id };
}

const STEP = 10;

/** Every surface that lists pitches in this order. */
function refresh() {
  revalidateTag("projects", { expire: 0 });
  revalidatePath("/admin/projects/order");
  revalidatePath("/admin/projects");
  revalidatePath("/filmprojects");
  revalidatePath("/producerstudio/projects");
  revalidatePath("/dashboard/discover");
}

async function audit(supabase: any, userId: string, action: string, projectId: string) {
  // Same shape as adminToggleProjectVisibility. Never allowed to fail the change.
  const { error } = await supabase.from("audit_logs").insert({
    actor_id: userId, action, target: "project", target_id: projectId,
  });
  if (error) console.error("[pitch-order] audit log failed:", error.message);
}

/** Pin a pitch to the bottom of the pinned list. */
export async function pinPitch(projectId: string): Promise<{ error?: string }> {
  const { error, supabase, userId } = await assertAdmin();
  if (error || !supabase || !userId) return { error: error ?? "Admins only." };
  if (!projectId) return { error: "No project given." };

  const { data: last } = await supabase
    .from("projects")
    .select("admin_rank")
    .not("admin_rank", "is", null)
    .order("admin_rank", { ascending: false })
    .limit(1)
    .maybeSingle();
  const next = ((last?.admin_rank as number | null) ?? 0) + STEP;

  const { error: upErr } = await supabase.from("projects").update({ admin_rank: next }).eq("id", projectId);
  if (upErr) return { error: upErr.message };

  await audit(supabase, userId, "pitch_pinned", projectId);
  refresh();
  return {};
}

/** Return a pitch to the normal newest-first order. */
export async function unpinPitch(projectId: string): Promise<{ error?: string }> {
  const { error, supabase, userId } = await assertAdmin();
  if (error || !supabase || !userId) return { error: error ?? "Admins only." };
  if (!projectId) return { error: "No project given." };

  const { error: upErr } = await supabase.from("projects").update({ admin_rank: null }).eq("id", projectId);
  if (upErr) return { error: upErr.message };

  await audit(supabase, userId, "pitch_unpinned", projectId);
  refresh();
  return {};
}

/** What follows the pinned pitches: newest first, or most liked first. */
export async function setPitchOrderMode(mode: string): Promise<{ error?: string }> {
  const { error, supabase, userId } = await assertAdmin();
  if (error || !supabase || !userId) return { error: error ?? "Admins only." };
  if (mode !== "newest" && mode !== "likes") return { error: "Unknown order." };

  const { error: upErr } = await supabase
    .from("pitch_order_config")
    .upsert({ id: true, mode, updated_at: new Date().toISOString(), updated_by: userId }, { onConflict: "id" });
  if (upErr) return { error: upErr.message };

  const { error: logErr } = await supabase.from("audit_logs").insert({
    actor_id: userId, action: mode === "likes" ? "pitch_order_likes" : "pitch_order_newest",
    target: "pitch_order_config", target_id: null,
  });
  if (logErr) console.error("[pitch-order] audit log failed:", logErr.message);

  refresh();
  return {};
}

/** Save the pinned list in the given order: first id is shown first. */
export async function reorderPinnedPitches(ids: string[]): Promise<{ error?: string }> {
  const { error, supabase, userId } = await assertAdmin();
  if (error || !supabase || !userId) return { error: error ?? "Admins only." };
  if (!Array.isArray(ids) || ids.length === 0) return {};

  // Only rows that are pinned now, so a stale or malformed list cannot pin
  // something the admin did not pin.
  const { data: pinned } = await supabase.from("projects").select("id").not("admin_rank", "is", null);
  const allowed = new Set((pinned ?? []).map((r: any) => r.id));
  const clean = ids.filter((id) => allowed.has(id));
  if (clean.length === 0) return {};

  for (let i = 0; i < clean.length; i++) {
    const { error: upErr } = await supabase
      .from("projects")
      .update({ admin_rank: (i + 1) * STEP })
      .eq("id", clean[i]);
    if (upErr) return { error: upErr.message };
  }

  await audit(supabase, userId, "pitches_reordered", clean[0]);
  refresh();
  return {};
}
