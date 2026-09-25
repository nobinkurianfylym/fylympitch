"use client";
// app/admin/featured/FeaturedList.tsx
//
// One queue, any order. Drag a card anywhere, regardless of kind: three
// projects in a row is allowed if that is what you want. The homepage
// walks this list one card a day, and any day the list does not reach
// is filled automatically.
//
// Native HTML5 drag, no library. The arrows stay for touch and keyboard,
// where dragging is not available.

import { useEffect, useState, useTransition } from "react";
import type { FeaturedSlot } from "@/lib/featured";
import FeaturedForm from "./FeaturedForm";
import {
  deleteFeaturedSlotForm,
  toggleFeaturedActiveForm,
  moveFeaturedSlotForm,
  reorderFeaturedSlots,
} from "@/lib/featured-actions";

const KIND_LABEL: Record<string, string> = {
  fund: "Fund", producer: "Producer", project: "Project", custom: "Custom",
};

function label(s: FeaturedSlot): string {
  return s.title?.trim() || `${KIND_LABEL[s.kind]} · ${s.ref_id?.slice(0, 8) ?? "—"}`;
}

export default function FeaturedList({ slots }: { slots: FeaturedSlot[] }) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [local, setLocal]         = useState<FeaturedSlot[]>(slots);
  const [dragId, setDragId]       = useState<string | null>(null);
  const [overId, setOverId]       = useState<string | null>(null);
  const [, start]                 = useTransition();

  // The server is the truth; a refresh after any action re-seeds this.
  useEffect(() => { setLocal(slots); }, [slots]);

  function drop(targetId: string) {
    const from = dragId;
    setDragId(null);
    setOverId(null);
    if (!from || from === targetId) return;

    const ids  = local.map(s => s.id);
    const next = ids.filter(id => id !== from);
    next.splice(
      ids.indexOf(targetId) > ids.indexOf(from)
        ? next.indexOf(targetId) + 1
        : next.indexOf(targetId),
      0, from);

    const rank = new Map(next.map((id, i) => [id, i]));
    setLocal(prev => [...prev].sort((a, b) => (rank.get(a.id) ?? 0) - (rank.get(b.id) ?? 0)));
    start(async () => { await reorderFeaturedSlots(next); });
  }

  if (local.length === 0) {
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
      <p className="text-[13px] leading-[1.7] text-ash mb-5 max-w-2xl">
        Drag a card anywhere in this list. Day one shows the first card, day two
        the second, and so on. Kind does not restrict the order, so you can run
        three projects together if you want to. With fewer than three cards the
        remaining days fill automatically.
      </p>

      <div className="border-t border-line">
        {local.map((s, i) => (
          <div
            key={s.id}
            draggable
            onDragStart={() => setDragId(s.id)}
            onDragEnd={() => { setDragId(null); setOverId(null); }}
            onDragOver={(e) => { e.preventDefault(); if (overId !== s.id) setOverId(s.id); }}
            onDrop={(e) => { e.preventDefault(); drop(s.id); }}
            className={`hairline py-3 transition-colors ${dragId === s.id ? "opacity-40" : ""} ${
              overId === s.id && dragId && dragId !== s.id ? "bg-gold/5" : ""
            }`}
          >
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
              <span
                aria-hidden="true"
                title="Drag to reorder"
                className="shrink-0 cursor-grab select-none px-1 text-[15px] leading-none text-ash/40 active:cursor-grabbing"
              >⠿</span>

              <span className="w-6 shrink-0 text-[12px] text-ash/50 tabular-nums">{i + 1}</span>

              {s.image_url ? (
                <img src={s.image_url} alt="" className="h-10 w-[30px] shrink-0 rounded-[2px] border border-line object-cover" />
              ) : (
                <span className="h-10 w-[30px] shrink-0 rounded-[2px] border border-line bg-parchment" />
              )}

              <div className="min-w-[180px] flex-1">
                <p className={`text-[14px] ${s.is_active ? "text-ink" : "text-ash line-through"}`}>
                  {label(s)}
                </p>
                <p className="mt-0.5 text-[11px] tracking-[0.14em] uppercase text-ash/60">
                  {KIND_LABEL[s.kind]}
                </p>
              </div>

              <div className="flex shrink-0 items-center gap-1.5">
                <form action={moveFeaturedSlotForm}>
                  <input type="hidden" name="id" value={s.id} />
                  <input type="hidden" name="direction" value="up" />
                  <button disabled={i === 0} aria-label="Move up"
                    className="rounded border border-line px-2 py-1 text-[13px] text-ash hover:border-gold hover:text-ink disabled:opacity-25 disabled:hover:border-line">↑</button>
                </form>
                <form action={moveFeaturedSlotForm}>
                  <input type="hidden" name="id" value={s.id} />
                  <input type="hidden" name="direction" value="down" />
                  <button disabled={i === local.length - 1} aria-label="Move down"
                    className="rounded border border-line px-2 py-1 text-[13px] text-ash hover:border-gold hover:text-ink disabled:opacity-25 disabled:hover:border-line">↓</button>
                </form>

                <button type="button"
                  onClick={() => setEditingId(editingId === s.id ? null : s.id)}
                  className={`${btn} ${editingId === s.id ? "border-gold text-ink" : ""}`}>
                  {editingId === s.id ? "Close" : "Edit"}
                </button>

                <form action={toggleFeaturedActiveForm}>
                  <input type="hidden" name="id" value={s.id} />
                  <button className={btn}>{s.is_active ? "Pause" : "Resume"}</button>
                </form>

                <form action={deleteFeaturedSlotForm}>
                  <input type="hidden" name="id" value={s.id} />
                  <button className="rounded-full border border-line px-2.5 py-1.5 text-[10px] uppercase tracking-[0.14em] text-ash transition-colors hover:border-red-300 hover:text-red-600">
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
    </>
  );
}
