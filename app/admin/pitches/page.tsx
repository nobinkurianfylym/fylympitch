// app/admin/pitches/page.tsx
//
// Every pitch aimed at a producer, in one place: exclusive pitches
// (a project assigned to one producer) and applications to
// producer-posted opportunities.
//
// The private ones are the point. Filmmakers are told, on the
// homepage FAQ, that private projects are visible to them, to
// PITCH.FYLYM administrators and to verified industry accounts, so
// this shows nothing anyone was not told about. It exists so that
// when a filmmaker asks whether their pitch arrived, the answer
// does not require a database query.

import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type Exclusive = {
  project_id: string; slug: string | null; title: string;
  format: string | null; country: string | null;
  is_public: boolean; admin_hidden: boolean; created_at: string;
  filmmaker: string; filmmaker_id: string;
  producer: string; producer_id: string | null; producer_username: string | null;
};

type Application = {
  application_id: string; created_at: string; status: string;
  match_score: number | null;
  project_id: string; project: string; is_public: boolean;
  filmmaker: string; filmmaker_id: string;
  opportunity: string; opportunity_id: string;
  producer: string; producer_id: string | null; producer_username: string | null;
};

type Overview = {
  exclusive: Exclusive[];
  applications: Application[];
  counts: {
    exclusive_total: number; exclusive_private: number;
    applications_total: number; unread_producers: number;
  };
};

const when = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });

function Tag({ children, tone = "ash" }: { children: React.ReactNode; tone?: "ash" | "red" | "gold" | "green" }) {
  const c = {
    ash:   "border-line text-ash",
    red:   "border-red-200 bg-red-50 text-red-600",
    gold:  "border-gold/40 bg-gold/5 text-[#8A6F3E]",
    green: "border-emerald-200 bg-emerald-50 text-emerald-700",
  }[tone];
  return (
    <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[9.5px] uppercase tracking-[0.12em] ${c}`}>
      {children}
    </span>
  );
}

export default async function PitchesPage() {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_pitch_overview", { p_limit: 200 });
  const o = (data ?? null) as Overview | null;

  return (
    <div className="max-w-4xl">
      <p className="eyebrow mb-3">Oversight</p>
      <h1 className="font-display text-[32px] md:text-[40px] font-normal leading-[1.1] mb-4">
        Every pitch sent{" "}
        <span className="italic text-gold">to a producer.</span>
      </h1>
      <p className="text-[16px] leading-[1.7] text-ash max-w-2xl mb-10">
        Exclusive pitches and applications to producer-posted opportunities,
        including the private ones. Your FAQ tells filmmakers that private
        projects are visible to administrators, so nothing here is a surprise to
        them &mdash; but treat it as confidential material and never quote a
        private pitch to anyone but its owner.
      </p>

      {error && (
        <p className="mb-8 rounded-card border border-red-200 bg-red-50 px-5 py-4 text-[14px] text-red-600">
          {error.message}
          {error.message.includes("admin_pitch_overview") && " — run migration 098."}
        </p>
      )}

      {o && (
        <>
          <div className="mb-12 grid grid-cols-2 gap-6 border-y border-line py-7 sm:grid-cols-4">
            <Big n={o.counts.exclusive_total}    label="Exclusive pitches" />
            <Big n={o.counts.exclusive_private}  label="Of those, private" gold />
            <Big n={o.counts.applications_total} label="Applications" />
            <Big n={o.counts.unread_producers}   label="Producers pitched" />
          </div>

          {/* ── Exclusive pitches ── */}
          <section className="mb-14">
            <p className="eyebrow mb-2">Exclusive pitches</p>
            <p className="mb-5 max-w-2xl text-[13px] leading-[1.7] text-ash">
              A project assigned to one producer. Private ones never appear in
              the showcase and are visible only to the filmmaker, that producer,
              verified industry accounts and you.
            </p>

            {o.exclusive.length === 0 ? (
              <p className="rounded-card border border-line px-5 py-6 text-[15px] text-ash">
                No exclusive pitches yet.
              </p>
            ) : (
              <div className="border-t border-line">
                {o.exclusive.map(e => (
                  <div key={e.project_id} className="hairline py-4">
                    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                      <Link href={`/dashboard/projects/${e.project_id}`}
                            className="font-display text-[19px] font-normal hover:text-gold">
                        {e.title}
                      </Link>
                      {!e.is_public && <Tag tone="gold">Private</Tag>}
                      {e.admin_hidden && <Tag tone="red">Hidden</Tag>}
                      <span className="text-[12px] text-ash/60">{when(e.created_at)}</span>
                    </div>
                    <p className="mt-1 text-[14px] text-ash">
                      <span className="text-ink">{e.filmmaker}</span>
                      {" → "}
                      {e.producer_username ? (
                        <Link href={`/u/${e.producer_username}`} className="text-gold hover:underline">
                          {e.producer}
                        </Link>
                      ) : (
                        <span className="text-gold">{e.producer}</span>
                      )}
                      {(e.format || e.country) && (
                        <span className="text-ash/60">
                          {" · "}{[e.format, e.country].filter(Boolean).join(" · ")}
                        </span>
                      )}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* ── Applications ── */}
          <section>
            <p className="eyebrow mb-2">Applications to producer briefs</p>
            <p className="mb-5 max-w-2xl text-[13px] leading-[1.7] text-ash">
              Filmmakers applying to opportunities a producer posted.
            </p>

            {o.applications.length === 0 ? (
              <p className="rounded-card border border-line px-5 py-6 text-[15px] text-ash">
                No applications to producer-posted opportunities yet.
              </p>
            ) : (
              <div className="border-t border-line">
                {o.applications.map(a => (
                  <div key={a.application_id} className="hairline py-4">
                    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                      <Link href={`/dashboard/projects/${a.project_id}`}
                            className="font-display text-[19px] font-normal hover:text-gold">
                        {a.project}
                      </Link>
                      {!a.is_public && <Tag tone="gold">Private</Tag>}
                      <Tag tone={a.status === "accepted" ? "green" : a.status === "rejected" ? "red" : "ash"}>
                        {String(a.status).replace(/_/g, " ")}
                      </Tag>
                      {a.match_score != null && <span className="text-[12px] text-ash/60">match {a.match_score}</span>}
                      <span className="text-[12px] text-ash/60">{when(a.created_at)}</span>
                    </div>
                    <p className="mt-1 text-[14px] text-ash">
                      <span className="text-ink">{a.filmmaker}</span>
                      {" → "}
                      {a.producer_username ? (
                        <Link href={`/u/${a.producer_username}`} className="text-gold hover:underline">
                          {a.producer}
                        </Link>
                      ) : (
                        <span className="text-gold">{a.producer}</span>
                      )}
                      <span className="text-ash/60">{" · "}{a.opportunity}</span>
                    </p>
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}

function Big({ n, label, gold }: { n: number; label: string; gold?: boolean }) {
  return (
    <div>
      <p className={`font-display text-[40px] leading-none font-normal ${gold ? "text-gold" : ""}`}>{n}</p>
      <p className="mt-2 text-[10px] uppercase tracking-[0.2em] text-ash/60">{label}</p>
    </div>
  );
}
