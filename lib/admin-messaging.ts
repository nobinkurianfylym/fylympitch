"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { sendBroadcastEmail, type BroadcastAttachment } from "@/lib/email";

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
  /** When true, also fires a real email to each recipient via Resend. */
  sendEmail?: boolean;
  /** Public URLs in the broadcast-attachments bucket, uploaded by the composer. */
  attachments?: BroadcastAttachment[];
  /** Deliver a copy to the sending admin, who is otherwise excluded. */
  includeSelf?: boolean;
}): Promise<{ ok: true; id: string; recipients: number; emailsSent?: number; emailsFailed?: number } | { error: string }> {
  const { supabase, isAdmin } = await requireAdmin();
  if (!isAdmin) return { error: "Not authorized." };
  if (!input.body?.trim()) return { error: "Message body is required." };
  if (!["all", "filmmakers", "producers"].includes(input.audience)) {
    return { error: "Invalid audience." };
  }

  // Attachments ride along inside the body rather than in a new column: the
  // RPC fans out to notifications.body, and /support linkifies URLs, so the
  // files are reachable in-app with no schema change. The email gets the same
  // list as proper anchors (see sendBroadcastEmail).
  const files = (input.attachments ?? []).filter((f) => f?.url && f?.name);
  const bodyWithFiles = files.length
    ? `${input.body.trim()}\n\n${files.length === 1 ? "Attachment" : "Attachments"}:\n` +
      files.map((f) => `${f.name} — ${f.url}`).join("\n")
    : input.body.trim();

  const { data: id, error } = await supabase.rpc("send_admin_broadcast", {
    p_audience: input.audience,
    p_subject: input.subject?.trim() || null,
    p_body: bodyWithFiles,
    p_include_self: !!input.includeSelf,
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

  // Optionally send real emails via Resend.
  let emailsSent: number | undefined;
  let emailsFailed: number | undefined;
  if (input.sendEmail) {
    try {
      // Same SQL function the fan-out uses, so the email list and the in-app
      // list cannot disagree. This replaced a second, hand-written role filter
      // here that excluded 'organization' and did not exclude admins — one
      // action with two different definitions of its own audience.
      const { data: audience, error: audErr } = await supabase.rpc(
        "admin_broadcast_audience",
        { p_audience: input.audience, p_include_self: !!input.includeSelf },
      );
      if (audErr) throw new Error(audErr.message);

      const emailRecipients = ((audience ?? []) as any[])
        .filter((p) => !!p.email)
        .map((p) => ({ email: p.email as string, name: (p.full_name ?? null) as string | null }));

      const result = await sendBroadcastEmail({
        recipients: emailRecipients,
        subject: input.subject?.trim() || "A message from PITCH.FYLYM",
        // The un-appended body: the email renders attachments as its own
        // styled block, so repeating the raw URLs here would duplicate them.
        body: input.body.trim(),
        attachments: files,
      });
      emailsSent = result.sent;
      emailsFailed = result.failed;
    } catch (e) {
      console.error("[admin-messaging] email broadcast failed:", e);
      emailsFailed = recipients; // conservative — assume all failed
    }
  }

  revalidatePath("/admin/messages");
  return { ok: true, id: id as string, recipients, emailsSent, emailsFailed };
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
