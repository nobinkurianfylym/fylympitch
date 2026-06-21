/**
 * FYLYMPITCH — Currency conversion utilities
 *
 * Waterfall (mirrors Cerebras → Groq → OpenAI):
 *   1. open.er-api.com        — free, no key, updates hourly
 *   2. exchangerate-api.com   — free tier, no key
 *   3. Fixed rates in format.ts — always succeeds
 */

import { CURRENCIES } from "@/lib/format";

// ── Waterfall helpers ─────────────────────────────────────────────────────────

async function fetchRatesFrom(url: string): Promise<Record<string, number> | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(3000) });
    if (!res.ok) return null;
    const data = await res.json();
    // open.er-api:        { result: 'success', rates: { INR: 83.5, ... } }
    // exchangerate-api v4: { base: 'USD', rates: { INR: 83.5, ... } }
    const rates = data?.rates ?? data?.conversion_rates;
    return rates && typeof rates === "object" ? (rates as Record<string, number>) : null;
  } catch {
    return null;
  }
}

/**
 * Get the USD conversion rate for a currency via the live-rate waterfall.
 * Returns: rate such that amount * rate = USD value.
 */
export async function getUSDRate(
  currency: string
): Promise<{ rate: number; source: "live" | "fixed" }> {
  if (currency === "USD") return { rate: 1, source: "fixed" };

  // 1. Primary — open.er-api.com
  const primary = await fetchRatesFrom("https://open.er-api.com/v6/latest/USD");
  if (primary?.[currency]) {
    return { rate: 1 / primary[currency], source: "live" };
  }

  // 2. Secondary — exchangerate-api.com
  const secondary = await fetchRatesFrom("https://api.exchangerate-api.com/v4/latest/USD");
  if (secondary?.[currency]) {
    return { rate: 1 / secondary[currency], source: "live" };
  }

  // 3. Fixed fallback — always succeeds
  const rate = CURRENCIES[currency]?.rate ?? 1;
  return { rate, source: "fixed" };
}

/**
 * Convert an amount in `currency` to USD using the live-rate waterfall.
 */
export async function toLiveUSD(amount: number, currency: string): Promise<number> {
  const { rate } = await getUSDRate(currency);
  return Math.round(amount * rate);
}

/**
 * Reverse-convert a USD amount to original currency (approximate, uses fixed rates).
 * Used for backfill display only.
 */
export function fromUSDApprox(usdAmount: number, currency: string): number {
  const rate = CURRENCIES[currency]?.rate ?? 1;
  return Math.round(usdAmount / rate);
}

/**
 * Validate budget split consistency.
 * Rule: finance_secured + funding_needed must not exceed total_budget.
 * Returns an error string, or null if valid.
 */
export function validateBudgetSplit(
  totalBudget: number | null,
  financeSecured: number | null,
  fundingNeeded: number | null
): string | null {
  if (totalBudget == null) return null;

  if (financeSecured != null && financeSecured > totalBudget) {
    return "Finance secured cannot exceed the total budget.";
  }
  if (fundingNeeded != null && fundingNeeded > totalBudget) {
    return "Funding needed cannot exceed the total budget.";
  }
  if (
    financeSecured != null &&
    fundingNeeded != null &&
    financeSecured + fundingNeeded > totalBudget
  ) {
    return "Finance secured + funding needed cannot exceed the total budget.";
  }

  return null;
}
