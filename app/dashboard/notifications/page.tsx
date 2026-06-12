import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { timeAgo } from "@/lib/format";
import { markAllRead } from "@/lib/actions";

export const dynamic = "force-dynamic";

export default async function NotificationsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: items } = await supabase
    .from("notifications").select("*").eq("user_id", user!.id)
    .order("created_at", { ascending: false }).limit(50);

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
      <div className="mt-10">
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
