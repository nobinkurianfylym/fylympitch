import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { timeAgo } from "@/lib/format";
import { markAllRead, deleteNotification, deleteAllNotifications } from "@/lib/auth-actions";

export const dynamic = "force-dynamic";

const KIND_LABEL: Record<string, string> = {
  new_project:    "New project",
  producer_match: "New match",
  system:         "System",
  offer_update:   "Offer",
};

export default async function ProducerNotificationsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: items } = await supabase
    .from("notifications")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(60);

  const unreadCount = (items ?? []).filter((n) => !n.read).length;
  const hasAny = (items ?? []).length > 0;

  return (
    <div className="px-6 md:px-8 py-10">
      {/* ── Header ── */}
      <div className="flex items-end justify-between mb-6">
        <div>
          <p className="eyebrow mb-3">Inbox</p>
          <h1 className="font-display text-[34px]">Notifications</h1>
          {unreadCount > 0 && (
            <p className="text-[13px] text-ash mt-1">{unreadCount} unread</p>
          )}
        </div>
      </div>

      {/* ── Bulk actions bar ── */}
      {hasAny && (
        <div className="flex items-center gap-3 mb-8">
          {unreadCount > 0 && (
            <form action={markAllRead}>
              <button className="btn-ghost !px-4 !py-2 text-[12px]">
                Mark all read
              </button>
            </form>
          )}
          <form action={deleteAllNotifications}>
            <button className="btn-ghost !px-4 !py-2 text-[12px] hover:!border-red-300 hover:!text-red-600">
              Delete all
            </button>
          </form>
        </div>
      )}

      {/* ── List ── */}
      <div>
        {(items ?? []).map((n) => (
          <div
            key={n.id}
            className={`hairline py-5 flex items-start justify-between gap-4 group ${
              !n.read ? "border-l-2 border-gold pl-4 -ml-4" : ""
            }`}
          >
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[10px] tracking-[0.14em] uppercase text-ash">
                  {KIND_LABEL[n.kind] ?? n.kind}
                </span>
                {!n.read && (
                  <span className="w-1.5 h-1.5 rounded-full bg-gold shrink-0" />
                )}
              </div>
              <p className={`text-[14px] ${n.read ? "text-ash" : "text-ink font-normal"}`}>
                {n.title}
              </p>
              {n.body && (
                <p className="mt-1 text-[13px] text-ash">{n.body}</p>
              )}
              {n.link && (
                <Link
                  href={n.link}
                  className="mt-2 inline-block text-[12px] tracking-[0.14em] uppercase text-gold hover:text-ink transition-colors"
                >
                  View →
                </Link>
              )}
            </div>

            {/* Timestamp + delete */}
            <div className="flex items-center gap-3 shrink-0 mt-0.5">
              <span className="text-[12px] text-ash whitespace-nowrap">
                {timeAgo(n.created_at)}
              </span>
              <form action={deleteNotification}>
                <input type="hidden" name="notification_id" value={n.id} />
                <button
                  type="submit"
                  title="Delete"
                  className="w-8 h-8 flex items-center justify-center rounded text-[20px] leading-none text-ash/50 hover:text-red-600 hover:bg-red-50 transition-colors"
                >
                  ×
                </button>
              </form>
            </div>
          </div>
        ))}

        {(!items || items.length === 0) && (
          <p className="hairline py-10 text-[14px] text-ash">All quiet for now.</p>
        )}
      </div>
    </div>
  );
}
