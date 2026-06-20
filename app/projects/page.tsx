import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import Wordmark from "@/components/Wordmark";
import ProjectThumbnail from "@/components/ProjectThumbnail";
import LoveButton from "@/components/LoveButton";
import ShareButton from "@/components/ShareButton";
import SearchInput from "@/components/SearchInput";
import { usd } from "@/lib/format";

export const dynamic = "force-dynamic";

const FORMATS = ["Feature", "Documentary", "Series", "Animation"];

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: Promise<{ format?: string; q?: string }>;
}) {
  const { format, q } = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  let dashboardHref = "/dashboard";
  if (user) {
    const { data: me } = await supabase.from("profiles").select("role").eq("id", user.id).single();
    if ((me as any)?.role === "producer") dashboardHref = "/producer";
  }
  const dashboardLabel = dashboardHref === "/producer" ? "Producer Studio" : "Dashboard";

  let query = supabase
    .from("projects")
    .select("id, title, genre, format, stage, language, country, logline, funding_needed_usd, poster_path, love_count, owner_id, filmmaker:profiles!projects_owner_id_fkey(full_name, career_stage)")
    .eq("is_public", true)
    .order("created_at", { ascending: false })
    .limit(60);

  if (format) query = query.eq("format", format.toLowerCase());
  if (q?.trim()) query = (query as any).or(`title.ilike.%${q.trim()}%,logline.ilike.%${q.trim()}%`);

  const { data: projects } = await query;

  const lovedSet = new Set<string>();
  if (user && projects?.length) {
    const { data: loves } = await supabase
      .from("project_loves").select("project_id")
      .eq("user_id", user.id)
      .in("project_id", projects.map((p: any) => p.id));
    (loves ?? []).forEach((l: any) => lovedSet.add(l.project_id));
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const CAREER_LABEL: Record<string, string> = {
    debut: "Debut", second_film: "2nd Film", established: "Established", veteran: "Veteran",
  };

  return (
    <div className="min-h-screen bg-ivory">

      {/* ── NAV ── */}
      <header className="border-b border-line">
        <div className="max-w-[1180px] mx-auto px-6 py-5 flex items-center justify-between">
          <Wordmark />
          <nav className="hidden md:flex items-center gap-8 text-[12px] tracking-[0.18em] uppercase font-[400] text-ash">
            <Link href="/#features" className="hover:text-ink transition-colors">Platform</Link>
            <Link href="/projects"  className="text-ink">Projects</Link>
            <Link href="/funds"     className="hover:text-ink transition-colors">Funds</Link>
          </nav>
          <div className="flex items-center gap-3">
            {user ? (
              <Link href={dashboardHref} className="text-[12px] tracking-[0.18em] uppercase hover:text-gold transition-colors">{dashboardLabel}</Link>
            ) : (
              <Link href="/login" className="btn-outline !px-5 !py-2.5 !text-[11px]">Get started</Link>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-[1180px] mx-auto px-6 py-12">
        <div className="mb-10">
          <p className="eyebrow mb-3">Discover</p>
          <h1 className="font-display text-[38px] font-[400]">Projects</h1>
          <p className="mt-3 text-[15px] text-ash max-w-lg">
            Pitches submitted by filmmakers on PITCH.FYLYM — open for producers, investors and collaborators to discover.
          </p>

          {/* Format filters + search bar */}
          <div className="mt-7 flex flex-wrap gap-2 items-center">
            <Link
              href={`/projects${q ? `?q=${encodeURIComponent(q)}` : ""}`}
              className={`text-[12px] tracking-[0.12em] uppercase rounded-full px-4 py-2 border transition-colors ${
                !format ? "bg-ink text-ivory border-ink" : "border-line text-ash hover:border-ink hover:text-ink"
              }`}>
              All formats
            </Link>
            {FORMATS.map((f) => (
              <Link
                key={f}
                href={`/projects?format=${f.toLowerCase()}${q ? `&q=${encodeURIComponent(q)}` : ""}`}
                className={`text-[12px] tracking-[0.12em] uppercase rounded-full px-4 py-2 border transition-colors ${
                  format?.toLowerCase() === f.toLowerCase()
                    ? "bg-ink text-ivory border-ink"
                    : "border-line text-ash hover:border-ink hover:text-ink"
                }`}>
                {f}
              </Link>
            ))}

            {/* Search bar — right side */}
            <div className="ml-auto">
              <SearchInput placeholder="Search projects…" basePath="/projects" />
            </div>
          </div>

          {q && (
            <p className="mt-4 text-[13px] text-ash">
              {projects?.length ?? 0} result{projects?.length !== 1 ? "s" : ""} for &ldquo;{q}&rdquo;
            </p>
          )}
        </div>

        {(!projects || projects.length === 0) ? (
          <div className="py-24 text-center text-ash text-[15px]">
            {q ? `No projects found for "${q}".` : `No public projects yet${format ? ` in ${format}` : ""}.`}
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {projects.map((p: any) => {
              const filmmaker = Array.isArray(p.filmmaker) ? p.filmmaker[0] : p.filmmaker;
              return (
                <div key={p.id} className="group flex flex-col bg-white/70 border border-line rounded-card overflow-hidden hover:border-gold hover:shadow-sm transition-all">
                  <Link href={`/projects/${p.id}`}>
                    <div className="aspect-[3/2] overflow-hidden">
                      <ProjectThumbnail posterPath={p.poster_path} title={p.title} genre={p.genre} supabaseUrl={supabaseUrl} className="rounded-t-card w-full h-full" />
                    </div>
                  </Link>
                  <div className="p-5 flex flex-col flex-1">
                    <p className="text-[11px] tracking-[0.24em] uppercase text-ash mb-2">
                      {p.genre} · {p.format.charAt(0).toUpperCase() + p.format.slice(1)}
                    </p>
                    <Link href={`/projects/${p.id}`}>
                      <h2 className="font-display text-[20px] font-[400] mb-2 group-hover:text-gold transition-colors leading-snug">{p.title}</h2>
                    </Link>
                    {p.logline && (
                      <p className="font-display italic text-[13px] leading-[1.55] text-ash line-clamp-2 flex-1">&ldquo;{p.logline}&rdquo;</p>
                    )}
                    {filmmaker && (
                      <div className="mt-3 flex items-center gap-2 text-[12px] text-ash">
                        <span>{filmmaker.full_name}</span>
                        {filmmaker.career_stage && (
                          <span className="text-[10px] tracking-[0.1em] uppercase bg-parchment border border-line px-2 py-0.5 rounded-full">
                            {CAREER_LABEL[filmmaker.career_stage] ?? filmmaker.career_stage}
                          </span>
                        )}
                      </div>
                    )}
                    <div className="mt-4 pt-4 border-t border-line flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <LoveButton projectId={p.id} initialCount={p.love_count ?? 0} initialLiked={lovedSet.has(p.id)} isLoggedIn={!!user} size="sm" />
                        <ShareButton projectId={p.id} title={p.title} genre={p.genre} country={p.country} size="sm" />
                      </div>
                      {p.funding_needed_usd && (
                        <span className="text-[12px] text-gold shrink-0">Seeking {usd(p.funding_needed_usd)}</span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {!user && (
        <div className="border-t border-line mt-16">
          <div className="max-w-[1180px] mx-auto px-6 py-12 flex flex-col sm:flex-row items-center justify-between gap-6">
            <div>
              <p className="font-display text-[22px]">Ready to pitch your film?</p>
              <p className="mt-1 text-[14px] text-ash">Submit your project and get matched with funds, labs and co-producers.</p>
            </div>
            <Link href="/signup" className="btn-gold shrink-0">Submit your project</Link>
          </div>
        </div>
      )}
    </div>
  );
}
