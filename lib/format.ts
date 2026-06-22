export const CURRENCIES: Record<string, { symbol: string; rate: number; label: string }> = {
  USD: { symbol: "$",  rate: 1,         label: "USD — US Dollar" },
  EUR: { symbol: "€",  rate: 1.08,      label: "EUR — Euro" },
  GBP: { symbol: "£",  rate: 1.27,      label: "GBP — British Pound" },
  CAD: { symbol: "$",  rate: 0.74,      label: "CAD — Canadian Dollar" },
  AUD: { symbol: "$",  rate: 0.65,      label: "AUD — Australian Dollar" },
  INR: { symbol: "₹",  rate: 0.012,     label: "INR — Indian Rupee" },
  NGN: { symbol: "₦",  rate: 0.00065,   label: "NGN — Nigerian Naira" },
  ZAR: { symbol: "R",  rate: 0.054,     label: "ZAR — South African Rand" },
  BRL: { symbol: "R$", rate: 0.19,      label: "BRL — Brazilian Real" },
  NOK: { symbol: "kr", rate: 0.093,     label: "NOK — Norwegian Krone" },
  CHF: { symbol: "Fr", rate: 1.13,      label: "CHF — Swiss Franc" },
  KRW: { symbol: "₩",  rate: 0.00074,   label: "KRW — South Korean Won" },
};

// Convert local amount → USD for storage/matching
export function toUSD(amount: number, currency: string): number {
  const rate = CURRENCIES[currency]?.rate ?? 1;
  return Math.round(amount * rate);
}

// Format a USD-stored value for display in its original currency
export function formatBudget(usdValue: number | null | undefined, currency = "USD"): string {
  if (usdValue == null) return "—";
  const c = CURRENCIES[currency] ?? CURRENCIES.USD;
  const local = usdValue / c.rate;
  const sym = c.symbol;
  if (currency === "INR") {
    if (local >= 10_000_000) return `${sym}${(local / 10_000_000).toFixed(2)} Cr`;
    if (local >= 100_000)    return `${sym}${(local / 100_000).toFixed(1)} L`;
    if (local >= 1_000)      return `${sym}${Math.round(local / 1_000)}K`;
    return `${sym}${Math.round(local)}`;
  }
  if (currency === "KRW" || currency === "NGN") {
    if (local >= 1_000_000_000) return `${sym}${(local / 1_000_000_000).toFixed(1)}B`;
    if (local >= 1_000_000)     return `${sym}${(local / 1_000_000).toFixed(1)}M`;
    if (local >= 1_000)         return `${sym}${Math.round(local / 1_000)}K`;
    return `${sym}${Math.round(local)}`;
  }
  if (local >= 1_000_000) return `${sym}${(local / 1_000_000).toFixed(1)}M`;
  if (local >= 1_000)     return `${sym}${Math.round(local / 1_000)}K`;
  return `${sym}${Math.round(local)}`;
}

