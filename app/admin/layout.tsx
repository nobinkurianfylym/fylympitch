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
    { href: "/admin/users", label: "Users" },
    { href: "/admin/opportunities", label: "Opportunities" },
    { href: "/admin/audit", label: "Audit log" },
  ];

  return (
    <div className="min-h-screen bg-ivory">
      <header className="border-b border-line bg-white/60">
        <div className="mx-auto max-w-6xl px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Link href="/"><Wordmark /></Link>
            <span className="eyebrow text-gold">Admin</span>
          </div>
          <nav className="flex items-center gap-5 text-sm font-light">
            {nav.map((n) => (
              <Link key={n.href} href={n.href} className="text-ash hover:text-ink transition-colors">
                {n.label}
              </Link>
            ))}
            <Link href="/dashboard" className="btn-ghost">Back to dashboard</Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-10">{children}</main>
    </div>
  );
}
