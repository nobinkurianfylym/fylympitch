import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Wordmark from "@/components/Wordmark";
import { signOut } from "@/lib/auth-actions";
import type { Profile } from "@/types";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (!user || authError) redirect("/login");

  // Parallel fetch — all three are independent once we have user.id
  const [
    { data: profile },
    { count: unread },
    { data: msgUnreadData },
  ] = await Promise.all([
    supabase.from("profiles").select("id, full_name, avatar_url, role, approval_status, company").eq("id", user.id).single<Profile>(),
    supabase.from("notifications").select("id", { count: "exact", head: true })
      .eq("user_id", user.id).eq("read", false),
    supabase.rpc("get_inbox_unread_count"),
  ]);

  const totalMsgUnread = (msgUnreadData as number | null) ?? 0;

  // Safe fallback if profile row is missing (trigger race or DB error).
  const role = profile?.role ?? "filmmaker";
  const isIndustry = role === "producer" || role === "investor" || role === "organization";



  // Primary nav
  const nav = [
    { href: "https://pitch.fylym.com/", label: "Home" },
    { href: "/dashboard",               label: "Dashboard" },
    { href: "/dashboard/projects",      label: "My Projects" },
    { href: "/dashboard/opportunities",label: "Opportunities" },
    { href: "/dashboard/applications", label: "Applications" },
    ...(isIndustry ? [{ href: "/producer", label: "Producer Studio" }] : []),
    { href: "/dashboard/messages",       label: `Messages${totalMsgUnread > 0 ? ` (${totalMsgUnread})` : ""}` },
    { href: "/dashboard/notifications",  label: `Notifications${(unread ?? 0) > 0 ? ` (${unread})` : ""}` },
    { href: "/dashboard/profile",      label: "Profile & Credits" },
    ...(role === "admin" ? [{ href: "/admin", label: "Admin" }] : []),
  ];

  // Secondary links — available to all users
  const secondaryNav = [
    { href: "/dashboard/saved", label: "Saved" },
    { href: "/projects", label: "Film showcase" },
  ];

  return (
    <div className="min-h-screen md:flex">
      <aside className="md:w-60 md:min-h-screen border-b md:border-b-0 md:border-r border-line px-6 py-7 flex md:flex-col gap-6 md:gap-0 items-center md:items-start overflow-x-auto">
        <div className="flex flex-col gap-1">
          <Wordmark href="/" />
          <span className="text-[10px] tracking-[0.22em] uppercase text-ash mt-1">Dashboard</span>
        </div>
        <nav className="flex md:flex-col gap-5 md:gap-0 md:mt-12 md:space-y-5 text-[12px] tracking-[0.16em] uppercase whitespace-nowrap">
          {nav.map((n) => (
            <Link key={n.href} href={n.href}
              className={`hover:text-ink transition-colors ${
                n.href === "/producer"
                  ? "text-gold hover:text-gold/80 font-medium"
                  : n.href === "/dashboard/notifications" && (unread ?? 0) > 0
                  ? "text-gold hover:text-gold/80"
                  : n.href === "/dashboard/messages" && totalMsgUnread > 0
                  ? "text-gold hover:text-gold/80"
                  : "text-ash"
              }`}>
              {n.label}
            </Link>
          ))}
        </nav>
        {/* Secondary nav — smaller, quieter */}
        <nav className="hidden md:flex md:flex-col md:mt-8 md:space-y-4 text-[11px] tracking-[0.16em] uppercase whitespace-nowrap">
          {secondaryNav.map((n) => (
            <Link key={n.href} href={n.href} className="text-ash/60 hover:text-ash transition-colors">
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="md:mt-auto md:pt-12 ml-auto md:ml-0 flex items-center gap-3">
          {/* Avatar circle */}
          <Link href="/dashboard/profile" className="shrink-0">
            <div className="w-8 h-8 rounded-full overflow-hidden bg-parchment border border-line flex items-center justify-center hover:border-gold transition-colors">
              {profile?.avatar_url ? (
                <img src={profile.avatar_url} alt={profile.full_name} className="w-full h-full object-cover" />
              ) : (
                <span className="font-display text-[11px] text-ash">
                  {(profile?.full_name ?? "?").split(" ").map((w: string) => w[0]).slice(0, 2).join("").toUpperCase()}
                </span>
              )}
            </div>
          </Link>
          <form action={signOut}>
            <button className="text-[12px] tracking-[0.16em] uppercase text-ash hover:text-gold">Sign out</button>
          </form>
        </div>
      </aside>
      <main className="flex-1 px-6 md:px-8 py-10">

        {children}
      </main>
    </div>
  );
}
