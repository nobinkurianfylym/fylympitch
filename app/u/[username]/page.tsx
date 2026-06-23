import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import Wordmark from "@/components/Wordmark";
import ProjectThumbnail from "@/components/ProjectThumbnail";
import ProfileShareButton from "@/components/ProfileShareButton";
import { formatBudget } from "@/lib/format";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

// ─── SEO metadata ────────────────────────────────────────────────────────────

export async function generateMetadata({
  params,
}: {
  params: Promise<{ username: string }>;
}): Promise<Metadata> {
  const { username } = await params;
  const supabase = await createClient();
  const { data: p } = await supabase
    .from("profiles")
    .select("full_name, bio, company, country")
    .eq("username", username)
    .single();
  if (!p) return { title: "Filmmaker Profile — PITCH.FYLYM" };
  return {
    title: `${p.full_name} (@${username}) — PITCH.FYLYM`,
    description:
      p.bio ??
      `${p.full_name}${p.company ? ` · ${p.company}` : ""}${p.country ? ` · ${p.country}` : ""} on PITCH.FYLYM`,
    openGraph: {
      title: `${p.full_name} on PITCH.FYLYM`,
      description:
        p.bio ??
        `${p.full_name} — filmmaker on PITCH.FYLYM`,
      type: "profile",
    },
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const CAREER: Record<string, string> = {
  debut:       "Debut Filmmaker",
  second_film: "2nd Film",
  established: "Established Filmmaker",
  veteran:     "Veteran Filmmaker",
  emerging:    "Emerging Filmmaker",
};

const STAGE_LABEL: Record<string, string> = {
  development:     "Development",
  pre_production:  "Pre-Production",
  production:      "In Production",
  post_production: "Post-Production",
  completed:       "Completed",
};

const FORMAT_LABEL: Record<string, string> = {
  documentary: "Documentary",
  narrative:   "Narrative",
  feature:     "Feature",
  short:       "Short Film",
  series:      "Series",
  animation:   "Animation",
  both:        "Documentary & Narrative",
};

const ROLE_LABEL: Record<string, string> = {
  independent_producer:  "Independent Producer",
  studio_exec:           "Studio Executive",
  sales_agent:           "Sales Agent",
  distributor:           "Distributor",
  ep:                    "Executive Producer",
  coproduction_partner:  "Co-Production Partner",
};

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function PublicProfilePage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;
  const supabase = await createClient();

  // Auth — optional (page is fully public; we just personalise CTAs)
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // ── Fetch profile ──────────────────────────────────────────────────────────
  const { data: profile } = await supabase
    .from("profiles")
    .select(
      "id, full_name, username, company, country, bio, website, imdb_url, avatar_url, role, career_stage, filmmaker_formats"
    )
    .eq("username", username)
    .single();

  if (!profile) notFound();

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;

  // ── Parallel fetches ───────────────────────────────────────────────────────
  const [
    { data: projects },
    { data: credits },
    { data: producerProfile },
    { data: me },
  ] = await Promise.all([
    supabase
      .from("projects")
      .select(
        "id, title, genre, format, stage, logline, poster_path, slug, love_count, budget_currency, finance_secured_usd, funding_needed_usd"
      )
      .eq("owner_id", profile.id)
      .eq("is_public", true)
      .order("created_at", { ascending: false }),

    supabase
      .from("filmmaker_credits")
      .select("*")
      .eq("user_id", profile.id)
      .order("is_featured", { ascending: false })
      .order("year", { ascending: false }),

    supabase
      .from("producer_profiles")
      .select("role_type, genres, formats, territories, is_public")
      .eq("user_id", profile.id)
      .eq("is_public", true)
      .maybeSingle(),

    user
      ? supabase
          .from("profiles")
          .select("id, role")
          .eq("id", user.id)
          .single()
      : Promise.resolve({ data: null }),
  ]);

  // ── Derived values ─────────────────────────────────────────────────────────
  const viewerRole   = (me as any)?.role ?? null;
  const dashboardHref =
    viewerRole === "producer" ? "/producer" : "/dashboard";

  const careerLabel = producerProfile
    ? ROLE_LABEL[producerProfile.role_type ?? ""] ?? "Producer"
    : CAREER[profile.career_stage as string] ?? "Filmmaker";

  const filmmakerFormats: string[] =
    (profile as any).filmmaker_formats ?? [];

  const projectList  = projects  ?? [];
  const creditList   = credits   ?? [];
  const featuredCred = creditList.filter((c: any) => c.is_featured);
  const restCred     = creditList.filter((c: any) => !c.is_featured);
  const sortedCredits = [...featuredCred, ...restCred];

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-ivory">

      {/* ── Nav ─────────────────────────────────────────────────────────── */}
      <header className="border-b border-line sticky top-0 z-30 bg-ivory/95 backdrop-blur-sm">
        <div className="max-w-[1180px] mx-auto px-6 py-5 flex items-center justify-between">
          <Wordmark />
          <nav className="flex items-center gap-6 text-[12px] tracking-[0.14em] uppercase text-ash">
            <Link href="/projects" className="hover:text-ink transition-colors">
              Film Projects
            </Link>
            <Link href="/funds" className="hover:text-ink transition-colors">
              Opportunities
            </Link>
            {user ? (
              <Link
                href={dashboardHref}
                className="hover:text-ink transition-colors"
              >
                {viewerRole === "producer" ? "Producer Studio" : "Dashboard"}
              </Link>
            ) : (
              <Link
                href={`/login?next=/u/${username}`}
                className="btn-gold px-5 py-2 text-[11px]"
              >
                Log In
              </Link>
            )}
          </nav>
        </div>
      </header>

      <main className="max-w-[1180px] mx-auto px-6">

        {/* ── Hero ──────────────────────────────────────────────────────── */}
        <section className="pt-14 pb-10 border-b border-line">
          <div className="flex flex-col sm:flex-row items-start gap-8">

            {/* Avatar */}
            <div className="shrink-0">
              {profile.avatar_url ? (
                <img
                  src={profile.avatar_url}
                  alt={profile.full_name}
                  className="w-[100px] h-[100px] rounded-full object-cover border border-line shadow-sm"
                />
              ) : (
                <div className="w-[100px] h-[100px] rounded-full bg-parchment border border-line flex items-center justify-center">
                  <span className="font-display text-[32px] text-ash/70 select-none">
                    {profile.full_name
                      .split(" ")
                      .map((w: string) => w[0])
                      .slice(0, 2)
                      .join("")
                      .toUpperCase()}
                  </span>
                </div>
              )}
            </div>

            {/* Identity block */}
            <div className="flex-1 min-w-0">
              {/* Career stage pill */}
              <p className="eyebrow mb-3">{careerLabel}</p>

              {/* Name */}
              <h1 className="font-display text-[42px] sm:text-[52px] font-[400] leading-[1.05] mb-2">
                {profile.full_name}
              </h1>

              {/* @handle · company · country */}
              <p className="text-[13px] text-ash tracking-[0.06em] mb-4">
                @{profile.username}
                {profile.company && (
                  <>
                    <span className="mx-2 opacity-30">·</span>
                    {profile.company}
                  </>
                )}
                {profile.country && (
                  <>
                    <span className="mx-2 opacity-30">·</span>
                    {profile.country}
                  </>
                )}
              </p>

              {/* Bio */}
              {profile.bio && (
                <p className="text-[15px] leading-relaxed max-w-2xl text-ink/75 mb-5">
                  {profile.bio}
                </p>
              )}

              {/* Format tags */}
              {filmmakerFormats.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-5">
                  {filmmakerFormats.map((fmt: string) => (
                    <span
                      key={fmt}
                      className="text-[11px] tracking-[0.14em] uppercase px-3 py-1 rounded-full border border-line bg-parchment text-ash"
                    >
                      {FORMAT_LABEL[fmt] ?? fmt}
                    </span>
                  ))}
                </div>
              )}

              {/* External links row */}
              <div className="flex items-center gap-5 mb-6">
                {profile.website && (
                  <a
                    href={profile.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[12px] tracking-[0.12em] uppercase text-ash hover:text-gold transition-colors"
                  >
                    Website ↗
                  </a>
                )}
                {profile.imdb_url && (
                  <a
                    href={profile.imdb_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[12px] tracking-[0.12em] uppercase text-ash hover:text-gold transition-colors"
                  >
                    IMDb ↗
                  </a>
                )}
              </div>

              {/* CTA row */}
              <div className="flex flex-wrap items-center gap-3">
                <ProfileShareButton
                  username={profile.username}
                  fullName={profile.full_name}
                />

                {user ? (
                  projectList.length > 0 ? (
                    <Link
                      href={`/projects/${projectList[0].slug ?? projectList[0].id}`}
                      className="btn-gold px-5 py-2.5 text-[12px]"
                    >
                      View Latest Project
                    </Link>
                  ) : null
                ) : (
                  <Link
                    href={`/login?next=/u/${username}`}
                    className="btn-gold px-5 py-2.5 text-[12px]"
                  >
                    Join to Connect
                  </Link>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* ── Stats strip ───────────────────────────────────────────────── */}
        {(projectList.length > 0 || sortedCredits.length > 0) && (
          <div className="py-5 border-b border-line flex items-center gap-8">
            {projectList.length > 0 && (
              <div className="text-center">
                <p className="font-display text-[28px] font-[400] leading-none text-ink">
                  {projectList.length}
                </p>
                <p className="eyebrow mt-1">
                  {projectList.length === 1 ? "Project" : "Projects"}
                </p>
              </div>
            )}
            {sortedCredits.length > 0 && (
              <div className="text-center">
                <p className="font-display text-[28px] font-[400] leading-none text-ink">
                  {sortedCredits.length}
                </p>
                <p className="eyebrow mt-1">
                  {sortedCredits.length === 1 ? "Credit" : "Credits"}
                </p>
              </div>
            )}
            {featuredCred.filter((c: any) => (c.awards ?? []).length > 0).length > 0 && (
              <div className="text-center">
                <p className="font-display text-[28px] font-[400] leading-none text-gold">
                  {featuredCred
                    .filter((c: any) => (c.awards ?? []).length > 0)
                    .reduce((sum: number, c: any) => sum + c.awards.length, 0)}
                </p>
                <p className="eyebrow mt-1">Awards</p>
              </div>
            )}
          </div>
        )}

        {/* ── Producer preferences (if public producer profile) ─────────── */}
        {producerProfile && (
          <section className="py-10 border-b border-line">
            <p className="eyebrow mb-6">Looking For</p>
            <div className="flex flex-wrap gap-2">
              {[
                ...(producerProfile.genres ?? []),
                ...(producerProfile.formats ?? []),
                ...(producerProfile.territories ?? []),
              ].map((tag: string) => (
                <span
                  key={tag}
                  className="text-[11px] tracking-[0.14em] uppercase px-3 py-1.5 rounded-full border border-line bg-parchment text-ash"
                >
                  {tag}
                </span>
              ))}
            </div>
          </section>
        )}

        {/* ── Projects ──────────────────────────────────────────────────── */}
        {projectList.length > 0 && (
          <section className="py-12 border-b border-line">
            <p className="eyebrow mb-7">Projects</p>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {projectList.map((p: any) => (
                <Link
                  key={p.id}
                  href={`/projects/${p.slug ?? p.id}`}
                  className="group flex flex-col bg-white/70 border border-line rounded-card overflow-hidden hover:border-gold hover:shadow-sm transition-all"
                >
                  {/* Poster */}
                  <div className="aspect-[3/2] overflow-hidden">
                    <ProjectThumbnail
                      posterPath={p.poster_path}
                      title={p.title}
                      genre={p.genre}
                      supabaseUrl={supabaseUrl}
                      className="w-full h-full rounded-t-card"
                    />
                  </div>

                  {/* Info */}
                  <div className="p-5 flex flex-col flex-1">
                    {/* Genre · Format */}
                    <p className="text-[11px] tracking-[0.24em] uppercase text-ash mb-2">
                      {p.genre}
                      {p.format && (
                        <>
                          {" · "}
                          {p.format.charAt(0).toUpperCase() + p.format.slice(1)}
                        </>
                      )}
                    </p>

                    {/* Title */}
                    <h3 className="font-display text-[22px] font-[400] group-hover:text-gold transition-colors leading-snug mb-2">
                      {p.title}
                    </h3>

                    {/* Logline */}
                    {p.logline && (
                      <p className="font-display italic text-[13px] leading-[1.55] text-ash line-clamp-2 flex-1">
                        &ldquo;{p.logline}&rdquo;
                      </p>
                    )}

                    {/* Stage + funding */}
                    <div className="mt-4 pt-4 border-t border-line flex items-center justify-between text-[12px]">
                      <span className="text-ash/60 tracking-[0.08em]">
                        {STAGE_LABEL[p.stage] ?? p.stage}
                      </span>
                      <div className="flex items-center gap-3">
                        {p.love_count > 0 && (
                          <span className="text-ash">
                            ♥ {p.love_count}
                          </span>
                        )}
                        {p.funding_needed_usd && (
                          <span className="text-gold font-[500]">
                            {formatBudget(p.funding_needed_usd, p.budget_currency)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* ── Credits & Filmography ─────────────────────────────────────── */}
        {sortedCredits.length > 0 && (
          <section className="py-12">
            <p className="eyebrow mb-7">Filmography</p>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {sortedCredits.map((c: any) => (
                <div
                  key={c.id}
                  className={`card p-5 flex flex-col gap-3 ${
                    c.is_featured ? "border-gold/30" : ""
                  }`}
                >
                  {/* Title + year */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-display text-[17px] font-[400] leading-snug">
                        {c.title}
                      </p>
                      <p className="text-[12px] text-ash mt-0.5 tracking-[0.06em]">
                        {c.year ?? "—"}
                        {c.format && (
                          <>
                            {" · "}
                            {c.format.charAt(0).toUpperCase() + c.format.slice(1)}
                          </>
                        )}
                      </p>
                    </div>
                    {c.is_featured && (
                      <span
                        className="shrink-0 text-[9px] tracking-[0.2em] uppercase text-gold border border-gold/40 rounded-full px-2 py-0.5"
                        title="Featured credit"
                      >
                        Featured
                      </span>
                    )}
                  </div>

                  {/* Festivals */}
                  {(c.festivals ?? []).length > 0 && (
                    <div>
                      <p className="text-[10px] tracking-[0.18em] uppercase text-ash/60 mb-1">
                        Festival Selection
                      </p>
                      <p className="text-[12px] text-ash leading-snug">
                        {(c.festivals as string[]).slice(0, 4).join(" · ")}
                        {(c.festivals as string[]).length > 4 && (
                          <span className="text-ash/50">
                            {" "}+{c.festivals.length - 4} more
                          </span>
                        )}
                      </p>
                    </div>
                  )}

                  {/* Awards */}
                  {(c.awards ?? []).length > 0 && (
                    <div>
                      <p className="text-[10px] tracking-[0.18em] uppercase text-gold/70 mb-1">
                        Awards
                      </p>
                      <p className="text-[12px] text-ink leading-snug">
                        {(c.awards as string[]).slice(0, 3).join(" · ")}
                        {(c.awards as string[]).length > 3 && (
                          <span className="text-ash/50">
                            {" "}+{c.awards.length - 3} more
                          </span>
                        )}
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ── Empty state ───────────────────────────────────────────────── */}
        {projectList.length === 0 && sortedCredits.length === 0 && (
          <section className="py-24 text-center">
            <p className="font-display text-[22px] font-[400] text-ash mb-3">
              No public work yet
            </p>
            <p className="text-[14px] text-ash/60">
              {`${profile.full_name} hasn't published any projects yet.`}
            </p>
          </section>
        )}

        {/* ── Join CTA (unauthenticated) ────────────────────────────────── */}
        {!user && projectList.length > 0 && (
          <section className="py-12 border-t border-line">
            <div className="max-w-lg">
              <p className="font-display text-[26px] font-[400] leading-snug mb-3">
                Connect with {profile.full_name.split(" ")[0]} on PITCH.FYLYM
              </p>
              <p className="text-[14px] text-ash/75 mb-6">
                Discover emerging filmmakers, explore projects seeking funding,
                and build co-production partnerships — all in one place.
              </p>
              <div className="flex items-center gap-4">
                <Link href={`/login?next=/u/${username}`} className="btn-gold px-6 py-3 text-[12px]">
                  Log In to Connect
                </Link>
                <Link href="/signup" className="btn-ghost px-6 py-3 text-[12px]">
                  Create Account
                </Link>
              </div>
            </div>
          </section>
        )}

      </main>

      {/* ── Footer ────────────────────────────────────────────────────────── */}
      <footer className="border-t border-line mt-16">
        <div className="max-w-[1180px] mx-auto px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <Wordmark />
          <nav className="flex items-center gap-6 text-[11px] tracking-[0.14em] uppercase text-ash">
            <Link href="/projects"  className="hover:text-ink transition-colors">Film Projects</Link>
            <Link href="/funds"     className="hover:text-ink transition-colors">Opportunities</Link>
            <Link href="/producers" className="hover:text-ink transition-colors">Producers</Link>
          </nav>
        </div>
      </footer>

    </div>
  );
}
