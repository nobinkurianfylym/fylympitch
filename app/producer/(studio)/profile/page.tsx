"use client";

import { useEffect, useState, useActionState } from "react";
import { createClient } from "@/lib/supabase/client";
import { saveProducerProfile, updateUsername } from "@/lib/actions";
import AvatarUpload from "@/components/AvatarUpload";

const STAGES = [
  { key: "development",   label: "Development" },
  { key: "pre_production",label: "Pre-Production" },
  { key: "production",    label: "Production" },
  { key: "post_production",label: "Post-Production" },
  { key: "completed",     label: "Completed / Acquisition" },
];

const FUNDING_ROLES = [
  { key: "full_financing",     label: "Full financing" },
  { key: "co_producer",        label: "Co-producer" },
  { key: "equity_investor",    label: "Equity investor" },
  { key: "territory_presales", label: "Territory pre-sales" },
  { key: "gap_financing",      label: "Gap financing" },
  { key: "grant_access",       label: "Grant access" },
];

const CONTRIBUTION_CAPACITY = [
  { key: "under_50k",   label: "Under $50K",     sub: "Micro contribution" },
  { key: "50k_250k",    label: "$50K – $250K",   sub: "Partial co-finance" },
  { key: "250k_1m",     label: "$250K – $1M",    sub: "Significant stake" },
  { key: "1m_plus",     label: "$1M+",           sub: "Lead financier" },
];

