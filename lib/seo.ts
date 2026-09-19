// ─────────────────────────────────────────────────────────────────────────────
// Central SEO utilities. Single source of truth for the canonical host, URL
// building, and — most importantly — the INDEXATION THRESHOLD that keeps the
// programmatic surface on the right side of Google's scaled-content policy.
//
// Rule of thumb (post March-2026 core update): a page is only allowed to compete
// in the index when it carries enough real, verified, unique data to genuinely
// help a searcher. Everything else stays `noindex, follow` — still crawlable and
// link-passing, just not dragging domain quality down as a thin page.
// ─────────────────────────────────────────────────────────────────────────────

export const SITE = {
  name: "PITCH.FYLYM",
  host: "https://pitch.fylym.com",
  twitter: "@fylymhq",
  defaultOgImage: "https://pitch.fylym.com/og-default.png",
} as const;

/** Build an absolute, canonical URL from a path. */
export function absoluteUrl(path = "/"): string {
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${SITE.host}${p}`;
}

// ── Page metadata builder ────────────────────────────────────────────────────
//
// Every page was hand-rolling its own metadata object, and they had drifted:
// some declared openGraph and some did not, some set a canonical and some did
// not, and the ones that forgot openGraph shared with NO image at all — a
// page-level openGraph replaces the root layout's outright rather than merging
// with it, which is the single most-repeated mistake in this codebase.
//
// One builder, so a page states what it is about and gets a complete, correct
// head every time.

export interface PageMetaInput {
  /** ~50-60 chars. The site name is appended — do not include it. */
  title: string;
  /** ~120-160 chars. Written for a human reading a result, not for a crawler. */
  description: string;
  /** Site-relative path, e.g. "/opportunities". Becomes the canonical URL. */
  path: string;
  /** Absolute URL or site-relative path. Defaults to the 1200x630 site card. */
  image?: string | null;
  /** Portrait artwork (a poster) shares as a summary card, not letterboxed. */
  imageIsPortrait?: boolean;
  /** Defaults to indexable. Pass false for gated, thin or transactional pages. */
  index?: boolean;
  /** "website" (default) or "article". */
  type?: "website" | "article";
}

/**
 * Build a complete Metadata object: title, description, canonical, OpenGraph
 * and Twitter, all consistent with each other.
 */
export function pageMetadata(input: PageMetaInput) {
  const {
    title, description, path, image = null,
    imageIsPortrait = false, index = true, type = "website",
  } = input;

  const fullTitle = title.includes(SITE.name) ? title : `${title} — ${SITE.name}`;
  const url = absoluteUrl(path);
  const img = image || "/og-default.png";

  return {
    title: fullTitle,
    description,
    alternates: { canonical: url },
    robots: index ? ROBOTS_INDEX : ROBOTS_NOINDEX,
    openGraph: {
      title: fullTitle,
      description,
      url,
      siteName: SITE.name,
      type,
      images: image && imageIsPortrait
        ? [{ url: img, alt: title }]
        : [{ url: img, width: 1200, height: 630, alt: title }],
    },
    twitter: {
      // A portrait poster centre-cropped into a large card loses its title
      // treatment at the top and its credits at the bottom. Shown small and
      // uncropped beside the text instead.
      card: imageIsPortrait ? ("summary" as const) : ("summary_large_image" as const),
      title: fullTitle,
      description,
      images: [img],
    },
  };
}

/** Trim a body of text into a meta description without cutting mid-word. */
export function metaDescription(text: string | null | undefined, max = 158): string {
  const clean = (text ?? "").replace(/\s+/g, " ").trim();
  if (!clean) return "";
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  return (lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).replace(/[,;:.\s]+$/, "") + "…";
}

/** Next.js `robots` metadata object for an indexable page. */
export const ROBOTS_INDEX = {
  index: true,
  follow: true,
  googleBot: { index: true, follow: true, "max-image-preview": "large" as const },
} as const;

/** Next.js `robots` metadata object for a crawlable-but-not-indexable page. */
export const ROBOTS_NOINDEX = {
  index: false,
  follow: true,
  googleBot: { index: false, follow: true },
} as const;

// ── Opportunity indexation threshold ─────────────────────────────────────────

/** Permissive shape — we only read fields, all optional, to stay decoupled. */
export type OpportunityLike = {
  is_active?: boolean | null;
  is_producer_post?: boolean | null;
  posted_by_producer_id?: string | null;
  title?: string | null;
  slug?: string | null;
  description?: string | null;
  opp_type?: string | null;
  country?: string | null;
  region?: string | null;
  deadline?: string | null;
  max_award_usd?: number | null;
  eligible_countries?: string[] | null;
  career_stages?: string[] | null;
  app_link?: string | null;
  apply_method?: string | null;
  organization_name?: string | null;
};

const MIN_DESCRIPTION_CHARS = 120;

/**
 * Decide whether an opportunity page earns a place in the index.
 *
 * Indexable only when the record is live, public (not a transient producer
 * brief), has a real title + slug, a substantive description, AND at least one
 * hard fact a filmmaker would search for (an award figure, a deadline, or an
 * eligibility signal). Producer-posted briefs are intentionally kept out of the
 * index for now — they are ephemeral asks, not durable reference content.
 */
export function opportunityIndexability(opp: OpportunityLike): {
  index: boolean;
  reason: string;
} {
  if (!opp.is_active) return { index: false, reason: "inactive" };
  if (opp.is_producer_post || opp.posted_by_producer_id)
    return { index: false, reason: "producer_brief" };
  if (!opp.title || !opp.slug) return { index: false, reason: "missing_title_or_slug" };

  const descLen = (opp.description ?? "").trim().length;
  if (descLen < MIN_DESCRIPTION_CHARS)
    return { index: false, reason: "thin_description" };

  const hasHardFact =
    opp.max_award_usd != null ||
    !!opp.deadline ||
    !!opp.country ||
    !!opp.region ||
    (opp.eligible_countries?.length ?? 0) > 0 ||
    (opp.career_stages?.length ?? 0) > 0;

  if (!hasHardFact) return { index: false, reason: "no_hard_facts" };

  return { index: true, reason: "ok" };
}

/** Convenience: the robots metadata object for an opportunity. */
export function opportunityRobots(opp: OpportunityLike) {
  return opportunityIndexability(opp).index ? ROBOTS_INDEX : ROBOTS_NOINDEX;
}

// ── Profile indexation threshold ─────────────────────────────────────────────

export type ProfileLike = {
  username?: string | null;
  full_name?: string | null;
  bio?: string | null;
  role?: string | null;
  company?: string | null;
};

export function profileIndexability(p: ProfileLike): { index: boolean; reason: string } {
  if (!p.username) return { index: false, reason: "no_username" };
  if (!p.full_name && !p.company) return { index: false, reason: "no_name" };
  if ((p.bio ?? "").trim().length < 60) return { index: false, reason: "thin_bio" };
  return { index: true, reason: "ok" };
}
export function profileRobots(p: ProfileLike) {
  return profileIndexability(p).index ? ROBOTS_INDEX : ROBOTS_NOINDEX;
}

// ── Project indexation threshold ─────────────────────────────────────────────

export type ProjectLike = {
  slug?: string | null;
  title?: string | null;
  logline?: string | null;
  synopsis?: string | null;
  is_public?: boolean | null;
  admin_hidden?: boolean | null;
};

export function projectIndexability(p: ProjectLike): { index: boolean; reason: string } {
  if (!p.is_public) return { index: false, reason: "not_public" };
  if (p.admin_hidden) return { index: false, reason: "admin_hidden" };
  if (!p.slug || !p.title) return { index: false, reason: "missing_slug_or_title" };
  const body = `${p.logline ?? ""} ${p.synopsis ?? ""}`.trim();
  if (body.length < 80) return { index: false, reason: "thin_content" };
  return { index: true, reason: "ok" };
}
export function projectRobots(p: ProjectLike) {
  return projectIndexability(p).index ? ROBOTS_INDEX : ROBOTS_NOINDEX;
}
