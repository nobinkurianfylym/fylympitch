import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { timeAgo } from "@/lib/format";
import { markAllRead, deleteNotification, deleteAllNotifications } from "@/lib/auth-actions";

export const dynamic = "force-dynamic";

const KIND_META: Record<string, { label: string; dot: string }> = {
  producer_interest:  { label: "Producer Interest", dot: "bg-gold" },
  offer_received:     { label: "Offer",             dot: "bg-emerald-500" },
  match_found:        { label: "New Match",         dot: "bg-blue-500" },
  application_update: { label: "Application",       dot: "bg-violet-500" },
  system:             { label: "System",            dot: "bg-ash" },
};

export default async function NotificationsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const [{ data: items }, { data: profile }] = await Promise.all([
    supabase
      .from("notifications")
      .select("*")
      .eq("user_id", user!.id)
      .order("created_at", { ascending: false })
      .limit(80),
    supabase
      .from("profiles")
      .select("full_name, country, bio, company, website, imdb_url")
      .eq("id", user!.id)
      .single(),
  ]);

  // Fetch poster thumbnails for notifications that have a project_id
  const projectIds = (items ?? []).map((n: any) => n.project_id).filter(Boolean);
  const { data: projectData } = projectIds.length
    ? await supabase.from("projects").select("id, poster_path").in("id", projectIds)
    : { data: [] };
  const posterMap = new Map((projectData ?? []).map((p: any) => [p.id, p.poster_path]));

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;

  const completionFields = [
    profile?.full_name, profile?.country, profile?.bio,
    profile?.company, (profile as any)?.website || (profile as any)?.imdb_url,
  ];
  const completion = Math.round(
    (completionFields.filter(Boolean).length / completionFields.length) * 100
  );

  const unreadCount = (items ?? []).filter((n: any) => !n.read).length;
  const hasAny      = (items ?? []).length > 0;

  // Runtime link rewrite — catches any stale links already in the DB
  function safeLink(link: string | null): string | null {
    if (!link) return null;
    if (link === "/projects" || link === "/producer/projects") return "/dashboard/projects";
    if (link.startsWith("/filmprojects/")) return link.replace("/filmprojects/", "/dashboard/projects/");
    return link;
  }

  return (
    <div>
      {/* ── Header ── */}
      <div className="flex items-end justify-between">
        <div>
          <p className="eyebrow mb-3">Inbox</p>
          <h1 className="font-display text-[34px]">
            Notifications
            {unreadCount > 0 && (
              <span className="ml-3 align-middle text-[14px] font-normal bg-gold text-white px-3 py-1 rounded-full">
                {unreadCount} new
              </span>
            )}
          </h1>
        </div>
      </div>

      {/* ── Bulk actions bar ── */}
      {hasAny && (
        <div className="flex items-center gap-3 mt-6">
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

      {/* ── Profile completion nudge ── */}
      {completion < 70 && (
        <Link
          href="/dashboard/profile"
          className="flex items-center gap-4 py-4 px-5 card hover:border-gold transition-colors mt-8"
        >
          <div className="flex-1 min-w-0">
            <p className="text-[13px] text-ink font-medium">Complete your profile</p>
            <p className="text-[12px] text-ash mt-0.5">
              A fuller profile unlocks better matches — {completion}% done.
            </p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <div className="w-20 h-[3px] bg-line rounded-full overflow-hidden">
              <div className="h-full bg-gold rounded-full" style={{ width: `${completion}%` }} />
            </div>
            <span className="text-[11px] tracking-[0.2em] uppercase text-ash">{completion}%</span>
          </div>
        </Link>
      )}

      {/* ── List ── */}
      <div className="mt-8 divide-y divide-line">
        {(items ?? []).map((n: any) => {
          const meta = KIND_META[n.kind] ?? KIND_META.system;
          const isUnread = !n.read;
          const posterPath = n.project_id ? posterMap.get(n.project_id) : null;
          const posterUrl = posterPath
            ? `${supabaseUrl}/storage/v1/object/public/thumbnails/${posterPath}`
            : null;

          // Inner row — shared between linked and plain variants
          const inner = (
            <div className={`py-4 flex items-start gap-3 pr-10 ${
              isUnread ? "bg-parchment/60 -mx-3 px-3 rounded-card" : ""
            }`}>
              {/* Unread dot */}
              <div className="mt-2.5 shrink-0 w-2">
                <span className={`block w-2 h-2 rounded-full ${isUnread ? meta.dot : "bg-transparent"}`} />
              </div>

              {/* Poster thumbnail */}
              {posterUrl && (
                <div className="shrink-0 w-14 h-[3.5rem] rounded-[4px] overflow-hidden border border-line bg-parchment">
                  <img src={posterUrl} alt="" className="w-full h-full object-cover" />
                </div>
              )}

              {/* Content */}
              <div className="flex-1 min-w-0">
                <p className="text-[10px] tracking-[0.18em] uppercase text-ash mb-1">{meta.label}</p>
                <p className={`text-[14px] leading-snug group-hover:text-gold transition-colors ${
                  isUnread ? "text-ink font-medium" : "text-ash"
                }`}>
                  {n.title}
                </p>
                {n.body && (
                  <p className="mt-1 text-[13px] text-ash leading-relaxed">{n.body}</p>
                )}
              </div>

              {/* Timestamp */}
              <span className="text-[12px] text-ash whitespace-nowrap mt-1 shrink-0">
                {timeAgo(n.created_at)}
              </span>
            </div>
          );

          return (
            // Wrapper: relative so the delete button can be abs-positioned outside the Link
            <div key={n.id} className="relative group">
              {safeLink(n.link) ? (
                <Link href={safeLink(n.link)!} className="block hover:no-underline">
                  {inner}
                </Link>
              ) : (
                inner
              )}

              {/* Delete button — absolutely positioned, never inside the Link */}
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
          <p className="py-10 text-[14px] text-ash">All quiet for now.</p>
        )}
      </div>
    </div>
  );
}
