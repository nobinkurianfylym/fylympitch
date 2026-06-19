import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import MessagesClient from "@/components/MessagesClient";

export const dynamic = "force-dynamic";

export default async function ProducerMessagesPage({
  searchParams,
}: {
  searchParams: Promise<{ conv?: string }>;
}) {
  const { conv: initialConvId } = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/producer/messages");

  const [{ data: me }, { data: myParticipations }] = await Promise.all([
    supabase.from("profiles").select("id, full_name, role, company").eq("id", user.id).single(),
    supabase.from("conversation_participants").select("conversation_id, unread_count")
      .eq("user_id", user.id).is("archived_at", null),
  ]);

  const convIds = (myParticipations ?? []).map((p) => p.conversation_id);

  let conversations: any[] = [];
  if (convIds.length) {
    const { data: convs } = await supabase
      .from("conversations")
      .select(`
        id, last_message_at, last_message_text, last_message_sender, project_id,
        conversation_participants (
          user_id,
          profiles:user_id ( id, full_name, role, company )
        )
      `)
      .in("id", convIds)
      .order("last_message_at", { ascending: false });

    const unreadMap = new Map((myParticipations ?? []).map((p) => [p.conversation_id, p.unread_count]));

    conversations = (convs ?? []).map((c) => {
      const other = (c.conversation_participants ?? []).find(
        (cp: any) => cp.user_id !== user.id
      );
      return {
        ...c,
        other_user: other?.profiles ?? null,
        unread_count: unreadMap.get(c.id) ?? 0,
      };
    });
  }

  return (
    <MessagesClient
      currentUser={me}
      initialConversations={conversations}
      initialConvId={initialConvId ?? null}
    />
  );
}
