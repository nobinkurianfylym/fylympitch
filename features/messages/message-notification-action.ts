"use server";
// features/messages/message-notification-action.ts
//
// Fire-and-forget server action: sends an email notification to the
// conversation counterparty when a new message arrives.
//
// Throttle: skips if the recipient read the conversation within the last
// 30 minutes — they're likely active and will see the message live.
// Never throws; all failures are logged and swallowed.

export async function notifyNewMessage({
  conversationId,
  senderId,
  messageText,
}: {
  conversationId: string;
  senderId: string;
  messageText: string | null;
}): Promise<void> {
  try {
    const { createAdminClient } = await import("@/lib/supabase/admin");
    const admin = createAdminClient();

    // ── Fetch conversation + both party profiles ───────────────
    const { data: conv, error: convError } = await admin
      .from("conversations")
      .select(`
        id,
        producer_id,
        filmmaker_id,
        producer_last_read_at,
        filmmaker_last_read_at,
        project:projects!project_id(title),
        producer:profiles!producer_id(id, full_name),
        filmmaker:profiles!filmmaker_id(id, full_name)
      `)
      .eq("id", conversationId)
      .single();

    if (convError || !conv) {
      console.error("[notify] conversation fetch failed:", convError?.message);
      return;
    }

    // ── Resolve recipient (not the sender) ────────────────────
    const senderIsProducer = conv.producer_id === senderId;
    const recipientId      = senderIsProducer ? conv.filmmaker_id : conv.producer_id;
    const recipientRole    = senderIsProducer ? "filmmaker" : "producer";

    const senderProfile    = senderIsProducer
      ? (conv.producer as { id: string; full_name: string | null } | null)
      : (conv.filmmaker as { id: string; full_name: string | null } | null);

    const recipientProfile = recipientRole === "producer"
      ? (conv.producer  as { id: string; full_name: string | null } | null)
      : (conv.filmmaker as { id: string; full_name: string | null } | null);

    // ── Throttle: skip if recipient was active in last 30 min ─
    const lastReadAt = recipientRole === "producer"
      ? conv.producer_last_read_at
      : conv.filmmaker_last_read_at;

    if (lastReadAt) {
      const thirtyMinsAgo = new Date(Date.now() - 30 * 60 * 1000);
      if (new Date(lastReadAt as string) > thirtyMinsAgo) {
        // Recipient read recently — they're likely online. Skip.
        return;
      }
    }

    // ── Get recipient email from auth.users (service role) ────
    const { data: userRecord, error: userError } =
      await admin.auth.admin.getUserById(recipientId);

    if (userError || !userRecord?.user?.email) {
      console.error("[notify] recipient email fetch failed:", userError?.message);
      return;
    }

    const recipientEmail = userRecord.user.email;
    const projectTitle   = (conv.project as { title: string } | null)?.title ?? "Untitled Project";
    const siteUrl        = process.env.NEXT_PUBLIC_SITE_URL ?? "https://pitch.fylym.com";

    const conversationUrl = recipientRole === "producer"
      ? `${siteUrl}/producerstudio/messages?conv=${conversationId}`
      : `${siteUrl}/dashboard/messages?conv=${conversationId}`;

    // ── Send ──────────────────────────────────────────────────
    const { sendNewMessageNotification } = await import("@/lib/email");

    await sendNewMessageNotification({
      to:              recipientEmail,
      recipientName:   recipientProfile?.full_name ?? null,
      senderName:      senderProfile?.full_name ?? null,
      projectTitle,
      messagePreview:  messageText,
      conversationUrl,
    });
  } catch (e) {
    // Never let notification failure surface to the user
    console.error("[notify] notifyNewMessage exception:", e);
  }
}