export function usd(n: number | null | undefined): string {
  if (n == null) return "—";
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${Math.round(n / 1_000)}K`;
  return `$${n}`;
}

export const STAGE_LABEL: Record<string, string> = {
  development: "Development",
  pre_production: "Pre-Production",
  production: "Production",
  post_production: "Post-Production",
  completed: "Completed",
};

export const TYPE_LABEL: Record<string, string> = {
  // Development
  lab:                   "Lab",
  residency:             "Residency",
  mentorship:            "Mentorship",
  grant:                 "Development Grant",
  fund:                  "Development Fund",
  writing_fellowship:    "Writing Fellowship",
  // Packaging & Markets
  pitch_forum:           "Pitch Forum",
  co_production:         "Co-Production Market",
  market:                "Film Market",
  // Early Financing
  crowdfunding:          "Crowdfunding",
  donation:              "Donation",
  fiscal_sponsorship:    "Fiscal Sponsorship",
  seed_funding:          "Seed Funding",
  community_funding:     "Community Funding",
  // Tax Incentives
  tax_incentive:         "Tax Credit",
  cash_rebate:           "Cash Rebate",
  production_rebate:     "Production Rebate",
  regional_incentive:    "Regional Incentive",
  location_incentive:    "Location Incentive",
  // Private Financing
  investor:              "Equity Investor",
  angel_investor:        "Angel Investor",
  venture_capital:       "Venture Capital",
  gap_financing:         "Gap Financing",
  brand_integration:     "Brand Integration",
  product_placement:     "Product Placement",
  sponsor:               "Corporate Sponsor",
  private_fund:          "Private Fund",
  // Production
  producer:              "Producer",
  co_producer:           "Co-Producer",
  production_company:    "Production Company",
  studio:                "Studio",
  // Post Production
  post_production_grant: "Post-Production Grant",
  post_production_fund:  "Post-Production Fund",
  finishing_fund:        "Finishing Fund",
  // Buyers & Sales
  sales_agent:           "Sales Agent",
  world_sales:           "World Sales",
  broadcaster:           "Broadcaster",
  streamer:              "Streamer",
  pre_sale:              "Pre-Sale",
  content_buyer:         "Content Buyer",
  music_rights:          "Music Rights",
  // Release & Distribution
  film_festival:            "Film Festival",
  distribution:             "Distribution Deal",
  theatrical_distribution:  "Theatrical Distribution",
  ott_distribution:         "OTT Distribution",
  tv_distribution:          "TV Distribution",
  digital_aggregator:       "Digital Aggregator",
  educational_distribution: "Educational Distribution",
  airline_distribution:     "Airline & Inflight",
};

export const OPP_CATEGORY_MAP: Record<string, string> = {
  // Development
  lab:                   "development",
  residency:             "development",
  mentorship:            "development",
  grant:                 "development",
  fund:                  "development",
  writing_fellowship:    "development",
  // Packaging & Markets
  pitch_forum:           "packaging_markets",
  co_production:         "packaging_markets",
  market:                "packaging_markets",
  // Early Financing
  crowdfunding:          "early_financing",
  donation:              "early_financing",
  fiscal_sponsorship:    "early_financing",
  seed_funding:          "early_financing",
  community_funding:     "early_financing",
  // Tax Incentives
  tax_incentive:         "tax_incentives",
  cash_rebate:           "tax_incentives",
  production_rebate:     "tax_incentives",
  regional_incentive:    "tax_incentives",
  location_incentive:    "tax_incentives",
  // Private Financing
  investor:              "private_financing",
  angel_investor:        "private_financing",
  venture_capital:       "private_financing",
  gap_financing:         "private_financing",
  brand_integration:     "private_financing",
  product_placement:     "private_financing",
  sponsor:               "private_financing",
  private_fund:          "private_financing",
  // Production
  producer:              "production",
  co_producer:           "production",
  production_company:    "production",
  studio:                "production",
  // Post Production
  post_production_grant: "post_production",
  post_production_fund:  "post_production",
  finishing_fund:        "post_production",
  // Buyers & Sales
  sales_agent:           "buyers_sales",
  world_sales:           "buyers_sales",
  broadcaster:           "buyers_sales",
  streamer:              "buyers_sales",
  pre_sale:              "buyers_sales",
  content_buyer:         "buyers_sales",
  music_rights:          "buyers_sales",
  // Release & Distribution
  film_festival:            "release_distribution",
  distribution:             "release_distribution",
  theatrical_distribution:  "release_distribution",
  ott_distribution:         "release_distribution",
  tv_distribution:          "release_distribution",
  digital_aggregator:       "release_distribution",
  educational_distribution: "release_distribution",
  airline_distribution:     "release_distribution",
};

export const CATEGORY_CONFIG: { key: string; label: string; sub: string }[] = [
  { key: "development",          label: "Development",            sub: "Labs · Residencies · Mentorships · Grants · Funds · Fellowships" },
  { key: "packaging_markets",    label: "Packaging & Markets",    sub: "Pitch Forums · Co-Productions · Film Markets" },
  { key: "early_financing",      label: "Early Financing",        sub: "Crowdfunding · Donations · Fiscal Sponsorship · Seed Funding" },
  { key: "tax_incentives",       label: "Tax Incentives",         sub: "Tax Credits · Cash Rebates · Production Rebates · Regional & Location Incentives" },
  { key: "private_financing",    label: "Private Financing",      sub: "Equity · Angel · Venture Capital · Gap · Brand · Product Placement · Sponsors · Private Funds" },
  { key: "production",           label: "Production",             sub: "Producers · Co-Producers · Production Companies · Studios" },
  { key: "post_production",      label: "Post Production",        sub: "Post-Production Grants · Post-Production Funds · Finishing Funds" },
  { key: "buyers_sales",         label: "Buyers & Sales",         sub: "Sales Agents · World Sales · Broadcasters · Streamers · Pre-Sales · Content Buyers · Music Rights" },
  { key: "release_distribution", label: "Release & Distribution", sub: "Film Festivals · Distribution · Theatrical · OTT · TV · Digital · Educational · Airline" },
];

export function timeAgo(iso: string): string {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}
