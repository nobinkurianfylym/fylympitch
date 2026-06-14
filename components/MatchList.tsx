"use client";

import { useState } from "react";
import Link from "next/link";
import MatchBadge from "@/components/MatchBadge";
import { usd, TYPE_LABEL } from "@/lib/format";

export interface MatchRow {
  id: string;
  title: string;
  opp_type: string;
  max_award_usd: number | null;
  deadline_note: string | null;
  deadline: string | null;
  score: number;
  tier: string;
  warnings: string[];
}

const INITIAL_SHOW = 3;

export default function MatchList({
  matches,
  projectId,
}: {
  matches: MatchRow[];
  projectId: string;
}) {
  const [expanded, setExpanded] = useState(false);

  if (matches.length === 0) {
    return (
      <p className="hairline py-8 text-[14px] text-ash">
        No opportunities clear the 60-point bar yet. Add budget and funding details to sharpen your matches.
      </p>
    );
  }

  const visible = expanded ? matches : matches.slice(0, INITIAL_SHOW);
  const hidden = matches.length - INITIAL_SHOW;

  return (
    <div>
      {visible.map((o) => (
        <Link
          key={o.id}
          href={`/dashboard/opportunities/${o.id}?project=${projectId}`}
          className="hairline py-5 flex items-center justify-between gap-6 hover:bg-parchment/60 px-2 -mx-2 transition-colors"
        >
          <div className="min-w-0">
            <div className="font-normal text-[15px] truncate">{o.title}</div>
            <div className="mt-1 text-[12px] tracking-[0.14em] uppercase text-ash">
              {TYPE_LABEL[o.opp_type]}
              {o.max_award_usd ? ` · up to ${usd(o.max_award_usd)}` : ""}
              {o.deadline_note ? ` · ${o.deadline_note}` : o.deadline ? ` · ${o.deadline}` : ""}
            </div>
            {o.warnings.length > 0 && (
              <div className="mt-1 text-[12px] text-[#9a6b1f]">{o.warnings[0]}</div>
            )}
          </div>
          <MatchBadge score={o.score} tier={o.tier} />
        </Link>
      ))}

      {!expanded && hidden > 0 && (
        <button
          onClick={() => setExpanded(true)}
          className="mt-4 text-[13px] text-gold hover:text-gold/70 transition-colors tracking-[0.06em]"
        >
          Show {hidden} more match{hidden !== 1 ? "es" : ""} →
        </button>
      )}

      {expanded && matches.length > INITIAL_SHOW && (
        <button
          onClick={() => setExpanded(false)}
          className="mt-4 text-[13px] text-ash hover:text-ink transition-colors tracking-[0.06em]"
        >
          Show less ↑
        </button>
      )}
    </div>
  );
}
