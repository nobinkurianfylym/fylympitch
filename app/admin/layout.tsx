import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import Wordmark from "@/components/Wordmark";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/admin");

  // Server-side role check — never trust the client.
  const { data: me } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (me?.role !== "admin") redirect("/dashboard");

  const nav = [
    { href: "/admin", label: "Analytics" },
    { href: "/admin/users", label: "User management" },
    { href: "/admin/projects", label: "Project management" },
    { href: "/admin/opportunities", label: "Fund management" },
    { href: "/admin/certificates", label: "Certificates" },
    { href: "/admin/moderation", label: "Moderation" },
    { href: "/admin/audit", label: "Audit log" },
  ];

  return (
    <div className="min-h-screen md:flex bg-ivory">
      <aside className="md:w-60 md:min-h-screen border-b md:border-b-0 md:border-r border-line px-6 py-7 flex md:flex-col gap-6 md:gap-0 items-center md:items-start overflow-x-auto">
        <div className="flex items-center gap-3">
          <Link href="/"><Wordmark /></Link>
          <span className="eyebrow text-gold">Admin</span>
        </div>
        <nav className="flex md:flex-col gap-5 md:gap-0 md:mt-10 md:space-y-4 text-[12px] tracking-[0.16em] uppercase whitespace-nowrap">
          {nav.map((n) => (
            <Link key={n.href} href={n.href} className="text-ash hover:text-ink transition-colors">
              {n.label}
            </Link>
          ))}
        </nav>
        <Link href="/dashboard" className="md:mt-auto md:pt-12 ml-auto md:ml-0 text-[12px] tracking-[0.16em] uppercase text-ash hover:text-gold">
          Back to dashboard
        </Link>
      </aside>
      <main className="flex-1 px-6 md:px-12 py-10 max-w-5xl">{children}</main>
    </div>
  );
}
