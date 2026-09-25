"use client";
// app/admin/featured/FeaturedList.tsx
//
// The queue. Client-side only so a row can open into an edit form in
// place; every mutation is still a server action.

import { useState } from "react";
import type { FeaturedSlot } from "@/lib/featured";
import FeaturedForm from "./FeaturedForm";
import {
  deleteFeaturedSlotForm,
  toggleFeaturedActiveForm,
  moveFeaturedSlotForm,
} from "@/lib/featured-actions";

const KIND_LABEL: Record<string, string> = {
  fund: "Fund", producer: "Producer", project: "Project", custom: "Custom",
};

function label(s: FeaturedSlot): string {
  return s.title?.trim() || `${KIND_LABEL[s.kind]} · ${s.ref_id?.slice(0, 8) ?? "—"}`;
}

export default function FeaturedList({ slots }: { slots: FeaturedSlot[] }) {
  const [editingId, setEditingId] = useState<string | null>(null);

  const byKind = ["fund", "producer", "project", "custom"]
    .map(k => ({ kind: k, items: slots.filter(s => s.kind === k) }))
    .filter(g => g.items.length > 0);

  if (byKind.length === 0) {
    return (
      <p className="text-[15px] text-ash border border-line rounded-card px-5 py-6">
        Nothing queued. The homepage is rotating a fund, a producer and a
        project on its own until you add something below.
      </p>
    );
  }

  const btn =
    "text-[10px] tracking-[0.14em] uppercase px-2.5 py-1.5 border border-line rounded-full " +
    "text-ash hover:border-gold hover:text-ink transition-colors";

  return (
    <>
      {byKind.map(group => (
        <div key={group.kind} className="mb-8">
          <p className="text-[10px] tracking-[0.2em] uppercase text-ash/60 mb-2">
            {KIND_LABEL[group.kind]} · {group.items.length}
          </p>
          <div className="border-t border-line">
            {group.items.map((s, i) => (
              <div key={s.id} className="hairline py-3">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                  {s.image_url ? (
                    <img src={s.image_url} alt="" className="h-10 w-[30px] rounded-[2px] border border-line object-cover shrink-0" />
                  ) : (
                    <span className="h-10 w-[30px] rounded-[2px] border border-line bg-parchment shrink-0" />
                  )}

                  <div className="flex-1 min-w-[180px]">
                    <p className={`text-[14px] ${s.is_active ? "text-ink" : "text-ash line-through"}`}>
                      {label(s)}
                    </p>
                    {s.hook && <p className="text-[12px] text-ash mt-0.5 line-clamp-1">{s.hook}</p>}
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <form action={moveFeaturedSlotForm}>
                      <input type="hidden" name="id" value={s.id} />
                      <input type="hidden" name="direction" value="up" />
                      <button disabled={i === 0} aria-label="Move up"
                        className="text-[13px] px-2 py-1 border border-line rounded text-ash hover:border-gold hover:text-ink disabled:opacity-25 disabled:hover:border-line">↑</button>
                    </form>
                    <form action={moveFeaturedSlotForm}>
                      <input type="hidden" name="id" value={s.id} />
                      <input type="hidden" name="direction" value="down" />
                      <button disabled={i === group.items.length - 1} aria-label="Move down"
                        className="text-[13px] px-2 py-1 border border-line rounded text-ash hover:border-gold hover:text-ink disabled:opacity-25 disabled:hover:border-line">↓</button>
                    </form>

                    <button
                      type="button"
                      onClick={() => setEditingId(editingId === s.id ? null : s.id)}
                      className={`${btn} ${editingId === s.id ? "border-gold text-ink" : ""}`}
                    >
                      {editingId === s.id ? "Close" : "Edit"}
                    </button>

                    <form action={toggleFeaturedActiveForm}>
                      <input type="hidden" name="id" value={s.id} />
                      <button className={btn}>{s.is_active ? "Pause" : "Resume"}</button>
                    </form>

                    <form action={deleteFeaturedSlotForm}>
                      <input type="hidden" name="id" value={s.id} />
                      <button className="text-[10px] tracking-[0.14em] uppercase px-2.5 py-1.5 border border-line rounded-full text-ash hover:border-red-300 hover:text-red-600 transition-colors">
                        Delete
                      </button>
                    </form>
                  </div>
                </div>

                {editingId === s.id && (
                  <div className="mt-4">
                    <FeaturedForm existing={s} onDone={() => setEditingId(null)} />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </>
  );
}
