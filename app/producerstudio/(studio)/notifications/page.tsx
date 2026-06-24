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

  // Fetch poster thumbnails for notifications that have a project_id
  const projectIds = (items ?? []).map((n: any) => n.project_id).filter(Boolean);
  const { data: projectData } = projectIds.length
    ? await supabase.from("projects").select("id, poster_path").in("id", projectIds)
    : { data: [] };
  const posterMap = new Map((projectData ?? []).map((p: any) => [p.id, p.poster_path]));

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;

  // Runtime link rewrite — catches any stale links already in the DB
  function safeLink(link: string | null): string | null {
    if (!link) return null;
    if (link === "/projects" || link === "/producer/projects") return "/producerstudio/projects";
    if (link.startsWith("/filmprojects/")) return link.replace("/filmprojects/", "/producerstudio/projects/");
    return link;
  }

  const unreadCount = (items ?? []).filter((n: any) => !n.read).length;
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
              <button className="btn-ghost !px-4 !py-2 text-[12px]">Mark all read</button>
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
        {(items ?? []).map((n: any) => {
          const posterPath = n.project_id ? posterMap.get(n.project_id) : null;
          const posterUrl = posterPath
            ? `${supabaseUrl}/storage/v1/object/public/thumbnails/${posterPath}`
            : null;

          const inner = (
            <div className={`hairline py-4 flex items-start gap-3 pr-10 group ${
              !n.read ? "border-l-2 border-gold pl-4 -ml-4" : ""
            }`}>
              {/* Poster thumbnail */}
              {posterUrl && (
                <div className="shrink-0 w-14 h-[3.5rem] rounded-[4px] overflow-hidden border border-line bg-parchment">
                  <img src={posterUrl} alt="" className="w-full h-full object-cover" />
                </div>
              )}

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[10px] tracking-[0.14em] uppercase text-ash">
                    {KIND_LABEL[n.kind] ?? n.kind}
                  </span>
                  {!n.read && <span className="w-1.5 h-1.5 rounded-full bg-gold shrink-0" />}
                </div>
                <p className={`text-[14px] group-hover:text-gold transition-colors ${
                  n.read ? "text-ash" : "text-ink font-normal"
                }`}>
                  {n.title}
                </p>
                {n.body && (
                  <p className="mt-1 text-[13px] text-ash">{n.body}</p>
                )}
              </div>

              <span className="text-[12px] text-ash whitespace-nowrap mt-0.5 shrink-0">
                {timeAgo(n.created_at)}
              </span>
            </div>
          );

          return (
            <div key={n.id} className="relative group">
              {safeLink(n.link) ? (
                <Link href={safeLink(n.link)!} className="block hover:no-underline">
                  {inner}
                </Link>
              ) : (
                inner
              )}

              {/* Delete button — outside the Link, absolutely positioned */}
              <div className="absolute top-4 right-0">
                <form action={deleteNotification}>
                  <input type="hidden" name="notification_id" value={n.id} />
                  <button
                    type="submit"
                    title="Delete"
                    className="w-8 h-8 flex items-center justify-center rounded text-[20px] leading-none text-ash/30 hover:text-red-600 hover:bg-red-50 transition-colors opacity-0 group-hover:opacity-100"
                  >
                    ×
                  </button>
                </form>
              </div>
            </div>
          );
        })}

        {(!items || items.length === 0) && (
          <p className="hairline py-10 text-[14px] text-ash">All quiet for now.</p>
        )}
      </div>
    </div>
  );
}
