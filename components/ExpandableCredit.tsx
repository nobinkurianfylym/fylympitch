"use client";

import { useState } from "react";
import { deleteFilmmakerCredit } from "@/lib/actions";

export default function ExpandableCredit({ credit }: { credit: any }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="card overflow-hidden">
      {/* Collapsed row — always visible */}
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-parchment/50 transition-colors"
      >
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <span className="font-display text-[15px] truncate">{credit.title}</span>
          {credit.year && (
            <span className="text-[12px] text-ash shrink-0">{credit.year}</span>
          )}
          {credit.format && (
            <span className="text-[10px] tracking-[0.1em] uppercase bg-parchment text-ash px-2 py-0.5 rounded-full border border-line shrink-0">
              {credit.format}
            </span>
          )}
          {credit.is_featured && (
            <span className="text-[9px] tracking-[0.1em] uppercase bg-gold/10 text-gold px-2 py-0.5 rounded-full border border-gold/30 shrink-0">
              Featured
            </span>
          )}
        </div>
        <span className="text-ash text-[12px] ml-4 shrink-0">{open ? "↑" : "↓"}</span>
      </button>

      {/* Expanded details */}
      {open && (
        <div className="px-5 pb-5 border-t border-line pt-4 space-y-3">
          {(credit.festivals?.length ?? 0) > 0 && (
            <div>
              <p className="text-[10px] tracking-[0.18em] uppercase text-ash mb-2">Festival selections</p>
              <div className="flex flex-wrap gap-1.5">
                {credit.festivals.map((f: string) => (
                  <span key={f} className="text-[10px] tracking-[0.1em] uppercase bg-parchment text-ash px-2 py-0.5 rounded-full border border-line">
                    {f}
                  </span>
                ))}
              </div>
            </div>
          )}

          {(credit.awards?.length ?? 0) > 0 && (
            <div>
              <p className="text-[10px] tracking-[0.18em] uppercase text-ash mb-2">Awards</p>
              <div className="space-y-1">
                {credit.awards.map((a: string) => (
                  <p key={a} className="text-[12px] text-gold">🏆 {a}</p>
                ))}
              </div>
            </div>
          )}

          <div className="pt-2 border-t border-line">
            <form action={deleteFilmmakerCredit}>
              <input type="hidden" name="credit_id" value={credit.id} />
              <button
                type="submit"
                className="text-[11px] tracking-[0.12em] uppercase text-ash hover:text-red-600 transition-colors"
              >
                Remove credit
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
