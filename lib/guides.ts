// Editorial guides. Real, accurate, filmmaker-facing content written to win
// informational head terms and feed the funding database via internal links.

export type Guide = {
  slug: string;
  title: string;
  description: string;
  updated: string; // ISO date
  intro: string;
  sections: { heading: string; paragraphs: string[] }[];
  faqs: { q: string; a: string }[];
  related: { label: string; href: string }[];
};

export const GUIDES: Guide[] = [
  {
    slug: "how-film-tax-credits-work",
    title: "How Film Tax Credits Work",
    description:
      "A plain-English guide to film tax incentives: how credits and rebates are calculated, refundable vs transferable credits, and how producers use them in a budget.",
    updated: "2026-07-01",
    intro:
      "Film tax incentives are one of the most reliable pillars of a production budget because, unlike investors or grants, the amount is calculable in advance. This guide explains how they work, the different forms they take, and how producers turn them into real money.",
    sections: [
      {
        heading: "What a film tax incentive actually is",
        paragraphs: [
          "A film tax incentive returns a percentage of a production's qualifying local spend — typically 20% to 40% — to the producer. Governments offer them to attract production spending, jobs and tourism to their region.",
          "The key phrase is qualifying spend: only money spent locally, on eligible categories, counts toward the incentive. Every programme publishes its own rules on what qualifies, so the same shoot can earn very different amounts in different territories.",
        ],
      },
      {
        heading: "Credit, rebate, or grant",
        paragraphs: [
          "Incentives come in three broad forms. A tax credit reduces the tax the production company owes; if it is refundable, the government pays the balance in cash even when no tax is due. A cash rebate is a direct payment of a percentage of spend, with no tax liability required at all.",
          "Some credits are transferable, meaning a production with no local tax bill can sell the credit to a company that does have one, usually at a small discount. Which form a programme uses determines how quickly and certainly a producer sees the money.",
        ],
      },
      {
        heading: "How producers use incentives in the capital stack",
        paragraphs: [
          "Because the incentive is calculable from a planned budget, a producer can estimate it early and treat it as committed soft money. Many then finance against it: a lender advances cash today secured against the incentive payment that will arrive after production, for a fee.",
          "Stacking a tax incentive with grants and pre-sales reduces the amount of expensive equity a producer must raise, which is why incentives are often the first piece of financing a producer locks in.",
        ],
      },
      {
        heading: "Choosing where to shoot for the incentive",
        paragraphs: [
          "Incentive value should never be the only reason to choose a location, but it is a major factor for footloose productions. Producers compare the headline percentage, the cap (the maximum payable), minimum spend thresholds, and how reliably and quickly the programme pays.",
          "Co-production treaties can layer national incentives from two countries onto the same film, which is why international structuring is so valuable for independent features.",
        ],
      },
    ],
    faqs: [
      {
        q: "Do I need to owe tax to benefit from a film tax credit?",
        a: "Not always. Refundable credits and cash rebates pay out even if the production owes no tax, and transferable credits can be sold to a company that does owe tax.",
      },
      {
        q: "When does the incentive money actually arrive?",
        a: "Usually after production wraps and an audit confirms the qualifying spend. Producers who need the cash sooner finance against the incentive with a short-term loan.",
      },
      {
        q: "Can I combine a tax incentive with grants?",
        a: "Yes. Incentives, grants, rebates and pre-sales are routinely stacked in the same budget to minimise the equity a producer must raise.",
      },
    ],
    related: [
      { label: "Browse tax incentives & rebates", href: "/opportunities/type/tax-incentives" },
      { label: "Film financing glossary", href: "/glossary" },
    ],
  },
  {
    slug: "film-grants-complete-guide",
    title: "Film Grants: A Complete Guide for Filmmakers",
    description:
      "How film grants work, who funds them, what makes an application competitive, and how to find grants you are actually eligible for.",
    updated: "2026-07-01",
    intro:
      "Grants are non-repayable money — the most valuable financing a filmmaker can get, and the most competitive. This guide covers where grants come from, how to find the ones you qualify for, and how to give an application the best chance.",
    sections: [
      {
        heading: "What a film grant is — and isn't",
        paragraphs: [
          "A grant is money awarded to a project or filmmaker that does not have to be repaid. It sits in the soft-money part of a budget alongside tax incentives, and because it carries no return obligation it directly reduces the amount of investment a producer must raise.",
          "Grants almost always come with conditions: a defined use of funds, reporting requirements, and eligibility rules covering who can apply and what kind of project qualifies. Reading those rules carefully is the single most important step before applying.",
        ],
      },
      {
        heading: "Who funds film grants",
        paragraphs: [
          "Grants come from national and regional film funds, arts councils, private foundations, broadcasters, and mission-driven organisations supporting particular subjects or communities. Documentary and socially engaged work has an especially deep pool of foundation and impact funding.",
          "Each funder has a mandate — a region, a genre, a stage of production, or a community it exists to support. Matching your project to a funder's mandate matters more than the size of the award.",
        ],
      },
      {
        heading: "What makes an application competitive",
        paragraphs: [
          "Strong applications answer the funder's actual question. They show a clear artistic vision, a realistic budget and timeline, and — crucially — a specific fit with the funder's mandate. Generic applications sent to many funders unchanged tend to fail.",
          "Evidence of feasibility helps: a developed script or treatment, a director's track record or samples, attached collaborators, and a plan for how the money moves the project forward. For later-stage grants, showing other committed financing signals that the project is real.",
        ],
      },
      {
        heading: "Finding grants you're eligible for",
        paragraphs: [
          "The fastest way to waste effort is to apply for grants you cannot win because you are not eligible. Filter by your country and residency, your project's stage and format, and any audience-specific criteria before you write a word.",
          "A structured, verified database lets you filter on exactly those fields — country, funding type, career stage and deadline — so you spend your time only on opportunities that fit.",
        ],
      },
    ],
    faqs: [
      {
        q: "Do film grants have to be repaid?",
        a: "No. A grant is non-repayable money. Some development support is structured as a recoupable advance instead, so always check whether an award is a true grant or a repayable advance.",
      },
      {
        q: "Can international filmmakers apply for film grants?",
        a: "It depends entirely on the funder. Many grants are restricted by nationality or residency, while others are open internationally. Eligibility is the first thing to confirm.",
      },
      {
        q: "How do I find grants I actually qualify for?",
        a: "Filter by country, project stage, format and any audience criteria before applying. A verified, filterable database makes this far faster than scanning static lists.",
      },
    ],
    related: [
      { label: "Browse grants & funds", href: "/opportunities/type/grants-funds" },
      { label: "Browse funding by country", href: "/opportunities/country" },
      { label: "Upcoming deadlines", href: "/deadlines" },
    ],
  },
];

const BY_SLUG = new Map(GUIDES.map((g) => [g.slug, g]));
export function guideBySlug(slug: string): Guide | undefined {
  return BY_SLUG.get(slug);
}
