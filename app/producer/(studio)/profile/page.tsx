"use client";

import { useEffect, useState, useActionState } from "react";
import { createClient } from "@/lib/supabase/client";
import { saveProducerProfile, updateUsername } from "@/lib/actions";
import AvatarUpload from "@/components/AvatarUpload";
import DeleteAccountModal from "@/components/DeleteAccountModal";
import Link from "next/link";

// ── Constants ─────────────────────────────────────────────────────────────────

const GENRES = [
  "Drama","Documentary","Thriller","Horror","Comedy",
  "Animation","Sci-Fi","World Cinema","Romance","Action","Experimental",
];

const FORMATS = ["Feature","Series","Documentary"];

const FUNDING_ROLES = [
  { key: "full_financing",     label: "Full Financing" },
  { key: "co_producer",        label: "Co-Producer" },
  { key: "equity_investor",    label: "Equity Investor" },
  { key: "territory_presales", label: "Territory Pre-Sales" },
  { key: "gap_financing",      label: "Gap Financing" },
  { key: "grant_access",       label: "Grant Access" },
];

const BUDGET_RANGES = [
  { key: "micro", label: "Micro",  sub: "< $100K" },
  { key: "low",   label: "Low",    sub: "$100K–$500K" },
  { key: "mid",   label: "Mid",    sub: "$500K–$2M" },
  { key: "high",  label: "High",   sub: "$2M+" },
];

const LANGUAGES = [
  "Arabic","Bengali","Cantonese","Danish","Dutch","English","Finnish","French",
  "German","Greek","Hebrew","Hindi","Indonesian","Italian","Japanese","Kannada",
  "Konkani","Korean","Malayalam","Mandarin","Marathi","Norwegian","Persian / Farsi",
  "Polish","Portuguese","Romanian","Russian","Spanish","Swahili","Swedish",
  "Tamil","Telugu","Thai","Tulu","Turkish","Ukrainian","Urdu","Vietnamese","Others",
];

const LOOKING_FOR_OPTIONS = [
  "First Feature Directors","Debut Filmmakers","Co-Productions",
  "Executive Producers","Scripts","OTT Projects","International Partners",
  "Regional Cinema","Festival Films","Documentary Projects","Animated Features",
];

const STAGES = [
  { key: "development",    label: "Development" },
  { key: "pre_production", label: "Pre-Production" },
  { key: "production",     label: "Production" },
  { key: "post_production",label: "Post-Production" },
  { key: "completed",      label: "Acquisition" },
];

