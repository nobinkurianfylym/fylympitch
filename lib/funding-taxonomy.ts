// lib/funding-taxonomy.ts
//
// One taxonomy, shared by every path that writes an opportunity.
//
// `opportunities.formats` is project_format[] and `opportunities.stages` is
// project_stage[]. Postgres rejects the WHOLE row if a single array element is
// not in the enum, so an extraction containing "distribution" or "animated"
// used to lose the entire fund at admin-approval time. The Edge Function had a
// filter; the admin approve path did not. This module is that one filter.
//
// It maps rather than drops. A bare allow-list threw away "animated" even
// though it plainly means "animation", so real funds lost real data for a
// spelling difference. Anything genuinely outside the taxonomy is still
// dropped, but it drops the value, never the fund.

export const FORMATS = ["feature", "short", "documentary", "series", "animation"] as const;
export const STAGES  = ["development", "pre_production", "production", "post_production", "completed"] as const;
export const CAREER  = ["debut", "second_film", "established", "veteran"] as const;

// opportunities.opp_type is the `opportunity_type` enum. This list is the enum
// itself, read from the database, so anything outside it is rejected at insert.
// The extractor invents types ("festival", "development_fund"), so an unknown
// value falls back to "grant" rather than failing the whole row.
export const OPP_TYPES = [
  "grant", "fund", "lab", "co_production", "market", "distribution", "investor",
  "broadcaster", "streamer", "sales_agent", "producer", "brand_integration",
  "crowdfunding", "production_company", "studio", "sponsor", "pre_sale",
  "tax_incentive", "residency", "mentorship", "writing_fellowship", "pitch_forum",
  "donation", "fiscal_sponsorship", "seed_funding", "community_funding",
  "cash_rebate", "production_rebate", "regional_incentive", "location_incentive",
  "angel_investor", "venture_capital", "gap_financing", "product_placement",
  "private_fund", "co_producer", "post_production_grant", "post_production_fund",
  "world_sales", "content_buyer", "music_rights", "film_festival",
  "theatrical_distribution", "ott_distribution", "tv_distribution",
  "digital_aggregator", "educational_distribution", "airline_distribution",
  "finishing_fund",
] as const;

export type OppType = (typeof OPP_TYPES)[number];

export type Format = (typeof FORMATS)[number];
export type Stage  = (typeof STAGES)[number];
export type Career = (typeof CAREER)[number];

/** lower-case, collapse whitespace, treat - and _ as spaces. So "post-production",
 *  "post_production" and "Post Production" all arrive at the same key. */
