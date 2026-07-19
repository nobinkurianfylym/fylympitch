import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import AdminChat, { type AdminChatMessage } from "@/components/AdminChat";

export const dynamic = "force-dynamic";

const ROLE_LABEL: Record<string, string> = {
  filmmaker: "Filmmaker",
  producer: "Producer",
  investor: "Investor",
  organization: "Organization",
};

export default async function AdminThreadPage({
  params,
}: {
  params: Promise<{ threadId: string }>;
}) {
  const { threadId } = await params;
  const supabase = await createClient();

  const { data: thread } = await supabase
    .from("admin_threads")
    .select("id, user_id, profiles:profiles!user_id(full_name, role, username)")
    .eq("id", threadId)
    .single();

  if (!thread) notFound();

  const { data: messages } = await supabase
    .from("admin_messages")
    .select("id, is_admin, body, sent_at")
    .eq("thread_id", threadId)
    .order("sent_at", { ascending: true })
    .limit(500);

  const u = (thread as any).profiles ?? {};

  return (
    <div>
      <Link
        href="/admin/messages"
        className="text-[12px] tracking-[0.16em] uppercase text-ash hover:text-gold"
      >
        ← Messages
      </Link>

      <div className="mt-4 mb-8 flex items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Direct conversation</p>
          <h1 className="font-display text-[28px] font-normal mt-1">{u.full_name ?? "User"}</h1>
          <p className="text-[12px] text-ash mt-1">
            {ROLE_LABEL[u.role] ?? u.role}
            {u.username ? ` · @${u.username}` : ""}
          </p>
        </div>
        <Link href={`/admin/users/${thread.user_id}`} className="btn-ghost">
          View profile
        </Link>
      </div>

      <div className="card p-6">
        <AdminChat
          threadId={threadId}
          viewerIsAdmin={true}
          initialMessages={(messages ?? []) as AdminChatMessage[]}
          emptyHint="No messages yet. Send the first message below."
        />
      </div>
    </div>
  );
}
