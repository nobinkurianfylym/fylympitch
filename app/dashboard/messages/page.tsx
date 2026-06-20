import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import InboxShell from "@/features/messages/InboxShell";
import { toConversationListItem } from "@/features/messages/message.utils";
import type { ConversationRow } from "@/features/messages/message.types";

export const dynamic = "force-dynamic";

export default async function MessagesPage({
  searchParams,
}: {
  searchParams: Promise<{ conv?: string }>;
}) {
  const { conv: initialConvId } = await searchParams;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/dashboard/messages");

  const { data: rows } = await supabase
    .from("conversations")
    .select(`
      id,
      project_id,
      producer_id,
      filmmaker_id,
      last_message,
      last_message_at,
      producer_last_read_at,
      filmmaker_last_read_at,
      conversation_type,
      created_at,
      updated_at,
      project:projects!conversations_project_id_fkey(title),
      producer:profiles!conversations_producer_id_fkey(id, full_name, company, avatar_url),
      filmmaker:profiles!conversations_filmmaker_id_fkey(id, full_name, company, avatar_url)
    `)
    .or(`producer_id.eq.${user.id},filmmaker_id.eq.${user.id}`)
    .order("last_message_at", { ascending: false, nullsFirst: false });

  const conversations = ((rows ?? []) as unknown as ConversationRow[]).map((row) =>
    toConversationListItem(row, user.id)
  );

  return (
    // Escape the dashboard layout's px-6 md:px-8 py-10 padding
    <div className="-mx-6 md:-mx-8 -my-10">
      <InboxShell
        currentUserId={user.id}
        initialConversations={conversations}
        initialConversationId={initialConvId ?? null}
        inboxPath="/dashboard/messages"
      />
    </div>
  );
}
