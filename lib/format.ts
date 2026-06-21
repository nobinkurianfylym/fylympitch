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
