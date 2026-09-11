import { createClient } from "@/lib/supabase/server";
import { parseBroadcastBody } from "@/lib/broadcast-body";
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

/**
 * A broadcast's own text, then its attachments. Images render as images — a
 * poster is the message, and a raw storage URL is not something anyone reads.
 * Everything else stays a named link. URLs left inside the text are linkified
 * so a link an admin typed by hand still works.
 */
function BroadcastBody({ body }: { body: string | null }) {
  if (!body) return null;
  const { text, files } = parseBroadcastBody(body);
  const images = files.filter((f) => f.isImage);
  const others = files.filter((f) => !f.isImage);

  return (
    <>
      {text && (
        <p className="text-[14px] text-ink/80 mt-1 whitespace-pre-wrap leading-relaxed">
          {linkify(text)}
        </p>
      )}

      {images.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-3">
          {images.map((f) => (
            <a
              key={f.url}
              href={f.url}
              target="_blank"
              rel="noopener noreferrer"
              className="block rounded-card overflow-hidden border border-line hover:border-gold transition-colors"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={f.url}
                alt={f.name}
                loading="lazy"
                className="block max-h-[320px] w-auto object-contain bg-parchment"
              />
            </a>
          ))}
        </div>
      )}

      {others.length > 0 && (
        <ul className="mt-4 space-y-1.5">
          {others.map((f) => (
            <li key={f.url}>
              <a
                href={f.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-[13px] text-ink hover:text-gold transition-colors"
              >
                <span className="text-gold">◆</span>
                <span className="underline underline-offset-2 decoration-ash/40">{f.name}</span>
              </a>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

/**
 * Bare URLs inside the message text are not clickable in pre-wrapped text.
 * Split on http(s) runs and render those as links; everything else stays plain
 * text, so nothing in a message is ever interpreted as markup.
 */
function linkify(text: string): React.ReactNode[] {
  return text.split(/(https?:\/\/[^\s]+)/g).map((part, i) =>
    /^https?:\/\//.test(part) ? (
      <a
        key={i}
        href={part}
        target="_blank"
        rel="noopener noreferrer"
        className="text-gold underline underline-offset-2 break-all hover:text-ink transition-colors"
      >
        {part}
      </a>
    ) : (
      part
    ),
  );
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
      .select("*")
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
                    <span className="text-[11px] text-ash shrink-0">
                      {fmtDate(a.created_at)}
                      {/* Recipients read one version and may now be reading
                          another. Say so rather than rewriting it silently. */}
                      {(a as any).edited_at && <span className="text-gold"> · Edited</span>}
                    </span>
                  </div>
                  <BroadcastBody body={a.body} />
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
