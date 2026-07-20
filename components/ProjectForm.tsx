"use client";

import { useState, useEffect, useTransition } from "react";
import { flushSync } from "react-dom";
import { createClient } from "@/lib/supabase/client";
import { createProject } from "@/lib/actions";
import { CURRENCIES } from "@/lib/format";
import { hashFile } from "@/lib/proofUtils";
import { generateAndUploadDeckCover } from "@/lib/deck-cover";

const GENRES = ["Drama","Comedy","Thriller","Horror","Romance","Action","Documentary","Family","Crime","Sci-Fi","Fantasy","Musical"];

// ── Engine loader ──────────────────────────────────────────────────────────────

function BlinkingDots() {
  const [dots, setDots] = useState(1);
  useEffect(() => {
    const id = setInterval(() => setDots((d) => (d % 3) + 1), 450);
    return () => clearInterval(id);
  }, []);
  return <span className="text-ash" style={{ fontWeight: 400 }}>{"•".repeat(dots)}</span>;
}

// ── AI analysing state ─────────────────────────────────────────────────────────

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

// ── Section header ─────────────────────────────────────────────────────────────

function SectionHeader({ label, sub }: { label: string; sub?: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="eyebrow text-gold">{label}</span>
      {sub && <span className="text-[11px] text-ash normal-case tracking-normal">{sub}</span>}
      <div className="h-px flex-1 bg-line" />
    </div>
  );
}

// ── Fields type ────────────────────────────────────────────────────────────────

type Fields = {
  title: string; genre: string; format: string; language: string; country: string;
  budget_usd: string; finance_secured_usd: string; funding_needed_usd: string; budget_currency: string; stage: string;
  logline: string; synopsis: string; director_statement: string; producer_info: string;
  runtime_minutes: string;
  director_name: string; director_email: string; director_phone: string;
  producer_name: string; producer_company: string;
};
type AiFilled = Partial<Record<keyof Fields, boolean>>;

const DEFAULT_FIELDS: Fields = {
  title: "", genre: "Drama", format: "feature", language: "Malayalam",
  country: "India", budget_usd: "", finance_secured_usd: "", funding_needed_usd: "", budget_currency: "USD", stage: "development",
  logline: "", synopsis: "", director_statement: "", producer_info: "",
  runtime_minutes: "",
  director_name: "", director_email: "", director_phone: "",
  producer_name: "", producer_company: "",
};

// ── Live USD preview ───────────────────────────────────────────────────────────

function useLiveUSD(amount: string, currency: string) {
  const [usd, setUsd] = useState<number | null>(null);
  const [source, setSource] = useState<"live" | "fixed" | null>(null);
  useEffect(() => {
    const n = parseFloat(amount);
    if (!amount || isNaN(n) || n <= 0 || currency === "USD") { setUsd(n > 0 ? n : null); setSource(null); return; }
    const ctrl = new AbortController();
    fetch(`/api/convert-currency?amount=${n}&from=${currency}`, { signal: ctrl.signal })
      .then((r) => r.json())
      .then((d) => { setUsd(d.usd); setSource(d.source); })
      .catch(() => {});
    return () => ctrl.abort();
  }, [amount, currency]);
  return { usd, source };
}

