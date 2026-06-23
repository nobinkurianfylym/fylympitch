import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function ProducerProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Fetch identity from profiles
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, full_name, company, bio, website, imdb_url, avatar_url, role, country, industry_genres, industry_formats, industry_countries")
    .eq("id", id)
    .single();

  if (!profile) notFound();

  // Fetch producer detail — RLS returns null if private and not owner
  const { data: pp } = await supabase
    .from("producer_profiles")
    .select("genres, formats, territories, budget_range, festivals, credits, open_to_coproduction, open_to_ep, bringing_territory_funding, is_public, imdb_url, country")
    .eq("user_id", id)
    .single();

  const isOwner   = user.id === id;
  const isPrivate = !pp?.is_public && !isOwner;

  const BUDGET_LABEL: Record<string, string> = {
    micro: "Under $100K",
    low:   "$100K – $500K",
    mid:   "$500K – $2M",
    high:  "$2M+",
  };

  const genres     = pp?.genres     ?? (profile.industry_genres    as string[] | null) ?? [];
  const formats    = pp?.formats    ?? (profile.industry_formats   as string[] | null) ?? [];
  const territories = pp?.territories ?? (profile.industry_countries as string[] | null) ?? [];
  const festivals  = pp?.festivals  ?? [];
  const credits    = pp?.credits    ?? null;
  const country    = pp?.country    || profile.country || null;
  const imdb_url   = pp?.imdb_url   || profile.imdb_url || null;
  const budget     = pp?.budget_range ? BUDGET_LABEL[pp.budget_range] : null;

  const initials = profile.full_name
    .split(" ").map((w: string) => w[0]).slice(0, 2).join("").toUpperCase();

  const roleLabel =
    profile.role === "investor"     ? "Investor" :
    profile.role === "organization" ? "Organisation" :
                                      "Producer";

  return (
    <main className="min-h-screen bg-parchment">
      {/* Nav back */}
      <div className="border-b border-line bg-parchment sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-6 h-14 flex items-center">
          <Link
            href="/dashboard/opportunities"
            className="text-[11px] tracking-[0.14em] uppercase text-ash hover:text-ink transition-colors"
          >
            ← Back
          </Link>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-14">

        {/* Header */}
        <div className="flex items-start gap-6 mb-12">
          {/* Avatar */}
          <div className="shrink-0 w-16 h-16 rounded-full bg-ink flex items-center justify-center overflow-hidden">
            {profile.avatar_url ? (
              <img src={profile.avatar_url} alt={profile.full_name} className="w-full h-full object-cover" />
            ) : (
              <span className="text-parchment font-medium text-lg tracking-wide">{initials}</span>
            )}
          </div>

          {/* Identity */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="font-display text-[28px] text-ink leading-tight">{profile.full_name}</h1>
              <span className="text-[10px] tracking-[0.16em] uppercase border border-line text-ash px-2 py-0.5 rounded">
                {roleLabel}
              </span>
              {pp?.open_to_coproduction && (
                <span className="text-[10px] tracking-[0.16em] uppercase bg-gold/10 border border-gold/30 text-gold px-2 py-0.5 rounded">
                  Open to Co-production
                </span>
              )}
            </div>
            {profile.company && (
              <p className="mt-1 text-[15px] text-ash">{profile.company}</p>
            )}
            {country && (
              <p className="mt-0.5 text-[12px] tracking-[0.1em] uppercase text-ash/60">{country}</p>
            )}
          </div>
        </div>

        {isPrivate ? (
          /* Private profile state */
          <div className="border border-line rounded p-10 text-center">
            <p className="text-[13px] text-ash tracking-wide">This producer has a private profile.</p>
            <p className="mt-2 text-[12px] text-ash/60">
              You can still connect via messaging from your project page.
            </p>
          </div>
        ) : (
          <div className="space-y-10">

            {/* Bio */}
            {profile.bio && (
              <section>
                <p className="text-[15px] text-ink/80 leading-relaxed">{profile.bio}</p>
              </section>
            )}

            {/* Focus */}
            {(genres.length > 0 || formats.length > 0 || territories.length > 0) && (
              <section>
                <div className="hairline mb-5" />
                <h2 className="text-[10px] tracking-[0.18em] uppercase text-ash mb-4">Focus</h2>
                <div className="space-y-3">
                  {genres.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {genres.map((g: string) => (
                        <span key={g} className="text-[11px] tracking-[0.08em] px-3 py-1 border border-line rounded-full text-ink/70">{g}</span>
                      ))}
                    </div>
                  )}
                  {formats.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {formats.map((f: string) => (
                        <span key={f} className="text-[11px] tracking-[0.08em] px-3 py-1 bg-ink/5 rounded text-ink/60">{f}</span>
                      ))}
                    </div>
                  )}
                  {territories.length > 0 && (
                    <p className="text-[12px] text-ash leading-relaxed">
                      {territories.slice(0, 8).join(" · ")}
                      {territories.length > 8 && <span className="text-ash/50"> +{territories.length - 8} more</span>}
                    </p>
                  )}
                </div>
              </section>
            )}

            {/* Budget & Festivals */}
            {(budget || festivals.length > 0) && (
              <section>
                <div className="hairline mb-5" />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  {budget && (
                    <div>
                      <p className="text-[10px] tracking-[0.18em] uppercase text-ash mb-1">Budget Range</p>
                      <p className="text-[14px] text-ink">{budget}</p>
                    </div>
                  )}
                  {festivals.length > 0 && (
                    <div>
                      <p className="text-[10px] tracking-[0.18em] uppercase text-ash mb-1">Festival Track Record</p>
                      <p className="text-[13px] text-ink/70 leading-relaxed">{festivals.slice(0, 5).join(", ")}</p>
                    </div>
                  )}
                </div>
              </section>
            )}

            {/* Signals */}
            {(pp?.open_to_ep || pp?.bringing_territory_funding) && (
              <section>
                <div className="hairline mb-5" />
                <div className="flex flex-wrap gap-3">
                  {pp?.open_to_ep && (
                    <span className="text-[11px] tracking-[0.1em] uppercase text-ink/60 border border-line px-3 py-1.5 rounded">
                      Open to EP role
                    </span>
                  )}
                  {pp?.bringing_territory_funding && (
                    <span className="text-[11px] tracking-[0.1em] uppercase text-ink/60 border border-line px-3 py-1.5 rounded">
                      Bringing territory funding
                    </span>
                  )}
                </div>
              </section>
            )}

            {/* Credits */}
            {credits && (
              <section>
                <div className="hairline mb-5" />
                <h2 className="text-[10px] tracking-[0.18em] uppercase text-ash mb-3">Credits</h2>
                <p className="text-[14px] text-ink/70 leading-relaxed whitespace-pre-line">{credits}</p>
              </section>
            )}

            {/* Links */}
            {(imdb_url || profile.website) && (
              <section>
                <div className="hairline mb-5" />
                <div className="flex flex-wrap gap-4">
                  {imdb_url && (
                    <a
                      href={imdb_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[11px] tracking-[0.14em] uppercase text-gold hover:text-gold/70 transition-colors"
                    >
                      IMDb ↗
                    </a>
                  )}
                  {profile.website && (
                    <a
                      href={profile.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[11px] tracking-[0.14em] uppercase text-ash hover:text-ink transition-colors"
                    >
                      Website ↗
                    </a>
                  )}
                </div>
              </section>
            )}

            {/* CTA */}
            {!isOwner && (
              <section className="pt-4">
                <div className="hairline mb-8" />
                <Link
                  href="/dashboard/messages"
                  className="inline-block bg-ink text-parchment text-[11px] tracking-[0.16em] uppercase px-8 py-3.5 rounded hover:bg-ink/80 transition-colors"
                >
                  Send Message
                </Link>
              </section>
            )}

          </div>
        )}
      </div>
    </main>
  );
}
