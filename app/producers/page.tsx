import { createClient } from "@/lib/supabase/server";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function ProducersDirectoryPage() {
  const supabase = await createClient();

  const { data: producers } = await supabase
    .from("producer_profiles")
    .select(`
      user_id, country, role_type, genres, formats, territories,
      open_to_coproduction, open_to_ep, bringing_territory_funding, imdb_url,
      profiles!producer_profiles_user_id_fkey(full_name, company)
    `)
    .eq("is_public", true)
    .order("created_at", { ascending: false });

  const ROLE_LABEL: Record<string, string> = {
    independent_producer: "Independent Producer",
    studio_exec:          "Studio Executive",
    sales_agent:          "Sales Agent",
    distributor:          "Distributor",
    ep:                   "Executive Producer",
    coproduction_partner: "Co-Production Partner",
  };

  return (
    <div className="min-h-screen bg-ivory">
      <div className="max-w-5xl mx-auto px-6 py-16">

        <p className="eyebrow mb-3">FYLYMPITCH Network</p>
        <h1 className="font-display text-[40px] mb-3">Producers</h1>
        <p className="text-ash text-[16px] mb-12 max-w-xl">
          Industry professionals looking for their next project. Each producer's interests are matched against filmmaker submissions in the FYLYMPITCH engine.
        </p>

        {(!producers || producers.length === 0) ? (
          <div className="card py-20 text-center">
            <p className="font-display text-[22px] mb-3">Coming soon</p>
            <p className="text-ash text-[15px]">Producers are joining the network. Check back soon.</p>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {producers.map((p: any) => {
              const profile = Array.isArray(p.profiles) ? p.profiles[0] : p.profiles;
              const tags = [
                p.open_to_coproduction && "Co-Production",
                p.open_to_ep && "EP",
                p.bringing_territory_funding && "Territory Funding",
              ].filter(Boolean);

              return (
                <div key={p.user_id} className="card p-6">
                  {/* Identity */}
                  <div className="mb-4">
                    <p className="font-display text-[18px] leading-snug">{profile?.full_name ?? "—"}</p>
                    {profile?.company && (
                      <p className="text-[13px] text-ash mt-0.5">{profile.company}</p>
                    )}
                    <p className="text-[12px] tracking-[0.14em] uppercase text-ash mt-1">
                      {ROLE_LABEL[p.role_type] ?? p.role_type}
                      {p.country ? ` · ${p.country}` : ""}
                    </p>
                  </div>

                  {/* Genres */}
                  {p.genres?.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mb-3">
                      {p.genres.slice(0, 4).map((g: string) => (
                        <span key={g} className="text-[10px] tracking-[0.1em] uppercase bg-parchment text-ash px-2.5 py-1 rounded-full border border-line">
                          {g}
                        </span>
                      ))}
                      {p.genres.length > 4 && (
                        <span className="text-[10px] text-ash px-2 py-1">+{p.genres.length - 4}</span>
                      )}
                    </div>
                  )}

                  {/* What they bring */}
                  {tags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mb-4">
                      {tags.map((t) => (
                        <span key={t as string} className="text-[10px] tracking-[0.1em] uppercase bg-gold/10 text-gold px-2.5 py-1 rounded-full border border-gold/30">
                          {t}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Format + territory */}
                  {p.formats?.length > 0 && (
                    <p className="text-[12px] text-ash mb-1">
                      <span className="text-ink">Format: </span>{p.formats.join(", ")}
                    </p>
                  )}
                  {p.territories?.length > 0 && (
                    <p className="text-[12px] text-ash">
                      <span className="text-ink">Territories: </span>
                      {p.territories.slice(0, 3).join(", ")}
                      {p.territories.length > 3 ? ` +${p.territories.length - 3}` : ""}
                    </p>
                  )}

                  {p.imdb_url && (
                    <a href={p.imdb_url} target="_blank" rel="noopener noreferrer"
                      className="mt-4 block text-[11px] tracking-[0.14em] uppercase text-ash hover:text-gold transition-colors">
                      IMDb →
                    </a>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <div className="mt-16 text-center">
          <p className="text-[13px] text-ash mb-4">Are you a producer? Join the network.</p>
          <Link href="/login?next=/producer" className="btn-gold">
            Join as Producer
          </Link>
        </div>
      </div>
    </div>
  );
}
