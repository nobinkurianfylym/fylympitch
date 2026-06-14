import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Wordmark from "@/components/Wordmark";
import { signOut } from "@/lib/actions";
import type { Profile } from "@/types";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single<Profile>();
  const role = profile?.role ?? "filmmaker";
  const isIndustry = role === "producer" || role === "investor" || role === "organization";

  const { count: unread } = await supabase
    .from("notifications").select("id", { count: "exact", head: true })
    .eq("user_id", user.id).eq("read", false);

  const nav = [
    { href: "/dashboard", label: "Overview" },
    ...(!isIndustry ? [
      { href: "/dashboard/projects", label: "My projects" },
      { href: "/dashboard/opportunities", label: "Opportunities" },
      { href: "/dashboard/applications", label: "Applications" },
      { href: "/dashboard/saved", label: "Saved" },
    ] : [
      { href: "/dashboard/discover", label: "Discover projects" },
      { href: "/dashboard/opportunities", label: "Opportunities" },
    ]),
    { href: "/projects", label: "Projects showcase" },
    { href: "/dashboard/notifications", label: `Notifications${unread ? ` (${unread})` : ""}` },
    { href: "/dashboard/profile", label: "Profile" },
    ...(role === "admin" ? [{ href: "/admin", label: "Admin" }] : []),
  ];

  return (
    <div className="min-h-screen md:flex">
      <aside className="md:w-60 md:min-h-screen border-b md:border-b-0 md:border-r border-line px-6 py-7 flex md:flex-col gap-6 md:gap-0 items-center md:items-start overflow-x-auto">
        <Wordmark href="/dashboard" />
        <nav className="flex md:flex-col gap-5 md:gap-0 md:mt-12 md:space-y-5 text-[12px] tracking-[0.16em] uppercase whitespace-nowrap">
          {nav.map((n) => (
            <Link key={n.href} href={n.href} className="text-ash hover:text-ink transition-colors">
              {n.label}
            </Link>
          ))}
        </nav>
        <form action={signOut} className="md:mt-auto md:pt-12 ml-auto md:ml-0">
          <button className="text-[12px] tracking-[0.16em] uppercase text-ash hover:text-gold">Sign out</button>
        </form>
      </aside>
      <main className="flex-1 px-6 md:px-12 py-10 max-w-5xl">
        {isIndustry && profile?.approval_status === "pending" && (
          <div className="mb-8 card border-gold/50 bg-gold/5 px-5 py-4 text-[14px]">
            <span className="font-normal">Verification in progress.</span>{" "}
            <span className="text-ash">Your {role} account is being reviewed. You'll be able to view projects and send offers once approved — usually within 48 hours.</span>
          </div>
        )}
        {children}
      </main>
    </div>
  );
}
