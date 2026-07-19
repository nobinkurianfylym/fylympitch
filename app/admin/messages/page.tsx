import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import BroadcastComposer from "./BroadcastComposer";

export const dynamic = "force-dynamic";

const ROLE_LABEL: Record<string, string> = {
  filmmaker: "Filmmaker",
  producer: "Producer",
  investor: "Investor",
  organization: "Organization",
};

const AUDIENCE_LABEL: Record<string, string> = {
  all: "Everyone",
  filmmakers: "Filmmakers",
  producers: "Producers",
};

function timeAgo(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso).getTime();
  const s = Math.floor((Date.now() - d) / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const days = Math.floor(h / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

export default async function AdminMessages() {
  const supabase = await createClient();

  const [threadsRes, broadcastsRes] = await Promise.all([
    supabase
      .from("admin_threads")
      .select(
        "id, user_id, last_message, last_message_at, last_sender_is_admin, admin_last_read_at, profiles:profiles!user_id(full_name, role, avatar_url, username)",
      )
      .order("last_message_at", { ascending: false, nullsFirst: false })
      .limit(100),
    supabase
      .from("admin_broadcasts")
      .select("id, audience, subject, body, recipient_count, created_at")
      .order("created_at", { ascending: false })
      .limit(15),
  ]);

  const threads = (threadsRes.data ?? []) as any[];
  const broadcasts = (broadcastsRes.data ?? []) as any[];

  return (
    <div>
      <div>
        <p className="eyebrow">Messages</p>
        <h1 className="font-display text-[30px] font-normal mt-1">Messages</h1>
        <p className="text-[13px] text-ash mt-2 max-w-xl leading-relaxed">
          Broadcast announcements to every user or a segment, or hold a direct conversation with an
          individual. Start a direct conversation from any user&rsquo;s profile.
        </p>
      </div>

      <div className="mt-8">
        <BroadcastComposer />
      </div>

      {/* ── Direct conversations ─────────────────────────────── */}
      <div className="mt-12">
        <p className="eyebrow">Direct conversations</p>
        <div className="card mt-4 divide-y divide-line">
          {threads.length === 0 ? (
            <p className="px-5 py-6 text-[13px] text-ash">
              No direct conversations yet. Open a user&rsquo;s profile and choose &ldquo;Message&rdquo; to
              start one.
            </p>
          ) : (
            threads.map((t) => {
              const u = t.profiles ?? {};
              const unread =
                t.last_message_at &&
                t.last_sender_is_admin === false &&
                (!t.admin_last_read_at || t.last_message_at > t.admin_last_read_at);
              const initials = (u.full_name ?? "?")
                .split(" ")
                .map((w: string) => w[0])
                .filter(Boolean)
                .join("")
                .slice(0, 2)
                .toUpperCase();
              return (
                <Link
                  key={t.id}
                  href={`/admin/messages/${t.id}`}
                  className="px-5 py-4 flex items-center gap-3 group"
                >
                  {u.avatar_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={u.avatar_url}
                      alt=""
                      className="w-9 h-9 rounded-full object-cover border border-line shrink-0"
                    />
                  ) : (
                    <div className="w-9 h-9 rounded-full border border-line bg-parchment flex items-center justify-center text-[11px] text-ash shrink-0">
                      {initials}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="font-normal text-ink group-hover:text-gold transition-colors flex items-center gap-2">
                      {u.full_name ?? "Unnamed"}
                      <span className="text-[10px] tracking-[0.14em] uppercase text-ash">
                        {ROLE_LABEL[u.role] ?? u.role}
                      </span>
                      {unread ? (
                        <span className="w-2 h-2 rounded-full bg-gold shrink-0" aria-label="Unread" />
                      ) : null}
                    </p>
                    <p className="text-[12px] text-ash truncate">
                      {t.last_sender_is_admin ? "You: " : ""}
                      {t.last_message ?? "No messages yet"}
                    </p>
                  </div>
                  <span className="text-[11px] text-ash shrink-0">{timeAgo(t.last_message_at)}</span>
                </Link>
              );
            })
          )}
        </div>
      </div>

      {/* ── Broadcast history ────────────────────────────────── */}
      <div className="mt-12">
        <p className="eyebrow">Recent broadcasts</p>
        <div className="card mt-4 divide-y divide-line">
          {broadcasts.length === 0 ? (
            <p className="px-5 py-6 text-[13px] text-ash">No broadcasts sent yet.</p>
          ) : (
            broadcasts.map((b) => (
              <div key={b.id} className="px-5 py-4">
                <div className="flex items-center justify-between gap-4">
                  <p className="font-normal text-ink">{b.subject ?? "A message from PITCH.FYLYM"}</p>
                  <span className="text-[11px] text-ash shrink-0">{timeAgo(b.created_at)}</span>
                </div>
                <p className="text-[13px] text-ash mt-1 line-clamp-2 leading-relaxed">{b.body}</p>
                <p className="text-[10px] tracking-[0.14em] uppercase text-ash mt-2">
                  {AUDIENCE_LABEL[b.audience] ?? b.audience} · {b.recipient_count.toLocaleString()}{" "}
                  {b.recipient_count === 1 ? "recipient" : "recipients"}
                </p>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
