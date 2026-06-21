import { NextRequest, NextResponse } from "next/server";
import { getUSDRate } from "@/lib/currency";

/**
 * GET /api/convert-currency?amount=8300000&from=INR
 * → { usd: 99480, rate: 0.01198, source: "live" | "fixed" }
 *
 * Called by ProjectForm and EditProjectForm to show live USD previews
 * while the filmmaker types. Waterfall: open.er-api → exchangerate-api → fixed rates.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const amountStr = searchParams.get("amount");
  const from = (searchParams.get("from") ?? "USD").toUpperCase();

  const amount = amountStr ? parseFloat(amountStr) : NaN;
  if (isNaN(amount) || amount < 0) {
    return NextResponse.json({ error: "Invalid amount" }, { status: 400 });
  }

  const { rate, source } = await getUSDRate(from);
  const usd = Math.round(amount * rate);

  return NextResponse.json(
    { usd, rate, source },
    {
      headers: {
        // CDN-cache for 1 hr; rates don't change minute-to-minute
        "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
      },
    }
  );
}
