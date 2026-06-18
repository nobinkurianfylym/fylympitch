import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { saveFilmmakerCredit, deleteFilmmakerCredit, updateCareerStage } from "@/lib/actions";

export const dynamic = "force-dynamic";

const CAREER_STAGES = [
  { key: "debut",       label: "Debut",        sub: "First feature or series" },
  { key: "second_film", label: "Second Film",   sub: "Established with one credit" },
  { key: "established", label: "Established",   sub: "Multiple credits, festival track" },
  { key: "veteran",     label: "Veteran",       sub: "10+ years, significant credits" },
];

const FESTIVALS = [
  "Cannes","Berlin","Venice","Sundance","TIFF","Rotterdam","Tribeca",
  "IFFR","Hot Docs","Locarno","San Sebastián","Busan","IDFA",
  "BFI London","Palm Springs","Frameline","AFI Fest",
];

const FORMATS = ["Feature","Short","Series","Documentary","Animation"];

export default async function CreditsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: profile }, { data: credits }] = await Promise.all([
    supabase.from("profiles").select("full_name, career_stage").eq("id", user.id).single(),
    supabase.from("filmmaker_credits").select("*").eq("user_id", user.id).order("year", { ascending: false }),
  ]);

  return (
    <div className="max-w-2xl">
      <p className="eyebrow mb-2">Filmmaker Profile</p>
      <h1 className="font-display text-[34px] mb-1">Credits & Track Record</h1>
      <p className="text-[14px] text-ash mb-10 max-w-lg">
        Producers reviewing your project see your career stage and festival history. Complete this to build credibility.
      </p>

      {/* Career stage */}
      <section className="mb-12">
        <p className="text-[11px] tracking-[0.22em] uppercase text-ash mb-4">Career stage</p>
        <form action={updateCareerStage}>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
            {CAREER_STAGES.map((s) => (
              <label key={s.key}
                className={`cursor-pointer px-4 py-3 rounded-card border text-left transition-all ${
                  profile?.career_stage === s.key
                    ? "border-gold bg-gold/10"
                    : "border-line bg-white hover:border-ink/30"
                }`}>
                <input type="radio" name="career_stage" value={s.key}
                  defaultChecked={profile?.career_stage === s.key}
                  className="hidden" />
                <p className={`text-[13px] font-medium ${profile?.career_stage === s.key ? "text-ink" : "text-ash"}`}>
                  {s.label}
                </p>
                <p className="text-[11px] text-ash mt-0.5">{s.sub}</p>
              </label>
            ))}
          </div>
          <button type="submit" className="btn-ghost !py-2 text-[12px]">Save stage</button>
        </form>
      </section>

      {/* Existing credits */}
      {(credits ?? []).length > 0 && (
        <section className="mb-10">
          <p className="text-[11px] tracking-[0.22em] uppercase text-ash mb-4">Your credits</p>
          <div className="space-y-3">
            {(credits ?? []).map((c: any) => (
              <div key={c.id} className="card p-5 flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-display text-[16px]">{c.title}</p>
                    {c.year && <span className="text-[12px] text-ash">{c.year}</span>}
                    {c.format && <span className="text-[11px] tracking-[0.1em] uppercase bg-parchment text-ash px-2 py-0.5 rounded-full border border-line">{c.format}</span>}
                    {c.is_featured && <span className="text-[10px] tracking-[0.1em] uppercase bg-gold/10 text-gold px-2 py-0.5 rounded-full border border-gold/30">Featured</span>}
                  </div>
                  {c.festivals?.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {c.festivals.map((f: string) => (
                        <span key={f} className="text-[10px] tracking-[0.1em] uppercase bg-parchment text-ash px-2 py-0.5 rounded-full border border-line">{f}</span>
                      ))}
                    </div>
                  )}
                  {c.awards?.length > 0 && (
                    <p className="text-[12px] text-gold mt-1">🏆 {c.awards.join(", ")}</p>
                  )}
                </div>
                <form action={deleteFilmmakerCredit}>
                  <input type="hidden" name="credit_id" value={c.id} />
                  <button type="submit" className="text-[11px] text-ash hover:text-red-500 transition-colors shrink-0">Remove</button>
                </form>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Add new credit */}
      <section>
        <p className="text-[11px] tracking-[0.22em] uppercase text-ash mb-4">Add a credit</p>
        <form action={saveFilmmakerCredit} className="card p-6 space-y-5">
          <div className="grid sm:grid-cols-3 gap-4">
            <div className="sm:col-span-2">
              <label className="field-label mb-1 block">Film / Project title *</label>
              <input name="title" required placeholder="The Goat Road" className="field w-full" />
            </div>
            <div>
              <label className="field-label mb-1 block">Year</label>
              <input name="year" type="number" min="1900" max="2030" placeholder="2023" className="field w-full" />
            </div>
          </div>

          <div>
            <label className="field-label mb-1 block">Format</label>
            <div className="flex flex-wrap gap-2">
              {FORMATS.map((f) => (
                <label key={f} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-line text-[12px] text-ash cursor-pointer hover:border-ink/30">
                  <input type="radio" name="format" value={f} className="w-3 h-3 accent-[#BF9953]" />
                  {f}
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="field-label mb-2 block">Festival selections</label>
            <div className="flex flex-wrap gap-2">
              {FESTIVALS.map((f) => (
                <label key={f} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-line text-[12px] text-ash cursor-pointer hover:border-ink/30 hover:text-ink">
                  <input type="checkbox" name="festivals" value={f} className="w-3 h-3 accent-[#BF9953]" />
                  {f}
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="field-label mb-1 block">Awards <span className="font-normal text-ash">(one per line)</span></label>
            <textarea name="awards_text" rows={2} placeholder="Best Director — Kerala Film Academy 2023" className="field w-full" />
            <p className="text-[11px] text-ash mt-1">These will be parsed as individual awards.</p>
          </div>

          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-[13px] text-ash cursor-pointer">
              <input type="checkbox" name="is_featured" value="true" className="w-4 h-4 accent-[#BF9953]" />
              Feature this credit prominently
            </label>
          </div>

          <button type="submit" className="btn-gold">Add credit</button>
        </form>
      </section>
    </div>
  );
}
