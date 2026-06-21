"use client";

import { useTransition } from "react";
import { adminApproveOpportunity, adminRejectOpportunity } from "@/lib/actions";

type PendingOpp = {
  id: string;
  title: string;
  opp_type: string;
  country: string | null;
  region: string | null;
  description: string | null;
  url: string | null;
  app_link: string | null;
  max_award_usd: number | null;
  deadline: string | null;
  submitted_by_name: string | null;
  submitted_by_email: string | null;
  genres: string[] | null;
  formats: string[] | null;
  stages: string[] | null;
  eligible_countries: string[] | null;
  created_at: string;
};

function PendingRow({ item }: { item: PendingOpp }) {
  const [isPending, start] = useTransition();

  return (
    <div className="px-5 py-5 border-b border-line last:border-0">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="min-w-0 flex-1">
          <p className="font-normal text-ink text-[15px]">{item.title}</p>
          <p className="text-[12px] text-ash font-normal mt-0.5">
            {item.opp_type.replace("_", " ")}
            {item.country ? ` · ${item.country}` : item.region ? ` · ${item.region}` : ""}
            {item.max_award_usd ? ` · up to $${(item.max_award_usd / 1000).toFixed(0)}K` : ""}
            {item.deadline ? ` · deadline ${new Date(item.deadline).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}` : ""}
          </p>
          {item.description && (
            <p className="text-[12px] text-ash/80 font-normal mt-1.5 max-w-xl line-clamp-2">{item.description}</p>
          )}
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-ash font-normal">
            {item.url && <a href={item.url} target="_blank" rel="noopener noreferrer" className="text-gold hover:underline">{item.url.replace(/^https?:\/\//, "").slice(0, 40)}</a>}
            {item.genres?.length ? <span>Genres: {item.genres.join(", ")}</span> : null}
            {item.formats?.length ? <span>Formats: {item.formats.join(", ")}</span> : null}
            {item.stages?.length ? <span>Stages: {item.stages.join(", ")}</span> : null}
            {item.eligible_countries?.length ? <span>Eligible: {item.eligible_countries.join(", ")}</span> : null}
          </div>
          {(item.submitted_by_name || item.submitted_by_email) && (
            <p className="text-[11px] text-ash/60 font-normal mt-2">
              Submitted by {item.submitted_by_name ?? "—"}{item.submitted_by_email ? ` · ${item.submitted_by_email}` : ""}
              {" · "}{new Date(item.created_at).toLocaleDateString()}
            </p>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <form action={adminApproveOpportunity}>
            <input type="hidden" name="opportunity_id" value={item.id} />
            <button disabled={isPending} className="btn-gold !py-1.5 !px-4 text-[13px] disabled:opacity-50">
              Approve
            </button>
          </form>
          <form action={adminRejectOpportunity}>
            <input type="hidden" name="opportunity_id" value={item.id} />
            <button disabled={isPending} className="btn-ghost !py-1.5 !px-4 text-[13px] text-ash disabled:opacity-50">
              Reject
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

export function PendingSubmissions({ items }: { items: PendingOpp[] }) {
  return (
    <div className="mb-10">
      <div className="flex items-baseline gap-3 mb-3">
        <h2 className="font-display text-[22px] font-normal text-ink">Pending review</h2>
        <span className="text-[11px] tracking-[0.1em] bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full font-normal">
          {items.length} submitted by public
        </span>
      </div>
      <p className="text-[12px] text-ash font-normal mb-4">Review each submission. Approved opportunities go live immediately.</p>
      <div className="card divide-y divide-line">
        {items.map(item => <PendingRow key={item.id} item={item} />)}
      </div>
    </div>
  );
}
