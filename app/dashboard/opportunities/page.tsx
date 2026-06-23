import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { usd, TYPE_LABEL, CATEGORY_CONFIG, OPP_CATEGORY_MAP } from "@/lib/format";
import { toggleSaved } from "@/lib/actions";
import { OpportunityCategoryBlock, type MatchedProducer } from "./OpportunityCategoryBlock";

export const dynamic = "force-dynamic";

const ALL_TYPES = [
  // Development
  "lab", "residency", "mentorship", "grant", "fund", "writing_fellowship",
  // Packaging & Markets
  "pitch_forum", "co_production", "market",
  // Early Financing
  "crowdfunding", "donation", "fiscal_sponsorship", "seed_funding", "community_funding",
  // Tax Incentives
  "tax_incentive", "cash_rebate", "production_rebate", "regional_incentive", "location_incentive",
  // Private Financing
  "investor", "angel_investor", "venture_capital", "gap_financing",
  "brand_integration", "product_placement", "sponsor", "private_fund",
  // Production
  "producer", "co_producer", "production_company", "studio",
  // Post Production
  "post_production_grant", "post_production_fund", "finishing_fund",
  // Buyers & Sales
  "sales_agent", "world_sales", "broadcaster", "streamer", "pre_sale", "content_buyer", "music_rights",
  // Release & Distribution
  "film_festival", "distribution", "theatrical_distribution", "ott_distribution",
  "tv_distribution", "digital_aggregator", "educational_distribution", "airline_distribution",
];

