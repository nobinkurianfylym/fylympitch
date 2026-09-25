// components/HubList.tsx
//
// The row used by every hub page. Deliberately data-rich rather than
// prose-rich: award, territory, cadence and the date it was last
// verified. Those are the fields a filmmaker scans for and the fields
// an answer engine can quote, and they are what separates this from a
// generic directory listing.

import Link from "next/link";
import type { HubRow } from "@/lib/hubs";
import { usd } from "@/lib/format";

const MONTHS = ["", "January","February","March","April","May","June",
                "July","August","September","October","November","December"];

function whenText(r: HubRow): { text: string; urgent: boolean } {
  if (r.deadline) {
    const days = Math.round(
      (new Date(r.deadline + "T00:00:00Z").getTime() - Date.now()) / 86_400_000);
    const nice = new Date(r.deadline + "T00:00:00Z")
      .toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
    if (days < 0)  return { text: nice, urgent: false };
    if (days === 0) return { text: `Closes today · ${nice}`, urgent: true };
    if (days === 1) return { text: `Closes tomorrow · ${nice}`, urgent: true };
    return { text: `Closes in ${days} days · ${nice}`, urgent: days <= 14 };
  }
  if (r.deadline_type === "rolling") return { text: "Open now · applications year-round", urgent: false };
  if (r.deadline_type === "annual") {
    return {
      text: r.typical_month
        ? `Annual · usually ${MONTHS[r.typical_month]}`
        : "Annual programme",
      urgent: false,
    };
  }
  if (r.deadline_note) return { text: r.deadline_note, urgent: false };
  return { text: "Deadline not published", urgent: false };
}

function Fact({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex gap-2">
      <dt className="shrink-0 text-[10px] uppercase tracking-[0.14em] text-ash/60">{k}</dt>
      <dd className="text-[13px] text-ink">{v}</dd>
    </div>
  );
}

export default function HubList({ rows }: { rows: HubRow[] }) {
  if (rows.length === 0) {
    return <p className="text-[15px] text-ash">Nothing listed here yet.</p>;
  }

  return (
    <div className="border-t border-line">
      {rows.map(r => {
        const w = whenText(r);
        return (
          <article key={r.id} className="hairline py-6">
            <h3 className="font-display text-[21px] font-normal leading-[1.25]">
              <Link href={`/opportunities/${r.slug}`} className="hover:text-gold">
                {r.title}
              </Link>
            </h3>

            {r.organization_name && (
              <p className="mt-1 text-[13px] text-ash">{r.organization_name}</p>
            )}

            {r.description && (
              <p className="mt-2 max-w-2xl text-[14px] leading-[1.7] text-ash line-clamp-2">
                {r.description}
              </p>
            )}

            <dl className="mt-3 flex flex-wrap gap-x-7 gap-y-1.5">
              <Fact k="Territory" v={r.country?.trim() || r.region?.trim() || "Worldwide"} />
              {r.max_award_usd != null && r.max_award_usd > 0 && (
                <Fact k="Up to" v={usd(r.max_award_usd)} />
              )}
              <div className="flex gap-2">
                <dt className="shrink-0 text-[10px] uppercase tracking-[0.14em] text-ash/60">When</dt>
                <dd className={`text-[13px] ${w.urgent ? "text-red-600" : "text-ink"}`}>{w.text}</dd>
              </div>
              {r.last_verified_at && (
                <Fact k="Verified" v={new Date(r.last_verified_at)
                  .toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })} />
              )}
            </dl>
          </article>
        );
      })}
    </div>
  );
}
