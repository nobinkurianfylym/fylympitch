"use client";

import { useState } from "react";
import Link from "next/link";
import MatchBadge from "@/components/MatchBadge";
import { usd, TYPE_LABEL } from "@/lib/format";
import { tierOf } from "@/services/matching";

interface MatchedOpportunity {
  score: number;
  project_id: string;
  opportunities: {
    id: string;
    title: string;
    opp_type: string;
    deadline: string | null;
    max_award_usd: number | null;
  };
}

export default function OpportunitiesExpand({ matches }: { matches: MatchedOpportunity[] }) {
  const [expanded, setExpanded] = useState(false);

  const visible = expanded ? matches : matches.slice(0, 3);
  const hiddenCount = matches.length - 3;

  return (
    <>
      <div>
        {visible.map((m) => (
          <Link
            key={m.opportunities.id}
            href={`/dashboard/opportunities/${m.opportunities.id}`}
            className="hairline py-5 flex items-center justify-between gap-6 hover:bg-parchment/60 transition-colors px-2 -mx-2"
          >
            <div className="min-w-0">
              <div className="font-normal text-[15px] truncate">{m.opportunities.title}</div>
              <div className="mt-1 text-[12px] tracking-[0.14em] uppercase text-ash">
                {TYPE_LABEL[m.opportunities.opp_type] ?? m.opportunities.opp_type}
                {m.opportunities.max_award_usd ? ` · up to ${usd(m.opportunities.max_award_usd)}` : ""}
                {m.opportunities.deadline ? ` · deadline ${m.opportunities.deadline}` : ""}
              </div>
            </div>
            <div className="shrink-0">
              <MatchBadge score={m.score} tier={tierOf(m.score)} />
            </div>
          </Link>
        ))}
      </div>

      {!expanded && hiddenCount > 0 && (
        <button
          onClick={() => setExpanded(true)}
          className="mt-6 text-[12px] tracking-[0.16em] uppercase text-ash hover:text-gold transition-colors"
        >
          + Show {hiddenCount} more {hiddenCount === 1 ? "opportunity" : "opportunities"}
        </button>
      )}

      {expanded && hiddenCount > 0 && (
        <button
          onClick={() => setExpanded(false)}
          className="mt-6 text-[12px] tracking-[0.16em] uppercase text-ash hover:text-gold transition-colors"
        >
          Show less
        </button>
      )}
    </>
  );
}
