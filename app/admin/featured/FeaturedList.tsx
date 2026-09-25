"use client";
// app/admin/featured/FeaturedList.tsx
//
// One queue, any order, any mix of kinds. The homepage walks this list
// one card a day; days the list does not reach fill automatically.
//
// Three ways to reorder, because one is never enough:
//   · drag the ⠿ handle, with a gold line showing where it will land
//   · the position dropdown, which is the reliable one on a phone
//   · the arrows, which work from a keyboard
//
// Dragging is armed by pressing the handle rather than the row, so a
// click on Edit or Delete is never swallowed by a drag, and selecting
// text in a title still works.

import { useEffect, useRef, useState, useTransition } from "react";
import type { FeaturedSlot } from "@/lib/featured";
import FeaturedForm from "./FeaturedForm";
import {
  deleteFeaturedSlotForm,
  toggleFeaturedActiveForm,
  reorderFeaturedSlots,
} from "@/lib/featured-actions";

const KIND_LABEL: Record<string, string> = {
  fund: "Fund", producer: "Producer", project: "Project", custom: "Custom",
};

function label(s: FeaturedSlot): string {
  return s.title?.trim() || `${KIND_LABEL[s.kind]} · ${s.ref_id?.slice(0, 8) ?? "—"}`;
}

/** Move one item to an index, returning the new id order. */
function move(ids: string[], id: string, to: number): string[] {
  const next = ids.filter(x => x !== id);
  next.splice(Math.max(0, Math.min(next.length, to)), 0, id);
  return next;
}

export default function FeaturedList({ slots }: { slots: FeaturedSlot[] }) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [local, setLocal]         = useState<FeaturedSlot[]>(slots);
  const [armedId, setArmedId]     = useState<string | null>(null);
  const [dragId, setDragId]       = useState<string | null>(null);
  const [marker, setMarker]       = useState<{ index: number; before: boolean } | null>(null);
  const [, start]                 = useTransition();

  // While a save is in flight the server sends back the old order for a
  // moment. This keeps the list as the admin left it until it agrees.
  const pendingOrder = useRef<string[] | null>(null);
  useEffect(() => {
    const incoming = slots.map(s => s.id).join(",");
    if (pendingOrder.current && pendingOrder.current.join(",") !== incoming) return;
    pendingOrder.current = null;
    setLocal(slots);
  }, [slots]);

  function commit(ids: string[]) {
    const rank = new Map(ids.map((id, i) => [id, i]));
    setLocal(prev => [...prev].sort((a, b) => (rank.get(a.id) ?? 0) - (rank.get(b.id) ?? 0)));
    pendingOrder.current = ids;
    start(async () => { await reorderFeaturedSlots(ids); });
  }

  function endDrag() {
    setDragId(null); setArmedId(null); setMarker(null);
  }

  function onDrop() {
    if (!dragId || !marker) { endDrag(); return; }
    const ids  = local.map(s => s.id);
    const from = ids.indexOf(dragId);
    let to = marker.before ? marker.index : marker.index + 1;
    if (from < to) to -= 1;                 // the gap closes behind it
    endDrag();
    if (to === from) return;
    commit(move(ids, dragId, to));
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
        Day one shows the first card, day two the second, and so on. Drag the
        handle, or set a position from the dropdown. Kind does not restrict the
        order. With fewer than three cards the remaining days fill
        automatically.
      </p>

      <div className="border-t border-line" onDragOver={e => e.preventDefault()} onDrop={onDrop}>
        {local.map((s, i) => {
          const dragging = dragId === s.id;
          const lineAbove = marker?.index === i && marker.before && !dragging;
          const lineBelow = marker?.index === i && !marker.before && !dragging;

          return (
            <div
              key={s.id}
              draggable={armedId === s.id}
              onDragStart={e => {
                // Firefox will not start a drag without payload.
                e.dataTransfer.setData("text/plain", s.id);
                e.dataTransfer.effectAllowed = "move";
                setDragId(s.id);
              }}
              onDragEnd={endDrag}
              onDragOver={e => {
                e.preventDefault();
                if (!dragId || dragId === s.id) return;
                const r = e.currentTarget.getBoundingClientRect();
                const before = e.clientY < r.top + r.height / 2;
                if (marker?.index !== i || marker?.before !== before) setMarker({ index: i, before });
              }}
              className={`hairline relative py-3 ${dragging ? "opacity-35" : ""}`}
            >
              {lineAbove && <span className="pointer-events-none absolute inset-x-0 -top-px block h-[2px] bg-gold" />}
              {lineBelow && <span className="pointer-events-none absolute inset-x-0 -bottom-px block h-[2px] bg-gold" />}

              <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                <span
                  role="button"
                  tabIndex={-1}
                  aria-label="Drag to reorder"
                  title="Drag to reorder"
                  onPointerDown={() => setArmedId(s.id)}
                  onPointerUp={() => { if (!dragId) setArmedId(null); }}
                  style={{ touchAction: "none" }}
                  className="shrink-0 cursor-grab select-none px-1.5 py-2 text-[15px] leading-none text-ash/40 hover:text-ash active:cursor-grabbing"
                >⠿</span>

                <select
                  value={i}
                  onChange={e => commit(move(local.map(x => x.id), s.id, Number(e.target.value)))}
                  aria-label="Position"
                  className="shrink-0 rounded border border-line bg-white px-1.5 py-1 text-[12px] text-ash tabular-nums"
                >
                  {local.map((_, n) => <option key={n} value={n}>{n + 1}</option>)}
                </select>

                {s.image_url ? (
                  <img src={s.image_url} alt="" draggable={false}
                       className="h-10 w-[30px] shrink-0 rounded-[2px] border border-line object-cover" />
                ) : (
                  <span className="h-10 w-[30px] shrink-0 rounded-[2px] border border-line bg-parchment" />
                )}

                <div className="min-w-[180px] flex-1">
                  <p className={`text-[14px] ${s.is_active ? "text-ink" : "text-ash line-through"}`}>
                    {label(s)}
                  </p>
                  <p className="mt-0.5 text-[11px] uppercase tracking-[0.14em] text-ash/60">
                    {KIND_LABEL[s.kind]}
                  </p>
                </div>

                <div className="flex shrink-0 items-center gap-1.5">
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
          );
        })}
      </div>
    </>
  );
}
