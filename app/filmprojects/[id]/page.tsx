import { createClient } from "@/lib/supabase/server";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import Wordmark from "@/components/Wordmark";
import ProjectThumbnail from "@/components/ProjectThumbnail";
import LoveButtonAuto from "@/components/LoveButtonAuto";
import ProjectViewerCta from "@/components/ProjectViewerCta";
import AuthAwareCta from "@/components/AuthAwareCta";
import ShareButton from "@/components/ShareButton";
import { formatBudget } from "@/lib/format";
import { formatFormat, formatCountry, formatStage } from "@/lib/film-identity";
import type { Metadata } from "next";
import JsonLd from "@/components/JsonLd";
import { projectSchema, breadcrumbSchema } from "@/lib/schema";
import { projectRobots, absoluteUrl } from "@/lib/seo";


const CAREER_LABEL: Record<string, string> = {
  debut: "Debut film", second_film: "2nd film", established: "Established filmmaker", veteran: "Veteran filmmaker",
};

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const supabase = await createClient();
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
  const { data: p } = await supabase
    .from("projects").select("title, genre, logline, synopsis, poster_path, country, slug, is_public, admin_hidden")
    .eq(isUuid ? "id" : "slug", id).eq("is_public", true).single();
  if (!p) return { title: "Project — PITCH.FYLYM" };
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const image = p.poster_path ? `${supabaseUrl}/storage/v1/object/public/thumbnails/${p.poster_path}` : null;
  const desc = p.logline ?? `A ${p.genre} from ${p.country} — now pitching on PITCH.FYLYM`;
  return {
    title: `${p.title} — PITCH.FYLYM`,
    description: desc,
    openGraph: { title: p.title, description: desc, images: image ? [image] : [], type: "article" },
    twitter: { card: "summary_large_image", title: p.title, description: desc, images: image ? [image] : [] },
    alternates: { canonical: absoluteUrl(`/filmprojects/${p.slug}`) },
    robots: projectRobots(p as any),
  };
}

