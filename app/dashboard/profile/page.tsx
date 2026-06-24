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

const CAREER_LABEL: Record<string, string> = {
  debut: "Debut Filmmaker", second_film: "2nd Film",
  established: "Established Filmmaker", veteran: "Veteran Filmmaker",
};

const FORMAT_LABEL: Record<string, string> = {
  documentary: "Documentary", narrative: "Narrative",
  feature: "Feature", short: "Short Film",
  series: "Series", animation: "Animation", both: "Documentary & Narrative",
};

export default async function ProfilePage() {
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

  const supabaseUrl   = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const filmmakerFmts: string[] = (profile as any).filmmaker_formats ?? [];

  return (
    <div>
      {/* ── Page header ─────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4 mb-8">
        <div>
          <p className="eyebrow mb-2">Filmmaker · {profile.username}</p>
          <h1 className="font-display text-[34px] font-[400]">Your Profile</h1>
          <p className="text-[13px] text-ash mt-1">
            How producers and funds see you. Keep it complete and current.
          </p>
        </div>
        {profile.username && (
          <Link
            href={`/u/${profile.username}`}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 btn-ghost !py-2 !px-4 text-[12px] flex items-center gap-1.5"
          >
            View public profile ↗
          </Link>
        )}
      </div>

      {/* ── Two-column layout ───────────────────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-[1fr_420px] gap-10 items-start">

        {/* ══ LEFT — Profile Preview ══════════════════════════ */}
        <div className="space-y-0">
          <p className="eyebrow mb-5">Profile preview</p>

          {/* Profile card */}
          <div className="rounded-card border border-line bg-white/60 overflow-hidden">

            {/* Hero */}
            <div className="px-7 pt-7 pb-6 border-b border-line">
              <div className="flex items-start gap-5">
                {/* Avatar */}
                <div className="shrink-0">
                  {profile.avatar_url ? (
                    <img
                      src={profile.avatar_url}
                      alt={profile.full_name}
                      className="w-[72px] h-[72px] rounded-full object-cover border border-line"
                    />
                  ) : (
                    <div className="w-[72px] h-[72px] rounded-full bg-parchment border border-line flex items-center justify-center">
                      <span className="font-display text-[22px] text-ash/70 select-none">
                        {profile.full_name.split(" ").map((w: string) => w[0]).slice(0, 2).join("").toUpperCase()}
                      </span>
                    </div>
                  )}
                </div>

                {/* Identity */}
                <div className="flex-1 min-w-0">
                  <p className="eyebrow mb-1.5">
                    {CAREER_LABEL[(profile as any).career_stage] ?? "Filmmaker"}
                  </p>
                  <h2 className="font-display text-[28px] font-[400] leading-tight mb-1">
                    {profile.full_name}
                  </h2>
                  <p className="text-[12px] text-ash">
                    @{profile.username}
                    {profile.company && <><span className="mx-1.5 opacity-30">·</span>{profile.company}</>}
                    {profile.country && <><span className="mx-1.5 opacity-30">·</span>{profile.country}</>}
                  </p>
                </div>
              </div>

              {/* Bio */}
              {profile.bio ? (
                <p className="mt-4 text-[14px] leading-relaxed text-ink/75">
                  {profile.bio}
                </p>
              ) : (
                <p className="mt-4 text-[13px] text-ash/50 italic">
                  No bio yet — add one in the edit panel.
                </p>
              )}

              {/* Format tags */}
              {filmmakerFmts.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-4">
                  {filmmakerFmts.map((fmt: string) => (
                    <span
                      key={fmt}
                      className="text-[11px] tracking-[0.14em] uppercase px-3 py-1 rounded-full border border-line bg-parchment text-ash"
                    >
                      {FORMAT_LABEL[fmt] ?? fmt}
                    </span>
                  ))}
                </div>
              )}

              {/* External links */}
              {(profile.website || profile.imdb_url) && (
                <div className="flex items-center gap-5 mt-4">
                  {profile.website && (
                    <a
                      href={profile.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[11px] tracking-[0.12em] uppercase text-ash hover:text-gold transition-colors"
                    >
                      Website ↗
                    </a>
                  )}
                  {profile.imdb_url && (
                    <a
                      href={profile.imdb_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[11px] tracking-[0.12em] uppercase text-ash hover:text-gold transition-colors"
                    >
                      IMDb ↗
                    </a>
                  )}
                </div>
              )}
            </div>

            {/* Credits */}
            <div className="px-7 py-6">
              <p className="eyebrow mb-4">
                Filmography
                <span className="ml-2 text-ash/50 normal-case tracking-normal font-normal">
                  {(credits ?? []).length} credit{(credits ?? []).length !== 1 ? "s" : ""}
                </span>
              </p>

              {(credits ?? []).length === 0 ? (
                <p className="text-[13px] text-ash/50 italic">
                  No credits yet — add them in the edit panel.
                </p>
              ) : (
                <div className="space-y-3">
                  {(credits ?? []).map((c: any) => (
                    <div
                      key={c.id}
                      className="flex flex-col gap-1.5 py-3 border-b border-line last:border-0"
                    >
                      <div className="flex items-center gap-3 flex-wrap">
                        <span className="font-display text-[16px] font-[400]">{c.title}</span>
                        {c.year && <span className="text-[12px] text-ash">{c.year}</span>}
                        {c.format && (
                          <span className="text-[10px] tracking-[0.1em] uppercase bg-parchment text-ash px-2 py-0.5 rounded-full border border-line">
                            {c.format}
                          </span>
                        )}
                        {c.is_featured && (
                          <span className="text-[9px] tracking-[0.14em] uppercase text-gold border border-gold/30 bg-gold/5 px-2 py-0.5 rounded-full">
                            Featured
                          </span>
                        )}
                      </div>
                      {(c.festivals ?? []).length > 0 && (
                        <p className="text-[11px] text-ash">
                          {(c.festivals as string[]).slice(0, 4).join(" · ")}
                          {c.festivals.length > 4 && <span className="text-ash/50"> +{c.festivals.length - 4}</span>}
                        </p>
                      )}
                      {(c.awards ?? []).length > 0 && (
                        <p className="text-[11px] text-gold">
                          🏆 {(c.awards as string[]).slice(0, 2).join(" · ")}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Completeness hint */}
          <div className="mt-4 px-5 py-3 rounded-card border border-line bg-parchment/50 flex items-center gap-3">
            <span className="text-[14px]">
              {[profile.bio, profile.avatar_url, profile.website, profile.country].filter(Boolean).length >= 3
                ? "✓" : "○"}
            </span>
            <p className="text-[12px] text-ash">
              {[profile.bio, profile.avatar_url, profile.website, profile.country].filter(Boolean).length >= 3
                ? "Profile looks good — producers can assess you properly."
                : "Add a bio, avatar, country and website to build credibility with producers."}
            </p>
          </div>
        </div>

        {/* ══ RIGHT — Edit Panel ═══════════════════════════════ */}
        <div className="space-y-10">
          <p className="eyebrow">Edit profile</p>

          {/* ── Identity form ─────────────────────────────────── */}
          <div>
            <h2 className="font-display text-[20px] font-[400] mb-5">Identity</h2>
            <ProfileForm profile={profile} />
          </div>

          {/* ── Username ──────────────────────────────────────── */}
          <div className="pt-8 border-t border-line">
            <h2 className="font-display text-[20px] font-[400] mb-5">Username</h2>
            <UsernameForm profile={profile} />
          </div>

          {/* ── Career stage ──────────────────────────────────── */}
          <div className="pt-8 border-t border-line">
            <h2 className="font-display text-[20px] font-[400] mb-1">Career Stage</h2>
            <p className="text-[12px] text-ash mb-5">
              Used by the matching engine to find the right opportunities.
            </p>
            <form action={updateCareerStage}>
              <div className="grid grid-cols-2 gap-3 mb-4">
                {CAREER_STAGES.map((s) => (
                  <label
                    key={s.key}
                    className={`cursor-pointer px-4 py-3 rounded-card border text-left transition-all ${
                      (profile as any).career_stage === s.key
                        ? "border-gold bg-gold/8"
                        : "border-line bg-white hover:border-ink/30"
                    }`}
                  >
                    <input
                      type="radio"
                      name="career_stage"
                      value={s.key}
                      defaultChecked={(profile as any).career_stage === s.key}
                      className="hidden"
                    />
                    <p className={`text-[13px] font-medium ${(profile as any).career_stage === s.key ? "text-ink" : "text-ash"}`}>
                      {s.label}
                    </p>
                    <p className="text-[11px] text-ash mt-0.5">{s.sub}</p>
                  </label>
                ))}
              </div>
              <button type="submit" className="btn-ghost !py-2 text-[12px]">
                Save stage
              </button>
            </form>
          </div>

          {/* ── Credits ───────────────────────────────────────── */}
          <div className="pt-8 border-t border-line">
            <h2 className="font-display text-[20px] font-[400] mb-1">Credits</h2>
            <p className="text-[12px] text-ash mb-6">
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

          {/* ── Danger zone ── */}
          <div className="pt-8 border-t border-line">
            <h2 className="font-display text-[20px] font-[400] mb-1">Danger zone</h2>
            <p className="text-[12px] text-ash mb-4">
              Permanently delete your account and all associated data.
            </p>
            <DeleteAccountModal />
          </div>
        </div>
      </div>
    </div>
  );
}
