import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import Wordmark from "@/components/Wordmark";
import { usd, STAGE_LABEL } from "@/lib/format";

export const dynamic = "force-dynamic";

const FORMATS = ["Feature", "Documentary", "Series", "Animation", "Short"];

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: Promise<{ format?: string }>;
}) {
  const { format } = await searchParams;
  const supabase = await createClient();

  // Require sign-in — public projects are readable by any authenticated user.
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/projects");

  let query = supabase
    .from("projects")
    .select("id, title, genre, format, stage, language, country, logline, funding_needed_usd")
    .eq("is_public", true)
    .order("created_at", { ascending: false })
    .limit(60);

  if (format) query = query.eq("format", format.toLowerCase());

  const { data: projects } = await query;

  return (
    <div className="min-h-screen bg-ivory">
      {/* Header */}
      <header className="border-b border-line">
        <div className="max-w-6xl mx-auto px-6 py-5 flex items-center justify-between">
          <Wordmark />
          <nav className="hidden md:flex items-center gap-8 text-[12px] tracking-[0.18em] uppercase font-[400] text-ash">
            <Link href="/#features" className="hover:text-ink transition-colors">Platform</Link>
            <Link href="/projects" className="text-ink">Projects</Link>
            <Link href="/#how" className="hover:text-ink transition-colors">How it works</Link>
          </nav>
          <div className="flex items-center gap-4">
            <Link href="/dashboard" className="text-[12px] tracking-[0.18em] uppercase hover:text-gold transition-colors">
              Dashboard
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-12">
        {/* Page header */}
        <div className="mb-10">
          <p className="eyebrow mb-3">Discover</p>
          <h1 className="font-display text-[38px] font-[400]">Projects</h1>
          <p className="mt-3 text-[15px] text-ash max-w-lg">
            Pitches submitted by filmmakers on FYLYMPITCH. Sign in to message a filmmaker or send a financing offer.
          </p>

          {/* Format filters */}
          <div className="mt-7 flex flex-wrap gap-2">
            <Link
              href="/projects"
              className={`text-[12px] tracking-[0.12em] uppercase rounded-full px-4 py-2 border transition-colors ${
                !format ? "bg-ink text-ivory border-ink" : "border-line text-ash hover:border-ink hover:text-ink"
              }`}
            >
              All formats
            </Link>
            {FORMATS.map((f) => (
              <Link
                key={f}
                href={`/projects?format=${f.toLowerCase()}`}
                className={`text-[12px] tracking-[0.12em] uppercase rounded-full px-4 py-2 border transition-colors ${
                  format?.toLowerCase() === f.toLowerCase()
                    ? "bg-ink text-ivory border-ink"
                    : "border-line text-ash hover:border-ink hover:text-ink"
                }`}
              >
                {f}
              </Link>
            ))}
          </div>
        </div>

        {/* Tile grid */}
        {(!projects || projects.length === 0) ? (
          <div className="py-24 text-center text-ash text-[15px]">
            No public projects yet{format ? ` in ${format}` : ""}.
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {projects.map((p) => (
              <Link
                key={p.id}
                href={`/projects/${p.id}`}
                className="group flex flex-col bg-white/70 border border-line rounded-card p-6 hover:border-gold hover:shadow-sm transition-all"
              >
                <p className="text-[11px] tracking-[0.24em] uppercase text-ash mb-2">
                  {p.genre} · {p.format.charAt(0).toUpperCase() + p.format.slice(1)} · {STAGE_LABEL[p.stage] ?? p.stage}
                </p>
                <h2 className="font-display text-[21px] font-[400] mb-3 group-hover:text-gold transition-colors">
                  {p.title}
                </h2>
                {p.logline && (
                  <p className="font-display italic text-[14px] leading-[1.55] text-ink/70 line-clamp-3 flex-1">
                    "{p.logline}"
                  </p>
                )}
                <div className="mt-5 pt-4 border-t border-line flex items-baseline justify-between text-[12px] text-ash">
                  <span>{p.country}{p.language ? ` · ${p.language}` : ""}</span>
                  {p.funding_needed_usd && (
                    <span className="text-gold font-[400]">Seeking {usd(p.funding_needed_usd)}</span>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
