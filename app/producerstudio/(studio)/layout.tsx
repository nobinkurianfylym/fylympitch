import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Wordmark from "@/components/Wordmark";
import { signOut } from "@/lib/auth-actions";

export const dynamic = "force-dynamic";

export default async function ProducerStudioLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (!user || authError) redirect("/login");

  // Parallelise — saves one sequential round-trip on every producer page load
  const [{ data: profile }, { data: producerProfile }, { count: unreadNotif }, { data: msgUnreadData }] = await Promise.all([
    supabase.from("profiles").select("id, full_name, avatar_url, role").eq("id", user.id).single(),
    supabase.from("producer_profiles").select("user_id").eq("user_id", user.id).single(),
    supabase.from("notifications").select("id", { count: "exact", head: true })
      .eq("user_id", user.id).eq("read", false),
    supabase.rpc("get_inbox_unread_count"),
  ]);

  const totalMsgUnread = (msgUnreadData as number | null) ?? 0;

  if (!profile) redirect("/dashboard");

  // Only producers and admins may access Producer Studio
  const role = (profile as any).role ?? "filmmaker";
  if (role !== "producer" && role !== "admin") redirect("/dashboard");

  if (!producerProfile) redirect("/producerstudio/onboarding");

  const nav = [
    { href: "https://pitch.fylym.com/", label: "Home" },
    { href: "/producerstudio",                        label: "Discover" },
    { href: "/producerstudio/pipeline",               label: "Pipeline" },
    { href: "/producerstudio/projects",               label: "All Projects" },
    { href: "/producerstudio/create-opportunity",     label: "Create an Opportunity" },
    { href: "/producerstudio/my-opportunities",       label: "My Opportunities" },
    { href: "/producerstudio/meetings",               label: "Meetings & Notes" },
    { href: "/producerstudio/messages",               label: totalMsgUnread > 0 ? `Messages (${totalMsgUnread})` : "Messages" },
    { href: "/producerstudio/notifications",          label: (unreadNotif ?? 0) > 0 ? `Notifications (${unreadNotif})` : "Notifications" },
    { href: "/producerstudio/profile",                label: "My Profile" },
  ];

  return (
    <div className="min-h-screen md:flex bg-ivory">
      <aside className="md:w-60 md:min-h-screen border-b md:border-b-0 md:border-r border-line px-6 py-7 flex md:flex-col gap-6 md:gap-0 items-center md:items-start overflow-x-auto bg-ivory">
        <div className="flex flex-col gap-1">
          <Wordmark href="/" />
          <span className="text-[10px] tracking-[0.22em] uppercase text-ash mt-1">Producer Studio</span>
        </div>

        <nav className="flex md:flex-col gap-5 md:gap-0 md:mt-12 md:space-y-5 text-[12px] tracking-[0.16em] uppercase whitespace-nowrap">
          {nav.map((n) => (
            <Link key={n.href} href={n.href}
              className={`transition-colors ${
                n.href === "/producerstudio/create-opportunity"
                  ? "text-gold hover:text-gold/80 border border-gold/40 px-2 py-1 rounded-sm -mx-2 -my-0.5"
                  : n.href === "/producerstudio/notifications" && (unreadNotif ?? 0) > 0
                  ? "text-gold hover:text-gold/80 hover:text-ink"
                  : n.href === "/producerstudio/messages" && totalMsgUnread > 0
                  ? "text-gold hover:text-gold/80 hover:text-ink"
                  : "text-ash hover:text-ink"
              }`}>
              {n.label}
            </Link>
          ))}
        </nav>

        <div className="md:mt-auto md:pt-12 ml-auto md:ml-0 flex items-center gap-3">
          {/* Avatar circle */}
          <Link href="/producerstudio/profile" className="shrink-0">
            <div className="w-8 h-8 rounded-full overflow-hidden bg-parchment border border-line flex items-center justify-center hover:border-gold transition-colors">
              {(profile as any)?.avatar_url ? (
                <img src={(profile as any).avatar_url} alt={(profile as any).full_name ?? ""} className="w-full h-full object-cover" />
              ) : (
                <span className="font-display text-[11px] text-ash">
                  {((profile as any)?.full_name ?? "?").split(" ").map((w: string) => w[0]).slice(0, 2).join("").toUpperCase()}
                </span>
              )}
            </div>
          </Link>
          <form action={signOut}>
            <button className="text-[12px] tracking-[0.16em] uppercase text-ash hover:text-gold">Sign out</button>
          </form>
        </div>
      </aside>

      <main className="flex-1 min-w-0">
        {children}
      </main>
    </div>
  );
}
