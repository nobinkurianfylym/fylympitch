"use client";

import { useState } from "react";
import { saveProducerProfile } from "@/lib/actions";

const ROLE_TYPES = [
  { key: "independent_producer", label: "Independent Producer" },
  { key: "studio_exec",          label: "Studio Executive" },
  { key: "sales_agent",          label: "Sales Agent" },
  { key: "distributor",          label: "Distributor" },
  { key: "ep",                   label: "Executive Producer" },
  { key: "coproduction_partner", label: "Co-Production Partner" },
];

const GENRES = [
  "Drama", "Documentary", "Thriller", "Horror", "Comedy",
  "Animation", "Sci-Fi", "World Cinema", "Romance", "Action",
  "Experimental", "Short Film",
];

const FORMATS = ["Feature", "Short", "Series", "Documentary"];

const BUDGET_RANGES = [
  { key: "micro", label: "Micro", sub: "< $100K" },
  { key: "low",   label: "Low",   sub: "$100K – $500K" },
  { key: "mid",   label: "Mid",   sub: "$500K – $2M" },
  { key: "high",  label: "High",  sub: "$2M+" },
];

const FESTIVALS = [
  "Cannes", "Berlin", "Venice", "Sundance", "TIFF",
  "Rotterdam", "Tribeca", "IFFR", "Hot Docs",
];

const COUNTRIES = [
  "India","United States","United Kingdom","France","Germany",
  "Italy","Spain","Japan","South Korea","Brazil","Mexico",
  "Australia","Canada","Nigeria","Kenya","Egypt","Iran",
  "Indonesia","Philippines","Argentina","Poland","Sweden",
  "Denmark","Norway","Netherlands","Belgium","Switzerland",
  "South Africa","Turkey","China","Hong Kong","Taiwan",
];

