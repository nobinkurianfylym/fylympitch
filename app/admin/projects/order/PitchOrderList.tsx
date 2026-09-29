"use client";
// app/admin/projects/order/PitchOrderList.tsx
//
// Pinned pitches, in the order they are listed across the platform, and
// below them every other public pitch with a Pin button.
//
// Same reordering as the Featured column: drag the ⠿ handle (a gold line shows
// where it will land) or pick a position from the dropdown, which is the
// reliable one on a phone. Dragging is armed by pressing the handle, so a click
// on Unpin or View is never swallowed by a drag.

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { pinPitch, unpinPitch, reorderPinnedPitches, setPitchOrderMode } from "@/lib/pitch-order-actions";

type Mode = "newest" | "likes";

export type OrderPitch = {
  id: string;
  href: string;
  title: string;
  meta: string;
  imageUrl: string | null;
  isPublic: boolean;
  adminHidden: boolean;
  exclusive: boolean;
  createdAt: string;
  loveCount: number;
};

/** The order the unpinned pitches are listed in, for the chosen mode. */
function sortRest(list: OrderPitch[], mode: Mode): OrderPitch[] {
  return [...list].sort((a, b) =>
    (mode === "likes" ? b.loveCount - a.loveCount : 0) || b.createdAt.localeCompare(a.createdAt));
}

function Loves({ n }: { n: number }) {
  return (
    <span className="text-[12px] text-ash tabular-nums" title={`${n} ${n === 1 ? "like" : "likes"}`}>
      <span aria-hidden="true" className="text-gold">♥</span> {n}
    </span>
  );
}

function move(ids: string[], id: string, to: number): string[] {
  const next = ids.filter((x) => x !== id);
  next.splice(Math.max(0, Math.min(next.length, to)), 0, id);
  return next;
}

const btn =
  "text-[10px] tracking-[0.14em] uppercase px-2.5 py-1.5 border border-line rounded-full " +
  "text-ash hover:border-gold hover:text-ink transition-colors disabled:opacity-40";

function Thumb({ url }: { url: string | null }) {
  return url ? (
    <img src={url} alt="" draggable={false} loading="lazy"
         className="h-12 w-[34px] shrink-0 rounded-[2px] border border-line object-cover" />
  ) : (
    <span className="h-12 w-[34px] shrink-0 rounded-[2px] border border-line bg-parchment" />
  );
}

/** Where a pinned pitch will actually show, stated plainly. */
function Visibility({ p }: { p: OrderPitch }) {
  const chip = "text-[10px] tracking-[0.12em] uppercase px-2 py-0.5 rounded-full border";
  if (p.adminHidden) return <span className={`${chip} bg-red-50 text-red-600 border-red-200`}>Admin hidden · not listed</span>;
  if (p.exclusive && !p.isPublic) return <span className={`${chip} bg-amber-50 text-amber-700 border-amber-200`}>Exclusive pitch · not listed</span>;
  if (!p.isPublic) return <span className={`${chip} bg-amber-50 text-amber-700 border-amber-200`}>Private · Producer Studio only</span>;
  return null;
}

