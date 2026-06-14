import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { usd, STAGE_LABEL } from "@/lib/format";
import OfferForm from "@/components/OfferForm";

export const dynamic = "force-dynamic";

export default async function DiscoverPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; genre?: string }>;
}) {
  const { q, genre } = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: me } = await supabase
    .from("profiles")
    .select("role, approval_status")
    .eq("id", user.id)
    .single();

  const isIndustry = me && ["producer", "investor", "organization"].includes(me.role);
  const approved = me?.approval_status === "approved" || me?.role === "admin";

  if (!isIndustry && me?.role !== "admin") {
    return (
      <div className="max-w-2xl">
        <h1 className="font-display text-[30px] font-normal">Discover</h1>
        <p className="mt-4 text-ash font-normal">
          Project discovery is available to producer, investor, and organization accounts.
        </p>
      </div>
    );
  }

  if (!approved) {
    return (
      <div className="max-w-2xl">
        <h1 className="font-display text-[30px] font-normal">Discover projects</h1>
        <div className="card mt-6 p-6">
          <p className="font-normal text-ink">
            Your account is pending verification by the FYLYMPITCH team.
          </p>
          <p className="mt-2 text-[14px] text-ash font-normal">
            Once approved, you will be able to browse projects, read scripts and pitch decks,
            and send offers directly to filmmakers. We verify every industry account to keep
            the platform safe for creators.
          </p>
        </div>
      </div>
    );
  }

  let query = supabase
    .from("projects")
    .select("id, title, genre, format, language, country, budget_usd, funding_needed_usd, stage, logline, synopsis, pitch_deck_path, script_path, created_at, profiles!projects_owner_id_fkey(full_name, country)")
    .eq("is_public", true)
    .order("created_at", { ascending: false })
    .limit(40);

  if (q) query = query.or(`title.ilike.%${q}%,logline.ilike.%${q}%`);
  if (genre) query = query.eq("genre", genre);

  const { data: projects } = await query;

  // Signed URLs for scripts and decks (1 hour)
  const withLinks = await Promise.all(
    (projects ?? []).map(async (p) => {
      const [deck, script] = await Promise.all([
        p.pitch_deck_path
          ? supabase.storage.from("pitch-decks").createSignedUrl(p.pitch_deck_path, 3600)
          : Promise.resolve({ data: null }),
        p.script_path
          ? supabase.storage.from("scripts").createSignedUrl(p.script_path, 3600)
          : Promise.resolve({ data: null }),
      ]);
      return { ...p, deckUrl: deck.data?.signedUrl ?? null, scriptUrl: script.data?.signedUrl ?? null };
    })
  );

  const genres = ["Drama", "Thriller", "Comedy", "Documentary", "Horror", "Romance", "Action", "Animation", "Family", "Sci-Fi", "Other"];

  return (
    <div className="max-w-5xl">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">For producers &amp; investors</p>
          <h1 className="font-display text-[30px] font-normal mt-1">Discover projects</h1>
        </div>
        <form className="flex gap-2" method="GET">
          <input
            name="q"
            defaultValue={q ?? ""}
            placeholder="Search title or logline"
            className="field w-56"
          />
          <select name="genre" defaultValue={genre ?? ""} className="field w-40">
            <option value="">All genres</option>
            {genres.map((g) => (
              <option key={g} value={g}>{g}</option>
            ))}
          </select>
          <button className="btn-ghost">Filter</button>
        </form>
      </div>

      <div className="mt-8 space-y-6">
        {withLinks.length === 0 && (
          <div className="card p-8 text-center">
            <p className="text-ash font-normal">No public projects match your filters yet.</p>
          </div>
        )}

        {withLinks.map((p) => {
          const owner = Array.isArray(p.profiles) ? p.profiles[0] : p.profiles;
          return (
            <article key={p.id} className="card p-6 sm:p-8">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h2 className="font-display text-[24px] font-normal">{p.title}</h2>
                  <p className="mt-1 text-[14px] text-ash font-normal">
                    {p.genre} · {p.format} · {p.language} · {p.country}
                    {owner?.full_name ? <> · by {owner.full_name}</> : null}
                  </p>
                </div>
                <div className="text-right">
                  <p className="eyebrow">Seeking</p>
                  <p className="text-[18px] font-normal text-ink">{usd(p.funding_needed_usd)}</p>
                  <p className="text-[12px] text-ash font-normal">
                    of {usd(p.budget_usd)} budget · {STAGE_LABEL[p.stage] ?? p.stage}
                  </p>
                </div>
              </div>

              {p.logline && (
                <p className="mt-4 font-display italic text-[18px] font-normal text-ink border-l-2 border-gold pl-4">
                  {p.logline}
                </p>
              )}
              {p.synopsis && (
                <p className="mt-3 text-[14px] text-ash font-normal leading-relaxed line-clamp-4">
                  {p.synopsis}
                </p>
              )}

              <div className="mt-5 flex flex-wrap items-center gap-3">
                {p.deckUrl && (
                  <a href={p.deckUrl} target="_blank" rel="noreferrer" className="btn-ghost">
                    View pitch deck
                  </a>
                )}
                {p.scriptUrl && (
                  <a href={p.scriptUrl} target="_blank" rel="noreferrer" className="btn-ghost">
                    Read script
                  </a>
                )}
              </div>

              <div className="hairline my-5" />
              <OfferForm projectId={p.id} />
            </article>
          );
        })}
      </div>
    </div>
  );
}
