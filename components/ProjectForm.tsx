"use client";

import { useState, useEffect, useTransition } from "react";
import { flushSync } from "react-dom";
import { createClient } from "@/lib/supabase/client";
import { createProject } from "@/lib/actions";

const GENRES = ["Drama","Comedy","Thriller","Horror","Romance","Action","Documentary","Family","Crime","Sci-Fi","Fantasy","Musical"];

// ── Engine loader ─────────────────────────────────────────────────────────────

const ENGINE_STEPS: { label: string; duration: number }[] = [
  { label: "Saving your project",                              duration: 400   },
  { label: "Loading active opportunities",                     duration: 700   },
  { label: "Scoring matches across funds, grants and labs",    duration: 1200  },
  { label: "Calculating your funding readiness score",         duration: 900   },
  { label: "Mapping funding sources for your budget",          duration: 900   },
  { label: "Identifying financing obstacles",                  duration: 800   },
  { label: "Building your roadmap to production",              duration: 800   },
  { label: "Matching producers and investors",                 duration: 700   },
  { label: "Generating your Executive Producer brief",         duration: 5000  },
  { label: "Finalising your intelligence report",              duration: 99999 },
];

function BlinkingDots() {
  const [dots, setDots] = useState(1);
  useEffect(() => {
    const id = setInterval(() => setDots((d) => (d % 3) + 1), 450);
    return () => clearInterval(id);
  }, []);
  return <span className="text-ash" style={{ fontWeight: 400 }}>{"•".repeat(dots)}</span>;
}

function EngineLoader({ step }: { step: number }) {
  const progress = Math.min(96, Math.round((step / (ENGINE_STEPS.length - 1)) * 100));
  const activeLabel = ENGINE_STEPS[Math.min(step, ENGINE_STEPS.length - 1)]?.label ?? "Processing…";
  return (
    <div className="py-10 max-w-2xl">
      <div className="flex items-center gap-4 mb-4">
        <div className="h-[2px] flex-1 bg-line rounded-full overflow-hidden">
          <div className="h-full bg-gold rounded-full transition-all duration-700"
            style={{ width: `${progress}%` }} />
        </div>
        <span className="text-[11px] tracking-[0.15em] uppercase text-gold shrink-0 font-medium">
          {progress}%
        </span>
      </div>
      <p className="text-[13px] text-ash">
        <span className="text-gold font-medium">PITCH.FYLYM ENGINE</span>
        {" · "}{activeLabel}<BlinkingDots />
      </p>
    </div>
  );
}

// ── AI analysing state ────────────────────────────────────────────────────────