const GENRES = [
  "Drama","Documentary","Thriller","Horror","Comedy",
  "Animation","Sci-Fi","World Cinema","Romance","Action","Experimental",
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

const LANGUAGES = [
  "Arabic","Bengali","Cantonese","Danish","Dutch","English","Finnish",
  "French","German","Greek","Hebrew","Hindi","Indonesian","Italian",
  "Japanese","Korean","Mandarin","Norwegian","Persian / Farsi","Polish",
  "Portuguese","Romanian","Russian","Spanish","Swahili","Swedish",
  "Tamil","Telugu","Thai","Turkish","Ukrainian","Urdu","Vietnamese",
];

const BASE_COUNTRIES = [
  "India","United States","United Kingdom","France","Germany",
  "Italy","Spain","Japan","South Korea","Brazil","Mexico",
  "Australia","Canada","Nigeria","Kenya","Egypt","Iran",
  "Indonesia","Philippines","Argentina","Poland","Sweden",
  "Denmark","Norway","Netherlands","Belgium","Switzerland",
  "South Africa","Turkey","China","Hong Kong","Taiwan",
];

const TERRITORY_GROUPS = [
  { group: "North America",            territories: ["United States","Canada"] },
  { group: "United Kingdom & Ireland", territories: ["United Kingdom","Republic of Ireland"] },
  { group: "Western Europe",           territories: ["Germany","France","Austria","Switzerland","Benelux"] },
  { group: "Nordic Countries",         territories: ["Sweden","Norway","Denmark","Finland","Iceland"] },
  { group: "Central & Eastern Europe", territories: ["Poland","Czech Republic","Hungary","Romania","Bulgaria","Slovakia","The Baltics","The Balkans","CIS / Russia","Ukraine"] },
  { group: "Southern Europe",          territories: ["Italy","Spain","Portugal","Greece","Cyprus"] },
  { group: "Latin America",            territories: ["Mexico","Brazil","Argentina","Colombia","Chile","Peru","Venezuela","Ecuador","Central America & Caribbean"] },
  { group: "Middle East",              territories: ["Saudi Arabia","UAE","Kuwait","Qatar","Oman","Bahrain","Egypt","Jordan","Lebanon","Iraq","Israel"] },
  { group: "Africa",                   territories: ["South Africa","Nigeria","Kenya","Ghana","Pan-African French-Speaking","North Africa / Maghreb"] },
  { group: "South Asia",               territories: ["India","Pakistan","Bangladesh","Sri Lanka","Nepal"] },
  { group: "East & Southeast Asia",    territories: ["Japan","South Korea","China","Hong Kong","Taiwan","Southeast Asia (SEAS)"] },
  { group: "Oceania",                  territories: ["Australia","New Zealand","Pacific Islands"] },
];

export default function ProducerProfilePage() {
  const [state, formAction, pending]             = useActionState(saveProducerProfile, null);
  const [usernameState, usernameAction, usernamePending] = useActionState(updateUsername, null);

  const [loading, setLoading]   = useState(true);
  const [saved, setSaved]       = useState(false);

  // Identity
  const [userId, setUserId]       = useState("");
  const [name, setName]           = useState("");
  const [company, setCompany]     = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [username, setUsername]   = useState("");
  const [country, setCountry]     = useState("");
  const [imdb, setImdb]           = useState("");

  // New preference fields
  const [stages, setStages]               = useState<string[]>([]);
  const [languages, setLanguages]         = useState<string[]>([]);
  const [fundingRoles, setFundingRoles]   = useState<string[]>([]);
  const [capacity, setCapacity]           = useState("");

  // Taste
  const [genres, setGenres]           = useState<string[]>([]);
  const [formats, setFormats]         = useState<string[]>([]);
  const [budget, setBudget]           = useState("");
  const [festivals, setFestivals]     = useState<string[]>([]);
  const [territories, setTerritories] = useState<string[]>([]);
  const [isPublic, setIsPublic]       = useState(false);

  // Territory accordion
  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set());

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      setUserId(user.id);
      Promise.all([
        supabase.from("profiles").select("full_name, company, avatar_url, username").eq("id", user.id).single(),
        supabase.from("producer_profiles").select("*").eq("user_id", user.id).single(),
      ]).then(([{ data: profile }, { data: pp }]) => {
        if (profile) {
          setName(profile.full_name ?? "");
          setCompany(profile.company ?? "");
          setAvatarUrl(profile.avatar_url ?? "");
          setUsername((profile as any).username ?? "");
        }
        if (pp) {
          setCountry(pp.country ?? "");
          setGenres(pp.genres ?? []);
          setFormats(pp.formats ?? []);
          setBudget(pp.budget_range ?? "");
          setFestivals(pp.festivals ?? []);
          setTerritories(pp.territories ?? []);
          setStages(pp.stage_preferences ?? []);
          setLanguages(pp.language_preferences ?? []);
          setFundingRoles(pp.funding_roles ?? []);
          setCapacity(pp.contribution_capacity ?? "");
          setIsPublic(!!pp.is_public);
          setImdb(pp.imdb_url ?? "");
        }
        setLoading(false);
      });
    });
  }, []);

  useEffect(() => {
    if (state?.ok) { setSaved(true); setTimeout(() => setSaved(false), 3000); }
  }, [state]);

  function toggle<T>(arr: T[], val: T): T[] {
    return arr.includes(val) ? arr.filter((x) => x !== val) : [...arr, val];
  }

  function toggleGroup(group: string) {
    setOpenGroups((prev) => {
      const next = new Set(prev);
      if (next.has(group)) next.delete(group); else next.add(group);
      return next;
    });
  }

  function toggleAllInGroup(groupTerritories: string[]) {
    const allSelected = groupTerritories.every((t) => territories.includes(t));
    if (allSelected) setTerritories((prev) => prev.filter((t) => !groupTerritories.includes(t)));
    else setTerritories((prev) => [...new Set([...prev, ...groupTerritories])]);
  }

  function addLanguage(e: React.ChangeEvent<HTMLSelectElement>) {
    const val = e.target.value;
    if (val && !languages.includes(val)) setLanguages((prev) => [...prev, val]);
    e.target.value = "";
  }

  if (loading) return <div className="p-10 text-ash text-[13px]">Loading profile…</div>;

  return (
    <div className="p-6 md:p-10 max-w-5xl">
      <p className="eyebrow mb-2">Producer Profile</p>
      <h1 className="font-display text-[36px] mb-1">{name || "Your Profile"}</h1>
      <p className="text-ash text-[14px] mb-10">Update your profile and taste preferences.</p>

      <form action={formAction}>
        {/* Hidden fields */}
        <input type="hidden" name="name"       value={name} />
        <input type="hidden" name="company"    value={company} />
        <input type="hidden" name="avatar_url" value={avatarUrl} />
        <input type="hidden" name="is_public"  value={isPublic ? "true" : "false"} />
        <input type="hidden" name="budget_range" value={budget} />
        <input type="hidden" name="contribution_capacity" value={capacity} />
        {genres.map((g)      => <input key={g} type="hidden" name="genres"               value={g} />)}
        {formats.map((f)     => <input key={f} type="hidden" name="formats"              value={f} />)}
        {festivals.map((f)   => <input key={f} type="hidden" name="festivals"            value={f} />)}
        {territories.map((t) => <input key={t} type="hidden" name="territories"          value={t} />)}
        {stages.map((s)      => <input key={s} type="hidden" name="stage_preferences"    value={s} />)}
        {languages.map((l)   => <input key={l} type="hidden" name="language_preferences" value={l} />)}
        {fundingRoles.map((r) => <input key={r} type="hidden" name="funding_roles"       value={r} />)}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-16 items-start">

          {/* ── LEFT: Identity & Stance ── */}
          <div className="space-y-10">

            {/* Identity card */}
            <section className="card p-6 space-y-5">
              <p className="text-[11px] tracking-[0.22em] uppercase text-ash">Identity</p>
              <AvatarUpload currentUrl={avatarUrl || null} userId={userId} name={name} onUpload={setAvatarUrl} />

              {/* Username — top of identity, this is your public profile URL */}
              <div className="pb-5 border-b border-line">
                <p className="text-[11px] tracking-[0.22em] uppercase text-ash mb-1">Your profile URL</p>
                <p className="text-[12px] text-ash mb-3">
                  pitch.fylym.com/u/<span className="text-ink font-medium">{username || "yourhandle"}</span>
                </p>
                <form action={usernameAction} className="flex items-center gap-3">
                  <div className="relative flex-1">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[13px] text-ash select-none">@</span>
                    <input name="username" className="field !pl-7 w-full" defaultValue={username} placeholder="yourhandle" minLength={3} maxLength={30} pattern="[a-z0-9_]+" />
                  </div>
                  <button className="btn-ghost !py-2.5" disabled={usernamePending}>
                    {usernamePending ? "Saving…" : "Save"}
                  </button>
                </form>
                {usernameState?.error && <p className="mt-2 text-[12px] text-red-700">{usernameState.error}</p>}
                {usernameState?.ok    && <p className="mt-2 text-[12px] text-[#8A6F3E]">Username updated.</p>}
                <p className="mt-1.5 text-[11px] text-ash/60">Lowercase letters, numbers and underscores only.</p>
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="field-label mb-1 block">Full name</label>
                  <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" className="field w-full" />
                </div>
                <div>
                  <label className="field-label mb-1 block">Company</label>
                  <input type="text" value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Optional" className="field w-full" />
                </div>
              </div>
              <div>
                <label className="field-label mb-1 block">Base country</label>
                <select name="country" value={country} onChange={(e) => setCountry(e.target.value)} className="field w-full">
                  <option value="">Select country</option>
                  {BASE_COUNTRIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="field-label mb-1 block">IMDb URL</label>
                <input type="url" name="imdb_url" value={imdb} onChange={(e) => setImdb(e.target.value)} placeholder="https://www.imdb.com/name/…" className="field w-full" />
              </div>
            </section>

            {/* Stage preference */}
            <section>
              <p className="text-[11px] tracking-[0.22em] uppercase text-ash mb-1">Stage preference</p>
              <p className="text-[12px] text-ash mb-3">Which project stages do you invest in?</p>
              <div className="flex flex-wrap gap-2">
                {STAGES.map((s) => (
                  <button key={s.key} type="button" onClick={() => setStages(toggle(stages, s.key))}
                    className={`px-4 py-2 rounded-full text-[12px] border transition-all ${
                      stages.includes(s.key)
                        ? s.key === "completed"
                          ? "bg-gold border-gold text-ink font-medium"
                          : "bg-ink border-ink text-ivory"
                        : "bg-white border-line text-ash hover:border-ink/40"
                    }`}>
                    {s.label}
                  </button>
                ))}
              </div>
            </section>

            {/* Language preference */}
            <section>
              <p className="text-[11px] tracking-[0.22em] uppercase text-ash mb-1">Language preference</p>
              <p className="text-[12px] text-ash mb-3">Projects in which languages interest you?</p>
              {languages.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-3">
                  {languages.map((l) => (
                    <span key={l} className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-parchment border border-line text-[12px] text-ink">
                      {l}
                      <button type="button" onClick={() => setLanguages(languages.filter((x) => x !== l))}
                        className="text-ash hover:text-ink transition-colors text-[14px] leading-none">×</button>
                    </span>
                  ))}
                </div>
              )}
              <select className="field w-full" onChange={addLanguage} defaultValue="">
                <option value="" disabled>+ Add a language…</option>
                {LANGUAGES.filter((l) => !languages.includes(l)).map((l) => (
                  <option key={l} value={l}>{l}</option>
                ))}
              </select>
            </section>

            {/* Funding role */}
            <section>
              <p className="text-[11px] tracking-[0.22em] uppercase text-ash mb-1">Funding role</p>
              <p className="text-[12px] text-ash mb-3">How do you participate in financing?</p>
              <div className="flex flex-wrap gap-2">
                {FUNDING_ROLES.map((r) => (
                  <button key={r.key} type="button" onClick={() => setFundingRoles(toggle(fundingRoles, r.key))}
                    className={`px-4 py-2 rounded-full text-[12px] border transition-all ${
                      fundingRoles.includes(r.key)
                        ? "bg-ink border-ink text-ivory"
                        : "bg-white border-line text-ash hover:border-ink/40"
                    }`}>
                    {r.label}
                  </button>
                ))}
              </div>
            </section>

            {/* Contribution capacity */}
            <section>
              <p className="text-[11px] tracking-[0.22em] uppercase text-ash mb-1">Contribution capacity</p>
              <p className="text-[12px] text-ash mb-3">How much can you bring to a single project?</p>
              <div className="grid grid-cols-2 gap-3">
                {CONTRIBUTION_CAPACITY.map((c) => (
                  <button key={c.key} type="button" onClick={() => setCapacity(capacity === c.key ? "" : c.key)}
                    className={`px-4 py-3 rounded-card border text-left transition-all ${
                      capacity === c.key ? "border-gold bg-gold/10" : "border-line bg-white hover:border-ink/30"
                    }`}>
                    <p className={`text-[13px] font-medium ${capacity === c.key ? "text-ink" : "text-ash"}`}>{c.label}</p>
                    <p className="text-[11px] text-ash mt-0.5">{c.sub}</p>
                  </button>
                ))}
              </div>
            </section>

            {/* Public opt-in */}
            <section>
              <button type="button" onClick={() => setIsPublic(!isPublic)}
                className={`w-full text-left p-6 rounded-card border-2 transition-all ${
                  isPublic ? "border-gold bg-gold/5" : "border-line bg-white hover:border-ink/20"
                }`}>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-[15px] font-medium text-ink mb-1">Listed in PITCH.FYLYM producer network</p>
                    <p className="text-[13px] text-ash leading-relaxed">
                      Filmmakers see your profile in their intelligence report when interests match their project.
                    </p>
                  </div>
                  <div className={`shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                    isPublic ? "bg-gold border-gold" : "border-line"
                  }`}>
                    {isPublic && <span className="text-white text-[12px]">✓</span>}
                  </div>
                </div>
              </button>
            </section>

            {/* Save */}
            <div className="pb-8 flex items-center gap-4">
              <button type="submit" disabled={pending}
                className="btn-gold py-4 px-10 text-[14px] tracking-[0.16em] disabled:opacity-60">
                {pending ? "Saving…" : "Save profile"}
              </button>
              {saved && <span className="text-[13px] text-emerald-600">✓ Saved</span>}
            </div>
          </div>

          {/* ── RIGHT: Taste & Preferences ── */}
          <div className="space-y-10 lg:pt-0 pt-10 lg:border-t-0 border-t border-line">

            {/* Genre */}
            <section>
              <p className="text-[11px] tracking-[0.22em] uppercase text-ash mb-3">Genre interests</p>
              <div className="flex flex-wrap gap-2">
                {GENRES.map((g) => (
                  <button key={g} type="button" onClick={() => setGenres(toggle(genres, g))}
                    className={`px-4 py-2 rounded-full text-[12px] tracking-[0.1em] border transition-all ${
                      genres.includes(g) ? "bg-ink text-ivory border-ink" : "bg-white border-line text-ash hover:border-ink/40"
                    }`}>
                    {g}
                  </button>
                ))}
              </div>
            </section>

            {/* Format */}
            <section>
              <p className="text-[11px] tracking-[0.22em] uppercase text-ash mb-3">Format</p>
              <div className="flex flex-wrap gap-3">
                {FORMATS.map((f) => (
                  <button key={f} type="button" onClick={() => setFormats(toggle(formats, f))}
                    className={`px-5 py-2.5 rounded-full text-[13px] border transition-all ${
                      formats.includes(f) ? "bg-ink text-ivory border-ink" : "bg-white border-line text-ash hover:border-ink/40"
                    }`}>
                    {f}
                  </button>
                ))}
              </div>
            </section>

            {/* Budget range */}
            <section>
              <p className="text-[11px] tracking-[0.22em] uppercase text-ash mb-3">Budget range</p>
              <div className="grid grid-cols-2 gap-3">
                {BUDGET_RANGES.map((b) => (
                  <button key={b.key} type="button" onClick={() => setBudget(budget === b.key ? "" : b.key)}
                    className={`px-4 py-3 rounded-card border text-left transition-all ${
                      budget === b.key ? "border-gold bg-gold/10" : "border-line bg-white hover:border-ink/30"
                    }`}>
                    <p className={`text-[13px] font-medium ${budget === b.key ? "text-ink" : "text-ash"}`}>{b.label}</p>
                    <p className="text-[11px] text-ash mt-0.5">{b.sub}</p>
                  </button>
                ))}
              </div>
            </section>

            {/* Territories */}
            <section>
              <div className="flex items-baseline gap-3 mb-3">
                <p className="text-[11px] tracking-[0.22em] uppercase text-ash">Territories of interest</p>
                {territories.length > 0 && <span className="text-[11px] text-gold">{territories.length} selected</span>}
              </div>
              <div className="border border-line rounded-card overflow-hidden bg-white">
                {TERRITORY_GROUPS.map((tg, idx) => {
                  const isOpen = openGroups.has(tg.group);
                  const selectedInGroup = tg.territories.filter((t) => territories.includes(t)).length;
                  const allInGroup = selectedInGroup === tg.territories.length;
                  return (
                    <div key={tg.group} className={idx < TERRITORY_GROUPS.length - 1 ? "border-b border-line" : ""}>
                      <div className="flex items-center gap-3 px-3 py-2.5 hover:bg-parchment/40 transition-colors">
                        <input type="checkbox" checked={allInGroup && tg.territories.length > 0}
                          onChange={() => toggleAllInGroup(tg.territories)}
                          onClick={(e) => e.stopPropagation()}
                          className="w-3 h-3 accent-[#BF9953] shrink-0 cursor-pointer" />
                        <button type="button" onClick={() => toggleGroup(tg.group)}
                          className="flex-1 flex items-center justify-between text-left">
                          <span className="text-[12px] font-medium text-ink">{tg.group}</span>
                          <span className="flex items-center gap-2 shrink-0">
                            {selectedInGroup > 0 && <span className="text-[10px] text-gold font-medium">{selectedInGroup}/{tg.territories.length}</span>}
                            <span className="text-[10px] text-ash">{isOpen ? "▲" : "▼"}</span>
                          </span>
                        </button>
                      </div>
                      {isOpen && (
                        <div className="border-t border-line/40 bg-parchment/20 px-5 py-2 grid grid-cols-1 gap-y-0.5">
                          {tg.territories.map((territory) => (
                            <label key={territory} className="flex items-center gap-2.5 py-1 cursor-pointer group">
                              <input type="checkbox" checked={territories.includes(territory)}
                                onChange={() => setTerritories(toggle(territories, territory))}
                                className="w-3 h-3 accent-[#BF9953] shrink-0" />
                              <span className="text-[12px] text-ash group-hover:text-ink transition-colors">{territory}</span>
                            </label>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>

            {/* Festivals */}
            <section>
              <p className="text-[11px] tracking-[0.22em] uppercase text-ash mb-1">Festivals</p>
              <p className="text-[12px] text-ash mb-3">Festival pedigree you look for in projects</p>
              <div className="flex flex-wrap gap-2">
                {FESTIVALS.map((f) => (
                  <button key={f} type="button" onClick={() => setFestivals(toggle(festivals, f))}
                    className={`px-4 py-2 rounded-full text-[12px] border transition-all ${
                      festivals.includes(f) ? "bg-ink text-ivory border-ink" : "bg-white border-line text-ash hover:border-ink/40"
                    }`}>
                    {f}
                  </button>
                ))}
              </div>
            </section>

          </div>
        </div>
      </form>
    </div>
  );
}