export default async function PublicProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

  // UUID → redirect to slug-based URL (preserve old shared links)
  if (isUuid) {
    const { data: slugRow } = await supabase
      .from("projects").select("slug").eq("id", id).eq("is_public", true).single();
    if (slugRow?.slug) redirect(`/filmprojects/${slugRow.slug}`);
  }

  const { data: p } = await supabase.from("projects")
    .select("id, slug, title, genre, format, stage, language, country, logline, synopsis, director_statement, producer_info, director_name, budget_currency, budget_usd, finance_secured_usd, funding_needed_usd, is_public, poster_path, deck_cover_path, pitch_deck_path, love_count, owner_id, filmmaker:profiles!projects_owner_id_fkey(full_name, avatar_url, career_stage, username)")
    .eq(isUuid ? "id" : "slug", id).eq("is_public", true).single();

  if (!p) notFound();

  const { data: filmmakerCredits } = await supabase
    .from("filmmaker_credits").select("*").eq("user_id", p.owner_id).order("year", { ascending: false });

  const filmmaker = Array.isArray(p.filmmaker) ? p.filmmaker[0] : p.filmmaker;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;

  const deckUrl = (!p.poster_path && !p.deck_cover_path && p.pitch_deck_path)
    ? (await supabase.storage.from("pitch-decks").createSignedUrl(p.pitch_deck_path, 3600)).data?.signedUrl
    : null;

  const posterUrl = p.poster_path ? `${supabaseUrl}/storage/v1/object/public/thumbnails/${p.poster_path}` : null;
  const projectLd = [
    projectSchema(p as any, { url: absoluteUrl(`/filmprojects/${p.slug}`), image: posterUrl, authorName: filmmaker?.full_name ?? null }),
    breadcrumbSchema([
      { name: "Film Projects", path: "/filmprojects" },
      { name: p.title, path: `/filmprojects/${p.slug}` },
    ]),
  ];

  return (
    <div className="min-h-screen bg-ivory">
      <JsonLd data={projectLd} />
      <header className="border-b border-line">
        <div className="max-w-6xl mx-auto px-6 py-5 flex items-center justify-between">
          <Wordmark />
          <nav className="hidden md:flex items-center gap-8 text-[12px] tracking-[0.18em] uppercase font-[400] text-ash">
            <Link href="/#features" className="hover:text-ink transition-colors">Platform</Link>
            <Link href="/filmprojects" className="text-ink">Film Projects</Link>
            <Link href="/opportunities" className="hover:text-ink transition-colors">Opportunities</Link>
          </nav>
          <AuthAwareCta authedHref="/dashboard" authedLabel="Dashboard" authedClassName="text-[12px] tracking-[0.18em] uppercase hover:text-gold transition-colors">
            <Link href="/login" className="text-[12px] tracking-[0.18em] uppercase hover:text-gold transition-colors">Sign in</Link>
          </AuthAwareCta>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-12 pb-24">
        <p className="text-[11px] tracking-[0.16em] uppercase text-ash mb-8">
          <Link href="/filmprojects" className="hover:text-ink transition-colors">Film Projects</Link>
          <span className="mx-2">›</span>
          <span className="text-ink uppercase" style={{ letterSpacing: "-0.01em" }}>{p.title}</span>
        </p>

        <ProjectThumbnail posterPath={p.poster_path} deckCoverPath={p.deck_cover_path} deckUrl={deckUrl} title={p.title} genre={p.genre}
          supabaseUrl={supabaseUrl} className="rounded-card mb-8 w-full max-h-[420px]" />

        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="flex-1 min-w-0">
            {/* L1: Title — always first */}
            <h1
              className="font-display font-bold text-[32px] sm:text-[38px] leading-[1.08] uppercase mb-3"
              style={{ letterSpacing: "-0.01em" }}
            >
              {p.title}
            </h1>
            {/* L2: Metadata row — Format · Genre · Country · Language · Stage */}
            <p className="text-[13px] text-ash leading-tight">
              {[
                formatFormat(p.format),
                p.genre,
                (() => { const c = formatCountry(p.country); return c?.flag ? `${c.flag} ${c.name}` : c?.name ?? null; })(),
                p.language,
                formatStage(p.stage),
              ].filter(Boolean).join(" · ")}
            </p>
            {/* L3: Director — links to filmmaker profile if username available */}
            {(p.director_name || filmmaker?.full_name) && (
              <p className="mt-3 text-[13px] text-ash">
                <span className="text-[10px] tracking-[0.08em] uppercase mr-1.5">Dir.</span>
                {filmmaker?.username ? (
                  <Link href={`/u/${filmmaker.username}`} className="text-ink font-medium hover:text-gold transition-colors">
                    {p.director_name ?? filmmaker.full_name}
                  </Link>
                ) : (
                  <span className="text-ink font-medium">{p.director_name ?? filmmaker?.full_name}</span>
                )}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0 mt-1">
            <LoveButtonAuto projectId={p.id} slug={p.slug} initialCount={p.love_count ?? 0} />
            <ShareButton projectId={p.id} slug={p.slug} title={p.title} genre={p.genre} country={p.country} />
          </div>
        </div>

        {/* L5: Logline */}
        {p.logline && (
          <p className="italic text-[18px] leading-[1.6] mt-5 text-ink">{p.logline}</p>
        )}

        {/* Budget / Seeking — only if present, no country/language repeat */}
        {(p.budget_usd || p.funding_needed_usd) && (
          <div className="mt-6 flex flex-wrap gap-6 text-[13px] text-ash">
            {p.budget_usd && <span>Budget — <span className="text-ink">{formatBudget(p.budget_usd, (p as any).budget_currency)}</span></span>}
            {(p as any).finance_secured_usd && <span>Secured — <span className="text-emerald-700 font-[400]">{formatBudget((p as any).finance_secured_usd, (p as any).budget_currency)}</span></span>}
            {p.funding_needed_usd && <span>Seeking — <span className="text-gold font-[400]">{formatBudget(p.funding_needed_usd, (p as any).budget_currency)}</span></span>}
          </div>
        )}

        {/* Filmmaker card */}
        {filmmaker && (
          <div className="mt-8 p-5 border border-line rounded-card bg-white/60 flex items-start gap-4">
            {/* Avatar — links to profile */}
            {filmmaker.username ? (
              <Link href={`/u/${filmmaker.username}`} className="shrink-0 block">
                <div className="w-12 h-12 rounded-full overflow-hidden bg-parchment border border-line flex items-center justify-center hover:border-gold transition-colors">
                  {filmmaker.avatar_url ? (
                    <img src={filmmaker.avatar_url} alt={filmmaker.full_name} className="w-full h-full object-cover" />
                  ) : (
                    <span className="font-display text-[14px] text-ash">
                      {filmmaker.full_name.split(" ").map((w: string) => w[0]).slice(0, 2).join("").toUpperCase()}
                    </span>
                  )}
                </div>
              </Link>
            ) : (
              <div className="w-12 h-12 rounded-full overflow-hidden bg-parchment border border-line flex items-center justify-center shrink-0">
                {filmmaker.avatar_url ? (
                  <img src={filmmaker.avatar_url} alt={filmmaker.full_name} className="w-full h-full object-cover" />
                ) : (
                  <span className="font-display text-[14px] text-ash">
                    {filmmaker.full_name.split(" ").map((w: string) => w[0]).slice(0, 2).join("").toUpperCase()}
                  </span>
                )}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-3">
                <div>
                  {filmmaker.username ? (
                    <Link href={`/u/${filmmaker.username}`} className="text-[15px] font-medium text-ink hover:text-gold transition-colors">
                      {filmmaker.full_name}
                    </Link>
                  ) : (
                    <p className="text-[15px] font-medium text-ink">{filmmaker.full_name}</p>
                  )}
                  {filmmaker.career_stage && (
                    <p className="text-[12px] tracking-[0.12em] uppercase text-ash mt-0.5">
                      {CAREER_LABEL[filmmaker.career_stage] ?? filmmaker.career_stage}
                    </p>
                  )}
                </div>
                {filmmaker.username && (
                  <Link
                    href={`/u/${filmmaker.username}`}
                    className="shrink-0 text-[11px] tracking-[0.12em] uppercase text-ash hover:text-gold border border-line hover:border-gold/40 rounded-full px-3 py-1 transition-colors"
                  >
                    View Profile →
                  </Link>
                )}
              </div>
              {/* Top credits */}
              {(filmmakerCredits ?? []).length > 0 && (
                <div className="mt-3 space-y-1.5">
                  {(filmmakerCredits ?? []).slice(0, 3).map((c: any) => (
                    <div key={c.id} className="flex flex-wrap items-center gap-2">
                      <span className="text-[13px] text-ink">{c.title}</span>
                      {c.year && <span className="text-[12px] text-ash">{c.year}</span>}
                      {c.festivals?.slice(0, 2).map((f: string) => (
                        <span key={f} className="text-[10px] tracking-[0.1em] uppercase bg-parchment text-ash px-2 py-0.5 rounded-full border border-line">{f}</span>
                      ))}
                      {c.awards?.length > 0 && (
                        <span className="text-[11px] text-gold">🏆 {c.awards[0]}</span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        <div className="hairline-gold mt-10 mb-10" />

        {p.synopsis && (
          <section className="mb-10">
            <p className="eyebrow mb-4">Synopsis</p>
            <p className="text-[21px] leading-[1.7] text-ink whitespace-pre-line">{p.synopsis}</p>
          </section>
        )}
        {p.director_statement && (
          <section className="mb-10">
            <p className="eyebrow mb-4">Director's statement</p>
            <p className="text-[21px] leading-[1.7] text-ink whitespace-pre-line">{p.director_statement}</p>
          </section>
        )}
        {p.producer_info && (
          <section className="mb-10">
            <p className="eyebrow mb-4">Producers</p>
            <p className="text-[21px] leading-[1.7] text-ink whitespace-pre-line">{p.producer_info}</p>
          </section>
        )}

        {/* CTA block — client component keeps this page edge-cacheable */}
        <ProjectViewerCta projectId={p.id} ownerId={p.owner_id} />

        <Link href="/filmprojects" className="mt-10 inline-block text-[12px] tracking-[0.16em] uppercase text-ash hover:text-ink transition-colors">
          ← Back to Projects
        </Link>
      </main>
    </div>
  );
}
