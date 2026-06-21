"use client";

import { useState, useEffect, useTransition } from "react";
import { flushSync } from "react-dom";
import Link from "next/link";
import { updateProject } from "@/lib/project-actions";
import { STAGE_LABEL, CURRENCIES } from "@/lib/format";
import type { Project } from "@/types";

const GENRES  = ["Drama","Comedy","Thriller","Horror","Romance","Action","Documentary","Family","Crime","Sci-Fi","Fantasy","Musical"];
const FORMATS = ["feature","documentary","series","animation"];
const STAGES  = Object.entries(STAGE_LABEL);

// ── USD preview hook ──────────────────────────────────────────────────────────

function useLiveUSD(amount: string, currency: string) {
  const [usd, setUsd] = useState<number | null>(null);
  const [source, setSource] = useState<"live" | "fixed" | null>(null);

  useEffect(() => {
    const n = parseFloat(amount);
    if (!amount || isNaN(n) || n <= 0 || currency === "USD") {
      setUsd(n > 0 ? n : null);
      setSource(null);
      return;
    }
    const ctrl = new AbortController();
    fetch(`/api/convert-currency?amount=${n}&from=${currency}`, { signal: ctrl.signal })
      .then((r) => r.json())
      .then((d) => { setUsd(d.usd); setSource(d.source); })
      .catch(() => {});
    return () => ctrl.abort();
  }, [amount, currency]);

  return { usd, source };
}

// ── Formatting ────────────────────────────────────────────────────────────────

