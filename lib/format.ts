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
  grant: "Grant",
  fund: "Fund",
  lab: "Lab",
  co_production: "Co-Production",
  market: "Market",
  distribution: "Distribution",
  investor: "Investor",
  broadcaster: "Broadcaster",
  streamer: "Streamer",
  sales_agent: "Sales Agent",
  brand_integration: "Brand Integration",
  crowdfunding: "Crowdfunding",
  producer: "Producer",
  production_company: "Production Company",
  studio: "Studio",
  sponsor: "Sponsor",
  pre_sale: "Pre-Sale",
  tax_incentive: "Tax Incentive",
};

export const OPP_CATEGORY_MAP: Record<string, string> = {
  lab:                "development",
  grant:              "development",
  fund:               "development",
  crowdfunding:       "early_financing",
  producer:           "production",
  production_company: "production",
  studio:             "production",
  investor:           "private_financing",
  sponsor:            "private_financing",
  brand_integration:  "private_financing",
  co_production:      "packaging_markets",
  market:             "packaging_markets",
  broadcaster:        "buyers_sales",
  streamer:           "buyers_sales",
  pre_sale:           "buyers_sales",
  sales_agent:        "buyers_sales",
  distribution:       "release_distribution",
  tax_incentive:      "tax_incentives",
};

export const CATEGORY_CONFIG: { key: string; label: string; sub: string }[] = [
  { key: "development",         label: "Development",          sub: "Labs, Grants, Funds" },
  { key: "early_financing",     label: "Early Financing",      sub: "Crowdfunding" },
  { key: "production",          label: "Production",           sub: "Producers, Production Companies, Studios" },
  { key: "private_financing",   label: "Private Financing",    sub: "Investors, Sponsors, Brand Integration" },
  { key: "packaging_markets",   label: "Packaging & Markets",  sub: "Co-productions, Markets" },
  { key: "buyers_sales",        label: "Buyers & Sales",       sub: "Broadcasters, Streamers, Pre-Sales, Sales Agents" },
  { key: "release_distribution",label: "Release & Distribution", sub: "Distribution" },
  { key: "tax_incentives",      label: "Tax Incentives",       sub: "Tax Incentives" },
];

export function timeAgo(iso: string): string {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}