const BASE_COUNTRIES = [
  "India","United States","United Kingdom","France","Germany","Italy","Spain",
  "Japan","South Korea","Brazil","Mexico","Australia","Canada","Nigeria","Kenya",
  "Egypt","Iran","Indonesia","Philippines","Argentina","Poland","Sweden",
  "Denmark","Norway","Netherlands","Belgium","Switzerland","South Africa",
  "Turkey","China","Hong Kong","Taiwan","Others",
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

// ── Profile Preview Component ──────────────────────────────────────────────────

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function ProducerProfilePage() {
  const [state, formAction, pending]                         = useActionState(saveProducerProfile, null);
  const [usernameState, usernameAction, usernamePending]     = useActionState(updateUsername, null);

  const [loading, setLoading]   = useState(true);
  const [saved, setSaved]       = useState(false);

  // Identity
  const [userId, setUserId]         = useState("");
  const [name, setName]             = useState("");
  const [company, setCompany]       = useState("");
  const [avatarUrl, setAvatarUrl]   = useState("");
  const [username, setUsername]     = useState("");
  const [bio, setBio]               = useState("");
  const [website, setWebsite]       = useState("");
  const [imdb, setImdb]             = useState("");
  const [linkedin, setLinkedin]     = useState("");
  const [country, setCountry]       = useState("");
  const [yearsExp, setYearsExp]     = useState("");

  // Preferences
  const [genres, setGenres]               = useState<string[]>([]);
  const [formats, setFormats]             = useState<string[]>([]);
  const [festivals, setFestivals]         = useState<string[]>([]);
  const [territories, setTerritories]     = useState<string[]>([]);
  const [languages, setLanguages]         = useState<string[]>([]);
  const [stages, setStages]               = useState<string[]>([]);
  const [fundingRoles, setFundingRoles]   = useState<string[]>([]);
  const [capacity, setCapacity]           = useState("");
  const [budget, setBudget]               = useState("");
  const [lookingFor, setLookingFor]       = useState<string[]>([]);
  const [acceptingPitches, setAccepting]  = useState(true);
  const [responseTime, setResponseTime]   = useState("");
  const [isPublic, setIsPublic]           = useState(false);

  // Territory accordion
  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set());

  // Edit sections accordion on mobile
  const [editSection, setEditSection] = useState<string>("identity");

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      setUserId(user.id);
      Promise.all([
        supabase.from("profiles").select("full_name, company, avatar_url, username, bio, website, imdb_url, linkedin_url").eq("id", user.id).single(),
        supabase.from("producer_profiles").select("*").eq("user_id", user.id).single(),
        supabase.from("profiles").select("is_producer_verified").eq("id", user.id).single(),
      ]).then(([{ data: profile }, { data: pp }, { data: vf }]) => {
        if (profile) {
          setName(profile.full_name ?? "");
          setCompany(profile.company ?? "");
          setAvatarUrl(profile.avatar_url ?? "");
          setUsername((profile as any).username ?? "");
          setBio((profile as any).bio ?? "");
          setWebsite((profile as any).website ?? "");
          setImdb((profile as any).imdb_url ?? "");
          setLinkedin((profile as any).linkedin_url ?? "");
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
          setLookingFor((pp as any).looking_for ?? []);
          setAccepting((pp as any).accepting_pitches ?? true);
          setResponseTime((pp as any).response_time ?? "");
          setYearsExp(String((pp as any).years_experience ?? ""));
        }
        setLoading(false);
      });
    });
  }, []);

  useEffect(() => {
    if (state?.ok) { setSaved(true); setTimeout(() => setSaved(false), 3000); }
  }, [state]);

  function toggle<T>(arr: T[], val: T): T[] {
    return arr.includes(val) ? arr.filter(x => x !== val) : [...arr, val];
  }

  function toggleGroup(group: string) {
    setOpenGroups(prev => {
      const next = new Set(prev);
      if (next.has(group)) next.delete(group); else next.add(group);
      return next;
    });
  }

  function toggleAllInGroup(groupTerritories: string[]) {
    const allSelected = groupTerritories.every(t => territories.includes(t));
    if (allSelected) setTerritories(prev => prev.filter(t => !groupTerritories.includes(t)));
    else setTerritories(prev => [...new Set([...prev, ...groupTerritories])]);
  }

  function addLanguage(e: React.ChangeEvent<HTMLSelectElement>) {
    const val = e.target.value;
    if (val && !languages.includes(val)) setLanguages(prev => [...prev, val]);
    e.target.value = "";
  }

  const sections: { key: string; label: string }[] = [
    { key: "identity",   label: "Identity" },
    { key: "interests",  label: "Focus" },
    { key: "investment", label: "Investment" },
    { key: "markets",    label: "Markets" },
    { key: "visibility", label: "Settings" },
  ];

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <p className="text-[13px] text-ash tracking-[0.1em]">Loading…</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full" style={{ minHeight: "calc(100vh - 1px)" }}>

      {/* ── Header strip ── */}
      <div className="shrink-0 px-8 py-5 border-b border-line flex items-center justify-between gap-4 bg-ivory">
        <div>
          <p className="eyebrow">Producer Profile</p>
          <h1 className="font-display text-[22px] mt-0.5">{name || "Your Profile"}</h1>
        </div>
        {/* Avatar — links to public profile */}
        <Link
          href={username ? `/u/${username}` : "#"}
          target={username ? "_blank" : undefined}
          rel="noopener noreferrer"
          title={username ? "View public profile" : "Set a username to view public profile"}
          className="shrink-0 hover:opacity-80 transition-opacity"
        >
          <div className="w-10 h-10 rounded-full overflow-hidden border border-line bg-parchment flex items-center justify-center">
            {avatarUrl
              ? <img
                  src={avatarUrl}
                  alt={name}
                  className="w-full h-full object-cover"
                />
              : <span className="font-display text-[13px] text-ash">
                  {name ? name.split(" ").map((w: string) => w[0]).join("").slice(0,2).toUpperCase() : "—"}
                </span>
            }
          </div>
        </Link>
      </div>

      {/* ── Edit panel ── */}
      <div className="flex-1 overflow-hidden">
        <div className="h-full overflow-y-auto bg-ivory max-w-2xl mx-auto">

          <form action={formAction}>
            {/* Hidden fields */}
            <input type="hidden" name="name"                    value={name} />
            <input type="hidden" name="company"                 value={company} />
            <input type="hidden" name="avatar_url"              value={avatarUrl} />
            <input type="hidden" name="bio"                     value={bio} />
            <input type="hidden" name="website"                 value={website} />
            <input type="hidden" name="is_public"               value={isPublic ? "true" : "false"} />
            <input type="hidden" name="budget_range"            value={budget} />
            <input type="hidden" name="contribution_capacity"   value={capacity} />
            <input type="hidden" name="accepting_pitches"       value={acceptingPitches ? "true" : "false"} />
            <input type="hidden" name="response_time"           value={responseTime} />
            <input type="hidden" name="years_experience"        value={yearsExp} />
            {genres.map(g       => <input key={g} type="hidden" name="genres"               value={g} />)}
            {formats.map(f      => <input key={f} type="hidden" name="formats"              value={f} />)}
            {festivals.map(f    => <input key={f} type="hidden" name="festivals"            value={f} />)}
            {territories.map(t  => <input key={t} type="hidden" name="territories"          value={t} />)}
            {stages.map(s       => <input key={s} type="hidden" name="stage_preferences"    value={s} />)}
            {languages.map(l    => <input key={l} type="hidden" name="language_preferences" value={l} />)}
            {fundingRoles.map(r => <input key={r} type="hidden" name="funding_roles"        value={r} />)}
            {lookingFor.map(l   => <input key={l} type="hidden" name="looking_for"          value={l} />)}

            {/* Section nav tabs */}
            <div className="sticky top-0 z-10 bg-ivory border-b border-line flex overflow-x-auto">
              {sections.map(s => (
                <button key={s.key} type="button" onClick={() => setEditSection(s.key)}
                  className={`shrink-0 px-4 py-3.5 text-[10px] tracking-[0.18em] uppercase font-semibold transition-colors whitespace-nowrap ${
                    editSection === s.key
                      ? "text-ink border-b-2 border-ink"
                      : "text-ash hover:text-ink"
                  }`}>
                  {s.label}
                </button>
              ))}
            </div>

            {/* ── IDENTITY section ── */}
            {editSection === "identity" && (
              <div className="p-6 space-y-5">
                <AvatarUpload currentUrl={avatarUrl || null} userId={userId} name={name} onUpload={setAvatarUrl} />

                <div>
                  <label className="field-label mb-1 block">Full name</label>
                  <input value={name} onChange={e => setName(e.target.value)} className="field w-full" placeholder="Your name" />
                </div>

                {/* Username — under name */}
                <div className="pb-2">
                  <p className="text-[10px] tracking-[0.2em] uppercase text-ash/60 font-semibold mb-1">Profile URL</p>
                  <p className="text-[12px] text-ash mb-2.5">
                    pitch.fylym.com/u/<span className="text-ink font-medium">{username || "yourhandle"}</span>
                  </p>
                  <form action={usernameAction} className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[13px] text-ash">@</span>
                      <input name="username" className="field !pl-7 w-full !py-2 !text-[13px]"
                        defaultValue={username} placeholder="yourhandle"
                        minLength={3} maxLength={30} pattern="[a-z0-9_]+" />
                    </div>
                    <button className="btn-ghost !py-2 !px-3 !text-[11px]" disabled={usernamePending}>
                      {usernamePending ? "…" : "Save"}
                    </button>
                  </form>
                  {usernameState?.error && <p className="mt-1.5 text-[11px] text-red-600">{usernameState.error}</p>}
                  {usernameState?.ok    && <p className="mt-1.5 text-[11px] text-emerald-600">✓ Saved</p>}
                </div>
                <div>
                  <label className="field-label mb-1 block">Production company</label>
                  <input value={company} onChange={e => setCompany(e.target.value)} className="field w-full" placeholder="Optional" />
                </div>
                <div>
                  <label className="field-label mb-1 block">Base country</label>
                  <select name="country" value={country} onChange={e => setCountry(e.target.value)} className="field w-full">
                    <option value="">Select country</option>
                    {BASE_COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="field-label mb-1 block">Years of experience</label>
                  <input type="number" min="0" max="60" value={yearsExp}
                    onChange={e => setYearsExp(e.target.value)}
                    className="field w-full" placeholder="e.g. 12" />
                </div>
                <div>
                  <label className="field-label mb-1 block">Bio</label>
                  <textarea value={bio} onChange={e => setBio(e.target.value)}
                    rows={4} className="field w-full resize-none"
                    placeholder="A short professional bio (3–5 lines)." />
                </div>
                <div>
                  <label className="field-label mb-1 block">IMDb URL</label>
                  <input type="url" name="imdb_url" value={imdb} onChange={e => setImdb(e.target.value)}
                    className="field w-full" placeholder="https://imdb.com/name/…" />
                </div>
                <div>
                  <label className="field-label mb-1 block">Website</label>
                  <input type="url" value={website} onChange={e => setWebsite(e.target.value)}
                    className="field w-full" placeholder="https://…" />
                </div>
                <div>
                  <label className="field-label mb-1 block">LinkedIn URL</label>
                  <input type="url" name="linkedin_url" value={linkedin} onChange={e => setLinkedin(e.target.value)}
                    className="field w-full" placeholder="https://linkedin.com/in/…" />
                </div>
              </div>
            )}

            {/* ── INTERESTS section ── */}
            {editSection === "interests" && (
              <div className="p-6 space-y-7">
                <div>
                  <p className="field-label mb-2">Genres</p>
                  <div className="flex flex-wrap gap-1.5">
                    {GENRES.map(g => (
                      <button key={g} type="button" onClick={() => setGenres(toggle(genres, g))}
                        className={`px-3 py-1.5 rounded-full text-[11px] tracking-[0.06em] border transition-all ${
                          genres.includes(g) ? "bg-ink border-ink text-ivory" : "bg-white border-line text-ash hover:border-ink/40"
                        }`}>{g}</button>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="field-label mb-2">Formats</p>
                  <div className="flex flex-wrap gap-1.5">
                    {FORMATS.map(f => (
                      <button key={f} type="button" onClick={() => setFormats(toggle(formats, f))}
                        className={`px-3 py-1.5 rounded-full text-[11px] tracking-[0.06em] border transition-all ${
                          formats.includes(f) ? "bg-ink border-ink text-ivory" : "bg-white border-line text-ash hover:border-ink/40"
                        }`}>{f}</button>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="field-label mb-2">Looking for</p>
                  <div className="flex flex-wrap gap-1.5">
                    {LOOKING_FOR_OPTIONS.map(l => (
                      <button key={l} type="button" onClick={() => setLookingFor(toggle(lookingFor, l))}
                        className={`px-3 py-1.5 rounded-full text-[11px] tracking-[0.06em] border transition-all ${
                          lookingFor.includes(l)
                            ? "border-[#BF9953] text-[#8A6F3E]" + " bg-[#BF9953]/10"
                            : "bg-white border-line text-ash hover:border-[#BF9953]/40"
                        }`}>{l}</button>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="field-label mb-2">Languages</p>
                  {languages.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {languages.map(l => (
                        <span key={l} className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-parchment border border-line text-[11px] text-ink">
                          {l}
                          <button type="button" onClick={() => setLanguages(languages.filter(x => x !== l))}
                            className="text-ash hover:text-red-500 transition-colors text-[14px] leading-none">×</button>
                        </span>
                      ))}
                    </div>
                  )}
                  <select className="field w-full !text-[12px]" onChange={addLanguage} defaultValue="">
                    <option value="" disabled>+ Add language…</option>
                    {LANGUAGES.filter(l => !languages.includes(l)).map(l => (
                      <option key={l} value={l}>{l}</option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {/* ── INVESTMENT section ── */}
            {editSection === "investment" && (
              <div className="p-6 space-y-7">
                <div>
                  <p className="field-label mb-2">Project stage preference</p>
                  <div className="flex flex-wrap gap-1.5">
                    {STAGES.map(s => (
                      <button key={s.key} type="button" onClick={() => setStages(toggle(stages, s.key))}
                        className={`px-3 py-1.5 rounded-full text-[11px] tracking-[0.06em] border transition-all ${
                          stages.includes(s.key) ? "bg-ink border-ink text-ivory" : "bg-white border-line text-ash hover:border-ink/40"
                        }`}>{s.label}</button>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="field-label mb-2">Financing role</p>
                  <div className="flex flex-wrap gap-1.5">
                    {FUNDING_ROLES.map(r => (
                      <button key={r.key} type="button" onClick={() => setFundingRoles(toggle(fundingRoles, r.key))}
                        className={`px-3 py-1.5 rounded-full text-[11px] tracking-[0.06em] border transition-all ${
                          fundingRoles.includes(r.key) ? "bg-ink border-ink text-ivory" : "bg-white border-line text-ash hover:border-ink/40"
                        }`}>{r.label}</button>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="field-label mb-2">Budget range preference</p>
                  <div className="grid grid-cols-2 gap-2">
                    {BUDGET_RANGES.map(b => (
                      <button key={b.key} type="button" onClick={() => setBudget(budget === b.key ? "" : b.key)}
                        className={`px-3 py-3 rounded-card border text-left transition-all ${
                          budget === b.key ? "border-gold bg-gold/8" : "border-line bg-white hover:border-ink/20"
                        }`}>
                        <p className={`text-[12px] font-semibold ${budget === b.key ? "text-ink" : "text-ash"}`}>{b.label}</p>
                        <p className="text-[10px] text-ash/60 mt-0.5">{b.sub}</p>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* ── MARKETS section ── */}
            {editSection === "markets" && (
              <div className="p-6">
                <div className="flex items-baseline gap-2 mb-3">
                  <p className="field-label">Territories of interest</p>
                  {territories.length > 0 && (
                    <span className="text-[10px] text-gold font-medium">{territories.length} selected</span>
                  )}
                </div>
                <div className="border border-line rounded-card overflow-hidden bg-white text-[12px]">
                  {TERRITORY_GROUPS.map((tg, idx) => {
                    const isOpen = openGroups.has(tg.group);
                    const sel = tg.territories.filter(t => territories.includes(t)).length;
                    const all = sel === tg.territories.length;
                    return (
                      <div key={tg.group} className={idx < TERRITORY_GROUPS.length - 1 ? "border-b border-line" : ""}>
                        <div className="flex items-center gap-2 px-3 py-2.5 hover:bg-parchment/40">
                          <input type="checkbox" checked={all && tg.territories.length > 0}
                            onChange={() => toggleAllInGroup(tg.territories)}
                            onClick={e => e.stopPropagation()}
                            className="w-3 h-3 accent-[#BF9953] shrink-0" />
                          <button type="button" onClick={() => toggleGroup(tg.group)}
                            className="flex-1 flex items-center justify-between text-left">
                            <span className="font-medium text-ink text-[12px]">{tg.group}</span>
                            <span className="flex items-center gap-1.5 shrink-0">
                              {sel > 0 && <span className="text-[10px] text-gold font-medium">{sel}</span>}
                              <span className="text-[9px] text-ash">{isOpen ? "▲" : "▼"}</span>
                            </span>
                          </button>
                        </div>
                        {isOpen && (
                          <div className="border-t border-line/40 bg-parchment/20 px-5 py-1.5 grid gap-y-0.5">
                            {tg.territories.map(territory => (
                              <label key={territory} className="flex items-center gap-2 py-0.5 cursor-pointer">
                                <input type="checkbox" checked={territories.includes(territory)}
                                  onChange={() => setTerritories(toggle(territories, territory))}
                                  className="w-3 h-3 accent-[#BF9953] shrink-0" />
                                <span className="text-[11px] text-ash hover:text-ink">{territory}</span>
                              </label>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ── VISIBILITY section ── */}
            {editSection === "visibility" && (
              <div className="p-6 space-y-5">
                {/* Listed toggle */}
                <button type="button" onClick={() => setIsPublic(!isPublic)}
                  className={`w-full text-left p-5 rounded-card border-2 transition-all ${
                    isPublic ? "border-gold bg-gold/5" : "border-line bg-white hover:border-ink/20"
                  }`}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[13px] font-semibold text-ink mb-1">
                        Listed in Producer Network
                      </p>
                      <p className="text-[12px] text-ash leading-relaxed">
                        Filmmakers see your profile in their project intelligence report when your interests match their project.
                      </p>
                    </div>
                    <div className={`shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                      isPublic ? "bg-gold border-gold" : "border-line"
                    }`}>
                      {isPublic && <span className="text-white text-[10px]">✓</span>}
                    </div>
                  </div>
                </button>

                {/* Accepting pitches */}
                <div>
                  <p className="field-label mb-2">Submission status</p>
                  <div className="flex gap-2">
                    {[true, false].map(val => (
                      <button key={String(val)} type="button" onClick={() => setAccepting(val)}
                        className={`flex-1 py-2.5 rounded-card border text-[12px] font-medium transition-all ${
                          acceptingPitches === val ? "bg-ink border-ink text-ivory" : "bg-white border-line text-ash hover:border-ink/30"
                        }`}>
                        {val ? "Accepting pitches" : "Not accepting"}
                      </button>
                    ))}
                  </div>
                </div>

              </div>

              {/* ── Danger zone — only shown in Settings tab ── */}
              {editSection === "visibility" && (
                <div className="px-6 pt-4 pb-6 border-t border-line mt-2">
                  <p className="text-[9px] tracking-[0.26em] uppercase font-semibold text-ash/40 mb-3">Danger zone</p>
                  <p className="text-[12px] text-ash mb-3 leading-relaxed">
                    Permanently delete your account and all associated data.
                  </p>
                  <DeleteAccountModal />
                </div>
              )}

            {/* Save footer */}
            <div className="sticky bottom-0 border-t border-line bg-ivory px-6 py-4 flex items-center gap-3">
              <button type="submit" disabled={pending}
                className="btn-gold !py-2.5 flex-1 text-[12px] tracking-[0.14em] disabled:opacity-60">
                {pending ? "Saving…" : "Save profile"}
              </button>
              {saved && (
                <span className="text-[12px] text-emerald-600 font-medium">✓ Saved</span>
              )}
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
