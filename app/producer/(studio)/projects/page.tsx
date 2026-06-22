import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { upsertProducerProject } from "@/lib/actions";
import FilmIdentity from "@/components/FilmIdentity";
import MessageButton from "@/components/MessageButton";
import LoveButton from "@/components/LoveButton";
import ShareButton from "@/components/ShareButton";

export const dynamic = "force-dynamic";

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

export default async function ProducerProjectsPage({
  searchParams,
}: {
  searchParams: Promise<{ genre?: string; format?: string; q?: string; country?: string; language?: string; filter?: string }>;
}) {
  const { genre, format, q, country, language, filter } = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;

  let query = supabase
    .from("projects")
    .select("id, title, genre, format, stage, country, language, director_name, logline, budget_usd, finance_secured_usd, funding_needed_usd, poster_path, is_public, created_at, owner_id, love_count, filmmaker:profiles!projects_owner_id_fkey(full_name, career_stage)")
    .eq("admin_hidden", false)
    .order("created_at", { ascending: false })
    .limit(100);

  if (genre)    query = query.eq("genre", genre);
  if (format)   query = query.eq("format", format.toLowerCase());
  if (q)        query = (query as any).or(`title.ilike.%${q}%,logline.ilike.%${q}%`);
  if (country)  query = query.ilike("country", `%${country}%`);
  if (language) query = query.ilike("language", `%${language}%`);

  const { data: projects } = await query;

  const projectIds = (projects ?? []).map((p) => p.id);
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
  const scoreMap = new Map<string, number>(
    (intelligenceRows ?? [])
      .filter((r: any) => r.funding_readiness?.score != null)
      .map((r: any) => [r.project_id as string, r.funding_readiness.score as number])
  );

  const display = filter === "passed"
    ? (projects ?? []).filter((p) => crmByProject.get(p.id)?.status === "passed")
    : (projects ?? []).filter((p) => crmByProject.get(p.id)?.status !== "passed");

  const hasFilters = !!(genre || format || q || country || language);
  const clearHref  = `/producer/projects${filter ? `?filter=${filter}` : ""}`;

  return (
    <div className="p-6 md:p-10">
      <div className="flex flex-wrap items-end justify-between gap-4 mb-8">
        <div>
          <p className="eyebrow mb-2">Producer Studio</p>
          <h1 className="font-display text-[32px]">
            {filter === "passed" ? "Passed projects" : "All projects"}
          </h1>
          <p className="mt-2 text-[14px] text-ash">
            {filter === "passed"
              ? "Projects you've passed on."
              : `${display.length} project${display.length !== 1 ? "s" : ""} — including private submissions not visible to the public.`}
          </p>
        </div>
        <Link href="/producer" className="btn-ghost">← Discover</Link>
      </div>

      {/* Filters */}
      <form method="GET" className="flex flex-wrap items-center gap-2 mb-8">
        {filter && <input type="hidden" name="filter" value={filter} />}
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
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {display.map((p) => {
          const crm     = crmByProject.get(p.id);
          const fm      = Array.isArray((p as any).filmmaker) ? (p as any).filmmaker[0] : (p as any).filmmaker;
          const pillCls = crm && crm.status !== "passed" ? PIPELINE_PILL[crm.status]  : null;
          const pillLbl = crm && crm.status !== "passed" ? PIPELINE_LABEL[crm.status] : null;
          const frs     = scoreMap.get(p.id);

          return (
            <FilmIdentity
              key={p.id}
              variant="compact-card"
              project={{
                ...p,
                filmmaker: fm,
                financing_secured_usd: (p as any).finance_secured_usd ?? null,
              }}
              supabaseUrl={supabaseUrl}
              href={`/producer/projects/${p.id}`}
              actions={
                <div className="space-y-2.5">

                  {/* Row 1: pipeline stage pill + FRS score */}
                  <div className="flex items-center justify-between gap-2">
                    {pillCls && pillLbl ? (
                      <span className={`text-[10px] font-medium tracking-[0.1em] uppercase px-2.5 py-1 rounded-full border border-line ${pillCls}`}>
                        {pillLbl}
                      </span>
                    ) : <span />}
                    <Link
                      href={`/dashboard/projects/${p.id}`}
                      title="Funding Readiness Score — view full engine analysis"
                      className="inline-flex items-baseline gap-1 group shrink-0"
                    >
                      <span className="text-[9px] tracking-[0.14em] uppercase text-ash/50 group-hover:text-gold transition-colors font-medium">FRS</span>
                      <span className="font-display text-[20px] leading-none text-gold group-hover:opacity-70 transition-opacity">
                        {frs != null ? frs : "—"}
                      </span>
                    </Link>
                  </div>

                  {/* Row 2: Message + Like + Share */}
                  <div className="flex items-center gap-2">
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

                  {/* Row 3: pipeline action */}
                  {crm && crm.status !== "passed" ? (
                    <Link
                      href="/producer/pipeline"
                      className="block text-center text-[12px] text-gold hover:underline py-1.5"
                    >
                      Open in Pipeline →
                    </Link>
                  ) : (
                    <form action={upsertProducerProject} className="w-full">
                      <input type="hidden" name="project_id" value={p.id} />
                      <input type="hidden" name="status" value="saved" />
                      <button className="btn-ghost !py-1.5 w-full text-[12px]">+ Add to Pipeline</button>
                    </form>
                  )}

                  {/* Pass option — only when not yet in pipeline */}
                  {!crm && (
                    <form action={upsertProducerProject}>
                      <input type="hidden" name="project_id" value={p.id} />
                      <input type="hidden" name="status" value="passed" />
                      <button className="text-[11px] text-ash/60 hover:text-red-500 transition-colors w-full text-center">
                        Pass
                      </button>
                    </form>
                  )}
                </div>
              }
            />
          );
        })}
      </div>

      {display.length === 0 && (
        <div className="py-20 text-center">
          <p className="font-display text-[22px] mb-2">No projects match your filters.</p>
          <p className="text-[14px] text-ash">Try adjusting genre, format, country or language.</p>
        </div>
      )}
    </div>
  );
}