export default function PitchOrderList({ pinned, rest, mode }: { pinned: OrderPitch[]; rest: OrderPitch[]; mode: Mode }) {
  const [localPinned, setLocalPinned] = useState(pinned);
  const [localRest, setLocalRest]     = useState(rest);
  const [localMode, setLocalMode]     = useState<Mode>(mode);
  const [modeBusy, setModeBusy]       = useState(false);
  const [armedId, setArmedId]         = useState<string | null>(null);
  const [dragId, setDragId]           = useState<string | null>(null);
  const [marker, setMarker]           = useState<{ index: number; before: boolean } | null>(null);
  const [query, setQuery]             = useState("");
  const [error, setError]             = useState<string | null>(null);
  const [busyId, setBusyId]           = useState<string | null>(null);
  const [, start]                     = useTransition();

  // While a save is in flight the server can send back the old order for a
  // moment. Keep the list as the admin left it until the server agrees.
  const pendingOrder = useRef<string[] | null>(null);
  useEffect(() => {
    const incoming = pinned.map((p) => p.id).join(",");
    if (pendingOrder.current && pendingOrder.current.join(",") !== incoming) return;
    pendingOrder.current = null;
    setLocalPinned(pinned);
    setLocalRest(rest);
  }, [pinned, rest]);
  useEffect(() => { setLocalMode(mode); }, [mode]);

  function chooseMode(next: Mode) {
    if (next === localMode || modeBusy) return;
    setError(null);
    setModeBusy(true);
    setLocalMode(next);
    setLocalRest((prev) => sortRest(prev, next));
    start(async () => {
      const res = await setPitchOrderMode(next);
      setModeBusy(false);
      if (res.error) { setLocalMode(mode); setLocalRest(sortRest(rest, mode)); setError(res.error); }
    });
  }

  function sortPinnedByLikes() {
    // Stable: equal likes keep their current relative order.
    const ids = localPinned
      .map((p, i) => ({ p, i }))
      .sort((a, b) => b.p.loveCount - a.p.loveCount || a.i - b.i)
      .map(({ p }) => p.id);
    if (ids.join(",") === localPinned.map((p) => p.id).join(",")) return;
    commit(ids);
  }

  const filteredRest = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return localRest;
    return localRest.filter((p) => `${p.title} ${p.meta}`.toLowerCase().includes(q));
  }, [localRest, query]);

  function commit(ids: string[]) {
    const rank = new Map(ids.map((id, i) => [id, i]));
    setLocalPinned((prev) => [...prev].sort((a, b) => (rank.get(a.id) ?? 0) - (rank.get(b.id) ?? 0)));
    pendingOrder.current = ids;
    setError(null);
    start(async () => {
      const res = await reorderPinnedPitches(ids);
      if (res.error) { pendingOrder.current = null; setLocalPinned(pinned); setError(res.error); }
    });
  }

  function pin(p: OrderPitch) {
    setError(null);
    setBusyId(p.id);
    const nextIds = [...localPinned.map((x) => x.id), p.id];
    pendingOrder.current = nextIds;
    setLocalPinned((prev) => [...prev, p]);
    setLocalRest((prev) => prev.filter((x) => x.id !== p.id));
    start(async () => {
      const res = await pinPitch(p.id);
      setBusyId(null);
      if (res.error) { pendingOrder.current = null; setLocalPinned(pinned); setLocalRest(rest); setError(res.error); }
    });
  }

  function unpin(p: OrderPitch) {
    setError(null);
    setBusyId(p.id);
    const nextIds = localPinned.map((x) => x.id).filter((id) => id !== p.id);
    pendingOrder.current = nextIds;
    setLocalPinned((prev) => prev.filter((x) => x.id !== p.id));
    if (p.isPublic && !p.adminHidden) {
      setLocalRest((prev) => sortRest([...prev, p], localMode));
    }
    start(async () => {
      const res = await unpinPitch(p.id);
      setBusyId(null);
      if (res.error) { pendingOrder.current = null; setLocalPinned(pinned); setLocalRest(rest); setError(res.error); }
    });
  }

  function endDrag() { setDragId(null); setArmedId(null); setMarker(null); }

  function onDrop() {
    if (!dragId || !marker) { endDrag(); return; }
    const ids = localPinned.map((p) => p.id);
    const from = ids.indexOf(dragId);
    let to = marker.before ? marker.index : marker.index + 1;
    if (from < to) to -= 1;
    endDrag();
    if (to === from) return;
    commit(move(ids, dragId, to));
  }

  return (
    <div className="space-y-12">
      {error && (
        <p role="alert" className="text-[13px] text-red-700 bg-red-50 border border-red-200 rounded-card px-4 py-3">
          {error}
        </p>
      )}

      {/* ── Order after the pinned pitches ── */}
      <section className="border border-line rounded-card px-5 py-4 flex flex-wrap items-center justify-between gap-4 bg-white/60">
        <div className="min-w-0">
          <p className="text-[14px] text-ink">After the pinned pitches, list the rest</p>
          <p className="text-[12px] text-ash mt-0.5">
            {localMode === "likes"
              ? "Most liked first. Pitches with the same number of likes are listed newest first."
              : "Newest first."}
          </p>
        </div>
        <div role="radiogroup" aria-label="Order after the pinned pitches" className="inline-flex rounded-full border border-line p-1 bg-white">
          {([["newest", "Newest first"], ["likes", "Most liked first"]] as [Mode, string][]).map(([value, label]) => (
            <button
              key={value}
              id={`pitch-order-mode-${value}`}
              type="button"
              role="radio"
              aria-checked={localMode === value}
              disabled={modeBusy}
              onClick={() => chooseMode(value)}
              className={`rounded-full px-4 py-1.5 text-[11px] tracking-[0.12em] uppercase transition-colors ${
                localMode === value ? "bg-ink text-ivory" : "text-ash hover:text-ink"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </section>

      {/* ── Pinned ── */}
      <section>
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <p className="eyebrow">Pinned to the top{localPinned.length > 0 ? ` · ${localPinned.length}` : ""}</p>
          {localPinned.length > 1 && (
            <button type="button" onClick={sortPinnedByLikes} className={btn}
              title="Reorder the pinned list once, most liked first. You can still drag afterwards.">
              Sort pinned by likes
            </button>
          )}
        </div>

        {localPinned.length === 0 ? (
          <p className="text-[14px] text-ash border border-line rounded-card px-5 py-6 max-w-2xl">
            Nothing pinned. Every listing follows the order set above. Pin a pitch below to put it at the top.
          </p>
        ) : (
          <div className="border-t border-line" onDragOver={(e) => e.preventDefault()} onDrop={onDrop}>
            {localPinned.map((p, i) => {
              const dragging = dragId === p.id;
              const lineAbove = marker?.index === i && marker.before && !dragging;
              const lineBelow = marker?.index === i && !marker.before && !dragging;
              return (
                <div
                  key={p.id}
                  draggable={armedId === p.id}
                  onDragStart={(e) => {
                    e.dataTransfer.setData("text/plain", p.id); // Firefox needs a payload
                    e.dataTransfer.effectAllowed = "move";
                    setDragId(p.id);
                  }}
                  onDragEnd={endDrag}
                  onDragOver={(e) => {
                    e.preventDefault();
                    if (!dragId || dragId === p.id) return;
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
                      onPointerDown={() => setArmedId(p.id)}
                      onPointerUp={() => { if (!dragId) setArmedId(null); }}
                      style={{ touchAction: "none" }}
                      className="shrink-0 cursor-grab select-none px-1.5 py-2 text-[15px] leading-none text-ash/40 hover:text-ash active:cursor-grabbing"
                    >⠿</span>

                    <select
                      value={i}
                      onChange={(e) => commit(move(localPinned.map((x) => x.id), p.id, Number(e.target.value)))}
                      aria-label={`Position of ${p.title}`}
                      className="shrink-0 rounded border border-line bg-white px-1.5 py-1 text-[12px] text-ash tabular-nums"
                    >
                      {localPinned.map((_, n) => <option key={n} value={n}>{n + 1}</option>)}
                    </select>

                    <Thumb url={p.imageUrl} />

                    <div className="min-w-[180px] flex-1">
                      <p className="text-[13px] font-semibold uppercase text-ink" style={{ letterSpacing: "-0.01em" }}>{p.title}</p>
                      <div className="mt-0.5 flex flex-wrap items-center gap-2">
                        {p.meta && <span className="text-[12px] text-ash">{p.meta}</span>}
                        <Loves n={p.loveCount} />
                        <Visibility p={p} />
                      </div>
                    </div>

                    <div className="flex shrink-0 items-center gap-1.5">
                      <a href={p.href} target="_blank" rel="noopener" className={btn}>View</a>
                      <button type="button" onClick={() => unpin(p)} disabled={busyId === p.id} className={btn}>
                        Unpin
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* ── Everything else ── */}
      <section>
        <div className="flex flex-wrap items-end justify-between gap-4 mb-4">
          <div>
            <p className="eyebrow">Other public pitches · {localMode === "likes" ? "most liked first" : "newest first"}</p>
            <p className="text-[12px] text-ash mt-1.5">Pinning adds a pitch to the end of the pinned list. Drag it higher from there.</p>
          </div>
          <input
            id="pitch-order-search"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search title or filmmaker"
            aria-label="Search pitches"
            className="field !py-2 w-full sm:w-72 text-[13px]"
          />
        </div>

        {filteredRest.length === 0 ? (
          <p className="text-[14px] text-ash px-1 py-4">
            {query ? `No public pitch matches “${query}”.` : "Every public pitch is pinned."}
          </p>
        ) : (
          <div className="border-t border-line">
            {filteredRest.map((p) => (
              <div key={p.id} className="hairline py-3 flex flex-wrap items-center gap-x-3 gap-y-2">
                <Thumb url={p.imageUrl} />
                <div className="min-w-[180px] flex-1">
                  <p className="text-[13px] font-semibold uppercase text-ink" style={{ letterSpacing: "-0.01em" }}>{p.title}</p>
                  <div className="mt-0.5 flex flex-wrap items-center gap-2">
                    {p.meta && <span className="text-[12px] text-ash">{p.meta}</span>}
                    <Loves n={p.loveCount} />
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  <a href={p.href} target="_blank" rel="noopener" className={btn}>View</a>
                  <button type="button" onClick={() => pin(p)} disabled={busyId === p.id}
                    className={`${btn} border-gold/50 text-ink`}>
                    Pin
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
