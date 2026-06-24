import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import ProfileForm from "@/components/ProfileForm";
import UsernameForm from "@/components/UsernameForm";
import ExpandableCredit from "@/components/ExpandableCredit";
import AddCreditForm from "@/components/AddCreditForm";
import DeleteAccountModal from "@/components/DeleteAccountModal";
import { updateCareerStage } from "@/lib/actions";
import type { Profile } from "@/types";

export const dynamic = "force-dynamic";

const CAREER_STAGES = [
  { key: "debut",       label: "Debut",       sub: "First feature or series" },
  { key: "second_film", label: "Second Film",  sub: "One credit" },
  { key: "established", label: "Established",  sub: "Multiple credits, festivals" },
  { key: "veteran",     label: "Veteran",      sub: "10+ years" },
];

const SECTIONS = [
  { key: "identity", label: "Identity" },
  { key: "career",   label: "Career" },
  { key: "credits",  label: "Credits" },
  { key: "settings", label: "Settings" },
];

export default async function ProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab = "identity" } = await searchParams;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: profile }, { data: credits }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).single<Profile>(),
    supabase.from("filmmaker_credits").select("*").eq("user_id", user.id)
      .order("is_featured", { ascending: false })
      .order("year",        { ascending: false }),
  ]);

  if (!profile) return null;

  const activeTab = SECTIONS.some(s => s.key === tab) ? tab : "identity";

  return (
    <div className="flex flex-col h-full" style={{ minHeight: "calc(100vh - 1px)" }}>

      {/* ── Header ── */}
      <div className="shrink-0 px-8 py-5 border-b border-line flex items-center justify-between gap-4 bg-ivory">
        <div>
          <p className="eyebrow">Filmmaker Profile</p>
          <h1 className="font-display text-[22px] mt-0.5">{profile.full_name || "Your Profile"}</h1>
        </div>
        {/* Avatar — links to public profile */}
        <Link
          href={profile.username ? `/u/${profile.username}` : "#"}
          target={profile.username ? "_blank" : undefined}
          rel="noopener noreferrer"
          title="View public profile"
          className="shrink-0 hover:opacity-80 transition-opacity"
        >
          <div className="w-10 h-10 rounded-full overflow-hidden border border-line bg-parchment flex items-center justify-center">
            {profile.avatar_url
              ? <img src={profile.avatar_url} alt={profile.full_name} className="w-full h-full object-cover" />
              : <span className="font-display text-[13px] text-ash">
                  {profile.full_name
                    ? profile.full_name.split(" ").map((w: string) => w[0]).join("").slice(0,2).toUpperCase()
                    : "—"}
                </span>
            }
          </div>
        </Link>
      </div>

      {/* ── Tabs + content ── */}
      <div className="flex-1 overflow-hidden">
        <div className="h-full overflow-y-auto bg-ivory max-w-2xl mx-auto">

          {/* Tab nav */}
          <div className="sticky top-0 z-10 bg-ivory border-b border-line flex overflow-x-auto">
            {SECTIONS.map(s => (
              <Link
                key={s.key}
                href={`/dashboard/profile?tab=${s.key}`}
                className={`shrink-0 px-4 py-3.5 text-[10px] tracking-[0.18em] uppercase font-semibold transition-colors whitespace-nowrap ${
                  activeTab === s.key
                    ? "text-ink border-b-2 border-ink"
                    : "text-ash hover:text-ink"
                }`}
              >
                {s.label}
              </Link>
            ))}
          </div>

          {/* ── IDENTITY ── */}
          {activeTab === "identity" && (
            <div className="p-6 space-y-6">
              <ProfileForm profile={profile} />
              <div className="pt-4 border-t border-line">
                <p className="field-label mb-1">Profile URL</p>
                <p className="text-[12px] text-ash mb-2.5">
                  pitch.fylym.com/u/<span className="text-ink font-medium">{profile.username || "yourhandle"}</span>
                </p>
                <UsernameForm profile={profile} />
              </div>
            </div>
          )}

          {/* ── CAREER ── */}
          {activeTab === "career" && (
            <div className="p-6 space-y-6">
              <div>
                <p className="field-label mb-1">Career Stage</p>
                <p className="text-[12px] text-ash mb-4">Used by the matching engine to find the right opportunities.</p>
                <form action={updateCareerStage}>
                  <div className="grid grid-cols-2 gap-3 mb-4">
                    {CAREER_STAGES.map(s => (
                      <label key={s.key}
                        className={`cursor-pointer px-4 py-3 rounded-card border text-left transition-all ${
                          (profile as any).career_stage === s.key
                            ? "border-gold bg-gold/8"
                            : "border-line bg-white hover:border-ink/30"
                        }`}>
                        <input type="radio" name="career_stage" value={s.key}
                          defaultChecked={(profile as any).career_stage === s.key} className="hidden" />
                        <p className={`text-[13px] font-medium ${(profile as any).career_stage === s.key ? "text-ink" : "text-ash"}`}>
                          {s.label}
                        </p>
                        <p className="text-[11px] text-ash mt-0.5">{s.sub}</p>
                      </label>
                    ))}
                  </div>
                  <button type="submit" className="btn-ghost !py-2 text-[12px]">Save stage</button>
                </form>
              </div>
            </div>
          )}

          {/* ── CREDITS ── */}
          {activeTab === "credits" && (
            <div className="p-6 space-y-6">
              <div>
                <p className="field-label mb-1">Credits</p>
                <p className="text-[12px] text-ash mb-5">
                  Festival selections and awards build credibility on every project card.
                </p>
                {(credits ?? []).length > 0 && (
                  <div className="space-y-3 mb-6">
                    {(credits ?? []).map((c: any) => (
                      <ExpandableCredit key={c.id} credit={c} />
                    ))}
                  </div>
                )}
                <AddCreditForm />
              </div>
            </div>
          )}

          {/* ── SETTINGS ── */}
          {activeTab === "settings" && (
            <>
              <div className="p-6">
                <p className="field-label mb-1">Public visibility</p>
                <p className="text-[12px] text-ash mb-3">
                  Your filmmaker profile is always public — producers and funds can discover you.
                </p>
                {profile.username && (
                  <Link href={`/u/${profile.username}`} target="_blank" rel="noopener noreferrer"
                    className="btn-ghost !py-2 !px-4 text-[12px] inline-flex items-center gap-1.5">
                    View public profile ↗
                  </Link>
                )}
              </div>

              <div className="px-6 pt-4 pb-8 border-t border-line">
                <p className="text-[9px] tracking-[0.26em] uppercase font-semibold text-ash/40 mb-3">Danger zone</p>
                <p className="text-[12px] text-ash mb-3 leading-relaxed">
                  Permanently delete your account and all associated data.
                </p>
                <DeleteAccountModal />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
