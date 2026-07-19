import type { Metadata } from "next";
import Link from "next/link";
import EditorialShell from "@/components/EditorialShell";
import { loadIndexableOpportunities } from "@/lib/hubs";
import { usd, TYPE_LABEL } from "@/lib/format";
import { absoluteUrl, ROBOTS_INDEX } from "@/lib/seo";
import { itemListSchema } from "@/lib/schema";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Film Grant & Funding Deadlines — Upcoming | PITCH.FYLYM",
  description:
    "Upcoming application deadlines for verified film grants, funds, labs and markets worldwide. Never miss a submission window.",
  alternates: { canonical: absoluteUrl("/deadlines") },
  robots: ROBOTS_INDEX,
};

export default async function DeadlinesPage() {
  const all = await loadIndexableOpportunities();
  const now = Date.now();

  const upcoming = all
    .filter((r) => {
      if (!r.deadline) return false;
      const t = new Date(r.deadline).getTime();
      return !Number.isNaN(t) && t >= now;
    })
    .sort((a, b) => (a.deadline as string).localeCompare(b.deadline as string));

  // Group by "Month Year"
  const groups = new Map<string, typeof upcoming>();
  for (const r of upcoming) {
    const key = new Date(r.deadline as string).toLocaleDateString("en-GB", { month: "long", year: "numeric" });
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(r);
  }

  return (
    <EditorialShell
      breadcrumbs={[{ name: "Home", path: "/" }, { name: "Deadlines", path: "/deadlines" }]}
      jsonLd={[itemListSchema(upcoming.slice(0, 100).map((r) => ({ name: r.title, path: `/opportunities/${r.slug}` })), "Upcoming film funding deadlines")]}
    >
      <p className="eyebrow mb-3">Calendar</p>
      <h1 className="font-display text-[42px] md:text-[52px] font-[400] leading-[1.1] text-ink">Upcoming funding deadlines</h1>
      <p className="mt-6 text-[16px] leading-[1.7] text-ash">
        {upcoming.length > 0
          ? `${upcoming.length} verified film grants, funds, labs and markets with open application windows, ordered by deadline.`
          : "Upcoming deadlines will appear here as verified opportunities are added."}
      </p>

      {[...groups.entries()].map(([month, rows]) => (
        <div key={month} className="mt-12">
          <p className="eyebrow mb-4">{month}</p>
          <div className="card divide-y divide-line">
            {rows.map((r) => (
              <Link key={r.id} href={`/opportunities/${r.slug}`} className="block px-6 py-4 group">
                <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
                  <p className="font-display text-[18px] text-ink group-hover:text-gold transition-colors">{r.title}</p>
                  <p className="text-[12px] text-gold shrink-0">
                    {new Date(r.deadline as string).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                  </p>
                </div>
                <p className="mt-0.5 text-[12px] text-ash">
                  {TYPE_LABEL[r.opp_type ?? ""] ?? r.opp_type}
                  {r.country ? `  ·  ${r.country}` : ""}
                  {r.max_award_usd != null ? `  ·  Up to ${usd(r.max_award_usd)}` : ""}
                </p>
              </Link>
            ))}
          </div>
        </div>
      ))}
    </EditorialShell>
  );
}