function AiLoader() {
  const steps = [
    "Reading your pitch deck",
    "Extracting project details",
    "Identifying genre and format",
    "Pulling budget and funding data",
    "Writing logline and synopsis",
  ];
  const [step, setStep] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setStep((s) => Math.min(s + 1, steps.length - 1)), 1800);
    return () => clearInterval(id);
  }, []);
  return (
    <div className="mt-4 rounded-card border border-gold/30 bg-gold/5 px-5 py-4">
      <div className="flex items-center gap-3 mb-3">
        <span className="text-gold text-[13px] tracking-[0.12em] uppercase font-medium">PITCH.FYLYM AI</span>
        <span className="text-ash text-[12px]">Analysing your pitch deck</span>
      </div>
      <div className="space-y-2">
        {steps.map((s, i) => (
          <div key={s} className="flex items-center gap-2.5"
            style={{ opacity: i > step ? 0.3 : 1, transition: "opacity 0.5s" }}>
            <span className="text-[11px] w-3 text-center"
              style={{ color: i < step ? "#8A857C" : i === step ? "#BF9953" : "transparent" }}>
              {i < step ? "✓" : i === step ? "›" : "·"}
            </span>
            <span className="text-[12px]"
              style={{ color: i < step ? "#8A857C" : "#1A1815", fontWeight: i === step ? 500 : 400 }}>
              {s}{i === step && <BlinkingDots />}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}



type Fields = {
  title: string; genre: string; format: string; language: string; country: string;
  budget_usd: string; finance_secured_usd: string; funding_needed_usd: string; stage: string;
  logline: string; synopsis: string; director_statement: string; producer_info: string;
};
type AiFilled = Partial<Record<keyof Fields, boolean>>;

const DEFAULT_FIELDS: Fields = {
  title: "", genre: "Drama", format: "feature", language: "Malayalam",
  country: "India", budget_usd: "", finance_secured_usd: "", funding_needed_usd: "", stage: "development",
  logline: "", synopsis: "", director_statement: "", producer_info: "",
};

export default function ProjectForm() {
  const [fields, setFields]         = useState<Fields>(DEFAULT_FIELDS);
  const [aiFilled, setAiFilled]     = useState<AiFilled>({});
  const [aiLoading, setAiLoading]   = useState(false);
  const [aiError, setAiError]       = useState<string | null>(null);
  const [error, setError]           = useState<string | null>(null);
  const [busy, setBusy]             = useState(false);
  const [engineStep, setEngineStep] = useState(0);
  const [uploading, setUploading]   = useState<string | null>(null);
  const [deckPath, setDeckPath]     = useState("");
  const [scriptPath, setScriptPath] = useState("");
  const [posterPath, setPosterPath] = useState("");
  const [visibility, setVisibility] = useState<"true" | "false">("true");
  const [showAdvanced, setShowAdvanced] = useState(false);  // closed until AI fills OR user opens

  // useTransition — the correct Next.js pattern for server actions that call redirect()
  const [, startTransition] = useTransition();

  const set = (k: keyof Fields) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setFields((f) => ({ ...f, [k]: e.target.value }));
    setAiFilled((a) => ({ ...a, [k]: false }));
  };

  useEffect(() => {
    if (!busy) return;
    setEngineStep(0);
    let i = 0;
    let timer: ReturnType<typeof setTimeout>;
    const advance = () => {
      i++;
      if (i < ENGINE_STEPS.length) {
        setEngineStep(i);
        timer = setTimeout(advance, ENGINE_STEPS[i].duration);
      }
    };
    timer = setTimeout(advance, ENGINE_STEPS[0].duration);
    return () => clearTimeout(timer);
  }, [busy]);

  // ── Client-side PDF text extraction ──────────────────────────────────────
  // pdfjs-dist runs in the browser where canvas is always available.
  // This avoids the Cloudflare Workers canvas limitation that broke server-side PDF parsing.
  async function extractPDFText(file: File): Promise<string> {
    const pdfjsLib = await import("pdfjs-dist");
    // Load the PDF.js worker from CDN — avoids bundling a 1 MB worker file into the app
    pdfjsLib.GlobalWorkerOptions.workerSrc =
      `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({
      data: arrayBuffer,
      isEvalSupported: false,   // no eval — security
      disableFontFace: true,    // not rendering, skip font loading
      useWorkerFetch: false,    // worker fetches handled by CDN script above
    }).promise;

    const maxPages = Math.min(pdf.numPages, 10); // first 10 pages is plenty for a pitch deck
    const parts: string[] = [];

    for (let i = 1; i <= maxPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      const pageText = content.items
        .map((item) => ("str" in item ? (item as { str: string }).str : ""))
        .join(" ");
      parts.push(pageText);
    }

    return parts.join("\n\n").slice(0, 12000);
  }

  // ── Vision fallback for scanned / image-based PDFs ────────────────────────
  // Renders the first 5 pages to JPEG via canvas, sends to OpenAI vision.
  // gpt-4o-mini reads text from images natively — no OCR library needed.
  async function renderPDFPages(file: File): Promise<string[]> {
    const pdfjsLib = await import("pdfjs-dist");
    pdfjsLib.GlobalWorkerOptions.workerSrc =
      `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({
      data: arrayBuffer,
      isEvalSupported: false,
    }).promise;

    const maxPages = Math.min(pdf.numPages, 5); // 5 pages max for vision
    const images: string[] = [];

    for (let i = 1; i <= maxPages; i++) {
      const page = await pdf.getPage(i);
      const viewport = page.getViewport({ scale: 1.5 }); // 1.5x for legibility
      const canvas = document.createElement("canvas");
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const ctx = canvas.getContext("2d")!;
      await page.render({ canvasContext: ctx, viewport, canvas }).promise;
      // Convert to base64 JPEG (0.85 quality — sharp enough for OCR, small enough for API)
      images.push(canvas.toDataURL("image/jpeg", 0.85).split(",")[1]);
    }

    return images;
  }

  async function uploadFile(file: File, bucket: "pitch-decks" | "scripts"): Promise<string | null> {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setError("Session expired — sign in again."); return null; }
    if (file.size > 25 * 1024 * 1024) { setError("Files must be under 25 MB."); return null; }
    const path = `${user.id}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9_.-]/g, "_")}`;
    const { error } = await supabase.storage.from(bucket).upload(path, file);
    if (error) { setError(`Upload failed: ${error.message}`); return null; }
    return path;
  }

  async function uploadPoster(file: File): Promise<string | null> {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setError("Session expired — sign in again."); return null; }
    if (file.size > 10 * 1024 * 1024) { setError("Poster must be under 10 MB."); return null; }
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
    const path = `${user.id}/${Date.now()}-poster.${ext}`;
    const { error } = await supabase.storage.from("thumbnails").upload(path, file, { contentType: file.type });
    if (error) { setError(`Poster upload failed: ${error.message}`); return null; }
    return path;
  }

  async function handleDeck(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setAiError(null);
    setUploading("pitch-decks");
    setAiLoading(true);

    // Upload to storage + extract text in parallel
    const [path, text] = await Promise.all([
      uploadFile(file, "pitch-decks"),
      extractPDFText(file).catch(() => ""),
    ]);
    if (path) setDeckPath(path);
    setUploading(null);

    try {
      let body: Record<string, unknown>;

      if (text.trim()) {
        // Text-based PDF — fast path
        body = { text };
      } else {
        // Scanned / image-based PDF — render pages and send to vision API
        const images = await renderPDFPages(file).catch(() => [] as string[]);
        if (!images.length) {
          setAiError("Could not read this PDF — try exporting it as a text-based PDF.");
          setAiLoading(false);
          return;
        }
        body = { images };
      }

      const res = await fetch("/api/ai-extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        const data = await res.json();
        const filled: AiFilled = {};
        setFields((prev) => {
          const next = { ...prev };
          const keys: (keyof Fields)[] = [
            "title","genre","format","language","country",
            "budget_usd","finance_secured_usd","funding_needed_usd","stage",
            "logline","synopsis","director_statement","producer_info",
          ];
          for (const k of keys) {
            const val = data[k];
            if (val !== null && val !== undefined && val !== "") {
              next[k] = String(val);
              filled[k] = true;
            }
          }
          return next;
        });
        setAiFilled(filled);
        // Auto-expand advanced section when AI fills ANY fields (title/logline now live there)
        if (Object.values(filled).some(Boolean)) setShowAdvanced(true);
      } else {
        const err = await res.json().catch(() => ({}));
        setAiError(err.error ?? "AI extraction failed — fill the fields manually.");
      }
    } catch {
      setAiError("AI extraction failed — fill the fields manually.");
    }
    setAiLoading(false);
  }

  async function handleScript(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading("scripts");
    const path = await uploadFile(file, "scripts");
    if (path) setScriptPath(path);
    setUploading(null);
  }

  async function handlePoster(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading("thumbnails");
    const path = await uploadPoster(file);
    if (path) setPosterPath(path);
    setUploading(null);
  }

  // ── Submit ─────────────────────────────────────────────────────────────────
  // Uses useTransition so Next.js can intercept redirect() from the server action
  // and perform client-side navigation. A plain try/catch swallows NEXT_REDIRECT.

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (aiLoading || uploading) return;

    // Client-side validation — show clear error before showing engine loader
    if (!fields.title.trim()) {
      setError("Please enter a title for your project.");
      return;
    }
    if (!fields.logline.trim()) {
      setError("Please enter a logline. It's the one sentence that describes your film.");
      return;
    }

    // Capture formData while form is still mounted
    const formData = new FormData(e.currentTarget);

    // flushSync forces setBusy(true) to commit to the DOM synchronously
    // BEFORE startTransition starts the async server action.
    // Without this, React 19 may batch the render with the transition,
    // so the EngineLoader animation never gets a chance to appear.
    flushSync(() => {
      setError(null);
      setBusy(true);  // EngineLoader is now rendered and animating
    });

    // startTransition correctly handles redirect() from the server action.
    // A plain try/catch swallows NEXT_REDIRECT so navigation never fires.
    startTransition(async () => {
      const result = await createProject(formData);
      if (result?.error) {
        setError(result.error);
        setBusy(false);
        setEngineStep(0);
      }
      // On success: redirect("/dashboard") is intercepted by Next.js
      // inside startTransition → client navigation fires automatically.
    });
  }

  if (busy) return <EngineLoader step={engineStep} />;

  const label = (text: string) => <span>{text}</span>;

  return (
    <form onSubmit={handleSubmit} className="space-y-7 max-w-2xl">
      <input type="hidden" name="pitch_deck_path" value={deckPath} />
      <input type="hidden" name="script_path" value={scriptPath} />
      <input type="hidden" name="poster_path" value={posterPath} />

      {/* ── 1. PITCH DECK — first, triggers AI ── */}
      <div className="rounded-card border border-line bg-white/60 p-6 space-y-4">
        <div>
          <p className="eyebrow text-gold mb-1">Step 1</p>
          <h3 className="font-display text-[20px] leading-snug">Upload your pitch deck</h3>
          <p className="text-[13px] text-ash mt-1">
            Upload a PDF and PITCH.FYLYM AI will read it and fill the form for you.
            Review and edit anything before submitting.
          </p>
        </div>

        <div>
          <label className="field-label" htmlFor="deck">Pitch deck (PDF)</label>
          <input id="deck" type="file" accept=".pdf" className="field !py-2.5 text-[13px]" onChange={handleDeck} />
          {uploading === "pitch-decks" && <p className="mt-2 text-[12px] text-ash">Uploading…</p>}
          {deckPath && !aiLoading && <p className="mt-2 text-[12px] text-[#8A6F3E]">Deck uploaded ✓</p>}
        </div>

        {aiLoading && <AiLoader />}
        {aiError && (
          <p className="text-[12px] text-amber-700 bg-amber-50 border border-amber-200 rounded-card px-4 py-3">
            {aiError}
          </p>
        )}

      </div>

      {/* ── 2. TITLE + LOGLINE — always visible, required ── */}
      <div className="space-y-5">
        <div>
          <label className="field-label" htmlFor="title">Title *</label>
          <input id="title" name="title" className="field" required maxLength={200}
            value={fields.title} onChange={set("title")}
            placeholder="Your film title" />
        </div>
        <div>
          <label className="field-label" htmlFor="logline">
            Logline *{" "}
            <span className="normal-case tracking-normal font-normal">(one sentence, max 500 characters)</span>
          </label>
          <textarea id="logline" name="logline" className="field" rows={2} required maxLength={500}
            value={fields.logline} onChange={set("logline")}
            placeholder="A one-sentence description of your film." />
          <p className="mt-1 text-[11px] text-ash text-right">{fields.logline.length}/500</p>
        </div>
      </div>

      {/* ── ADVANCED TOGGLE ── */}
      <div className="border border-line rounded-card overflow-hidden">
        <button type="button"
          onClick={() => setShowAdvanced((v) => !v)}
          className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-parchment/40 transition-colors">
          <span className="text-[13px] font-medium tracking-[0.04em]">
            Additional details
          </span>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none"
            className={`text-ash transition-transform ${showAdvanced ? "rotate-180" : ""}`}>
            <path d="M2 4.5l5 5 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>

        {showAdvanced && (
          <div className="px-5 pb-5 space-y-5 border-t border-line pt-5">

            <div>
              <label className="field-label" htmlFor="genre">Genre *</label>
              <select id="genre" name="genre" className="field" value={fields.genre} onChange={set("genre")}>
                {GENRES.map((g) => <option key={g}>{g}</option>)}
              </select>
            </div>

            <div className="grid sm:grid-cols-2 gap-5">
              <div>
                <label className="field-label" htmlFor="format">"Format"</label>
                <select id="format" name="format" className="field" value={fields.format} onChange={set("format")}>
                  <option value="feature">Feature</option>
                  <option value="documentary">Documentary</option>
                  <option value="series">Series</option>
                  <option value="animation">Animation</option>
                </select>
              </div>
              <div>
                <label className="field-label" htmlFor="stage">"Stage"</label>
                <select id="stage" name="stage" className="field" value={fields.stage} onChange={set("stage")}>
                  <option value="development">Development</option>
                  <option value="pre_production">Pre-Production</option>
                  <option value="production">Production</option>
                  <option value="post_production">Post-Production</option>
                  <option value="completed">Completed</option>
                </select>
              </div>
              <div>
                <label className="field-label" htmlFor="language">"Language"</label>
                <input id="language" name="language" className="field" required
                  value={fields.language} onChange={set("language")} />
              </div>
              <div>
                <label className="field-label" htmlFor="country">"Country"</label>
                <input id="country" name="country" className="field" required
                  value={fields.country} onChange={set("country")} />
              </div>
              <div>
                <label className="field-label" htmlFor="budget_usd">"Total budget (USD)"</label>
                <input id="budget_usd" name="budget_usd" type="number" min="0" step="1000"
                  className="field" placeholder="400000"
                  value={fields.budget_usd} onChange={set("budget_usd")} />
              </div>
              <div>
                <label className="field-label" htmlFor="finance_secured_usd">"Finance secured (USD)"</label>
                <input id="finance_secured_usd" name="finance_secured_usd" type="number" min="0" step="1000"
                  className="field" placeholder="100000"
                  value={fields.finance_secured_usd} onChange={set("finance_secured_usd")} />
              </div>
              <div>
                <label className="field-label" htmlFor="funding_needed_usd">"Funding needed (USD)"</label>
                <input id="funding_needed_usd" name="funding_needed_usd" type="number" min="0" step="1000"
                  className="field" placeholder="150000"
                  value={fields.funding_needed_usd} onChange={set("funding_needed_usd")} />
              </div>
            </div>

            <div>
              <label className="field-label" htmlFor="synopsis">"Synopsis"</label>
              <textarea id="synopsis" name="synopsis" className="field" rows={5}
                value={fields.synopsis} onChange={set("synopsis")} />
            </div>

            <div>
              <label className="field-label" htmlFor="director_statement">"Director's statement"</label>
              <textarea id="director_statement" name="director_statement" className="field" rows={4}
                value={fields.director_statement} onChange={set("director_statement")} />
            </div>

            <div>
              <label className="field-label" htmlFor="producer_info">"Producer information"</label>
              <textarea id="producer_info" name="producer_info" className="field" rows={3}
                placeholder="Attached producers, production company, prior credits"
                value={fields.producer_info} onChange={set("producer_info")} />
            </div>

            <div>
              <label className="field-label" htmlFor="script">
                Script (PDF) <span className="normal-case tracking-normal font-normal">— optional</span>
              </label>
              <input id="script" type="file" accept=".pdf" className="field !py-2.5 text-[13px]" onChange={handleScript} />
              {uploading === "scripts" && <p className="mt-2 text-[12px] text-ash">Uploading…</p>}
              {scriptPath && <p className="mt-2 text-[12px] text-[#8A6F3E]">Script uploaded ✓</p>}
            </div>

            <div>
              <label className="field-label" htmlFor="poster">
                Poster / thumbnail{" "}
                <span className="normal-case tracking-normal font-normal">(JPG, PNG or WebP — optional)</span>
              </label>
              <input id="poster" type="file" accept="image/jpeg,image/png,image/webp"
                className="field !py-2.5 text-[13px]" onChange={handlePoster} />
              {uploading === "thumbnails" && <p className="mt-2 text-[12px] text-ash">Uploading…</p>}
              {posterPath && <p className="mt-2 text-[12px] text-[#8A6F3E]">Poster uploaded ✓</p>}
            </div>

            {/* Visibility */}
            <div>
              <label className="field-label">Visibility</label>
              <div className="grid sm:grid-cols-2 gap-4">
                <label className={`flex flex-col gap-2 p-5 rounded-card border bg-white/70 cursor-pointer transition-colors ${visibility === "true" ? "border-gold bg-gold/5" : "border-line"}`}>
                  <input type="radio" name="is_public" value="true" checked={visibility === "true"}
                    onChange={() => setVisibility("true")} className="sr-only" />
                  <span className="flex items-center gap-2 font-display text-[17px]">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                      <circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3a14 14 0 0 1 0 18 14 14 0 0 1 0-18z" />
                    </svg>
                    Public
                  </span>
                  <span className="text-[13px] text-ash">Shown on the Projects showcase.</span>
                </label>
                <label className={`flex flex-col gap-2 p-5 rounded-card border bg-white/70 cursor-pointer transition-colors ${visibility === "false" ? "border-gold bg-gold/5" : "border-line"}`}>
                  <input type="radio" name="is_public" value="false" checked={visibility === "false"}
                    onChange={() => setVisibility("false")} className="sr-only" />
                  <span className="flex items-center gap-2 font-display text-[17px]">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                      <rect x="4" y="11" width="16" height="9" rx="1.5" /><path d="M8 11V7a4 4 0 0 1 8 0v4" />
                    </svg>
                    Private
                  </span>
                  <span className="text-[13px] text-ash">Only visible to you.</span>
                </label>
              </div>
            </div>
          </div>
        )}
      </div>

      {error && (
        <p className="text-[13px] text-red-700 border border-red-200 bg-red-50 rounded-card px-4 py-3">
          {error}
        </p>
      )}

      <button type="submit" disabled={aiLoading || uploading !== null}
        className="btn-gold disabled:opacity-50">
        {aiLoading ? "AI is reading your deck…" : uploading ? "Uploading…" : "Create project & compute matches"}
      </button>
    </form>
  );
}