function fmtUSD(n: number | null): string {
  if (n == null) return "";
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${Math.round(n / 1_000)}K`;
  return `$${n}`;
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  project: Project & { admin_hidden?: boolean };
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function EditProjectForm({ project }: Props) {
  const currency = (project as any).budget_currency ?? "USD";
  const sym = CURRENCIES[currency]?.symbol ?? "$";

  // Initialise from original *_amount columns (not USD values)
  const [budgetCurrency, setBudgetCurrency]       = useState(currency);
  const [budgetAmount, setBudgetAmount]           = useState(String((project as any).budget_amount ?? ""));
  const [financeSecured, setFinanceSecured]       = useState(String((project as any).finance_secured_amount ?? ""));
  const [fundingNeeded, setFundingNeeded]         = useState(String((project as any).funding_needed_amount ?? ""));
  const [autoFunding, setAutoFunding]             = useState(false);
  const [budgetError, setBudgetError]             = useState<string | null>(null);
  const [submitError, setSubmitError]             = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const curSym = CURRENCIES[budgetCurrency]?.symbol ?? "$";

  // ── Live USD previews for all three fields ────────────────────────────────
  const { usd: budgetUSD, source: budgetSrc }     = useLiveUSD(budgetAmount, budgetCurrency);
  const { usd: securedUSD }                       = useLiveUSD(financeSecured, budgetCurrency);
  const { usd: neededUSD }                        = useLiveUSD(fundingNeeded, budgetCurrency);

  // ── Auto-compute funding_needed = budget - secured ────────────────────────
  useEffect(() => {
    const total    = parseFloat(budgetAmount);
    const secured  = parseFloat(financeSecured);
    if (!isNaN(total) && !isNaN(secured) && total >= secured) {
      const computed = total - secured;
      setFundingNeeded(String(computed % 1 === 0 ? Math.round(computed) : computed.toFixed(2)));
      setAutoFunding(true);
    }
  }, [budgetAmount, financeSecured]);

  // ── Budget split validation ───────────────────────────────────────────────
  useEffect(() => {
    const total   = parseFloat(budgetAmount)   || null;
    const secured = parseFloat(financeSecured) || null;
    const needed  = parseFloat(fundingNeeded)  || null;

    if (total == null) { setBudgetError(null); return; }
    if (secured != null && secured > total) {
      setBudgetError("Finance secured cannot exceed the total budget."); return;
    }
    if (needed != null && needed > total) {
      setBudgetError("Funding needed cannot exceed the total budget."); return;
    }
    if (secured != null && needed != null && secured + needed > total) {
      setBudgetError("Finance secured + funding needed cannot exceed the total budget."); return;
    }
    setBudgetError(null);
  }, [budgetAmount, financeSecured, fundingNeeded]);

  // ── Submit ────────────────────────────────────────────────────────────────
  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (budgetError) return;
    const formData = new FormData(e.currentTarget);
    flushSync(() => setSubmitError(null));
    startTransition(async () => {
      const result = await updateProject(formData) as any;
      if (result?.error) setSubmitError(result.error);
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <input type="hidden" name="project_id" value={project.id} />

      <div>
        <label className="field-label mb-1 block">Title *</label>
        <input name="title" required defaultValue={project.title} className="field w-full" />
      </div>

      <div>
        <label className="field-label mb-1 block">Logline *</label>
        <textarea name="logline" required rows={2} defaultValue={project.logline ?? ""} className="field w-full" />
      </div>

      <div className="grid sm:grid-cols-3 gap-4">
        <div>
          <label className="field-label mb-1 block">Genre</label>
          <select name="genre" defaultValue={project.genre ?? ""} className="field w-full">
            {GENRES.map((g) => <option key={g} value={g}>{g}</option>)}
          </select>
        </div>
        <div>
          <label className="field-label mb-1 block">Format</label>
          <select name="format" defaultValue={project.format ?? ""} className="field w-full">
            {FORMATS.map((f) => <option key={f} value={f}>{f.charAt(0).toUpperCase() + f.slice(1)}</option>)}
          </select>
        </div>
        <div>
          <label className="field-label mb-1 block">Stage</label>
          <select name="stage" defaultValue={project.stage ?? ""} className="field w-full">
            {STAGES.map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label className="field-label mb-1 block">Country</label>
          <input name="country" defaultValue={project.country ?? ""} className="field w-full" />
        </div>
        <div>
          <label className="field-label mb-1 block">Language</label>
          <input name="language" defaultValue={project.language ?? ""} className="field w-full" />
        </div>
      </div>

      {/* ── Finance section ─────────────────────────────────────────────── */}
      <div className="rounded-card border border-line bg-white/60 p-5 space-y-4">
        <p className="text-[11px] tracking-[0.12em] uppercase text-gold font-medium">Finance</p>

        {/* Currency */}
        <div>
          <label className="field-label mb-1 block">Currency</label>
          <select
            name="budget_currency"
            value={budgetCurrency}
            onChange={(e) => {
              setBudgetCurrency(e.target.value);
              // Clear computed amounts when currency changes
              setBudgetAmount(""); setFinanceSecured(""); setFundingNeeded("");
            }}
            className="field w-full"
          >
            {Object.entries(CURRENCIES).map(([code, c]) => (
              <option key={code} value={code}>{c.label}</option>
            ))}
          </select>
          {budgetSrc === "live" && (
            <p className="mt-1 text-[11px] text-green-600">Live exchange rate applied</p>
          )}
          {budgetSrc === "fixed" && budgetCurrency !== "USD" && (
            <p className="mt-1 text-[11px] text-ash">Using fixed rate (live rate unavailable)</p>
          )}
        </div>

        <div className="grid sm:grid-cols-3 gap-4">
          {/* Total budget */}
          <div>
            <label className="field-label mb-1 block">
              Total budget <span className="text-ash font-normal normal-case tracking-normal">({budgetCurrency})</span>
            </label>
            <input
              name="budget_usd"
              type="number"
              min="0"
              step="1"
              className="field w-full"
              placeholder="e.g. 10000000"
              value={budgetAmount}
              onChange={(e) => setBudgetAmount(e.target.value)}
            />
            {budgetUSD != null && budgetCurrency !== "USD" && (
              <p className="mt-1 text-[11px] text-ash">≈ {fmtUSD(budgetUSD)}</p>
            )}
          </div>

          {/* Finance secured */}
          <div>
            <label className="field-label mb-1 block">
              Finance secured <span className="text-ash font-normal normal-case tracking-normal">({budgetCurrency})</span>
            </label>
            <input
              name="finance_secured_usd"
              type="number"
              min="0"
              step="1"
              className="field w-full"
              placeholder="e.g. 3000000"
              value={financeSecured}
              onChange={(e) => { setFinanceSecured(e.target.value); setAutoFunding(false); }}
            />
            {securedUSD != null && budgetCurrency !== "USD" && (
              <p className="mt-1 text-[11px] text-ash">≈ {fmtUSD(securedUSD)}</p>
            )}
          </div>

          {/* Funding needed */}
          <div>
            <label className="field-label mb-1 block">
              Funding needed <span className="text-ash font-normal normal-case tracking-normal">({budgetCurrency})</span>
            </label>
            <input
              name="funding_needed_usd"
              type="number"
              min="0"
              step="1"
              className="field w-full"
              placeholder="e.g. 7000000"
              value={fundingNeeded}
              onChange={(e) => { setFundingNeeded(e.target.value); setAutoFunding(false); }}
            />
            {neededUSD != null && budgetCurrency !== "USD" && (
              <p className="mt-1 text-[11px] text-ash">≈ {fmtUSD(neededUSD)}</p>
            )}
            {autoFunding && fundingNeeded && (
              <p className="mt-1 text-[11px] text-gold">Auto-calculated</p>
            )}
          </div>
        </div>

        {budgetError && (
          <p className="text-[12px] text-red-700 bg-red-50 border border-red-200 rounded-card px-3 py-2">
            {budgetError}
          </p>
        )}
      </div>

      <div>
        <label className="field-label mb-1 block">Synopsis</label>
        <textarea name="synopsis" rows={5} defaultValue={project.synopsis ?? ""} className="field w-full" />
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label className="field-label mb-1 block">Director name</label>
          <input name="director_name" defaultValue={(project as any).director_name ?? ""} className="field w-full" placeholder="e.g. Jane Smith" />
        </div>
        <div>
          <label className="field-label mb-1 block">Writer name</label>
          <input name="writer_name" defaultValue={(project as any).writer_name ?? ""} className="field w-full" placeholder="e.g. Jane Smith" />
        </div>
      </div>

      <div>
        <label className="field-label mb-1 block">Director's statement</label>
        <textarea name="director_statement" rows={4} defaultValue={project.director_statement ?? ""} className="field w-full" />
      </div>

      <div>
        <label className="field-label mb-1 block">Producer info</label>
        <textarea name="producer_info" rows={3} defaultValue={project.producer_info ?? ""} className="field w-full" />
      </div>

      <div className="flex items-center gap-3">
        <label className="flex items-center gap-2 text-[13px] text-ash cursor-pointer">
          <input
            type="checkbox"
            name="is_public"
            value="true"
            defaultChecked={project.is_public}
            className="w-4 h-4 accent-[#BF9953]"
          />
          Make this project publicly visible
        </label>
      </div>

      {submitError && (
        <p className="text-[13px] text-red-700 border border-red-200 bg-red-50 rounded-card px-4 py-3">
          {submitError}
        </p>
      )}

      <div className="flex items-center gap-4 pt-2">
        <button
          type="submit"
          disabled={!!budgetError}
          className="btn-gold px-8 disabled:opacity-50"
        >
          Save changes
        </button>
        <Link href={`/dashboard/projects/${project.id}`} className="text-[13px] text-ash hover:text-ink transition-colors">
          Cancel
        </Link>
      </div>
    </form>
  );
}
