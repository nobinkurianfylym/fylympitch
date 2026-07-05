import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { upsertProducerProject } from "@/lib/actions";
import FilmIdentity from "@/components/FilmIdentity";
import MessageButton from "@/components/MessageButton";
import LoveButton from "@/components/LoveButton";
import ShareButton from "@/components/ShareButton";
import FRSButton from "@/components/FRSButton";
import SaveToPipelineButton from "@/components/SaveToPipelineButton";

export const dynamic = "force-dynamic";

export default async function ProducerProjectsPage({
  searchParams,
}: {
  searchParams: Promise<{ genre?: string; format?: string; q?: string; country?: string; language?: string; view?: string }>;
}) {
  const FORMATS = ["Feature", "Documentary", "Series", "Animation"];
  const GENRES  = ["Drama", "Thriller", "Comedy", "Documentary", "Horror", "Romance", "Action", "Animation", "Sci-Fi"];
  const PIPELINE_PILL: Record<string, string> = {
    saved:       "bg-parchment text-ash",
    shortlisted: "bg-blue-50 text-blue-700",
    in_review:   "bg-amber-50 text-amber-700",
    meeting_set: "bg-emerald-50 text-emerald-700",
    deal_active: "bg-gold/10 text-gold",
  };
  const PIPELINE_LABEL: Record<string, string> = {
    saved: "Saved", shortlisted: "Shortlisted", in_review: "In Review",
    meeting_set: "Meeting Set", deal_active: "Deal Active",
  };

  const { genre, format, q, country, language, view } = await searchParams;
  const showPassed = view === "passed";

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;

  let query = supabase
    .from("projects")
    .select("id, title, genre, format, stage, country, language, director_name, logline, budget_usd, finance_secured_usd, funding_needed_usd, poster_path, pitch_deck_path, is_public, created_at, owner_id, love_count, filmmaker:profiles!projects_owner_id_fkey(full_name, username, career_stage)")
    .eq("admin_hidden", false)
    .is("target_producer_id", null)
    .order("created_at", { ascending: false })
    .limit(100);

  if (genre)    query = query.eq("genre", genre);
  if (format)   query = query.eq("format", format.toLowerCase());
  if (q)        query = (query as any).or(`title.ilike.%${q}%,logline.ilike.%${q}%`);
  if (country)  query = query.ilike("country", `%${country}%`);
  if (language) query = query.ilike("language", `%${language}%`);

  const { data: projects } = await query;

  const projectIds = (projects ?? []).map((p) => p.id);

  // Bulk signed URLs for pitch deck cover tiles (poster takes priority when present)
  const deckUrlMap = new Map<string, string>();
  await Promise.all(
    (projects ?? [])
      .filter((p: any) => !p.poster_path && p.pitch_deck_path)
      .map(async (p: any) => {
        const { data } = await supabase.storage.from("pitch-decks").createSignedUrl(p.pitch_deck_path, 3600);
        if (data?.signedUrl) deckUrlMap.set(p.id, data.signedUrl);
      })
  );

  const [{ data: crmRows }, { data: intelligenceRows }] = await Promise.all([
    projectIds.length
      ? supabase.from("producer_projects").select("project_id, status, rating")
          .eq("producer_id", user.id).in("project_id", projectIds)
      : { data: [] },
    projectIds.length
      ? supabase.from("project_intelligence").select("project_id, funding_readiness")
          .in("project_id", projectIds)
      : { data: [] },
  ]);

  const crmByProject = new Map((crmRows ?? []).map((r) => [r.project_id, r]));
  const frsMap = new Map<string, { score: number; missing: string[]; fund_requirements?: string[] }>(
    (intelligenceRows ?? [])
      .filter((r: any) => r.funding_readiness?.score != null)
      .map((r: any) => [r.project_id as string, r.funding_readiness])
  );

  const allProjects  = projects ?? [];
  const passedInView = allProjects.filter((p) => crmByProject.get(p.id)?.status === "passed");
  const passedCount  = passedInView.length;

  // All passed: every project in current search scope has been passed
  const allPassed = allProjects.length > 0 && passedCount === allProjects.length;

  // What to display
  const display = showPassed
    ? passedInView
    : allProjects.filter((p) => crmByProject.get(p.id)?.status !== "passed");

  const hasFilters = !!(genre || format || q || country || language);

  // Build base href for filters (preserves view param)
  const viewParam   = showPassed ? "&view=passed" : "";
  const clearHref   = `/producerstudio/projects${showPassed ? "?view=passed" : ""}`;

  // Tab hrefs — preserve search filters when switching tabs
  const filterParams = new URLSearchParams();
  if (genre)    filterParams.set("genre", genre);
  if (format)   filterParams.set("format", format);
  if (q)        filterParams.set("q", q);
  if (country)  filterParams.set("country", country);
  if (language) filterParams.set("language", language);
  const filterStr        = filterParams.toString();
  const discoverTabHref  = `/producerstudio/projects${filterStr ? `?${filterStr}` : ""}`;
  const passedTabHref    = `/producerstudio/projects?view=passed${filterStr ? `&${filterStr}` : ""}`;

  return (
    <div className="p-6 md:p-10">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4 mb-8">
        <div>
          <p className="eyebrow mb-2">Producer Studio</p>
          <h1 className="font-display text-[32px]">
            {showPassed ? "Passed projects" : "All projects"}
          </h1>
          <p className="mt-2 text-[14px] text-ash">
            {showPassed
              ? `${display.length} project${display.length !== 1 ? "s" : ""} you've passed on.`
              : `${display.length} project${display.length !== 1 ? "s" : ""} — including private submissions not visible to the public.`}
          </p>
        </div>
        <Link href="/producerstudio" className="btn-ghost">← Discover</Link>
      </div>

      {/* ── Tab bar: shown only when all projects in view have been passed ── */}
      {allPassed && (
        <div className="flex items-center gap-1 mb-8 border-b border-line">
          <Link
            href={discoverTabHref}
            className={`px-4 py-2.5 text-[12px] tracking-[0.12em] uppercase font-medium transition-colors border-b-2 -mb-px ${
              !showPassed
                ? "border-ink text-ink"
                : "border-transparent text-ash hover:text-ink"
            }`}
          >
            All Projects
          </Link>
          <Link
            href={passedTabHref}
            className={`px-4 py-2.5 text-[12px] tracking-[0.12em] uppercase font-medium transition-colors border-b-2 -mb-px ${
              showPassed
                ? "border-ink text-ink"
                : "border-transparent text-ash hover:text-ink"
            }`}
          >
            Passed ({passedCount})
          </Link>
        </div>
      )}

      {/* Filters */}
      <form method="GET" className="flex flex-wrap items-center gap-2 mb-8">
        {showPassed && <input type="hidden" name="view" value="passed" />}
        <input
          name="q"
          defaultValue={q ?? ""}
          placeholder="Search title or logline…"
          className="field !w-52 !py-2 !text-[13px]"
        />
        <select name="genre" defaultValue={genre ?? ""} className="field !w-36 !py-2 !text-[13px]">
          <option value="">All genres</option>
          {GENRES.map((g) => <option key={g} value={g}>{g}</option>)}
        </select>
        <select name="format" defaultValue={format ?? ""} className="field !w-32 !py-2 !text-[13px]">
          <option value="">All formats</option>
          {FORMATS.map((f) => <option key={f} value={f.toLowerCase()}>{f}</option>)}
        </select>
        <input name="country"  defaultValue={country  ?? ""} placeholder="Country"  className="field !w-28 !py-2 !text-[13px]" />
        <input name="language" defaultValue={language ?? ""} placeholder="Language" className="field !w-28 !py-2 !text-[13px]" />
        <button className="btn-ghost !py-2 !text-[12px]">Filter</button>
        {hasFilters && <a href={clearHref} className="btn-ghost !py-2 !text-[12px] text-ash">Clear</a>}
      </form>

      {/* Project grid */}
      {display.length > 0 ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {display.map((p) => {
            const crm     = crmByProject.get(p.id);
            const fm      = Array.isArray((p as any).filmmaker) ? (p as any).filmmaker[0] : (p as any).filmmaker;
            const isPassed = crm?.status === "passed";
            const pillCls = crm && !isPassed ? PIPELINE_PILL[crm.status]  : null;
            const pillLbl = crm && !isPassed ? PIPELINE_LABEL[crm.status] : null;
            const frs     = frsMap.get(p.id);

            return (
              <FilmIdentity
                key={p.id}
                variant="compact-card"
                project={{
                  ...p,
                  filmmaker: fm,
                  financing_secured_usd: (p as any).finance_secured_usd ?? null,
                  deckUrl: deckUrlMap.get(p.id) ?? null,
                }}
                supabaseUrl={supabaseUrl}
                href={`/producerstudio/projects/${p.id}`}
                actions={
                  <div className="space-y-2.5">

                    {/* Passed badge */}
                    {isPassed && (
                      <span className="inline-flex text-[10px] font-medium tracking-[0.1em] uppercase px-2.5 py-1 rounded-full border border-line bg-parchment text-ash">
                        Passed
                      </span>
                    )}

                    {/* Pipeline stage pill */}
                    {pillCls && pillLbl && (
                      <Link href="/producerstudio/pipeline"
                        className={`inline-flex text-[10px] font-medium tracking-[0.1em] uppercase px-2.5 py-1 rounded-full border border-line hover:opacity-80 transition-opacity ${pillCls}`}>
                        {pillLbl} →
                      </Link>
                    )}

                    {/* Action row: FRS · Message · Like · Share */}
                    <div className="flex items-center gap-2">
                      <FRSButton
                        score={frs?.score ?? null}
                        missing={frs?.missing ?? []}
                        fundRequirements={frs?.fund_requirements}
                        projectTitle={p.title}
                      />
                      <MessageButton
                        projectId={p.id}
                        producerId={user.id}
                        filmakerId={(p as any).owner_id}
                        label="Message"
                        className="btn-ghost !py-1.5 !px-3 text-[12px] gap-1.5 flex-1"
                      />
                      <LoveButton
                        projectId={p.id}
                        initialCount={(p as any).love_count ?? 0}
                        initialLiked={false}
                        isLoggedIn={true}
                        size="sm"
                      />
                      <ShareButton
                        projectId={p.id}
                        title={p.title}
                        genre={p.genre}
                        country={p.country}
                        size="sm"
                      />
                    </div>

                    {/* Pipeline / pass actions — hidden in passed view */}
                    {!isPassed && (
                      <>
                        {crm ? (
                          <Link
                            href="/producerstudio/pipeline"
                            className="block text-center text-[12px] text-gold hover:underline py-1.5"
                          >
                            Open in Pipeline →
                          </Link>
                        ) : (
                          <SaveToPipelineButton projectId={p.id} />
                        )}
                        {!crm && (
                          <form action={upsertProducerProject}>
                            <input type="hidden" name="project_id" value={p.id} />
                            <input type="hidden" name="status" value="passed" />
                            <button className="text-[11px] text-ash/60 hover:text-red-500 transition-colors w-full text-center">
                              Pass
                            </button>
                          </form>
                        )}
                      </>
                    )}
                  </div>
                }
              />
            );
          })}
        </div>
      ) : (
        <div className="py-20 text-center">
          {allPassed && !showPassed ? (
            <>
              <p className="font-display text-[22px] mb-3">You've reviewed everything</p>
              <p className="text-ash text-[15px] mb-6 max-w-sm mx-auto">
                You've passed on all projects here. Revisit them or wait for new submissions.
              </p>
              <Link href={passedTabHref} className="btn-ghost">
                View passed ({passedCount})
              </Link>
            </>
          ) : (
            <>
              <p className="font-display text-[22px] mb-2">No projects match your filters.</p>
              <p className="text-[14px] text-ash">Try adjusting genre, format, country or language.</p>
            </>
          )}
        </div>
      )}
    </div>
  );
}
