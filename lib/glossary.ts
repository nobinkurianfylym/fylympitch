// Film-financing glossary. Concise, accurate definitions written for filmmakers.
// Definitional content like this is disproportionately cited by AI answer engines,
// so each entry is self-contained and factual.

export type GlossaryTerm = {
  slug: string;
  term: string;
  short: string; // one-line, used for meta description
  definition: string; // 2-4 sentences
  related: string[]; // slugs
  hub?: { label: string; href: string };
};

export const GLOSSARY: GlossaryTerm[] = [
  {
    slug: "co-production-treaty",
    term: "Co-Production Treaty",
    short: "A bilateral government agreement letting a film qualify as national in two or more countries.",
    definition:
      "A co-production treaty is an agreement between two or more countries that allows a film made jointly by producers from those countries to be treated as a national production in each. That national status unlocks each country's public funding, tax incentives and broadcast quotas for the same film. Treaties set minimum thresholds for each partner's creative and financial contribution.",
    related: ["minority-co-production", "soft-money", "tax-incentive"],
    hub: { label: "Browse co-production programmes", href: "/opportunities/type/markets-coproduction" },
  },
  {
    slug: "minority-co-production",
    term: "Minority Co-Production",
    short: "A co-production where one partner contributes the smaller share of financing and creative input.",
    definition:
      "In a minority co-production, one country's producer holds the smaller stake — typically 20–40% of the budget and a proportionate share of cast, crew and spend. Many national funds run dedicated minority co-production schemes so local producers can attach to strong foreign-led projects while still accessing domestic incentives.",
    related: ["co-production-treaty", "soft-money"],
  },
  {
    slug: "soft-money",
    term: "Soft Money",
    short: "Non-repayable film financing such as grants, tax credits and rebates.",
    definition:
      "Soft money is financing that does not have to be repaid from a film's revenue — grants, tax credits, cash rebates and regional incentives. It is contrasted with hard money (equity and loans), which expects a return. Soft money often anchors an independent film's budget because it reduces the amount of recoupable capital a producer must raise.",
    related: ["hard-money", "tax-incentive", "cash-rebate", "gap-financing"],
    hub: { label: "Browse grants & funds", href: "/opportunities/type/grants-funds" },
  },
  {
    slug: "hard-money",
    term: "Hard Money",
    short: "Repayable film financing — equity investment and loans that expect a return.",
    definition:
      "Hard money is capital that expects to be paid back with a return: equity from investors and loans from lenders. It sits at the front of the recoupment waterfall and is the most expensive part of a film's capital stack. Producers generally minimise hard money by first maximising soft money and pre-sales.",
    related: ["soft-money", "gap-financing", "recoupment"],
    hub: { label: "Browse investors & financing", href: "/opportunities/type/investors-financing" },
  },
  {
    slug: "tax-incentive",
    term: "Film Tax Incentive",
    short: "A government credit or rebate that returns a percentage of qualifying local production spend.",
    definition:
      "A film tax incentive returns a percentage of a production's qualifying local spend, usually 20–40%, as a tax credit or cash payment. Some credits are refundable (paid even if no tax is owed) or transferable (sellable to a third party). Incentives are one of the most reliable pillars of a film budget because the amount is calculable in advance from planned local spend.",
    related: ["cash-rebate", "soft-money", "co-production-treaty"],
    hub: { label: "Browse tax incentives", href: "/opportunities/type/tax-incentives" },
  },
  {
    slug: "cash-rebate",
    term: "Cash Rebate",
    short: "A direct cash payment of a percentage of qualifying spend, paid after production.",
    definition:
      "A cash rebate returns a set percentage of qualifying local spend as a direct payment rather than a tax credit, so the producer does not need a tax liability to benefit. Rebates are typically paid after an audit once production wraps. They are prized for their simplicity and because the payout is predictable.",
    related: ["tax-incentive", "soft-money"],
    hub: { label: "Browse tax incentives & rebates", href: "/opportunities/type/tax-incentives" },
  },
  {
    slug: "gap-financing",
    term: "Gap Financing",
    short: "A loan covering the shortfall between secured financing and the full budget.",
    definition:
      "Gap financing is a loan that bridges the difference between the money a producer has already secured and the full budget. It is repaid from a film's projected unsold rights — the 'gap' — and is therefore riskier and more expensive than a pre-sale-backed loan. Lenders usually cap the gap at a modest share of the budget and require sales estimates from a reputable agent.",
    related: ["hard-money", "pre-sales", "minimum-guarantee", "recoupment"],
  },
  {
    slug: "pre-sales",
    term: "Pre-Sales",
    short: "Selling distribution rights in a territory before the film is made, to raise financing.",
    definition:
      "A pre-sale is a distribution deal signed before or during production, usually for a specific territory, that commits a distributor to pay on delivery. The resulting contract can be taken to a bank and borrowed against, turning future revenue into present financing. Pre-sales depend heavily on the cast and the sales agent's estimates.",
    related: ["minimum-guarantee", "sales-agent", "gap-financing"],
  },
  {
    slug: "minimum-guarantee",
    term: "Minimum Guarantee (MG)",
    short: "A guaranteed advance a distributor pays a producer against future revenue.",
    definition:
      "A minimum guarantee is an advance a distributor or sales agent commits to pay the producer, recouped from the film's later revenue in that deal. Because it is guaranteed on delivery, an MG can be financed against to fund production. The size of the MG signals the market's confidence in a project.",
    related: ["pre-sales", "sales-agent", "recoupment"],
  },
  {
    slug: "sales-agent",
    term: "Sales Agent",
    short: "A company that licenses a film's distribution rights to buyers across territories.",
    definition:
      "A sales agent represents a film to distributors and buyers worldwide, licensing rights territory by territory, usually at film markets. They provide the sales estimates that underpin pre-sales and gap financing, and take a commission plus recoupable expenses. A credible sales agent attached early can make a project financeable.",
    related: ["pre-sales", "minimum-guarantee", "recoupment"],
  },
  {
    slug: "recoupment",
    term: "Recoupment",
    short: "The order in which a film's revenue repays its financiers and participants.",
    definition:
      "Recoupment is the waterfall that governs how a film's revenue is distributed — typically sales commissions and expenses first, then senior lenders, then equity investors, and finally profit participants. Where each party sits in the waterfall determines how likely they are to be paid. Understanding recoupment is essential to structuring a fair and financeable deal.",
    related: ["hard-money", "gap-financing", "points"],
  },
  {
    slug: "points",
    term: "Points (Backend)",
    short: "A share of a film's net or gross profit granted to cast, crew or financiers.",
    definition:
      "Points are percentage shares of a film's profit — 'backend' — granted to key talent, producers or investors on top of, or instead of, upfront fees. Gross points (a share of revenue) are far more valuable than net points (a share after costs), which often pay little. Points align participants with a film's commercial success.",
    related: ["recoupment", "hard-money"],
  },
  {
    slug: "completion-bond",
    term: "Completion Bond",
    short: "An insurance guarantee that a film will be finished and delivered on budget.",
    definition:
      "A completion bond is a guarantee, sold by a bond company, that a film will be completed and delivered on schedule and on budget — or the bonder will provide the funds to finish it, or repay financiers. Lenders and many equity investors require one before releasing money. The bonder monitors the production and can step in if it runs off track.",
    related: ["hard-money", "gap-financing"],
  },
  {
    slug: "fiscal-sponsorship",
    term: "Fiscal Sponsorship",
    short: "Using a nonprofit's tax-exempt status so donors to a film can give tax-deductibly.",
    definition:
      "Fiscal sponsorship lets an individual filmmaker or unincorporated project raise tax-deductible donations and apply for grants restricted to nonprofits, by operating under an established charitable organisation's tax-exempt status. The sponsor typically takes an administrative fee. It is common for documentaries and socially driven projects.",
    related: ["soft-money", "development-fund"],
    hub: { label: "Browse grants & funds", href: "/opportunities/type/grants-funds" },
  },
  {
    slug: "development-fund",
    term: "Development Fund",
    short: "Financing for the early writing, research and packaging stage of a film.",
    definition:
      "A development fund supports the earliest stage of a film — screenwriting, research, and attaching talent and a producer — long before production financing is in place. Support may be a grant or a recoupable advance repaid if the film is made. Strong development is what makes a project fundable later.",
    related: ["development-lab", "soft-money", "fiscal-sponsorship"],
    hub: { label: "Browse grants & funds", href: "/opportunities/type/grants-funds" },
  },
  {
    slug: "development-lab",
    term: "Development Lab",
    short: "A structured programme that develops a project and its filmmakers through mentorship.",
    definition:
      "A development lab is a selective programme that helps filmmakers develop a specific project through mentorship, workshops and industry access, sometimes with a stipend or grant attached. Labs are valued as much for the networks and validation they confer as for any money. A well-known lab credit can open doors to financing.",
    related: ["development-fund", "co-production-treaty"],
    hub: { label: "Browse labs & residencies", href: "/opportunities/type/labs-residencies" },
  },
];

const BY_SLUG = new Map(GLOSSARY.map((t) => [t.slug, t]));
export function glossaryBySlug(slug: string): GlossaryTerm | undefined {
  return BY_SLUG.get(slug);
}
