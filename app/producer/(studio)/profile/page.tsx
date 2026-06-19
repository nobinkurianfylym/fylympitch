"use client";

import { useEffect, useState, useActionState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { saveProducerProfile } from "@/lib/actions";
import AvatarUpload from "@/components/AvatarUpload";

const ROLE_TYPES = [
  { key: "independent_producer", label: "Independent Producer" },
  { key: "studio_exec",          label: "Studio Executive" },
  { key: "sales_agent",          label: "Sales Agent" },
  { key: "distributor",          label: "Distributor" },
  { key: "ep",                   label: "Executive Producer" },
  { key: "coproduction_partner", label: "Co-Production Partner" },
];

const GENRES = [
  "Drama","Documentary","Thriller","Horror","Comedy",
  "Animation","Sci-Fi","World Cinema","Romance","Action",
  "Experimental",
];

const FORMATS = ["Feature","Series","Documentary"];

const BUDGET_RANGES = [
  { key: "micro", label: "Micro", sub: "< $100K" },
  { key: "low",   label: "Low",   sub: "$100K – $500K" },
  { key: "mid",   label: "Mid",   sub: "$500K – $2M" },
  { key: "high",  label: "High",  sub: "$2M+" },
];

const FESTIVALS = [
  "Cannes","Berlin","Venice","Sundance","TIFF",
  "Rotterdam","Tribeca","IFFR","Hot Docs",
];

const COUNTRIES = [
  "India","United States","United Kingdom","France","Germany",
  "Italy","Spain","Japan","South Korea","Brazil","Mexico",
  "Australia","Canada","Nigeria","Kenya","Egypt","Iran",
  "Indonesia","Philippines","Argentina","Poland","Sweden",
  "Denmark","Norway","Netherlands","Belgium","Switzerland",
  "South Africa","Turkey","China","Hong Kong","Taiwan",
];

export default function ProducerProfilePage() {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(saveProducerProfile, null);
  const [loading, setLoading]   = useState(true);
  const [saved, setSaved]       = useState(false);

  // Identity
  const [userId, setUserId]     = useState("");
  const [name, setName]         = useState("");
  const [company, setCompany]   = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");

  // Taste
  const [roleType, setRoleType] = useState("independent_producer");
  const [country, setCountry]   = useState("");
  const [genres, setGenres]     = useState<string[]>([]);
  const [formats, setFormats]   = useState<string[]>([]);
  const [budget, setBudget]     = useState("");
  const [festivals, setFestivals] = useState<string[]>([]);
  const [territories, setTerritories] = useState<string[]>([]);
  const [coproduction, setCoproduction] = useState(false);
  const [attachEP, setAttachEP] = useState(false);
  const [bringFunding, setBringFunding] = useState(false);
  const [isPublic, setIsPublic] = useState(false);
  const [imdb, setImdb]         = useState("");

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      setUserId(user.id);
      Promise.all([
        supabase.from("profiles").select("full_name, company, avatar_url").eq("id", user.id).single(),
        supabase.from("producer_profiles").select("*").eq("user_id", user.id).single(),
      ]).then(([{ data: profile }, { data: pp }]) => {
        if (profile) {
          setName(profile.full_name ?? "");
          setCompany(profile.company ?? "");
          setAvatarUrl(profile.avatar_url ?? "");
        }
        if (pp) {
          setRoleType(pp.role_type ?? "independent_producer");
          setCountry(pp.country ?? "");
          setGenres(pp.genres ?? []);
          setFormats(pp.formats ?? []);
          setBudget(pp.budget_range ?? "");
          setFestivals(pp.festivals ?? []);
          setTerritories(pp.territories ?? []);
          setCoproduction(!!pp.open_to_coproduction);
          setAttachEP(!!pp.open_to_ep);
          setBringFunding(!!pp.bringing_territory_funding);
          setIsPublic(!!pp.is_public);
          setImdb(pp.imdb_url ?? "");
        }
        setLoading(false);
      });
    });
  }, []);

  // Show saved state
  useEffect(() => {
    if (state?.ok) {
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    }
  }, [state]);

  function toggle<T>(arr: T[], val: T): T[] {
    return arr.includes(val) ? arr.filter((x) => x !== val) : [...arr, val];
  }

  if (loading) return (
    <div className="p-10 text-ash text-[13px]">Loading profile…</div>
  );

  return (
    <div className="p-6 md:p-10 max-w-2xl">
      <p className="eyebrow mb-2">Producer Profile</p>
      <h1 className="font-display text-[36px] mb-1">{name || "Your Profile"}</h1>
      <p className="text-ash text-[14px] mb-10">Update your profile and taste preferences.</p>

      <form action={formAction} className="space-y-10">

        {/* Hidden state */}
        <input type="hidden" name="name" value={name} />
        <input type="hidden" name="company" value={company} />
        <input type="hidden" name="avatar_url" value={avatarUrl} />
        <input type="hidden" name="open_to_coproduction" value={coproduction ? "true" : "false"} />
        <input type="hidden" name="open_to_ep" value={attachEP ? "true" : "false"} />
        <input type="hidden" name="bringing_territory_funding" value={bringFunding ? "true" : "false"} />
        <input type="hidden" name="is_public" value={isPublic ? "true" : "false"} />

        {/* Identity */}
        <section className="card p-6">
          <p className="text-[11px] tracking-[0.22em] uppercase text-ash mb-5">Identity</p>
          <div className="mb-6">
            <AvatarUpload currentUrl={avatarUrl || null} userId={userId} name={name} onUpload={setAvatarUrl} />
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="field-label mb-1 block">Full name</label>
              <input type="text" value={name} onChange={(e) => setName(e.target.value)}
                placeholder="Your name" className="field w-full" />
            </div>
            <div>
              <label className="field-label mb-1 block">Company</label>
              <input type="text" value={company} onChange={(e) => setCompany(e.target.value)}
                placeholder="Optional" className="field w-full" />
            </div>
            <div>
              <label className="field-label mb-1 block">IMDb URL</label>
              <input type="url" name="imdb_url" value={imdb} onChange={(e) => setImdb(e.target.value)}
                placeholder="Optional" className="field w-full" />
            </div>
          </div>
        </section>

        {/* Location */}
        <section>
          <p className="text-[11px] tracking-[0.22em] uppercase text-ash mb-4">Base country</p>
          <select name="country" value={country} onChange={(e) => setCountry(e.target.value)} className="field w-full max-w-xs">
            <option value="">Select country</option>
            {COUNTRIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </section>

        {/* Role */}
        <section>
          <p className="text-[11px] tracking-[0.22em] uppercase text-ash mb-4">Your role</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {ROLE_TYPES.map((r) => (
              <button key={r.key} type="button" onClick={() => setRoleType(r.key)}
                className={`text-left px-4 py-3 rounded-card border text-[13px] transition-all
                  ${roleType === r.key ? "border-gold bg-gold/10 text-ink font-medium" : "border-line bg-white text-ash hover:border-ink/30"}`}>
                {r.label}
              </button>
            ))}
          </div>
          <input type="hidden" name="role_type" value={roleType} />
        </section>

        {/* Genres */}
        <section>
          <p className="text-[11px] tracking-[0.22em] uppercase text-ash mb-4">Genre interests</p>
          <div className="flex flex-wrap gap-2">
            {GENRES.map((g) => (
              <button key={g} type="button" onClick={() => setGenres(toggle(genres, g))}
                className={`px-4 py-2 rounded-full text-[12px] tracking-[0.1em] border transition-all
                  ${genres.includes(g) ? "bg-ink text-ivory border-ink" : "bg-white border-line text-ash hover:border-ink/40"}`}>
                {g}
              </button>
            ))}
          </div>
          {genres.map((g) => <input key={g} type="hidden" name="genres" value={g} />)}
        </section>

        {/* Format */}
        <section>
          <p className="text-[11px] tracking-[0.22em] uppercase text-ash mb-4">Format</p>
          <div className="flex flex-wrap gap-3">
            {FORMATS.map((f) => (
              <button key={f} type="button" onClick={() => setFormats(toggle(formats, f))}
                className={`px-5 py-2.5 rounded-full text-[13px] border transition-all
                  ${formats.includes(f) ? "bg-ink text-ivory border-ink" : "bg-white border-line text-ash hover:border-ink/40"}`}>
                {f}
              </button>
            ))}
          </div>
          {formats.map((f) => <input key={f} type="hidden" name="formats" value={f} />)}
        </section>

        {/* Budget */}
        <section>
          <p className="text-[11px] tracking-[0.22em] uppercase text-ash mb-4">Budget range</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {BUDGET_RANGES.map((b) => (
              <button key={b.key} type="button" onClick={() => setBudget(budget === b.key ? "" : b.key)}
                className={`px-4 py-3 rounded-card border text-left transition-all
                  ${budget === b.key ? "border-gold bg-gold/10" : "border-line bg-white hover:border-ink/30"}`}>
                <p className={`text-[13px] font-medium ${budget === b.key ? "text-ink" : "text-ash"}`}>{b.label}</p>
                <p className="text-[11px] text-ash mt-0.5">{b.sub}</p>
              </button>
            ))}
          </div>
          <input type="hidden" name="budget_range" value={budget} />
        </section>

        {/* Territories */}
        <section>
          <p className="text-[11px] tracking-[0.22em] uppercase text-ash mb-4">Territories of interest</p>
          <div className="flex flex-wrap gap-2">
            {COUNTRIES.slice(0, 20).map((c) => (
              <button key={c} type="button" onClick={() => setTerritories(toggle(territories, c))}
                className={`px-3 py-1.5 rounded-full text-[11px] border transition-all
                  ${territories.includes(c) ? "bg-ink text-ivory border-ink" : "bg-white border-line text-ash hover:border-ink/40"}`}>
                {c}
              </button>
            ))}
          </div>
          {territories.map((t) => <input key={t} type="hidden" name="territories" value={t} />)}
        </section>

        {/* Festivals */}
        <section>
          <p className="text-[11px] tracking-[0.22em] uppercase text-ash mb-4">Festivals</p>
          <div className="flex flex-wrap gap-2">
            {FESTIVALS.map((f) => (
              <button key={f} type="button" onClick={() => setFestivals(toggle(festivals, f))}
                className={`px-4 py-2 rounded-full text-[12px] border transition-all
                  ${festivals.includes(f) ? "bg-ink text-ivory border-ink" : "bg-white border-line text-ash hover:border-ink/40"}`}>
                {f}
              </button>
            ))}
          </div>
          {festivals.map((f) => <input key={f} type="hidden" name="festivals" value={f} />)}
        </section>

        {/* What you bring */}
        <section>
          <p className="text-[11px] tracking-[0.22em] uppercase text-ash mb-4">What you bring</p>
          <div className="flex flex-wrap gap-3">
            {[
              { label: "Open to co-production", active: coproduction, set: setCoproduction },
              { label: "Can attach as EP",       active: attachEP,     set: setAttachEP },
              { label: "Bringing territory funding", active: bringFunding, set: setBringFunding },
            ].map((item) => (
              <button key={item.label} type="button" onClick={() => item.set(!item.active)}
                className={`px-5 py-2.5 rounded-full text-[13px] border transition-all
                  ${item.active ? "bg-gold text-white border-gold" : "bg-white border-line text-ash hover:border-gold/50"}`}>
                {item.active && <span className="mr-1.5">✓</span>}
                {item.label}
              </button>
            ))}
          </div>
        </section>

        {/* Public opt-in */}
        <section>
          <button type="button" onClick={() => setIsPublic(!isPublic)}
            className={`w-full text-left p-6 rounded-card border-2 transition-all
              ${isPublic ? "border-gold bg-gold/5" : "border-line bg-white hover:border-ink/20"}`}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[15px] font-medium text-ink mb-1">Listed in FYLYMPITCH producer network</p>
                <p className="text-[13px] text-ash leading-relaxed">
                  Filmmakers see your profile in their intelligence report when your interests match their project.
                </p>
              </div>
              <div className={`shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center
                ${isPublic ? "bg-gold border-gold" : "border-line"}`}>
                {isPublic && <span className="text-white text-[12px]">✓</span>}
              </div>
            </div>
          </button>
        </section>

        <div className="pb-8 flex items-center gap-4">
          <button type="submit" disabled={pending}
            className="btn-gold py-4 px-10 text-[14px] tracking-[0.16em] disabled:opacity-60">
            {pending ? "Saving…" : "Save profile"}
          </button>
          {saved && <span className="text-[13px] text-emerald-600">✓ Saved</span>}
        </div>

      </form>
    </div>
  );
}
