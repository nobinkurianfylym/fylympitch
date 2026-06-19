import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { timeAgo } from "@/lib/format";
import { markAllRead } from "@/lib/auth-actions";

export const dynamic = "force-dynamic";

export default async function NotificationsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const [{ data: items }, { data: profile }] = await Promise.all([
    supabase.from("notifications").select("*").eq("user_id", user!.id)
      .order("created_at", { ascending: false }).limit(50),
    supabase.from("profiles").select("full_name, country, bio, company, website, imdb_url").eq("id", user!.id).single(),
  ]);

  const completionFields = [profile?.full_name, profile?.country, profile?.bio, profile?.company, (profile as any)?.website || (profile as any)?.imdb_url];
  const completion = Math.round((completionFields.filter(Boolean).length / completionFields.length) * 100);

  return (
    <div>
      <div className="flex items-end justify-between">
        <div>
          <p className="eyebrow mb-3">Inbox</p>
          <h1 className="font-display text-[34px]">Notifications</h1>
        </div>
        <form action={markAllRead}>
          <button className="btn-ghost !px-5 !py-2.5">Mark all read</button>
        </form>
      </div>

      {/* Profile completion nudge — shown until 70% */}
      {completion < 70 && (
        <Link href="/dashboard/profile"
          className="flex items-center gap-4 py-4 px-5 card hover:border-gold transition-colors mt-8">
          <div className="flex-1 min-w-0">
            <p className="text-[13px] text-ink font-medium">Complete your profile</p>
            <p className="text-[12px] text-ash mt-0.5">A fuller profile unlocks better matches — {completion}% done.</p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <div className="w-20 h-[3px] bg-line rounded-full overflow-hidden">
              <div className="h-full bg-gold rounded-full" style={{ width: `${completion}%` }} />
            </div>
            <span className="text-[11px] tracking-[0.2em] uppercase text-ash">{completion}%</span>
          </div>
        </Link>
      )}

      <div className="mt-8">
        {(items ?? []).map((n) => (
          <div key={n.id} className="hairline py-5 flex justify-between gap-6">
            <div className="text-[14px] min-w-0">
              <span className={n.read ? "text-ash" : "font-normal"}>{n.title}</span>
              {n.body && <p className="mt-1 text-ash">{n.body}</p>}
              {n.link && <Link href={n.link} className="mt-1 inline-block text-[12px] tracking-[0.14em] uppercase text-gold hover:text-ink">Open →</Link>}
            </div>
            <span className="text-[12px] text-ash shrink-0">{timeAgo(n.created_at)}</span>
          </div>
        ))}
        {(!items || items.length === 0) && <p className="hairline py-10 text-[14px] text-ash">All quiet for now.</p>}
      </div>
    </div>
  );
}
