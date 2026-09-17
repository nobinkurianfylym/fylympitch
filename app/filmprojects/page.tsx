import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import Wordmark from "@/components/Wordmark";
import LoveButton from "@/components/LoveButton";
import ShareButton from "@/components/ShareButton";
import SearchInput from "@/components/SearchInput";
import { formatBudget } from "@/lib/format";
import FilmIdentity from "@/components/FilmIdentity";
import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";

export const dynamic = "force-dynamic";

// This page is in the sitemap at priority 0.7 and had no metadata of its own,
// so it competed for nothing and shared as the generic site card.
export const metadata: Metadata = pageMetadata({
  title: "Film Projects Looking for Funding & Producers",
  description:
    "Browse independent film projects seeking finance, co-producers and partners — features, documentaries, series and animation from filmmakers worldwide.",
  path: "/filmprojects",
});

const FORMATS = ["Feature", "Documentary", "Series", "Animation"];

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: Promise<{ format?: string; q?: string }>;
}) {
  const { format, q } = await searchParams;
  const supabase = await createClient();

  // ── Stage 1: auth and the project list, together ──────────────────────────
  // The listing does not depend on who is asking, so it has no reason to wait
  // for the auth round trip. This page measured ~1s TTFB, and five sequential
  // hops to Supabase were most of it.
  let query = supabase
    .from("projects")
    .select("id, slug, title, genre, format, stage, language, country, director_name, logline, budget_usd, budget_currency, finance_secured_usd, funding_needed_usd, poster_path, deck_cover_path, pitch_deck_path, love_count, owner_id, filmmaker:profiles!projects_owner_id_fkey(full_name, career_stage)")
    .eq("is_public", true)
    .is("target_producer_id", null)
    .order("created_at", { ascending: false })
    .limit(60);

  if (format)    query = query.eq("format", format.toLowerCase());
  if (q?.trim()) query = (query as any).or(`title.ilike.%${q.trim()}%,logline.ilike.%${q.trim()}%`);

  const [userRes, projectsRes] = await Promise.all([
    supabase.auth.getUser(),
    query,
  ]);

  const user = userRes.data.user;
  const projects = projectsRes.data;

  // ── Stage 2: everything that needed the results of stage 1 ────────────────
  // Three more queries that were each awaited separately. The deck covers were
  // the worst of them: one createSignedUrl round trip PER project without a
  // poster. createSignedUrls signs the whole batch in a single request.
  const deckPaths = (projects ?? [])
    .filter((p: any) => !p.poster_path && !p.deck_cover_path && p.pitch_deck_path);

  const [roleRes, lovesRes, signedRes] = await Promise.all([
    user
      ? supabase.from("profiles").select("role").eq("id", user.id).single()
      : Promise.resolve({ data: null }),
    user && projects?.length
      ? supabase.from("project_loves").select("project_id")
          .eq("user_id", user.id)
          .in("project_id", projects.map((p: any) => p.id))
      : Promise.resolve({ data: null }),
    deckPaths.length
      ? supabase.storage.from("pitch-decks")
          .createSignedUrls(deckPaths.map((p: any) => p.pitch_deck_path), 3600)
      : Promise.resolve({ data: null }),
  ]);

  const dashboardHref =
    (roleRes.data as any)?.role === "producer" ? "/producerstudio" : "/dashboard";
  const dashboardLabel = dashboardHref === "/producerstudio" ? "Producer Studio" : "Dashboard";

  const lovedSet = new Set<string>(
    ((lovesRes.data ?? []) as any[]).map((l: any) => l.project_id)
  );

  // createSignedUrls returns results in the order the paths were given, and
  // entries can individually fail — a missing deck must not lose the mapping
  // for every project after it.
  const deckUrlMap = new Map<string, string>();
  ((signedRes.data ?? []) as any[]).forEach((row: any, i: number) => {
    const project = deckPaths[i];
    if (project && row?.signedUrl) deckUrlMap.set(project.id, row.signedUrl);
  });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;

  return (
    <div className="min-h-screen bg-ivory">

      {/* ── NAV ── */}
      <header className="border-b border-line">
        <div className="max-w-[1180px] mx-auto px-6 py-5 flex items-center justify-between">
          <Wordmark />
          <nav className="hidden md:flex items-center gap-8 text-[12px] tracking-[0.18em] uppercase font-[400] text-ash">
            <Link href="/#features" className="hover:text-ink transition-colors">Platform</Link>
            <Link href="/filmprojects"  className="text-ink">Film Projects</Link>
            <Link href="/opportunities"     className="hover:text-ink transition-colors">Opportunities</Link>
          </nav>
          <div className="flex items-center gap-3">
            {user ? (
              <Link href={dashboardHref} className="text-[12px] tracking-[0.18em] uppercase hover:text-gold transition-colors">{dashboardLabel}</Link>
            ) : (
              <Link href="/login" className="btn-outline !px-5 !py-2.5 !text-[11px]">Get started</Link>
            )}
          </div>
        </div>
        {/* MOBILE NAV — desktop nav hidden below md; surface cross-links */}
        <nav className="md:hidden max-w-[1180px] mx-auto px-6 pb-3 flex items-center gap-8 text-[12px] tracking-[0.18em] uppercase text-ash">
          <Link href="/filmprojects" className="py-2.5 text-ink">Film Projects</Link>
          <Link href="/opportunities" className="py-2.5 hover:text-ink transition-colors">Opportunities</Link>
        </nav>
      </header>

      <main className="max-w-[1180px] mx-auto px-6 py-12">
        <div className="mb-10">
          <p className="eyebrow mb-3">Discover</p>
          <h1 className="font-display text-[38px] font-[400]">Film Projects</h1>
          <p className="mt-3 text-[15px] text-ash max-w-lg">
            Pitches submitted by filmmakers on PITCH.FYLYM — open for producers, investors and collaborators to discover.
          </p>

          {/* Format filters + search */}
          <div className="mt-7 flex flex-wrap gap-2 items-center">
            <Link
              href={`/filmprojects${q ? `?q=${encodeURIComponent(q)}` : ""}`}
              className={`text-[12px] tracking-[0.12em] uppercase rounded-full px-4 py-2 border transition-colors ${
                !format ? "bg-ink text-ivory border-ink" : "border-line text-ash hover:border-ink hover:text-ink"
              }`}>
              All formats
            </Link>
            {FORMATS.map((f) => (
              <Link
                key={f}
                href={`/filmprojects?format=${f.toLowerCase()}${q ? `&q=${encodeURIComponent(q)}` : ""}`}
                className={`text-[12px] tracking-[0.12em] uppercase rounded-full px-4 py-2 border transition-colors ${
                  format?.toLowerCase() === f.toLowerCase()
                    ? "bg-ink text-ivory border-ink"
                    : "border-line text-ash hover:border-ink hover:text-ink"
                }`}>
                {f}
              </Link>
            ))}
            <div className="ml-auto">
              <SearchInput placeholder="Search projects…" basePath="/filmprojects" />
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
                <FilmIdentity
                  key={p.id}
                  variant="compact-card"
                  project={{
                    ...p,
                    filmmaker,
                    financing_secured_usd: p.finance_secured_usd ?? null,
                    deckUrl: deckUrlMap.get(p.id) ?? null,
                  }}
                  supabaseUrl={supabaseUrl}
                  href={`/filmprojects/${p.id}`}
                  actions={
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <LoveButton
                          projectId={p.id}
                          slug={(p as any).slug}
                          initialCount={p.love_count ?? 0}
                          initialLiked={lovedSet.has(p.id)}
                          isLoggedIn={!!user}
                          size="sm"
                        />
                        <ShareButton
                          projectId={p.id}
                          slug={(p as any).slug}
                          title={p.title}
                          genre={p.genre}
                          country={p.country}
                          size="sm"
                        />
                      </div>
                      {p.funding_needed_usd && (
                        <span className="text-[11px] text-gold shrink-0">
                          Seeking {formatBudget(p.funding_needed_usd, p.budget_currency)}
                        </span>
                      )}
                    </div>
                  }
                />
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
