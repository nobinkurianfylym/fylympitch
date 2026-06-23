"use client";

import { useState } from "react";
import Link from "next/link";
import { toggleSaved } from "@/lib/actions";
import { TYPE_LABEL } from "@/lib/format";

const TOP_N = 5;

type Opp = {
  id: string;
  title: string;
  opp_type: string;
  country: string | null;
  region: string | null;
  max_award_usd: number | null;
  deadline: string | null;
};

export type MatchedProducer = {
  id: string;
  full_name: string;
  company: string | null;
  score: number;
  project_id: string;
  project_title: string;
  genres: string[];
  role: string;
};

function scorePill(score: number) {
  if (score >= 80) return "bg-emerald-50 border-emerald-200 text-emerald-700";
  if (score >= 60) return "bg-gold/10 border-gold/30 text-gold";
  return "bg-parchment border-line text-ash";
}

function usd(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n}`;
}

function OppRow({ o, score, saved }: { o: Opp; score: number | undefined; saved: boolean }) {
  const days = o.deadline
    ? Math.ceil((new Date(o.deadline).getTime() - Date.now()) / 86_400_000)
    : null;

  return (
    <div className="hairline py-4 flex items-center justify-between gap-4">
      <div className="shrink-0 w-12 text-center hidden sm:block">
        {score != null ? (
          <span className={`text-[11px] tracking-[0.08em] px-2 py-0.5 rounded-full border ${scorePill(score)}`}>
            {score}
          </span>
        ) : (
          <span className="text-[11px] text-ash/30">—</span>
        )}
      </div>
      <Link href={`/dashboard/opportunities/${o.id}`} className="flex-1 min-w-0 group">
        <div className="font-normal text-[15px] group-hover:text-gold transition-colors truncate">{o.title}</div>
        <div className="mt-0.5 text-[12px] tracking-[0.14em] uppercase text-ash flex flex-wrap gap-x-3">
          <span>{TYPE_LABEL[o.opp_type] ?? o.opp_type}</span>
          {o.region ? <span>{o.region}</span> : o.country ? <span>{o.country}</span> : <span>Worldwide</span>}
          {o.max_award_usd ? <span className="text-gold">up to {usd(o.max_award_usd)}</span> : null}
        </div>
      </Link>
      {days != null && (
        <span className={`shrink-0 text-[11px] tracking-[0.08em] px-2 py-0.5 rounded-full border hidden md:inline-block ${
          days <= 7  ? "bg-red-50 border-red-200 text-red-600"
          : days <= 30 ? "bg-amber-50 border-amber-200 text-amber-700"
          : "bg-parchment border-line text-ash"
        }`}>{days}d</span>
      )}
      <form action={toggleSaved} className="shrink-0">
        <input type="hidden" name="opportunity_id" value={o.id} />
        <button className={`text-[12px] tracking-[0.16em] uppercase ${saved ? "text-gold" : "text-ash hover:text-ink"}`}>
          {saved ? "★" : "Save"}
        </button>
      </form>
    </div>
  );
}

function ProducerRow({ pm }: { pm: MatchedProducer }) {
  return (
    <div className="hairline py-4 flex items-center justify-between gap-4">
      {/* Score */}
      <div className="shrink-0 w-12 text-center hidden sm:block">
        <span className={`text-[11px] tracking-[0.08em] px-2 py-0.5 rounded-full border ${scorePill(pm.score)}`}>
          {pm.score}
        </span>
      </div>
      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="text-[15px] text-ink truncate">
          {pm.full_name}
          {pm.company && <span className="text-ash font-normal"> · {pm.company}</span>}
        </div>
        <div className="mt-0.5 text-[12px] tracking-[0.14em] uppercase text-ash flex flex-wrap gap-x-3">
          <span>{pm.role === "investor" ? "Investor" : pm.role === "organization" ? "Organisation" : "Producer"}</span>
          {pm.genres.length > 0 && <span>{pm.genres.slice(0, 2).join(", ")}</span>}
          <span className="normal-case tracking-normal text-ash/50">via {pm.project_title}</span>
        </div>
      </div>
      {/* Connect */}
      <Link
        href={`/dashboard/projects/${pm.project_id}`}
        className="shrink-0 text-[10px] tracking-[0.12em] uppercase text-ash border border-line rounded px-3 py-1.5 hover:text-ink transition-colors"
      >
        Connect →
      </Link>
    </div>
  );
}

export function OpportunityCategoryBlock({
  cat,
  items,
  matchScores,
  savedIds,
  matchedProducers = [],
}: {
  cat: { key: string; label: string; sub: string };
  items: Opp[];
  matchScores: Record<string, number>;
  savedIds: string[];
  matchedProducers?: MatchedProducer[];
}) {
  const [expanded, setExpanded] = useState(false);
  const savedSet = new Set(savedIds);

  const top     = items.slice(0, TOP_N);
  const rest    = items.slice(TOP_N);
  const visible = expanded ? items : top;

  const hasContent = items.length > 0 || matchedProducers.length > 0;
  if (!hasContent) return null;

  return (
    <div key={cat.key}>
      <div className="mb-1">
        <div className="flex items-baseline gap-3">
          <h2 className="font-display text-[20px] font-normal">{cat.label}</h2>
          <span className="text-[12px] text-ash font-normal tracking-[0.1em]">
            {items.length + matchedProducers.length}
          </span>
        </div>
        <p className="text-[12px] text-ash/70 font-normal">{cat.sub}</p>
      </div>

      {/* Opportunity rows */}
      <div>
        {visible.map((o) => (
          <OppRow key={o.id} o={o} score={matchScores[o.id]} saved={savedSet.has(o.id)} />
        ))}
      </div>

      {rest.length > 0 && (
        <button
          onClick={() => setExpanded(e => !e)}
          className="mt-3 text-[11px] tracking-[0.16em] uppercase text-ash hover:text-ink transition-colors font-normal"
        >
          {expanded ? "Show less ↑" : `Show ${rest.length} more in ${cat.label} ↓`}
        </button>
      )}

      {/* Matched producer profiles — only in Production category */}
      {matchedProducers.length > 0 && (
        <div className={items.length > 0 ? "mt-4 pt-4 border-t border-line/50" : ""}>
          <p className="text-[10px] tracking-[0.18em] uppercase text-ash/60 mb-1">
            Matched Profiles on PITCH.FYLYM
          </p>
          {matchedProducers.map(pm => (
            <ProducerRow key={pm.id} pm={pm} />
          ))}
        </div>
      )}
    </div>
  );
}
