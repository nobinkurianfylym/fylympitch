import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import AdminChat, { type AdminChatMessage } from "@/components/AdminChat";

export const dynamic = "force-dynamic";

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default async function SupportPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/support");

  const [threadRes, announceRes] = await Promise.all([
    supabase.from("admin_threads").select("id").eq("user_id", user.id).maybeSingle(),
    supabase
      .from("notifications")
      .select("id, title, body, created_at")
      .eq("user_id", user.id)
      .eq("kind", "admin_broadcast")
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  const thread = threadRes.data as { id: string } | null;
  const announcements = (announceRes.data ?? []) as any[];

  let messages: AdminChatMessage[] = [];
  if (thread?.id) {
    const { data } = await supabase
      .from("admin_messages")
      .select("id, is_admin, body, sent_at")
      .eq("thread_id", thread.id)
      .order("sent_at", { ascending: true })
      .limit(500);
    messages = (data ?? []) as AdminChatMessage[];
  }

  return (
    <div className="min-h-screen bg-ivory px-6 md:px-12 py-10">
      <div className="max-w-2xl mx-auto">
        <Link
          href="/dashboard"
          className="text-[12px] tracking-[0.16em] uppercase text-ash hover:text-gold"
        >
          ← Dashboard
        </Link>

        <div className="mt-4 mb-8">
          <p className="eyebrow text-gold">PITCH.FYLYM</p>
          <h1 className="font-display text-[30px] font-normal mt-1">Messages from the team</h1>
          <p className="text-[13px] text-ash mt-2 leading-relaxed">
            Announcements and direct messages from the PITCH.FYLYM team.
          </p>
        </div>

        {/* ── Announcements ──────────────────────────────────── */}
        {announcements.length > 0 && (
          <div className="mb-10">
            <p className="eyebrow">Announcements</p>
            <div className="card mt-4 divide-y divide-line">
              {announcements.map((a) => (
                <div key={a.id} className="px-5 py-4">
                  <div className="flex items-center justify-between gap-4">
                    <p className="font-normal text-ink">{a.title}</p>
                    <span className="text-[11px] text-ash shrink-0">{fmtDate(a.created_at)}</span>
                  </div>
                  {a.body && (
                    <p className="text-[14px] text-ink/80 mt-1 whitespace-pre-wrap leading-relaxed">
                      {a.body}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Direct conversation ────────────────────────────── */}
        <p className="eyebrow">Conversation</p>
        <div className="card mt-4 p-6">
          {thread?.id ? (
            <AdminChat threadId={thread.id} viewerIsAdmin={false} initialMessages={messages} />
          ) : (
            <p className="text-[13px] text-ash py-6 text-center">
              No direct messages yet. If the PITCH.FYLYM team reaches out, the conversation will
              appear here and you&rsquo;ll be able to reply.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
