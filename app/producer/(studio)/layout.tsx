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
  const [{ data: profile }, { data: producerProfile }] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, full_name, avatar_url")   // only what the sidebar needs
      .eq("id", user.id)
      .single(),
    supabase
      .from("producer_profiles")
      .select("user_id")
      .eq("user_id", user.id)
      .single(),
  ]);

  if (!profile) redirect("/dashboard");
  if (!producerProfile) redirect("/producer/onboarding");

  const nav = [
    { href: "/producer",          label: "Discover",     icon: "ti-compass" },
    { href: "/producer/pipeline", label: "Pipeline",     icon: "ti-layout-kanban" },
    { href: "/producer/projects", label: "All projects", icon: "ti-stack-2" },
    { href: "/producer/meetings", label: "Meetings",     icon: "ti-calendar" },
    { href: "/producer/notes",    label: "Notes",        icon: "ti-notes" },
    { href: "/producer/profile",  label: "My profile",   icon: "ti-user" },
  ];

  return (
    <div className="min-h-screen md:flex bg-ivory">
      <aside className="md:w-56 md:min-h-screen border-b md:border-b-0 md:border-r border-line px-5 py-7 flex md:flex-col gap-6 md:gap-0 items-center md:items-start overflow-x-auto bg-ivory">
        <div className="flex flex-col gap-1 w-full">
          <Wordmark href="/" />
          <span className="text-[10px] tracking-[0.22em] uppercase text-ash mt-1">Producer Studio</span>
        </div>

        <nav className="flex md:flex-col gap-4 md:gap-0 md:mt-10 md:space-y-1 w-full">
          {nav.map((n) => (
            <Link key={n.href} href={n.href}
              className="flex items-center gap-3 px-3 py-2.5 rounded-card text-[13px] text-ash hover:text-ink hover:bg-parchment transition-colors">
              <i className={`ti ${n.icon}`} style={{ fontSize: 16 }} aria-hidden="true" />
              {n.label}
            </Link>
          ))}
        </nav>

        <div className="md:mt-auto md:pt-8 ml-auto md:ml-0 flex flex-col gap-3 w-full">
          <Link href="/dashboard" className="text-[12px] tracking-[0.14em] uppercase text-ash hover:text-ink transition-colors px-3">
            Filmmaker view
          </Link>
          <form action={signOut} className="px-3">
            <button className="text-[12px] tracking-[0.14em] uppercase text-ash hover:text-gold">Sign out</button>
          </form>
        </div>
      </aside>

      <main className="flex-1 min-w-0">
        {children}
      </main>
    </div>
  );
}
