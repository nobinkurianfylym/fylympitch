// app/admin/featured/page.tsx
//
// The homepage featured column: what is queued, what is coming,
// and how to change it.

import { createClient } from "@/lib/supabase/server";
import { getUpcoming, type FeaturedSlot } from "@/lib/featured";
import FeaturedForm from "./FeaturedForm";
import FeaturedList from "./FeaturedList";

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
        thing. The cycle is always fund, then producer, then project, with your
        custom cards taking a fourth turn when any exist. A day with nothing
        queued is filled automatically from the catalogue rather than skipped,
        so the column is never blank.
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
              <span className="text-[10px] tracking-[0.16em] uppercase px-2 py-0.5 rounded-full bg-parchment text-ash w-20 text-center">
                {KIND_LABEL[d.kind]}
              </span>
              {d.slot ? (
                <span className="text-ink">{label(d.slot)}</span>
              ) : (
                <span className="text-ash/60">
                  Auto ·{" "}
                  {d.kind === "fund"     && "closing soonest"}
                  {d.kind === "producer" && "approved producers, in turn"}
                  {d.kind === "project"  && "newest public project with a poster"}
                  {d.kind === "custom"   && "nothing queued"}
                </span>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* ── Queue ── */}
      <section className="mb-14">
        <p className="eyebrow mb-4">The queue</p>

        <FeaturedList slots={slots} />
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
