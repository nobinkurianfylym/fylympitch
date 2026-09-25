// app/admin/outcomes/page.tsx
//
// The first page on the platform that answers "does this work".
// Everything else measures activity; this measures results.

import { createClient } from "@/lib/supabase/server";
import AskPanel from "./AskPanel";

export const dynamic = "force-dynamic";

type Win = {
  project: string; filmmaker: string; country: string | null;
  fund: string; programme: string; award_usd: number | null; reported_at: string;
};
type ByFund = { fund: string; applied: number; funded: number; declined: number };
type Stats = {
  tracked: number; asked: number; reported: number;
  funded: number; declined: number; waiting: number;
  wins: Win[]; by_fund: ByFund[];
};

const usd = (n: number | null) =>
  n ? `$${n.toLocaleString("en-US")}` : "—";

export default async function OutcomesPage() {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("application_outcome_stats");
  const s = (data ?? null) as Stats | null;

  const { data: runs } = await supabase
    .from("application_outcome_runs")
    .select("id, triggered_at, weeks_after, dry_run, filmmakers, asks")
    .order("triggered_at", { ascending: false })
    .limit(8);

  // Of the people who answered, how many were funded. Deliberately not
  // funded/tracked: most applications have never been asked about, and a
  // denominator full of unknowns would understate the rate to the point of
  // being misleading in the other direction.
  const answered = (s?.funded ?? 0) + (s?.declined ?? 0);
  const rate = answered ? Math.round(((s?.funded ?? 0) / answered) * 100) : null;

  return (
    <div className="max-w-4xl">
      <p className="eyebrow mb-3">Outcomes</p>
      <h1 className="font-display text-[32px] md:text-[40px] font-normal leading-[1.1] mb-4">
        Who actually{" "}
        <span className="italic text-gold">got the money.</span>
      </h1>
      <p className="text-[16px] leading-[1.7] text-ash max-w-2xl mb-10">
        Filmmakers do not come back to update a status field, so this asks them
        once, three weeks after the deadline, with three buttons in their
        notification tab. What comes back is the only evidence the platform
        works.
      </p>

      {error && (
        <p className="text-[14px] text-red-600 border border-red-200 bg-red-50 rounded-card px-5 py-4 mb-8">
          {error.message}
        </p>
      )}

      {s && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 border-y border-line py-7 mb-12">
            <Big n={s.funded}   label="Funded"    gold />
            <Big n={s.declined} label="Declined" />
            <Big n={s.waiting}  label="Waiting" />
            <Big n={rate === null ? "—" : `${rate}%`} label="Success rate" />
          </div>

          {/* ── PR ── */}
          <section className="mb-14">
            <div className="flex items-baseline justify-between flex-wrap gap-3 mb-2">
              <p className="eyebrow">The wins</p>
              <p className="text-[12px] text-ash">{s.wins.length} recorded</p>
            </div>
            <p className="text-[13px] leading-[1.7] text-ash mb-5 max-w-2xl">
              These are your case studies. Nothing here has been cleared for
              publication: ask the filmmaker before using their name, their
              title or the amount anywhere public.
            </p>

            {s.wins.length === 0 ? (
              <p className="text-[15px] text-ash border border-line rounded-card px-5 py-6">
                No funded outcomes recorded yet. Send the question below once a
                few deadlines have passed, and the first one will appear here.
              </p>
            ) : (
              <div className="border-t border-line">
                {s.wins.map((w, i) => (
                  <div key={i} className="hairline py-5">
                    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                      <span className="font-display text-[20px] font-normal">{w.project}</span>
                      <span className="text-[13px] text-ash">{w.filmmaker}</span>
                      {w.country && <span className="text-[13px] text-ash/60">{w.country}</span>}
                    </div>
                    <p className="text-[14px] text-ink mt-1.5">
                      <span className="text-gold">{w.fund}</span>
                      {w.programme && w.programme !== w.fund && (
                        <span className="text-ash">{" · "}{w.programme}</span>
                      )}
                      <span className="text-ash">{" · up to "}{usd(w.award_usd)}</span>
                    </p>
                    <p className="text-[12px] text-ash/60 mt-1">
                      reported {new Date(w.reported_at).toLocaleDateString()}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* ── Which funds say yes ── */}
          {s.by_fund.length > 0 && (
            <section className="mb-14">
              <p className="eyebrow mb-2">Which funds say yes</p>
              <p className="text-[13px] leading-[1.7] text-ash mb-5 max-w-2xl">
                Only funds with at least one decided application. Small numbers,
                so read it as a signal rather than a rate until the counts grow.
              </p>
              <div className="border-t border-line">
                {s.by_fund.map((f, i) => (
                  <div key={i} className="hairline py-3 flex flex-wrap items-baseline gap-x-5 text-[14px]">
                    <span className="text-ink flex-1 min-w-[180px]">{f.fund}</span>
                    <span className="text-emerald-700">{f.funded} funded</span>
                    <span className="text-ash">{f.declined} declined</span>
                    <span className="text-ash/60">{f.applied} applied</span>
                  </div>
                ))}
              </div>
            </section>
          )}

          <div className="flex flex-wrap gap-8 text-[13px] text-ash border-t border-line pt-6 mb-12">
            <span>{s.tracked} applications tracked</span>
            <span>{s.asked} asked</span>
            <span>{s.reported} answered</span>
          </div>
        </>
      )}

      {/* ── Ask ── */}
      <p className="eyebrow mb-4">Ask for outcomes</p>
      <AskPanel />

      {!!runs?.length && (
        <div className="mt-12">
          <p className="eyebrow mb-4">Recent runs</p>
          <div className="border-t border-line">
            {runs.map((r: any) => (
              <div key={r.id} className="hairline py-3 flex flex-wrap items-baseline gap-x-5 gap-y-1 text-[13px]">
                <span className="text-ash w-44">{new Date(r.triggered_at).toLocaleString()}</span>
                <span className={`text-[10px] tracking-[0.16em] uppercase px-2 py-0.5 rounded-full ${
                  r.dry_run ? "bg-parchment text-ash" : "bg-violet-50 text-violet-600"
                }`}>
                  {r.dry_run ? "Preview" : "Asked"}
                </span>
                <span className="text-ash">{r.weeks_after}w after deadline</span>
                <span className="text-ink">{r.filmmakers} filmmakers · {r.asks} applications</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Big({ n, label, gold }: { n: number | string; label: string; gold?: boolean }) {
  return (
    <div>
      <p className={`font-display text-[40px] leading-none font-normal ${gold ? "text-gold" : ""}`}>{n}</p>
      <p className="text-[10px] tracking-[0.2em] uppercase text-ash/60 mt-2">{label}</p>
    </div>
  );
}
