"use client";
// app/admin/featured/RefPicker.tsx
//
// Pick what to feature by name. The form still submits a ref_id, so
// nothing downstream changes, but nobody has to go and find a UUID
// to give one project preference over another.

import { useEffect, useRef, useState, useTransition } from "react";
import { searchFeaturable, getFeaturableById, type FeaturableRow } from "@/lib/featured-actions";

export default function RefPicker({
  kind,
  initialId = "",
}: {
  kind: "fund" | "producer" | "project";
  initialId?: string;
}) {
  const [q, setQ]           = useState("");
  const [rows, setRows]     = useState<FeaturableRow[]>([]);
  const [chosen, setChosen] = useState<FeaturableRow | null>(null);
  const [id, setId]         = useState(initialId);
  const [open, setOpen]     = useState(false);
  const [pending, start]    = useTransition();

  // Show what is already chosen by name when editing, rather than the
  // bare id the form actually submits.
  useEffect(() => {
    if (!initialId) return;
    let live = true;
    getFeaturableById(kind, initialId).then(row => {
      if (live && row) setChosen(row);
    });
    return () => { live = false; };
    // Deliberately once: re-resolving on every keystroke would fight the
    // admin's own selection.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Reset when the admin switches kind: a fund id in a project slot would
  // fail silently at render time. Skipped on the first render, which would
  // otherwise wipe the id an edit form just handed us.
  const mounted = useRef(false);
  useEffect(() => {
    if (!mounted.current) { mounted.current = true; return; }
    setChosen(null); setId(""); setQ(""); setRows([]); setOpen(false);
  }, [kind]);

  // Debounced. An empty box lists the obvious candidates rather than
  // nothing, because most of the time the admin wants a recent one.
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => {
      start(async () => setRows(await searchFeaturable(kind, q)));
    }, q ? 250 : 0);
    return () => clearTimeout(t);
  }, [q, kind, open]);

  const noun = kind === "fund" ? "fund" : kind === "producer" ? "producer" : "project";

  return (
    <div>
      <input type="hidden" name="ref_id" value={id} />

      {chosen ? (
        <div className="flex items-center gap-3 rounded-card border border-gold/50 bg-gold/5 px-3 py-2.5">
          {chosen.image ? (
            <img src={chosen.image} alt="" className="h-10 w-[30px] shrink-0 rounded-[2px] border border-line object-cover" />
          ) : (
            <span className="h-10 w-[30px] shrink-0 rounded-[2px] border border-line bg-parchment" />
          )}
          <div className="min-w-0 flex-1">
            <p className="text-[14px] text-ink">{chosen.label}</p>
            {chosen.sublabel && <p className="text-[12px] text-ash">{chosen.sublabel}</p>}
            {chosen.warning && <p className="text-[12px] text-amber-700">{chosen.warning}</p>}
          </div>
          <button type="button"
            onClick={() => { setChosen(null); setId(""); setOpen(true); }}
            className="shrink-0 text-[11px] tracking-[0.14em] uppercase text-ash hover:text-ink">
            Change
          </button>
        </div>
      ) : (
        <>
          <input
            value={q}
            onChange={e => setQ(e.target.value)}
            onFocus={() => setOpen(true)}
            placeholder={`Search ${noun}s by name…`}
            className="field w-full"
          />

          {open && (
            <div className="mt-2 max-h-[280px] overflow-y-auto rounded-card border border-line">
              {pending && rows.length === 0 && (
                <p className="px-3 py-3 text-[13px] text-ash">Searching…</p>
              )}
              {!pending && rows.length === 0 && (
                <p className="px-3 py-3 text-[13px] text-ash">
                  Nothing matches. {kind === "producer" && "Only approved producers can be featured."}
                  {kind === "project" && "Only public, non-hidden projects can be featured."}
                </p>
              )}
              {rows.map(r => (
                <button
                  key={r.id} type="button"
                  onClick={() => { setChosen(r); setId(r.id); setOpen(false); }}
                  className="flex w-full items-center gap-3 border-b border-line px-3 py-2.5 text-left last:border-b-0 hover:bg-parchment"
                >
                  {r.image ? (
                    <img src={r.image} alt="" className="h-10 w-[30px] shrink-0 rounded-[2px] border border-line object-cover" />
                  ) : (
                    <span className="h-10 w-[30px] shrink-0 rounded-[2px] border border-line bg-parchment" />
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block text-[14px] text-ink">{r.label}</span>
                    {r.sublabel && <span className="block text-[12px] text-ash">{r.sublabel}</span>}
                  </span>
                  {r.warning && (
                    <span className="shrink-0 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] uppercase tracking-[0.1em] text-amber-700">
                      {r.warning}
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}

          <p className="mt-1.5 text-[12px] text-ash">
            Whoever you pick jumps into the {noun} queue. Reorder it below to
            decide who gets the next {noun} day.
          </p>
        </>
      )}
    </div>
  );
}