export default async function OpportunitiesPage({ searchParams }: { searchParams: Promise<{ type?: string; q?: string; sort?: string }> }) {
  const { type, q, sort = "match" } = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  let query = supabase.from("opportunities").select("*").eq("is_active", true);
  if (type && ALL_TYPES.includes(type)) query = query.eq("opp_type", type);
  if (q) query = query.ilike("title", `%${q}%`);
  if (sort !== "match") query = query.order("deadline", { ascending: true, nullsFirst: false });
  const { data: opps } = await query;

  const [
    { data: saved },
    { data: projects },
  ] = await Promise.all([
    supabase.from("saved_opportunities").select("opportunity_id").eq("user_id", user!.id),
    supabase.from("projects").select("id, title").eq("owner_id", user!.id),
  ]);

  const savedIds    = (saved ?? []).map((s) => s.opportunity_id);
  const savedSet    = new Set(savedIds);
  const projectIds  = (projects ?? []).map((p: any) => p.id);

  // Best match score per opportunity
  const matchScores: Record<string, number> = {};
  if (projectIds.length && sort === "match") {
    const { data: matchRows } = await supabase
      .from("matches")
      .select("score, opportunity_id")
      .in("project_id", projectIds)
      .order("score", { ascending: false });

    for (const m of matchRows ?? []) {
      if (!matchScores[m.opportunity_id] || m.score > matchScores[m.opportunity_id]) {
        matchScores[m.opportunity_id] = m.score;
      }
    }
  }

  // Producer matches from engine — aggregate across all projects, keep highest score per producer
  type MatchedProducer = {
    id: string; full_name: string; company: string | null;
    score: number; project_id: string; project_title: string;
    genres: string[]; role: string;
  };
  const producerMap = new Map<string, MatchedProducer>();
  if (projectIds.length) {
    const { data: intelRows } = await supabase
      .from("project_intelligence")
      .select("producer_matches, project_id")
      .in("project_id", projectIds);

    for (const row of intelRows ?? []) {
      const proj = (projects ?? []).find((p: any) => p.id === row.project_id);
      for (const pm of (row.producer_matches ?? [])) {
        if (!pm?.profile?.id) continue; // guard against deleted/malformed profiles
        const existing = producerMap.get(pm.profile.id);
        if (!existing || pm.score > existing.score) {
          producerMap.set(pm.profile.id, {
            id:            pm.profile.id,
            full_name:     pm.profile.full_name,
            company:       pm.profile.company ?? null,
            score:         pm.score,
            project_id:    row.project_id,
            project_title: proj?.title ?? "your project",
            genres:        pm.profile.genres ?? [],
            role:          pm.profile.role ?? "producer",
          });
        }
      }
    }
  }
  const matchedProducers = [...producerMap.values()]
    .filter(p => p.score >= 60)
    .sort((a, b) => b.score - a.score)
    .slice(0, 8);

  const sorted = sort === "match"
    ? [...(opps ?? [])].sort((a, b) => (matchScores[b.id] ?? 0) - (matchScores[a.id] ?? 0))
    : (opps ?? []);

  const hasMatches   = Object.keys(matchScores).length > 0;
  const showCategories = !type && !q;

  const grouped = showCategories
    ? CATEGORY_CONFIG
        .map(cat => ({
          ...cat,
          items: sorted.filter((o: any) => OPP_CATEGORY_MAP[o.opp_type] === cat.key),
        }))
        .filter(g => g.items.length > 0 || (g.key === "production" && matchedProducers.length > 0))
    : null;

  // Flat-list row (used only when filter/search is active — no expand logic needed)
  function OppRow({ o }: { o: any }) {
    const score = matchScores[o.id];
    const days = o.deadline
      ? Math.ceil((new Date(o.deadline).getTime() - Date.now()) / 86_400_000)
      : null;

    function scorePill(s: number) {
      if (s >= 80) return "bg-emerald-50 border-emerald-200 text-emerald-700";
      if (s >= 60) return "bg-gold/10 border-gold/30 text-gold";
      return "bg-parchment border-line text-ash";
    }

    return (
      <div className="hairline py-4 flex items-center justify-between gap-4">
        <div className="shrink-0 w-12 text-center hidden sm:block">
          {score != null ? (
            <span className={`text-[11px] tracking-[0.08em] px-2 py-0.5 rounded-full border ${scorePill(score)}`}>
              {score}
            </span>
          ) : (
            <span className="text-[11px] text-ash/30">—</span>
          )}
        </div>
        <Link href={`/dashboard/opportunities/${o.id}`} className="flex-1 min-w-0 group">
          <div className="font-normal text-[15px] group-hover:text-gold transition-colors truncate">{o.title}</div>
          <div className="mt-0.5 text-[12px] tracking-[0.14em] uppercase text-ash flex flex-wrap gap-x-3">
            <span>{TYPE_LABEL[o.opp_type] ?? o.opp_type}</span>
            {o.region ? <span>{o.region}</span> : o.country ? <span>{o.country}</span> : <span>Worldwide</span>}
            {o.max_award_usd ? <span className="text-gold">up to {usd(o.max_award_usd)}</span> : null}
          </div>
        </Link>
        {days != null && (
          <span className={`shrink-0 text-[11px] tracking-[0.08em] px-2 py-0.5 rounded-full border hidden md:inline-block ${
            days <= 7
              ? "bg-red-50 border-red-200 text-red-600"
              : days <= 30
              ? "bg-amber-50 border-amber-200 text-amber-700"
              : "bg-parchment border-line text-ash"
          }`}>
            {days}d
          </span>
        )}
        <form action={toggleSaved} className="shrink-0">
          <input type="hidden" name="opportunity_id" value={o.id} />
          <button className={`text-[12px] tracking-[0.16em] uppercase ${savedSet.has(o.id) ? "text-gold" : "text-ash hover:text-ink"}`}>
            {savedSet.has(o.id) ? "★" : "Save"}
          </button>
        </form>
      </div>
    );
  }

  return (
    <div>
      <p className="eyebrow mb-3">Database</p>
      <h1 className="font-display text-[34px]">Opportunities</h1>
      <p className="text-[14px] text-ash mt-2 mb-8">
        {hasMatches
          ? "Top 5 per category, sorted by match score against your projects."
          : "Active funding opportunities. Submit a project to see your match scores."}
      </p>

      {/* Filters + sort */}
      <form className="flex flex-wrap gap-3 mb-8" action="/dashboard/opportunities" method="get">
        <input name="q" defaultValue={q ?? ""} placeholder="Search by name…" className="field !w-56" />
        <select name="type" defaultValue={type ?? ""} className="field !w-48">
          <option value="">All types</option>
          {ALL_TYPES.map((t) => <option key={t} value={t}>{TYPE_LABEL[t] ?? t}</option>)}
        </select>
        <select name="sort" defaultValue={sort} className="field !w-40">
          <option value="match">Match score</option>
          <option value="deadline">Deadline</option>
        </select>
        <button className="btn-ghost !px-5 !py-2.5">Filter</button>
        {(type || q) && <a href="/dashboard/opportunities" className="btn-ghost !px-5 !py-2.5 text-ash">Clear</a>}
      </form>

      {/* Categorised view — top 5 per category + expandable */}
      {grouped && (
        <div className="space-y-10">
          {grouped.map(cat => (
            <OpportunityCategoryBlock
              key={cat.key}
              cat={cat}
              items={cat.items}
              matchScores={matchScores}
              savedIds={savedIds}
              matchedProducers={cat.key === "production" ? matchedProducers : []}
            />
          ))}
          {grouped.length === 0 && (
            <p className="text-[14px] text-ash">No opportunities available.</p>
          )}
        </div>
      )}

      {/* Flat list — filter or search active */}
      {!grouped && (
        <div>
          {sorted.map((o: any) => <OppRow key={o.id} o={o} />)}
          {sorted.length === 0 && (
            <p className="hairline py-10 text-[14px] text-ash">No opportunities match that filter.</p>
          )}
        </div>
      )}
    </div>
  );
}
