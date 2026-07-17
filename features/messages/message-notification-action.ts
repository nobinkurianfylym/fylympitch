"use server";
// features/messages/message-notification-action.ts
//
// Sends an email notification to the conversation counterparty when a new
// message arrives.
//
// SECURITY
// --------
// A "use server" export is a public HTTP endpoint. Anyone can POST to it with
// any arguments — being called from our own client component proves nothing.
// This action reaches for the service-role client, so it must establish the
// caller's identity itself and derive everything else from the database.
//
// Therefore:
//   - the caller must be authenticated;
//   - the sender is auth.uid(), never a client-supplied id;
//   - the caller must actually be a participant in the conversation;
//   - the preview text is read back from the message row itself, after checking
//     that the row belongs to this conversation and was sent by the caller.
//     Client-supplied text would let anyone put arbitrary words into an email
//     we send under our own domain.
//
// Throttle: skips if the recipient read the conversation within the last
// 30 minutes — they are likely active and will see the message live.
// Never throws; all failures are logged and swallowed.

/** A one-to-one PostgREST embed arrives as an object or a single-element array
 *  depending on how the relationship is resolved. Normalise both. */
function one<T>(v: T | T[] | null | undefined): T | null {
  if (v == null) return null;
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

export async function notifyNewMessage({
  conversationId,
  messageId,
}: {
  conversationId: string;
  messageId: string;
}): Promise<void> {
  try {
    // ── 1. Who is actually calling? ────────────────────────────
    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;                       // unauthenticated — nothing to do

    const senderId = user.id;                // never trust a client-supplied id

    const { createAdminClient } = await import("@/lib/supabase/admin");
    const admin = createAdminClient();

    // ── 2. Fetch conversation + both party profiles ────────────
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
      .maybeSingle();

    if (convError || !conv) {
      console.error("[notify] conversation fetch failed:", convError?.message);
      return;
    }

    // ── 3. The caller must be in this conversation ─────────────
    // The admin client bypasses RLS, so this check is the only thing standing
    // between a stranger and an email sent to an arbitrary user.
    const senderIsProducer  = conv.producer_id  === senderId;
    const senderIsFilmmaker = conv.filmmaker_id === senderId;
    if (!senderIsProducer && !senderIsFilmmaker) {
      console.error("[notify] caller is not a participant:", { conversationId, senderId });
      return;
    }

    // ── 4. Read the preview back from the message itself ───────
    // Verifying it belongs to this conversation and to this sender closes the
    // last gap: without it, a participant could point the action at any row.
    const { data: msg } = await admin
      .from("messages")
      .select("message, attachment_name, sender_id, conversation_id, deleted_at")
      .eq("id", messageId)
      .maybeSingle();

    if (
      !msg ||
      msg.conversation_id !== conversationId ||
      msg.sender_id !== senderId ||
      msg.deleted_at !== null
    ) {
      console.error("[notify] message does not match caller/conversation:", { messageId });
      return;
    }

    const preview: string | null = msg.message ?? msg.attachment_name ?? null;

    // ── 5. Resolve recipient (the other party) ─────────────────
    const recipientId   = senderIsProducer ? conv.filmmaker_id : conv.producer_id;
    const recipientRole = senderIsProducer ? "filmmaker" : "producer";

    type Party = { id: string; full_name: string | null };
    const producerParty  = one<Party>(conv.producer  as any);
    const filmmakerParty = one<Party>(conv.filmmaker as any);

    const senderProfile    = senderIsProducer ? producerParty : filmmakerParty;
    const recipientProfile = recipientRole === "producer" ? producerParty : filmmakerParty;

    // ── 6. Throttle: skip if recipient was active in last 30 min ─
    const lastReadAt = recipientRole === "producer"
      ? conv.producer_last_read_at
      : conv.filmmaker_last_read_at;

    if (lastReadAt) {
      const thirtyMinsAgo = new Date(Date.now() - 30 * 60 * 1000);
      if (new Date(lastReadAt as string) > thirtyMinsAgo) return;
    }

    // ── 7. Get recipient email from auth.users (service role) ──
    const { data: userRecord, error: userError } =
      await admin.auth.admin.getUserById(recipientId);

    if (userError || !userRecord?.user?.email) {
      console.error("[notify] recipient email fetch failed:", userError?.message);
      return;
    }

    const recipientEmail = userRecord.user.email;
    const projectTitle   = one<{ title: string }>(conv.project as any)?.title ?? "Untitled Project";
    const siteUrl        = process.env.NEXT_PUBLIC_SITE_URL ?? "https://pitch.fylym.com";

    const conversationUrl = recipientRole === "producer"
      ? `${siteUrl}/producerstudio/messages?conv=${conversationId}`
      : `${siteUrl}/dashboard/messages?conv=${conversationId}`;

    // ── 8. Send ────────────────────────────────────────────────
    const { sendNewMessageNotification } = await import("@/lib/email");

    await sendNewMessageNotification({
      to:              recipientEmail,
      recipientName:   recipientProfile?.full_name ?? null,
      senderName:      senderProfile?.full_name ?? null,
      projectTitle,
      messagePreview:  preview,
      conversationUrl,
    });
  } catch (e) {
    // Never let notification failure surface to the user
    console.error("[notify] notifyNewMessage exception:", e);
  }
}
