import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import ProfileForm from "@/components/ProfileForm";
import UsernameForm from "@/components/UsernameForm";
import ExpandableCredit from "@/components/ExpandableCredit";
import AddCreditForm from "@/components/AddCreditForm";
import { updateCareerStage } from "@/lib/actions";
import type { Profile } from "@/types";

export const dynamic = "force-dynamic";

const CAREER_STAGES = [
  { key: "debut",       label: "Debut",       sub: "First feature or series" },
  { key: "second_film", label: "Second Film",  sub: "Established with one credit" },
  { key: "established", label: "Established",  sub: "Multiple credits, festival track" },
  { key: "veteran",     label: "Veteran",      sub: "10+ years, significant credits" },
];

export default async function ProfilePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: profile }, { data: credits }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).single<Profile>(),
    supabase.from("filmmaker_credits").select("*").eq("user_id", user.id).order("year", { ascending: false }),
  ]);

  if (!profile) return null;

  return (
    <div>
      {/* ── Header ── */}
      <p className="eyebrow mb-3">
        {profile.role}{profile.approval_status === "pending" ? " · verification pending" : ""}
      </p>
      <h1 className="font-display text-[34px] mb-1">Profile</h1>
      <p className="mt-2 text-[14px] text-ash max-w-lg mb-10">
        A complete profile builds trust with funds and producers reviewing your applications.
      </p>

      {/* ── 2-col grid ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-16 gap-y-12 items-start max-w-5xl">

        {/* LEFT — Identity */}
        <ProfileForm profile={profile} />

        {/* RIGHT — Username + Credits */}
        <div className="space-y-10">

          {/* Username */}
          <UsernameForm profile={profile} />

          {/* Credits & Track Record */}
          <div className="pt-8 border-t border-line">
            <h2 className="font-display text-[24px] mb-1">Credits &amp; Track Record</h2>
            <p className="text-[13px] text-ash mb-8">
              Producers see your career stage and festival history. Complete this to build credibility.
            </p>

            {/* Career stage */}
            <section className="mb-10">
              <p className="text-[11px] tracking-[0.22em] uppercase text-ash mb-4">Career stage</p>
              <form action={updateCareerStage}>
                <div className="grid grid-cols-2 gap-3 mb-4">
                  {CAREER_STAGES.map((s) => (
                    <label
                      key={s.key}
                      className={`cursor-pointer px-4 py-3 rounded-card border text-left transition-all ${
                        profile.career_stage === s.key
                          ? "border-gold bg-gold/10"
                          : "border-line bg-white hover:border-ink/30"
                      }`}
                    >
                      <input
                        type="radio"
                        name="career_stage"
                        value={s.key}
                        defaultChecked={profile.career_stage === s.key}
                        className="hidden"
                      />
                      <p className={`text-[13px] font-medium ${profile.career_stage === s.key ? "text-ink" : "text-ash"}`}>
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
              <section className="mb-8">
                <p className="text-[11px] tracking-[0.22em] uppercase text-ash mb-4">Your credits</p>
                <div className="space-y-3">
                  {(credits ?? []).map((c: any) => (
                    <ExpandableCredit key={c.id} credit={c} />
                  ))}
                </div>
              </section>
            )}

            {/* Add a credit */}
            <AddCreditForm />
          </div>
        </div>
      </div>
    </div>
  );
}
