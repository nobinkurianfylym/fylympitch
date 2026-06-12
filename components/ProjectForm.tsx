"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { createProject } from "@/lib/actions";

const GENRES = ["Drama", "Comedy", "Thriller", "Horror", "Romance", "Action", "Documentary", "Family", "Crime", "Sci-Fi", "Fantasy", "Musical"];

export default function ProjectForm() {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState<string | null>(null);
  const [deckPath, setDeckPath] = useState("");
  const [scriptPath, setScriptPath] = useState("");

  async function uploadFile(file: File, bucket: "pitch-decks" | "scripts"): Promise<string | null> {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setError("Your session expired — sign in again."); return null; }
    if (file.size > 25 * 1024 * 1024) { setError("Files must be under 25 MB."); return null; }
    const path = `${user.id}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9_.-]/g, "_")}`;
    const { error } = await supabase.storage.from(bucket).upload(path, file);
    if (error) { setError(`Upload failed: ${error.message}`); return null; }
    return path;
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>, bucket: "pitch-decks" | "scripts") {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setUploading(bucket);
    const path = await uploadFile(file, bucket);
    if (path) (bucket === "pitch-decks" ? setDeckPath : setScriptPath)(path);
    setUploading(null);
  }

  async function action(formData: FormData) {
    setBusy(true);
    setError(null);
    const result = await createProject(formData);
    if (result?.error) { setError(result.error); setBusy(false); }
    // success path redirects server-side
  }

  return (
    <form action={action} className="space-y-7 max-w-2xl">
      <input type="hidden" name="pitch_deck_path" value={deckPath} />
      <input type="hidden" name="script_path" value={scriptPath} />

      <div>
        <label className="field-label" htmlFor="title">Title *</label>
        <input id="title" name="title" className="field" required maxLength={200} />
      </div>

      <div className="grid sm:grid-cols-2 gap-5">
        <div>
          <label className="field-label" htmlFor="genre">Genre *</label>
          <select id="genre" name="genre" className="field" required defaultValue="Drama">
            {GENRES.map((g) => <option key={g}>{g}</option>)}
          </select>
        </div>
        <div>
          <label className="field-label" htmlFor="format">Format *</label>
          <select id="format" name="format" className="field" defaultValue="feature">
            <option value="feature">Feature</option>
            <option value="short">Short</option>
            <option value="documentary">Documentary</option>
            <option value="series">Series</option>
            <option value="animation">Animation</option>
          </select>
        </div>
        <div>
          <label className="field-label" htmlFor="language">Language *</label>
          <input id="language" name="language" className="field" defaultValue="Malayalam" required />
        </div>
        <div>
          <label className="field-label" htmlFor="country">Country of production *</label>
          <input id="country" name="country" className="field" defaultValue="India" required />
        </div>
        <div>
          <label className="field-label" htmlFor="budget_usd">Total budget (USD)</label>
          <input id="budget_usd" name="budget_usd" type="number" min="0" step="1000" className="field" placeholder="400000" />
        </div>
        <div>
          <label className="field-label" htmlFor="funding_needed_usd">Funding still needed (USD)</label>
          <input id="funding_needed_usd" name="funding_needed_usd" type="number" min="0" step="1000" className="field" placeholder="150000" />
        </div>
        <div>
          <label className="field-label" htmlFor="stage">Stage *</label>
          <select id="stage" name="stage" className="field" defaultValue="development">
            <option value="development">Development</option>
            <option value="pre_production">Pre-Production</option>
            <option value="production">Production</option>
            <option value="post_production">Post-Production</option>
            <option value="completed">Completed</option>
          </select>
        </div>
      </div>

      <div>
        <label className="field-label" htmlFor="logline">Logline * <span className="normal-case tracking-normal">(max 500 characters)</span></label>
        <textarea id="logline" name="logline" className="field" rows={2} required maxLength={500} />
      </div>
      <div>
        <label className="field-label" htmlFor="synopsis">Synopsis</label>
        <textarea id="synopsis" name="synopsis" className="field" rows={5} />
      </div>
      <div>
        <label className="field-label" htmlFor="director_statement">Director's statement</label>
        <textarea id="director_statement" name="director_statement" className="field" rows={4} />
      </div>
      <div>
        <label className="field-label" htmlFor="producer_info">Producer information</label>
        <textarea id="producer_info" name="producer_info" className="field" rows={3} placeholder="Attached producers, production company, prior credits" />
      </div>

      <div className="grid sm:grid-cols-2 gap-5">
        <div>
          <label className="field-label" htmlFor="deck">Pitch deck (PDF)</label>
          <input id="deck" type="file" accept=".pdf" className="field !py-2.5 text-[13px]"
            onChange={(e) => handleFile(e, "pitch-decks")} />
          {uploading === "pitch-decks" && <p className="mt-2 text-[12px] text-ash">Uploading…</p>}
          {deckPath && <p className="mt-2 text-[12px] text-[#8A6F3E]">Deck uploaded ✓</p>}
        </div>
        <div>
          <label className="field-label" htmlFor="script">Script (PDF)</label>
          <input id="script" type="file" accept=".pdf" className="field !py-2.5 text-[13px]"
            onChange={(e) => handleFile(e, "scripts")} />
          {uploading === "scripts" && <p className="mt-2 text-[12px] text-ash">Uploading…</p>}
          {scriptPath && <p className="mt-2 text-[12px] text-[#8A6F3E]">Script uploaded ✓</p>}
        </div>
      </div>

      <label className="flex items-center gap-3 text-[14px]">
        <input type="checkbox" name="is_public" defaultChecked className="accent-[#C9A96E] h-4 w-4" />
        Visible to verified producers and investors
      </label>

      {error && <p className="text-[13px] text-red-700 border border-red-200 bg-red-50 rounded-card px-4 py-3">{error}</p>}

      <button type="submit" disabled={busy || uploading !== null} className="btn-gold disabled:opacity-50">
        {busy ? "Creating…" : "Create project & compute matches"}
      </button>
    </form>
  );
}
