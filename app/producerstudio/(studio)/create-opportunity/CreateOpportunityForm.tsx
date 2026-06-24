"use client";

import { useState, useTransition, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { createProducerOpportunity } from "@/lib/actions";

// ── Constants ─────────────────────────────────────────────────────────────────

const OPP_TYPES = [
  // Production
  { value: "producer",           label: "Producer" },
  { value: "co_producer",        label: "Co-Producer" },
  { value: "production_company", label: "Production Company" },
  // Development
  { value: "lab",                label: "Lab / Script Lab" },
  { value: "grant",              label: "Development Grant" },
  { value: "fund",               label: "Development Fund" },
  { value: "mentorship",         label: "Mentorship" },
  { value: "writing_fellowship", label: "Writing Fellowship" },
  // Packaging & Markets
  { value: "pitch_forum",        label: "Pitch Forum" },
  { value: "co_production",      label: "Co-Production" },
  // Financing
  { value: "investor",           label: "Equity Investor" },
  { value: "angel_investor",     label: "Angel Investor" },
  { value: "gap_financing",      label: "Gap Financing" },
  { value: "seed_funding",       label: "Seed Funding" },
  { value: "private_fund",       label: "Private Fund" },
  // Sales / Distribution
  { value: "sales_agent",        label: "Sales Agent" },
  { value: "content_buyer",      label: "Content Buyer" },
  { value: "pre_sale",           label: "Pre-Sale" },
  { value: "streamer",           label: "Streaming Platform" },
  { value: "broadcaster",        label: "Broadcaster" },
  { value: "distribution",       label: "Distribution Deal" },
  // Post Production
  { value: "finishing_fund",     label: "Finishing Fund" },
  { value: "post_production_fund", label: "Post-Production Fund" },
];

const GENRES = [
  "Drama", "Documentary", "Thriller", "Horror", "Comedy",
  "Animation", "Sci-Fi", "World Cinema", "Romance", "Action",
  "Experimental", "Biography", "Historical",
];

const FORMATS = ["Feature", "Short", "Series", "Documentary", "Animation"];

const STAGES = [
  { key: "development",    label: "Development" },
  { key: "pre_production", label: "Pre-Production" },
  { key: "production",     label: "Production" },
  { key: "post_production",label: "Post-Production" },
  { key: "finished",       label: "Finished" },
];

// ── Chip toggle helper ────────────────────────────────────────────────────────

function ChipGroup({
  label, options, selected, onChange,
}: {
  label: string;
  options: { key: string; label: string }[];
  selected: string[];
  onChange: (vals: string[]) => void;
}) {
  function toggle(key: string) {
    onChange(selected.includes(key) ? selected.filter((v) => v !== key) : [...selected, key]);
  }
  return (
    <div>
      <label className="text-[11px] tracking-[0.18em] uppercase text-ash mb-3 block">{label}</label>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => (
          <button
            key={o.key}
            type="button"
            onClick={() => toggle(o.key)}
            className={`px-3 py-1.5 text-[12px] tracking-[0.12em] uppercase border transition-all rounded-sm ${
              selected.includes(o.key)
                ? "border-gold bg-gold/10 text-gold"
                : "border-line text-ash hover:border-ink hover:text-ink"
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Poster uploader ───────────────────────────────────────────────────────────

function PosterUpload({
  userId,
  value,
  onChange,
}: {
  userId: string;
  value: string | null;
  onChange: (url: string | null) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { setError("Max 5MB"); return; }
    setError(null);
    setUploading(true);
    try {
      const supabase = createClient();
      const ext  = file.name.split(".").pop() ?? "jpg";
      const path = `${userId}/opp-${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from("opportunity-posters")
        .upload(path, file, { upsert: true, contentType: file.type });
      if (uploadError) { setError("Upload failed"); return; }
      const { data } = supabase.storage.from("opportunity-posters").getPublicUrl(path);
      onChange(data.publicUrl);
    } catch { setError("Upload failed"); }
    finally { setUploading(false); }
  }

  return (
    <div>
      <label className="text-[11px] tracking-[0.18em] uppercase text-ash mb-3 block">
        Poster / Cover Image <span className="normal-case text-[11px] text-ash/60">(optional · max 5MB)</span>
      </label>

      <div
        onClick={() => inputRef.current?.click()}
        className={`relative cursor-pointer border border-dashed border-line hover:border-gold transition-colors rounded-sm overflow-hidden ${
          value ? "w-[160px] h-[220px]" : "w-full h-[120px] flex items-center justify-center"
        }`}
      >
        {value ? (
          <img src={value} alt="Poster" className="w-full h-full object-cover" />
        ) : (
          <div className="text-center">
            <div className="text-[22px] text-ash/40 mb-1">＋</div>
            <p className="text-[11px] tracking-[0.14em] uppercase text-ash">
              {uploading ? "Uploading…" : "Attach poster"}
            </p>
          </div>
        )}
        {uploading && (
          <div className="absolute inset-0 bg-ivory/80 flex items-center justify-center">
            <span className="text-[11px] tracking-[0.14em] uppercase text-ash">Uploading…</span>
          </div>
        )}
      </div>

      {value && (
        <button
          type="button"
          onClick={() => onChange(null)}
          className="mt-2 text-[11px] tracking-[0.12em] uppercase text-ash hover:text-gold transition-colors"
        >
          Remove
        </button>
      )}
      {error && <p className="mt-1 text-[12px] text-red-500">{error}</p>}
      <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleFile} />
    </div>
  );
}

// ── Main form ─────────────────────────────────────────────────────────────────

export default function CreateOpportunityForm({ userId }: { userId: string }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Controlled state
  const [genres,  setGenres]  = useState<string[]>([]);
  const [formats, setFormats] = useState<string[]>([]);
  const [stages,  setStages]  = useState<string[]>([]);
  const [posterUrl, setPosterUrl] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    // Inject multi-select values (chips)
    genres.forEach((g)  => fd.append("genres",  g));
    formats.forEach((f) => fd.append("formats", f));
    stages.forEach((s)  => fd.append("stages",  s));
    if (posterUrl) fd.set("poster_url", posterUrl);

    startTransition(async () => {
      const result = await createProducerOpportunity(fd);
      if (result?.error) setError(result.error);
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-10">

      {/* ── Title ── */}
      <div>
        <label htmlFor="title" className="text-[11px] tracking-[0.18em] uppercase text-ash mb-2 block">
          Opportunity Title <span className="text-gold">*</span>
        </label>
        <input
          id="title"
          name="title"
          required
          placeholder="e.g. Looking for a Feature Documentary"
          className="w-full bg-transparent border border-line rounded-sm px-4 py-3 text-[15px] text-ink placeholder:text-ash/40 focus:outline-none focus:border-gold transition-colors"
        />
      </div>

      {/* ── What we're looking for ── */}
      <div>
        <label htmlFor="description" className="text-[11px] tracking-[0.18em] uppercase text-ash mb-2 block">
          What You're Looking For <span className="text-gold">*</span>
        </label>
        <textarea
          id="description"
          name="description"
          required
          rows={5}
          placeholder="Describe the project, story, or filmmaker profile you're seeking. Be specific — filmmakers will read this carefully before submitting."
          className="w-full bg-transparent border border-line rounded-sm px-4 py-3 text-[15px] text-ink placeholder:text-ash/40 focus:outline-none focus:border-gold transition-colors resize-none"
        />
        <p className="mt-1.5 text-[11px] text-ash/60">This is your brief. Make it clear, specific, and compelling.</p>
      </div>

      {/* ── Type + Deadline row ── */}
      <div className="grid sm:grid-cols-2 gap-6">
        <div>
          <label htmlFor="opp_type" className="text-[11px] tracking-[0.18em] uppercase text-ash mb-2 block">
            Opportunity Type
          </label>
          <select
            id="opp_type"
            name="opp_type"
            defaultValue="producer"
            className="w-full bg-ivory border border-line rounded-sm px-4 py-3 text-[14px] text-ink focus:outline-none focus:border-gold transition-colors"
          >
            {OPP_TYPES.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="deadline" className="text-[11px] tracking-[0.18em] uppercase text-ash mb-2 block">
            Submission Deadline
          </label>
          <input
            id="deadline"
            name="deadline"
            type="date"
            className="w-full bg-transparent border border-line rounded-sm px-4 py-3 text-[14px] text-ink focus:outline-none focus:border-gold transition-colors"
          />
        </div>
      </div>

      {/* ── Country + Region row ── */}
      <div className="grid sm:grid-cols-2 gap-6">
        <div>
          <label htmlFor="country" className="text-[11px] tracking-[0.18em] uppercase text-ash mb-2 block">
            Country Focus
          </label>
          <input
            id="country"
            name="country"
            placeholder="e.g. Australia, UK — or leave blank for worldwide"
            className="w-full bg-transparent border border-line rounded-sm px-4 py-3 text-[14px] text-ink placeholder:text-ash/40 focus:outline-none focus:border-gold transition-colors"
          />
        </div>
        <div>
          <label htmlFor="region" className="text-[11px] tracking-[0.18em] uppercase text-ash mb-2 block">
            Region
          </label>
          <input
            id="region"
            name="region"
            placeholder="e.g. Asia-Pacific, Europe"
            className="w-full bg-transparent border border-line rounded-sm px-4 py-3 text-[14px] text-ink placeholder:text-ash/40 focus:outline-none focus:border-gold transition-colors"
          />
        </div>
      </div>

      {/* ── Max award ── */}
      <div>
        <label htmlFor="max_award" className="text-[11px] tracking-[0.18em] uppercase text-ash mb-2 block">
          Maximum Award / Investment (USD)
        </label>
        <input
          id="max_award"
          name="max_award"
          type="number"
          min={0}
          step={1000}
          placeholder="e.g. 500000"
          className="w-full bg-transparent border border-line rounded-sm px-4 py-3 text-[14px] text-ink placeholder:text-ash/40 focus:outline-none focus:border-gold transition-colors"
        />
      </div>

      {/* ── Website ── */}
      <div>
        <label htmlFor="url" className="text-[11px] tracking-[0.18em] uppercase text-ash mb-2 block">
          Website / More Info URL
        </label>
        <input
          id="url"
          name="url"
          type="url"
          placeholder="https://"
          className="w-full bg-transparent border border-line rounded-sm px-4 py-3 text-[14px] text-ink placeholder:text-ash/40 focus:outline-none focus:border-gold transition-colors"
        />
      </div>

      {/* ── Multi-select chips ── */}
      <ChipGroup
        label="Genres"
        options={GENRES.map((g) => ({ key: g, label: g }))}
        selected={genres}
        onChange={setGenres}
      />

      <ChipGroup
        label="Formats"
        options={FORMATS.map((f) => ({ key: f, label: f }))}
        selected={formats}
        onChange={setFormats}
      />

      <ChipGroup
        label="Project Stages"
        options={STAGES}
        selected={stages}
        onChange={setStages}
      />

      {/* ── Poster ── */}
      <PosterUpload userId={userId} value={posterUrl} onChange={setPosterUrl} />

      {/* ── Error + Submit ── */}
      {error && (
        <p className="text-[13px] text-red-500 bg-red-50 border border-red-100 rounded-sm px-4 py-3">
          {error}
        </p>
      )}

      <div className="pt-2">
        <button
          type="submit"
          disabled={isPending}
          className="btn-gold min-w-[200px] disabled:opacity-50"
        >
          {isPending ? "Publishing…" : "Publish Opportunity →"}
        </button>
        <p className="mt-3 text-[11px] text-ash/60">
          Your opportunity will go live immediately on the public Opportunities page.
          Filmmakers who submit will send their project to you as an exclusive pitch.
        </p>
      </div>
    </form>
  );
}
