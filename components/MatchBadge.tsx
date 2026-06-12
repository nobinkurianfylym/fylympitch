const TIER_STYLE: Record<string, string> = {
  excellent: "text-[#8A6F3E] border-gold",
  strong: "text-ink border-line",
  possible: "text-ash border-line",
};

const TIER_LABEL: Record<string, string> = {
  excellent: "Excellent match",
  strong: "Strong match",
  possible: "Possible match",
};

export default function MatchBadge({ score, tier }: { score: number; tier: string }) {
  return (
    <div className="flex items-center gap-3">
      <div
        className={`h-12 w-12 rounded-full border flex items-center justify-center font-display text-[17px] ${TIER_STYLE[tier] ?? "text-ash border-line"}`}
        aria-label={`Match score ${score} of 100`}
      >
        {score}
      </div>
      <span className="text-[11px] tracking-[0.2em] uppercase text-ash">{TIER_LABEL[tier] ?? "Match"}</span>
    </div>
  );
}