function key(value: unknown): string {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// A term can legitimately mean two things at once. "animated feature" is both
// an animation and a feature, and `formats` is an array, so it gets both.
const FORMAT_MAP: Record<string, readonly Format[]> = {
  // canonical
  "feature": ["feature"],
  "short": ["short"],
  "documentary": ["documentary"],
  "series": ["series"],
  "animation": ["animation"],
  // animation
  "animated": ["animation"],
  "animated film": ["animation"],
  "animation film": ["animation"],
  "anime": ["animation"],
  "cartoon": ["animation"],
  "animated feature": ["animation", "feature"],
  "animated feature film": ["animation", "feature"],
  "animated documentary": ["animation", "documentary"],
  "animated doc": ["animation", "documentary"],
  "animated short": ["animation", "short"],
  "animated short film": ["animation", "short"],
  "animated series": ["animation", "series"],
  // feature
  "feature film": ["feature"],
  "feature films": ["feature"],
  "fiction feature": ["feature"],
  "narrative feature": ["feature"],
  "fiction": ["feature"],
  "live action": ["feature"],
  "long form": ["feature"],
  // short
  "short film": ["short"],
  "short films": ["short"],
  "shorts": ["short"],
  "short form": ["short"],
  // documentary
  "doc": ["documentary"],
  "docs": ["documentary"],
  "documentaries": ["documentary"],
  "documentary film": ["documentary"],
  "documentary feature": ["documentary", "feature"],
  "feature documentary": ["documentary", "feature"],
  "documentary short": ["documentary", "short"],
  "non fiction": ["documentary"],
  "nonfiction": ["documentary"],
  "creative documentary": ["documentary"],
  // series
  "tv series": ["series"],
  "television series": ["series"],
  "tv": ["series"],
  "television": ["series"],
  "drama series": ["series"],
  "web series": ["series"],
  "episodic": ["series"],
  "mini series": ["series"],
  "miniseries": ["series"],
  "limited series": ["series"],
  "serial": ["series"],
};

const STAGE_MAP: Record<string, readonly Stage[]> = {
  // canonical
  "development": ["development"],
  "pre production": ["pre_production"],
  "production": ["production"],
  "post production": ["post_production"],
  "completed": ["completed"],
  // development
  "script development": ["development"],
  "screenwriting": ["development"],
  "writing": ["development"],
  "treatment": ["development"],
  "concept": ["development"],
  "early development": ["development"],
  // pre-production
  "prep": ["pre_production"],
  "packaging": ["pre_production"],
  "financing": ["pre_production"],
  "pre prod": ["pre_production"],
  // production
  "principal photography": ["production"],
  "shooting": ["production"],
  "filming": ["production"],
  "in production": ["production"],
  // post-production
  "post": ["post_production"],
  "postproduction": ["post_production"],
  "finishing": ["post_production"],
  "rough cut": ["post_production"],
  "picture lock": ["post_production"],
  "editing": ["post_production"],
  // completed. A distribution-stage fund supports films that are already
  // finished and heading to release, so `completed` is the honest mapping.
  "distribution": ["completed"],
  "theatrical distribution": ["completed"],
  "release": ["completed"],
  "released": ["completed"],
  "exhibition": ["completed"],
  "theatrical release": ["completed"],
  "sales": ["completed"],
  "market": ["completed"],
  "finished": ["completed"],
  "final cut": ["completed"],
  "delivered": ["completed"],
  "finished film": ["completed"],
};

const CAREER_MAP: Record<string, readonly Career[]> = {
  "debut": ["debut"],
  "second film": ["second_film"],
  "established": ["established"],
  "veteran": ["veteran"],
  "first film": ["debut"],
  "first feature": ["debut"],
  "emerging": ["debut"],
  "first time": ["debut"],
  "first time director": ["debut"],
  "newcomer": ["debut"],
  "sophomore": ["second_film"],
  "mid career": ["established"],
  "experienced": ["established"],
  "senior": ["veteran"],
  "master": ["veteran"],
};

/** Map each raw term through the table, keep what resolves, drop what does not,
 *  de-duplicate, and preserve the canonical order. */
function resolve<T extends string>(
  raw: unknown,
  map: Record<string, readonly T[]>,
  canonical: readonly T[],
): T[] {
  const list = Array.isArray(raw) ? raw : raw == null ? [] : [raw];
  const hits = new Set<T>();
  for (const item of list) {
    for (const mapped of map[key(item)] ?? []) hits.add(mapped);
  }
  return canonical.filter(c => hits.has(c));
}

export const normalizeFormats       = (raw: unknown): Format[] => resolve(raw, FORMAT_MAP, FORMATS);
export const normalizeStages        = (raw: unknown): Stage[]  => resolve(raw, STAGE_MAP,  STAGES);
// career_stages is a plain text[] column, not an enum, so an unrecognised term
// cannot break the insert. Map what we recognise onto the canonical vocabulary
// and keep the rest rather than throwing away information the database accepts.
export function normalizeCareerStages(raw: unknown): string[] {
  const list = Array.isArray(raw) ? raw : raw == null ? [] : [raw];
  const out = new Set<string>();
  for (const item of list) {
    const k = key(item);
    if (!k) continue;
    const mapped = CAREER_MAP[k];
    if (mapped) { for (const m of mapped) out.add(m); } else { out.add(k); }
  }
  return [...out];
}

/** Unknown or missing opp_type falls back to "grant" so the row still saves. */
export function normalizeOppType(raw: unknown): OppType {
  const k = key(raw).replace(/ /g, "_");
  return (OPP_TYPES as readonly string[]).includes(k) ? (k as OppType) : "grant";
}

/** Everything an opportunity write needs, cleaned in one call. */
export function normalizeTaxonomy(d: Record<string, unknown>): {
  formats: Format[];
  stages: Stage[];
  career_stages: string[];
  opp_type: OppType;
} {
  return {
    formats:       normalizeFormats(d.formats),
    stages:        normalizeStages(d.stages),
    career_stages: normalizeCareerStages(d.career_stages),
    opp_type:      normalizeOppType(d.opp_type),
  };
}
