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

export function timeAgo(iso: string): string {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}
