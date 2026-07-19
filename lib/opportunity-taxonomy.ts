// ─────────────────────────────────────────────────────────────────────────────
// Hub taxonomy. Groups the ~30 raw opp_type values into a handful of SEO-facing
// families so hub pages are fewer, richer, and more likely to clear the ≥3-record
// indexation threshold (rather than one thin page per raw type).
// ─────────────────────────────────────────────────────────────────────────────

export type OpportunityFamily = {
  slug: string;
  label: string; // Title Case, e.g. "Grants & Funds"
  noun: string; // lower-case plural for intro copy, e.g. "grants and funds"
  description: string;
  types: string[]; // raw opp_type values that belong to this family
};

export const OPPORTUNITY_FAMILIES: OpportunityFamily[] = [
  {
    slug: "grants-funds",
    label: "Grants & Funds",
    noun: "grants and funds",
    description:
      "Non-repayable grants, development and production funds, fellowships and other soft-money support for filmmakers.",
    types: [
      "grant",
      "fund",
      "seed_funding",
      "community_funding",
      "crowdfunding",
      "donation",
      "fiscal_sponsorship",
      "writing_fellowship",
    ],
  },
  {
    slug: "labs-residencies",
    label: "Labs & Residencies",
    noun: "labs and residencies",
    description:
      "Development labs, residencies and mentorship programmes that develop projects and filmmakers.",
    types: ["lab", "residency", "mentorship"],
  },
  {
    slug: "markets-coproduction",
    label: "Markets & Co-Production",
    noun: "markets and co-production programmes",
    description:
      "Film markets, pitching forums and co-production platforms where projects meet financiers and partners.",
    types: ["pitch_forum", "co_production", "market"],
  },
  {
    slug: "tax-incentives",
    label: "Tax Incentives & Rebates",
    noun: "tax incentives and rebates",
    description:
      "Government tax credits, cash rebates and regional incentives that lower the cost of production.",
    types: [
      "tax_incentive",
      "cash_rebate",
      "production_rebate",
      "regional_incentive",
      "location_incentive",
    ],
  },
  {
    slug: "investors-financing",
    label: "Investors & Financing",
    noun: "investors and financing sources",
    description:
      "Equity investors, gap financiers and other private capital sources for independent film.",
    types: ["investor", "angel_investor", "venture_capital", "gap_financing", "brand_integration"],
  },
];

const FAMILY_BY_SLUG = new Map(OPPORTUNITY_FAMILIES.map((f) => [f.slug, f]));
const FAMILY_BY_TYPE = new Map<string, OpportunityFamily>();
for (const fam of OPPORTUNITY_FAMILIES) for (const t of fam.types) FAMILY_BY_TYPE.set(t, fam);

export function familyBySlug(slug: string): OpportunityFamily | undefined {
  return FAMILY_BY_SLUG.get(slug);
}
export function familyForType(oppType?: string | null): OpportunityFamily | undefined {
  return oppType ? FAMILY_BY_TYPE.get(oppType) : undefined;
}

// ── Country slugs ────────────────────────────────────────────────────────────

export function countrySlug(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// Reserved first-segment words under /opportunities that are hub routes, not slugs.
export const RESERVED_OPP_SEGMENTS = new Set(["type", "country", "submit", "for"]);
