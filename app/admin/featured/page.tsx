// app/admin/featured/page.tsx
//
// The homepage featured column: what is queued, what is coming,
// and how to change it.

import { createClient } from "@/lib/supabase/server";
import { getUpcoming, type FeaturedSlot } from "@/lib/featured";
import FeaturedForm from "./FeaturedForm";
import {
  deleteFeaturedSlotForm as deleteFeaturedSlot,
  toggleFeaturedActiveForm as toggleFeaturedActive,
  moveFeaturedSlotForm as moveFeaturedSlot,
} from "@/lib/featured-actions";

export const dynamic = "force-dynamic";

const KIND_LABEL: Record<string, string> = {
  fund: "Fund", producer: "Producer", project: "Project", custom: "Custom",
};

function label(s: FeaturedSlot): string {
  return s.title?.trim() || `${KIND_LABEL[s.kind]} · ${s.ref_id?.slice(0, 8) ?? "—"}`;
}

export default async function FeaturedAdminPage() {
  const supabase = await createClient();

  const [{ data: rows }, upcoming] = await Promise.all([
    supabase.from("featured_slots").select("*")
      .order("kind", { ascending: true })
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true }),
    getUpcoming(14),
  ]);

  const slots = ((rows ?? []) as any[]).map(r => ({ ...r, rows: Array.isArray(r.rows) ? r.rows : [] })) as FeaturedSlot[];
  const byKind = ["fund", "producer", "project", "custom"]
    .map(k => ({ kind: k, items: slots.filter(s => s.kind === k) }))
    .filter(g => g.items.length > 0);

  return (
    <div className="max-w-4xl">
      <p className="eyebrow mb-3">Homepage</p>
      <h1 className="font-display text-[32px] md:text-[40px] font-normal leading-[1.1] mb-4">
        The featured column,{" "}
        <span className="italic text-gold">one card a day.</span>
      </h1>
      <p className="text-[16px] leading-[1.7] text-ash max-w-2xl mb-10">
        The card beside the hero changes at midnight UTC. The date decides it,
        so nothing can get stuck and every visitor on a given day sees the same
        thing. Kinds take turns, and within a kind the queue advances one step
        each time its turn comes round. If the queue is empty the card falls
        back to the soonest-closing fund in the catalogue, so it is never blank.
      </p>

      {/* ── Schedule ── */}
      <section className="mb-14">
        <p className="eyebrow mb-4">Next fourteen days</p>
        <div className="border-t border-line">
          {upcoming.map((d, i) => (
            <div key={d.date} className="hairline py-2.5 flex flex-wrap items-baseline gap-x-4 gap-y-1 text-[13px]">
              <span className={`w-28 ${i === 0 ? "text-gold" : "text-ash"}`}>
                {i === 0 ? "Today" : new Date(d.date + "T00:00:00Z").toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" })}
              </span>
              {d.slot ? (
                <>
                  <span className="text-[10px] tracking-[0.16em] uppercase px-2 py-0.5 rounded-full bg-parchment text-ash">
                    {KIND_LABEL[d.slot.kind]}
                  </span>
                  <span className="text-ink">{label(d.slot)}</span>
                </>
              ) : (
                <span className="text-ash/60">Fallback — soonest-closing fund</span>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* ── Queue ── */}
      <section className="mb-14">
        <p className="eyebrow mb-4">The queue</p>

        {byKind.length === 0 ? (
          <p className="text-[15px] text-ash border border-line rounded-card px-5 py-6">
            Nothing queued. The homepage is showing the soonest-closing fund
            until you add something below.
          </p>
        ) : byKind.map(group => (
          <div key={group.kind} className="mb-8">
            <p className="text-[10px] tracking-[0.2em] uppercase text-ash/60 mb-2">
              {KIND_LABEL[group.kind]} · {group.items.length}
            </p>
            <div className="border-t border-line">
              {group.items.map((s, i) => (
                <div key={s.id} className="hairline py-3 flex flex-wrap items-center gap-x-3 gap-y-2">
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
                    <form action={moveFeaturedSlot}>
                      <input type="hidden" name="id" value={s.id} />
                      <input type="hidden" name="direction" value="up" />
                      <button disabled={i === 0}
                        className="text-[13px] px-2 py-1 border border-line rounded text-ash hover:border-gold hover:text-ink disabled:opacity-25 disabled:hover:border-line"
                        aria-label="Move up">↑</button>
                    </form>
                    <form action={moveFeaturedSlot}>
                      <input type="hidden" name="id" value={s.id} />
                      <input type="hidden" name="direction" value="down" />
                      <button disabled={i === group.items.length - 1}
                        className="text-[13px] px-2 py-1 border border-line rounded text-ash hover:border-gold hover:text-ink disabled:opacity-25 disabled:hover:border-line"
                        aria-label="Move down">↓</button>
                    </form>
                    <form action={toggleFeaturedActive}>
                      <input type="hidden" name="id" value={s.id} />
                      <button className="text-[10px] tracking-[0.14em] uppercase px-2.5 py-1.5 border border-line rounded-full text-ash hover:border-gold hover:text-ink">
                        {s.is_active ? "Pause" : "Resume"}
                      </button>
                    </form>
                    <form action={deleteFeaturedSlot}>
                      <input type="hidden" name="id" value={s.id} />
                      <button className="text-[10px] tracking-[0.14em] uppercase px-2.5 py-1.5 border border-line rounded-full text-ash hover:border-red-300 hover:text-red-600">
                        Delete
                      </button>
                    </form>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </section>

      {/* ── Add ── */}
      <section>
        <p className="eyebrow mb-4">Add a card</p>
        <FeaturedForm />
        <p className="text-[13px] leading-[1.7] text-ash mt-5 max-w-2xl">
          A fund needs nobody&rsquo;s permission: every figure is one it publishes
          itself. A producer or a project is a claim about someone else, so get
          their consent before it goes on the homepage, and let them see the copy.
        </p>
      </section>
    </div>
  );
}
