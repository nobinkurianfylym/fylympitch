"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export type BroadcastAudience = "all" | "filmmakers" | "producers";

async function currentUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

async function requireAdmin() {
  const { supabase, user } = await currentUser();
  if (!user) return { supabase, user: null, isAdmin: false as const };
  const { data: me } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  return { supabase, user, isAdmin: me?.role === "admin" };
}

/** Admin → send an announcement to all users or a segment. Announce-only. */
export async function sendBroadcast(input: {
  audience: BroadcastAudience;
  subject?: string;
  body: string;
}): Promise<{ ok: true; id: string; recipients: number } | { error: string }> {
  const { supabase, isAdmin } = await requireAdmin();
  if (!isAdmin) return { error: "Not authorized." };
  if (!input.body?.trim()) return { error: "Message body is required." };
  if (!["all", "filmmakers", "producers"].includes(input.audience)) {
    return { error: "Invalid audience." };
  }

  const { data: id, error } = await supabase.rpc("send_admin_broadcast", {
    p_audience: input.audience,
    p_subject: input.subject?.trim() || null,
    p_body: input.body.trim(),
  });
  if (error) return { error: error.message };

  // Read back the recipient count the RPC recorded.
  let recipients = 0;
  const { data: row } = await supabase
    .from("admin_broadcasts")
    .select("recipient_count")
    .eq("id", id as string)
    .single();
  if (row?.recipient_count != null) recipients = row.recipient_count;

  revalidatePath("/admin/messages");
  return { ok: true, id: id as string, recipients };
}

/** Admin → open (or find) the 1:1 support thread for a specific user. */
export async function openThread(
  userId: string,
): Promise<{ ok: true; threadId: string } | { error: string }> {
  const { supabase, isAdmin } = await requireAdmin();
  if (!isAdmin) return { error: "Not authorized." };
  if (!userId) return { error: "No user specified." };

  const { data: threadId, error } = await supabase.rpc("admin_open_thread", {
    p_user_id: userId,
  });
  if (error) return { error: error.message };
  revalidatePath("/admin/messages");
  return { ok: true, threadId: threadId as string };
}

/**
 * Post a message to an admin thread. Usable by an admin (any thread) OR by the
 * thread's own user (their reply) — the RPC authorizes; we only require auth.
 */
export async function sendAdminMessage(
  threadId: string,
  body: string,
): Promise<{ ok: true; id: string } | { error: string }> {
  const { supabase, user } = await currentUser();
  if (!user) return { error: "Not authenticated." };
  if (!body?.trim()) return { error: "Message body is required." };

  const { data: id, error } = await supabase.rpc("send_admin_message", {
    p_thread_id: threadId,
    p_body: body.trim(),
  });
  if (error) return { error: error.message };

  revalidatePath(`/admin/messages/${threadId}`);
  revalidatePath("/admin/messages");
  revalidatePath("/support");
  return { ok: true, id: id as string };
}

/** Mark a thread read for the caller (admin side or user side). */
export async function markThreadRead(
  threadId: string,
): Promise<{ ok: true } | { error: string }> {
  const { supabase, user } = await currentUser();
  if (!user) return { error: "Not authenticated." };
  const { error } = await supabase.rpc("mark_admin_thread_read", { p_thread_id: threadId });
  if (error) return { error: error.message };
  return { ok: true };
}