export default function ProducerOnboardingPage() {
  const [roleType, setRoleType]   = useState("");
  const [country, setCountry]     = useState("");
  const [genres, setGenres]       = useState<string[]>([]);
  const [formats, setFormats]     = useState<string[]>([]);
  const [budget, setBudget]       = useState("");
  const [festivals, setFestivals] = useState<string[]>([]);
  const [territories, setTerritories] = useState<string[]>([]);
  const [coproduction, setCoproduction] = useState(false);
  const [attachEP, setAttachEP]   = useState(false);
  const [bringFunding, setBringFunding] = useState(false);
  const [isPublic, setIsPublic]   = useState(false);
  const [imdb, setImdb]           = useState("");

  function toggle<T>(arr: T[], val: T): T[] {
    return arr.includes(val) ? arr.filter((x) => x !== val) : [...arr, val];
  }

  return (
    <div className="min-h-screen bg-ivory flex items-start justify-center py-16 px-4">
      <div className="w-full max-w-2xl">

        {/* Header */}
        <p className="eyebrow mb-3">Producer Studio</p>
        <h1 className="font-display text-[36px] mb-2">Tell us who you are.</h1>
        <p className="text-ash text-[15px] mb-10">30 seconds. Tick what applies. We'll surface projects matched to your taste.</p>

        <form action={saveProducerProfile} className="space-y-10">

          {/* Hidden toggle fields */}
          <input type="hidden" name="open_to_coproduction" value={coproduction ? "true" : "false"} />
          <input type="hidden" name="open_to_ep" value={attachEP ? "true" : "false"} />
          <input type="hidden" name="bringing_territory_funding" value={bringFunding ? "true" : "false"} />
          <input type="hidden" name="is_public" value={isPublic ? "true" : "false"} />

          {/* 1. Country + IMDb */}
          <section>
            <p className="text-[11px] tracking-[0.22em] uppercase text-ash mb-4">Where are you based?</p>
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <select
                  name="country"
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  required
                  className="field w-full"
                >
                  <option value="">Select country</option>
                  {COUNTRIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <input
                  type="url"
                  name="imdb_url"
                  value={imdb}
                  onChange={(e) => setImdb(e.target.value)}
                  placeholder="IMDb URL (optional)"
                  className="field w-full"
                />
              </div>
            </div>
          </section>

          {/* 2. Role type */}
          <section>
            <p className="text-[11px] tracking-[0.22em] uppercase text-ash mb-4">Your role</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {ROLE_TYPES.map((r) => (
                <button
                  key={r.key}
                  type="button"
                  onClick={() => setRoleType(r.key)}
                  className={`text-left px-4 py-3 rounded-card border text-[13px] transition-all
                    ${roleType === r.key
                      ? "border-gold bg-gold/10 text-ink font-medium"
                      : "border-line bg-white text-ash hover:border-ink/30 hover:text-ink"
                    }`}
                >
                  {r.label}
                </button>
              ))}
            </div>
            <input type="hidden" name="role_type" value={roleType || "independent_producer"} />
          </section>

          {/* 3. Genres */}
          <section>
            <p className="text-[11px] tracking-[0.22em] uppercase text-ash mb-4">What excites you? <span className="normal-case font-normal">(tick all that apply)</span></p>
            <div className="flex flex-wrap gap-2">
              {GENRES.map((g) => (
                <button
                  key={g}
                  type="button"
                  onClick={() => setGenres(toggle(genres, g))}
                  className={`px-4 py-2 rounded-full text-[12px] tracking-[0.1em] border transition-all
                    ${genres.includes(g)
                      ? "bg-ink text-ivory border-ink"
                      : "bg-white border-line text-ash hover:border-ink/40 hover:text-ink"
                    }`}
                >
                  {g}
                </button>
              ))}
            </div>
            {genres.map((g) => <input key={g} type="hidden" name="genres" value={g} />)}
          </section>

          {/* 4. Format */}
          <section>
            <p className="text-[11px] tracking-[0.22em] uppercase text-ash mb-4">Preferred format</p>
            <div className="flex flex-wrap gap-3">
              {FORMATS.map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFormats(toggle(formats, f))}
                  className={`px-5 py-2.5 rounded-full text-[13px] border transition-all
                    ${formats.includes(f)
                      ? "bg-ink text-ivory border-ink"
                      : "bg-white border-line text-ash hover:border-ink/40 hover:text-ink"
                    }`}
                >
                  {f}
                </button>
              ))}
            </div>
            {formats.map((f) => <input key={f} type="hidden" name="formats" value={f} />)}
          </section>

          {/* 5. Budget range */}
          <section>
            <p className="text-[11px] tracking-[0.22em] uppercase text-ash mb-4">Budget range you typically engage</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {BUDGET_RANGES.map((b) => (
                <button
                  key={b.key}
                  type="button"
                  onClick={() => setBudget(budget === b.key ? "" : b.key)}
                  className={`px-4 py-3 rounded-card border text-left transition-all
                    ${budget === b.key
                      ? "border-gold bg-gold/10"
                      : "border-line bg-white hover:border-ink/30"
                    }`}
                >
                  <p className={`text-[13px] font-medium ${budget === b.key ? "text-ink" : "text-ash"}`}>{b.label}</p>
                  <p className="text-[11px] text-ash mt-0.5">{b.sub}</p>
                </button>
              ))}
            </div>
            <input type="hidden" name="budget_range" value={budget} />
          </section>

          {/* 6. Territories you're interested in */}
          <section>
            <p className="text-[11px] tracking-[0.22em] uppercase text-ash mb-4">Territories of interest <span className="normal-case font-normal">(tick all)</span></p>
            <div className="flex flex-wrap gap-2">
              {COUNTRIES.slice(0, 20).map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setTerritories(toggle(territories, c))}
                  className={`px-3 py-1.5 rounded-full text-[11px] tracking-[0.08em] border transition-all
                    ${territories.includes(c)
                      ? "bg-ink text-ivory border-ink"
                      : "bg-white border-line text-ash hover:border-ink/40 hover:text-ink"
                    }`}
                >
                  {c}
                </button>
              ))}
            </div>
            {territories.map((t) => <input key={t} type="hidden" name="territories" value={t} />)}
          </section>

          {/* 7. Festivals */}
          <section>
            <p className="text-[11px] tracking-[0.22em] uppercase text-ash mb-4">Festivals you're active in</p>
            <div className="flex flex-wrap gap-2">
              {FESTIVALS.map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFestivals(toggle(festivals, f))}
                  className={`px-4 py-2 rounded-full text-[12px] border transition-all
                    ${festivals.includes(f)
                      ? "bg-ink text-ivory border-ink"
                      : "bg-white border-line text-ash hover:border-ink/40 hover:text-ink"
                    }`}
                >
                  {f}
                </button>
              ))}
            </div>
            {festivals.map((f) => <input key={f} type="hidden" name="festivals" value={f} />)}
          </section>

          {/* 8. What you bring */}
          <section>
            <p className="text-[11px] tracking-[0.22em] uppercase text-ash mb-4">What do you bring?</p>
            <div className="flex flex-wrap gap-3">
              {[
                { key: "coproduction", label: "Open to co-production", active: coproduction, set: setCoproduction },
                { key: "ep",          label: "Can attach as EP",       active: attachEP,     set: setAttachEP },
                { key: "funding",     label: "Bringing territory funding", active: bringFunding, set: setBringFunding },
              ].map((item) => (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => item.set(!item.active)}
                  className={`px-5 py-2.5 rounded-full text-[13px] border transition-all
                    ${item.active
                      ? "bg-gold text-white border-gold"
                      : "bg-white border-line text-ash hover:border-gold/50 hover:text-ink"
                    }`}
                >
                  {item.active && <span className="mr-1.5">✓</span>}
                  {item.label}
                </button>
              ))}
            </div>
          </section>

          {/* 9. Be found by filmmakers */}
          <section>
            <button
              type="button"
              onClick={() => setIsPublic(!isPublic)}
              className={`w-full text-left p-6 rounded-card border-2 transition-all
                ${isPublic
                  ? "border-gold bg-gold/5"
                  : "border-line bg-white hover:border-ink/20"
                }`}
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[15px] font-medium text-ink mb-1">
                    Add me to FYLYMPITCH's producer network
                  </p>
                  <p className="text-[13px] text-ash leading-relaxed">
                    Filmmakers whose projects match your interests will see your profile in their FYLYMPITCH Intelligence report. You'll receive an email when someone requests an introduction.
                  </p>
                </div>
                <div className={`shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all
                  ${isPublic ? "bg-gold border-gold" : "border-line"}`}>
                  {isPublic && <span className="text-white text-[12px]">✓</span>}
                </div>
              </div>
            </button>
          </section>

          {/* Submit */}
          <div className="pt-2 pb-8">
            <button type="submit" className="btn-gold w-full py-4 text-[14px] tracking-[0.16em]">
              Enter Producer Studio →
            </button>
          </div>

        </form>
      </div>
    </div>
  );
}