function fmtUSD(n: number | null): string {
  if (n == null) return "";
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${Math.round(n / 1_000)}K`;
  return `$${n}`;
}

// ── Component ──────────────────────────────────────────────────────────────────

export default function ProjectForm({ targetProducerId = null }: { targetProducerId?: string | null }) {
  const [fields, setFields]         = useState<Fields>(DEFAULT_FIELDS);
  const [aiFilled, setAiFilled]     = useState<AiFilled>({});
  const [aiLoading, setAiLoading]   = useState(false);
  const [aiError, setAiError]       = useState<string | null>(null);
  const [error, setError]           = useState<string | null>(null);
  const [busy, setBusy]             = useState(false);
  const [uploading, setUploading]   = useState<string | null>(null);
  const [deckPath, setDeckPath]         = useState("");
  const [deckHash, setDeckHash]         = useState("");
  const [deckCoverPath, setDeckCoverPath] = useState("");
  const [deckFileName, setDeckFileName] = useState("");
  const [scriptPath, setScriptPath] = useState("");
  const [posterPath, setPosterPath] = useState("");
  const [visibility, setVisibility] = useState<"true" | "false">("true");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [budgetError, setBudgetError]   = useState<string | null>(null);
  const [autoFunding, setAutoFunding]   = useState(false);
  const [hasScript,    setHasScript]    = useState(false);
  const [hasBudget,    setHasBudget]    = useState(false);
  const [hasLookbook,  setHasLookbook]  = useState(false);
  const [hasCoproducer, setHasCoproducer] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);

  // ── Live USD previews ──────────────────────────────────────────────────────
  const { usd: budgetUSD, source: budgetSrc } = useLiveUSD(fields.budget_usd, fields.budget_currency);
  const { usd: securedUSD }                   = useLiveUSD(fields.finance_secured_usd, fields.budget_currency);
  const { usd: neededUSD }                    = useLiveUSD(fields.funding_needed_usd, fields.budget_currency);

  // ── Budget validation ──────────────────────────────────────────────────────
  useEffect(() => {
    const total   = parseFloat(fields.budget_usd)           || null;
    const secured = parseFloat(fields.finance_secured_usd)  || null;
    const needed  = parseFloat(fields.funding_needed_usd)   || null;
    if (total == null) { setBudgetError(null); return; }
    if (secured != null && secured > total) { setBudgetError("Finance secured cannot exceed the total budget."); return; }
    if (needed  != null && needed  > total) { setBudgetError("Amount requested cannot exceed the total budget."); return; }
    if (secured != null && needed != null && secured + needed > total) { setBudgetError("Finance secured + amount requested cannot exceed the total budget."); return; }
    setBudgetError(null);
  }, [fields.budget_usd, fields.finance_secured_usd, fields.funding_needed_usd]);

  // ── Auto-compute amount requested = total - secured ────────────────────────
  useEffect(() => {
    const total   = parseFloat(fields.budget_usd);
    const secured = parseFloat(fields.finance_secured_usd);
    if (!isNaN(total) && !isNaN(secured) && total >= secured) {
      const computed = total - secured;
      setFields((f) => ({ ...f, funding_needed_usd: String(computed % 1 === 0 ? Math.round(computed) : computed.toFixed(2)) }));
      setAutoFunding(true);
    }
  }, [fields.budget_usd, fields.finance_secured_usd]);

  const [, startTransition] = useTransition();

  const set = (k: keyof Fields) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setFields((f) => ({ ...f, [k]: e.target.value }));
    setAiFilled((a) => ({ ...a, [k]: false }));
  };

  // ── PDF extraction ─────────────────────────────────────────────────────────
  async function extractPDFText(file: File): Promise<string> {
    const pdfjsLib = await import("pdfjs-dist");
    pdfjsLib.GlobalWorkerOptions.workerSrc =
      `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({
      data: arrayBuffer, isEvalSupported: false, disableFontFace: true, useWorkerFetch: false,
    }).promise;
    const maxPages = Math.min(pdf.numPages, 10);
    const parts: string[] = [];
    for (let i = 1; i <= maxPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      const pageText = content.items.map((item) => ("str" in item ? (item as { str: string }).str : "")).join(" ");
      parts.push(pageText);
    }
    return parts.join("\n\n").slice(0, 12000);
  }

  async function renderPDFPages(file: File): Promise<string[]> {
    const pdfjsLib = await import("pdfjs-dist");
    pdfjsLib.GlobalWorkerOptions.workerSrc =
      `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer, isEvalSupported: false }).promise;
    const maxPages = Math.min(pdf.numPages, 5);
    const images: string[] = [];
    for (let i = 1; i <= maxPages; i++) {
      const page = await pdf.getPage(i);
      const viewport = page.getViewport({ scale: 1.5 });
      const canvas = document.createElement("canvas");
      canvas.width = viewport.width; canvas.height = viewport.height;
      const ctx = canvas.getContext("2d")!;
      await page.render({ canvasContext: ctx, viewport, canvas }).promise;
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
    setError(null); setAiError(null);
    setUploading("pitch-decks"); setAiLoading(true);
    // Hash the file client-side for OTS proof (runs in parallel with upload)
    hashFile(file).then((h) => { setDeckHash(h); setDeckFileName(file.name); }).catch(() => {});
    // Fetch user profile for fallback name
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    let userFullName = "";
    if (user) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", user.id)
        .single();
      userFullName = profile?.full_name?.trim() ?? "";
    }
    const [path, text] = await Promise.all([uploadFile(file, "pitch-decks"), extractPDFText(file).catch(() => "")]);
    if (path) setDeckPath(path);
    setUploading(null);
    // Pre-render a static cover so public pages don't run pdf.js on every view.
    // Non-blocking: if it fails or the user submits first, rendering falls back
    // to the client-side deck thumbnail and the owner backfills on next visit.
    setDeckCoverPath("");
    generateAndUploadDeckCover(file)
      .then((cover) => { if (cover) setDeckCoverPath(cover); })
      .catch(() => {});
    try {
      let body: Record<string, unknown>;
      if (text.trim()) {
        body = { text };
      } else {
        const images = await renderPDFPages(file).catch(() => [] as string[]);
        if (!images.length) { setAiError("Could not read this PDF — try exporting it as a text-based PDF."); setAiLoading(false); return; }
        body = { images };
      }
      const res = await fetch("/api/ai-extract", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      });
      if (res.ok) {
        const data = await res.json();
        const filled: AiFilled = {};
        // Fallback: if director_name not in deck, use logged-in user's full name
        if ((!data.director_name || data.director_name.trim() === "") && userFullName) {
          data.director_name = userFullName;
        }
        setFields((prev) => {
          const next = { ...prev };
          const keys: (keyof Fields)[] = [
            "title","genre","format","language","country",
            "budget_usd","finance_secured_usd","funding_needed_usd","budget_currency","stage",
            "logline","synopsis","director_statement","producer_info",
            "runtime_minutes","director_name","director_email","director_phone",
            "producer_name","producer_company",
          ];
          for (const k of keys) {
            const val = data[k];
            if (val !== null && val !== undefined && val !== "") { next[k] = String(val); filled[k] = true; }
          }
          return next;
        });
        setAiFilled(filled);
        if (Object.values(filled).some(Boolean)) setShowAdvanced(true);
      } else {
        const err = await res.json().catch(() => ({}));
        setAiError(err.error ?? "AI extraction failed — fill the fields manually.");
      }
    } catch { setAiError("AI extraction failed — fill the fields manually."); }
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
  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (aiLoading || uploading) return;
    if (!fields.title.trim()) { setError("Please enter a title for your project."); return; }
    if (!fields.logline.trim()) { setError("Please enter a logline. It's the one sentence that describes your film."); return; }
    if (budgetError) { setError(budgetError); return; }
    if (!termsAccepted) { setError("Please accept the terms and conditions to continue."); return; }
    const formData = new FormData(e.currentTarget);
    flushSync(() => { setError(null); setBusy(true); });
    startTransition(async () => {
      const result = await createProject(formData);
      if (result?.error) { setError(result.error); setBusy(false); }
    });
  }

  // ── AI highlight helper ────────────────────────────────────────────────────
  const ai = (k: keyof Fields) => aiFilled[k] ? "border-gold/60 bg-gold/4" : "";

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-w-2xl">
      <input type="hidden" name="pitch_deck_path"     value={deckPath} />
      <input type="hidden" name="deck_cover_path"     value={deckCoverPath} />
      <input type="hidden" name="pitch_deck_hash"     value={deckHash} />
      <input type="hidden" name="pitch_deck_filename" value={deckFileName} />
      <input type="hidden" name="script_path"       value={scriptPath} />
      <input type="hidden" name="poster_path"       value={posterPath} />
      <input type="hidden" name="has_script_doc"    value={String(hasScript || !!scriptPath)} />
      <input type="hidden" name="has_budget_doc"    value={String(hasBudget)} />
      <input type="hidden" name="has_lookbook"      value={String(hasLookbook)} />
      <input type="hidden" name="has_coproducer"    value={String(hasCoproducer)} />
      {targetProducerId && <input type="hidden" name="target_producer_id" value={targetProducerId} />}

      {/* ── STEP 1: PITCH DECK ── */}
      <div className="rounded-card border border-line bg-white/60 p-6 space-y-4">
        <div>
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
        {/* Asset Readiness */}
        <div className="pt-4 border-t border-line">
          <p className="eyebrow text-ash mb-3">
            Tick what you have ready, if asked
          </p>
          <div className="flex flex-wrap gap-3">
            {([
              { key: "script",     label: "Script",      val: hasScript,      set: setHasScript      },
              { key: "budget",     label: "Budget",      val: hasBudget,      set: setHasBudget      },
              { key: "lookbook",   label: "Lookbook",    val: hasLookbook,    set: setHasLookbook    },
              { key: "coproducer", label: "Co-Producer", val: hasCoproducer,  set: setHasCoproducer  },
            ] as { key: string; label: string; val: boolean; set: (v: boolean) => void }[]).map(({ key, label, val, set }) => (
              <button key={key} type="button" onClick={() => set(!val)}
                className={`flex items-center gap-2 px-4 py-2 rounded-full border text-[11px] tracking-[0.12em] uppercase transition-all ${
                  val ? "border-gold bg-gold/8 text-ink" : "border-line bg-white/60 text-ash"
                }`}>
                <span style={{ fontSize: 12, color: val ? "#BF9953" : "#C8C3BC" }}>{val ? "✓" : "○"}</span>
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── TITLE + LOGLINE ── */}
      <div className="space-y-4">
        <div>
          <label className="field-label" htmlFor="title">Title *</label>
          <input id="title" name="title" className={`field ${ai("title")}`} required maxLength={200}
            value={fields.title} onChange={set("title")} placeholder="Your film title" />
        </div>
        <div>
          <label className="field-label" htmlFor="logline">
            Logline *{" "}
            <span className="normal-case tracking-normal font-normal">(one sentence, max 500 characters)</span>
          </label>
          <textarea id="logline" name="logline" className={`field ${ai("logline")}`} rows={2} required maxLength={500}
            value={fields.logline} onChange={set("logline")}
            placeholder="A one-sentence description of your film." />
          <p className="mt-1 text-[11px] text-ash text-right">{fields.logline.length}/500</p>
        </div>
      </div>

      {/* ── ADDITIONAL DETAILS toggle ── */}
      <div className="border border-line rounded-card overflow-hidden">
        <button type="button" onClick={() => setShowAdvanced((v) => !v)}
          className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-parchment/40 transition-colors">
          <span className="text-[13px] font-medium tracking-[0.04em]">Additional details</span>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none"
            className={`text-ash transition-transform ${showAdvanced ? "rotate-180" : ""}`}>
            <path d="M2 4.5l5 5 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>

        {showAdvanced && (
          <div className="px-5 pb-5 space-y-6 border-t border-line pt-5">

            {/* ── PROJECT BASICS ── */}
            <div className="space-y-4">
              <SectionHeader label="Project Basics" />

              <div className="grid sm:grid-cols-2 gap-5">
                <div>
                  <label className="field-label" htmlFor="format">Format</label>
                  <select id="format" name="format" className={`field ${ai("format")}`}
                    value={fields.format} onChange={set("format")}>
                    <option value="feature">Feature</option>
                    <option value="documentary">Documentary</option>
                    <option value="series">Series</option>
                    <option value="animation">Animation</option>
                  </select>
                </div>
                <div>
                  <label className="field-label" htmlFor="genre">Genre</label>
                  <select id="genre" name="genre" className={`field ${ai("genre")}`}
                    value={fields.genre} onChange={set("genre")}>
                    {GENRES.map((g) => <option key={g}>{g}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-5">
                <div>
                  <label className="field-label" htmlFor="stage">Production Stage</label>
                  <select id="stage" name="stage" className={`field ${ai("stage")}`}
                    value={fields.stage} onChange={set("stage")}>
                    <option value="development">Development</option>
                    <option value="pre_production">Pre-Production</option>
                    <option value="production">Production</option>
                    <option value="post_production">Post-Production</option>
                    <option value="completed">Completed</option>
                  </select>
                </div>
                <div>
                  <label className="field-label" htmlFor="country">Country of Production</label>
                  <input id="country" name="country" className={`field ${ai("country")}`}
                    value={fields.country} onChange={set("country")} />
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-5">
                <div>
                  <label className="field-label" htmlFor="language">Production Language</label>
                  <input id="language" name="language" className={`field ${ai("language")}`}
                    value={fields.language} onChange={set("language")} />
                </div>
                <div>
                  <label className="field-label" htmlFor="runtime_minutes">
                    Expected Runtime{" "}
                    <span className="normal-case tracking-normal font-normal text-ash">mins</span>
                  </label>
                  <input id="runtime_minutes" name="runtime_minutes" type="number" min="1" max="600" step="1"
                    className={`field ${ai("runtime_minutes")}`} placeholder="90"
                    value={fields.runtime_minutes} onChange={set("runtime_minutes")} />
                </div>
              </div>

              <div>
                <label className="field-label" htmlFor="synopsis">Synopsis</label>
                <textarea id="synopsis" name="synopsis" className={`field ${ai("synopsis")}`} rows={5}
                  placeholder="Story summary — characters, arc, themes"
                  value={fields.synopsis} onChange={set("synopsis")} />
              </div>
            </div>

            {/* ── TEAM ── */}
            <div className="space-y-4">
              <SectionHeader label="Team" />

              <div>
                <label className="field-label" htmlFor="director_name">Director / Writer</label>
                <input id="director_name" name="director_name" className={`field ${ai("director_name")}`}
                  placeholder="Full name" value={fields.director_name} onChange={set("director_name")} />
              </div>

              <div className="grid sm:grid-cols-2 gap-5">
                <div>
                  <label className="field-label" htmlFor="director_email">Email</label>
                  <input id="director_email" name="director_email" type="email"
                    className={`field ${ai("director_email")}`}
                    placeholder="director@example.com"
                    value={fields.director_email} onChange={set("director_email")} />
                </div>
                <div>
                  <label className="field-label" htmlFor="director_phone">Phone</label>
                  <input id="director_phone" name="director_phone" type="tel"
                    className={`field ${ai("director_phone")}`}
                    placeholder="+91 …"
                    value={fields.director_phone} onChange={set("director_phone")} />
                </div>
              </div>

              <div>
                <label className="field-label" htmlFor="director_statement">Director Statement</label>
                <textarea id="director_statement" name="director_statement"
                  className={`field ${ai("director_statement")}`} rows={4}
                  placeholder="Your vision for the film — why you, why now"
                  value={fields.director_statement} onChange={set("director_statement")} />
              </div>
            </div>

            {/* ── BUDGET & FINANCES ── */}
            <div className="space-y-4">
              <SectionHeader label="Budget & Finances" />

              {/* Currency converter */}
              <div>
                <label className="field-label" htmlFor="budget_currency">
                  Currency
                  <span className="normal-case tracking-normal font-normal text-ash ml-1.5">— live rates applied automatically</span>
                </label>
                <select id="budget_currency" name="budget_currency" className="field"
                  value={fields.budget_currency}
                  onChange={(e) => {
                    set("budget_currency")(e);
                    setFields((f) => ({ ...f, budget_usd: "", finance_secured_usd: "", funding_needed_usd: "" }));
                    setAutoFunding(false);
                  }}>
                  {Object.entries(CURRENCIES).map(([code, c]) => (
                    <option key={code} value={code}>{c.label}</option>
                  ))}
                </select>
                {budgetSrc === "live" && <p className="mt-1 text-[11px] text-green-600">Live exchange rate applied</p>}
                {budgetSrc === "fixed" && fields.budget_currency !== "USD" && (
                  <p className="mt-1 text-[11px] text-ash">Using fixed rate (live rate unavailable)</p>
                )}
              </div>

              <div className="grid sm:grid-cols-2 gap-5">
                <div>
                  <label className="field-label" htmlFor="budget_usd">
                    Total Budget{" "}
                    <span className="font-normal normal-case tracking-normal text-ash">({fields.budget_currency})</span>
                  </label>
                  <input id="budget_usd" name="budget_usd" type="number" min="0" step="1"
                    className={`field ${ai("budget_usd")}`} placeholder="10000000"
                    value={fields.budget_usd} onChange={(e) => { set("budget_usd")(e); setAutoFunding(false); }} />
                  {budgetUSD != null && fields.budget_currency !== "USD" && (
                    <p className="mt-1 text-[11px] text-ash">≈ {fmtUSD(budgetUSD)}</p>
                  )}
                </div>
                <div>
                  <label className="field-label" htmlFor="funding_needed_usd">
                    Amount Requested{" "}
                    <span className="font-normal normal-case tracking-normal text-ash">({fields.budget_currency})</span>
                  </label>
                  <input id="funding_needed_usd" name="funding_needed_usd" type="number" min="0" step="1"
                    className={`field ${ai("funding_needed_usd")}`} placeholder="7000000"
                    value={fields.funding_needed_usd}
                    onChange={(e) => { set("funding_needed_usd")(e); setAutoFunding(false); }} />
                  {neededUSD != null && fields.budget_currency !== "USD" && (
                    <p className="mt-1 text-[11px] text-ash">≈ {fmtUSD(neededUSD)}</p>
                  )}
                  {autoFunding && fields.funding_needed_usd && (
                    <p className="mt-1 text-[11px] text-gold">Auto-calculated from budget gap</p>
                  )}
                </div>
              </div>

              <div>
                <label className="field-label" htmlFor="finance_secured_usd">
                  Finance Secured{" "}
                  <span className="font-normal normal-case tracking-normal text-ash">({fields.budget_currency})</span>
                </label>
                <input id="finance_secured_usd" name="finance_secured_usd" type="number" min="0" step="1"
                  className={`field ${ai("finance_secured_usd")}`} placeholder="3000000"
                  value={fields.finance_secured_usd} onChange={(e) => { set("finance_secured_usd")(e); setAutoFunding(false); }} />
                {securedUSD != null && fields.budget_currency !== "USD" && (
                  <p className="mt-1 text-[11px] text-ash">≈ {fmtUSD(securedUSD)}</p>
                )}
              </div>

              {budgetError && (
                <p className="text-[12px] text-red-700 bg-red-50 border border-red-200 rounded-card px-3 py-2">
                  {budgetError}
                </p>
              )}
            </div>

            {/* ── PRODUCER / CO-PRODUCER ── */}
            <div className="space-y-4">
              <SectionHeader label="Producer / Co-producer" sub="if any" />

              <div className="grid sm:grid-cols-2 gap-5">
                <div>
                  <label className="field-label" htmlFor="producer_name">Name</label>
                  <input id="producer_name" name="producer_name" className={`field ${ai("producer_name")}`}
                    placeholder="Full name"
                    value={fields.producer_name} onChange={set("producer_name")} />
                </div>
                <div>
                  <label className="field-label" htmlFor="producer_company">Company</label>
                  <input id="producer_company" name="producer_company" className={`field ${ai("producer_company")}`}
                    placeholder="Production company"
                    value={fields.producer_company} onChange={set("producer_company")} />
                </div>
              </div>

              {/* Hidden: keep producer_info for engine backwards compat */}
              <input type="hidden" name="producer_info"
                value={[fields.producer_name, fields.producer_company].filter(Boolean).join(" · ")} />
            </div>

            {/* ── POSTER & VISIBILITY ── */}
            <div className="space-y-4">

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
                    <span className="text-[13px] text-ash">Only visible to you and verified producers.</span>
                  </label>
                </div>
              </div>
            </div>

            {/* ── TERMS & CONDITIONS ── */}
            <div className="rounded-card border border-line bg-white/60 p-5">
              <label className="flex items-start gap-3 cursor-pointer select-none">
                <button
                  type="button"
                  onClick={() => setTermsAccepted((v) => !v)}
                  aria-checked={termsAccepted}
                  role="checkbox"
                  className={`mt-0.5 w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                    termsAccepted ? "border-gold bg-gold" : "border-ash/40 bg-white hover:border-gold/50"
                  }`}>
                  {termsAccepted && (
                    <svg width="11" height="8" viewBox="0 0 11 8" fill="none">
                      <path d="M1 4L4 7L10 1" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  )}
                </button>
                <span className="text-[13px] leading-relaxed text-ink">
                  I agree to the{" "}
                  <a href="/terms" target="_blank" className="text-gold underline underline-offset-2 hover:text-gold/80">
                    Terms of Service
                  </a>{" "}
                  and confirm that all submitted information is accurate and that I hold the necessary rights to the material submitted.
                </span>
              </label>
            </div>

          </div>
        )}
      </div>

      {error && (
        <p className="text-[13px] text-red-700 border border-red-200 bg-red-50 rounded-card px-4 py-3">
          {error}
        </p>
      )}

      <button type="submit" disabled={busy || aiLoading || uploading !== null}
        className="btn-gold disabled:opacity-50">
        {busy ? "Submitting…" : aiLoading ? "AI is reading your deck…" : uploading ? "Uploading…" : "Create project & compute matches"}
      </button>
    </form>
  );
}
