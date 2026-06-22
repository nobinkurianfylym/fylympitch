"use client";
// app/admin/intelligence/SiteCrawlForm.tsx
// Admin: manually specify a URL to scrape, extract, and queue.

import { useState, useRef } from "react";
import { gatherIntelligenceFromUrl, type GatherResult } from "./crawl-site-action";

type Stage = "idle" | "scraping" | "extracting" | "saving" | "done" | "error";

const OPP_TYPE_LABEL: Record<string, string> = {
  lab: "Lab", residency: "Residency", mentorship: "Mentorship",
  grant: "Grant", fund: "Fund", writing_fellowship: "Writing Fellowship",
  pitch_forum: "Pitch Forum", co_production: "Co-Production", market: "Market",
  crowdfunding: "Crowdfunding", tax_incentive: "Tax Incentive", investor: "Investor",
  film_festival: "Film Festival", distribution: "Distribution",
  broadcaster: "Broadcaster", streamer: "Streamer",
  post_production_grant: "Post-Production Grant", finishing_fund: "Finishing Fund",
};

const STAGE_LABEL: Record<Stage, string> = {
  idle:       "Gather Intelligence",
  scraping:   "Scraping page…",
  extracting: "Extracting data…",
  saving:     "Saving to queue…",
  done:       "Gather Intelligence",
  error:      "Try Again",
};

export function SiteCrawlForm() {
  const [url, setUrl]     = useState("");
  const [stage, setStage] = useState<Stage>("idle");
  const [result, setResult] = useState<GatherResult | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const busy = stage === "scraping" || stage === "extracting" || stage === "saving";

  async function handleSubmit() {
    const trimmed = url.trim();
    if (!trimmed || busy) return;

    // Basic URL validation
    try { new URL(trimmed); } catch {
      setResult({ success: false, error: "Enter a valid URL (include https://)", stage: "auth" });
      setStage("error");
      return;
    }

    setResult(null);
    setStage("scraping");

    // Simulate stage progression for UX
    const extractTimer = setTimeout(() => setStage("extracting"), 3500);
    const saveTimer    = setTimeout(() => setStage("saving"),     9000);

    const res = await gatherIntelligenceFromUrl(trimmed);

    clearTimeout(extractTimer);
    clearTimeout(saveTimer);

    setResult(res);
    setStage(res.success ? "done" : "error");
  }

  const S = {
    gold: "#BF9953",
    ink:  "#1A1815",
    ash:  "#8A857C",
    line: "rgba(26,24,21,0.07)",
    mist: "rgba(26,24,21,0.03)",
  };

  return (
    <div style={{
      background:   "#FFFFFF",
      border:       `1px solid ${S.line}`,
      borderRadius: 10,
      padding:      "28px 28px 24px",
      marginBottom: 32,
    }}>
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <p style={{
          fontSize:      9,
          letterSpacing: "0.22em",
          textTransform: "uppercase",
          color:         S.gold,
          fontWeight:    700,
          marginBottom:  6,
        }}>
          Targeted Site Crawl
        </p>
        <p style={{ fontSize: 12, color: S.ash, lineHeight: 1.5 }}>
          Enter any public URL — grant page, festival, fund, broadcaster, lab, or market.
          AI extracts funding data and adds it to the review queue.
        </p>
      </div>

      {/* Input row */}
      <div style={{ display: "flex", gap: 8, alignItems: "stretch" }}>
        {/* Globe icon */}
        <div style={{
          width:          40,
          flexShrink:     0,
          display:        "flex",
          alignItems:     "center",
          justifyContent: "center",
          background:     S.mist,
          border:         `1px solid ${S.line}`,
          borderRadius:   6,
        }}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <circle cx="8" cy="8" r="6.5" stroke={S.ash} strokeWidth="1.2"/>
            <path d="M8 1.5C8 1.5 5.5 4 5.5 8s2.5 6.5 2.5 6.5" stroke={S.ash} strokeWidth="1.2"/>
            <path d="M8 1.5C8 1.5 10.5 4 10.5 8S8 14.5 8 14.5" stroke={S.ash} strokeWidth="1.2"/>
            <path d="M1.5 8h13" stroke={S.ash} strokeWidth="1.2"/>
            <path d="M2.2 5.5h11.6M2.2 10.5h11.6" stroke={S.ash} strokeWidth="1.2"/>
          </svg>
        </div>

        {/* URL input */}
        <input
          ref={inputRef}
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
          placeholder="https://www.sundance.org/programs/screenwriters-lab"
          disabled={busy}
          style={{
            flex:          1,
            height:        40,
            padding:       "0 14px",
            fontSize:      13,
            fontFamily:    "Montserrat, sans-serif",
            color:         S.ink,
            background:    busy ? S.mist : "#FFFFFF",
            border:        `1px solid ${S.line}`,
            borderRadius:  6,
            outline:       "none",
            transition:    "border-color 0.15s",
          }}
        />

        {/* Submit button */}
        <button
          onClick={handleSubmit}
          disabled={busy || !url.trim()}
          style={{
            flexShrink:    0,
            height:        40,
            padding:       "0 20px",
            fontSize:      11,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            fontWeight:    700,
            fontFamily:    "Montserrat, sans-serif",
            color:         busy ? S.ash : "#FFFFFF",
            background:    busy ? S.mist : S.ink,
            border:        `1px solid ${busy ? S.line : S.ink}`,
            borderRadius:  6,
            cursor:        busy || !url.trim() ? "not-allowed" : "pointer",
            transition:    "all 0.15s",
            whiteSpace:    "nowrap",
            minWidth:      160,
            display:       "flex",
            alignItems:    "center",
            gap:           8,
            justifyContent:"center",
          }}
        >
          {busy && (
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none"
              style={{ animation: "fyp-spin 1s linear infinite", flexShrink: 0 }}>
              <circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth="1.5"
                strokeDasharray="14 8" strokeLinecap="round"/>
            </svg>
          )}
          {STAGE_LABEL[stage]}
        </button>
      </div>

      {/* Stage progress pill */}
      {busy && (
        <div style={{
          marginTop:     12,
          display:       "flex",
          alignItems:    "center",
          gap:           6,
          fontSize:      11,
          color:         S.ash,
          letterSpacing: "0.06em",
        }}>
          <span style={{
            display:       "inline-flex",
            gap:           4,
            alignItems:    "center",
          }}>
            {(["scraping", "extracting", "saving"] as Stage[]).map((s, i) => (
              <span key={s} style={{
                display:       "flex",
                alignItems:    "center",
                gap:           4,
                opacity:       stage === s ? 1 : 0.3,
              }}>
                {i > 0 && <span style={{ opacity: 0.3 }}>›</span>}
                <span style={{
                  width:        6, height: 6, borderRadius: "50%",
                  background:   stage === s ? S.gold : S.ash,
                  display:      "inline-block",
                  transition:   "background 0.3s",
                }} />
                <span style={{
                  fontWeight: stage === s ? 600 : 400,
                  color:      stage === s ? S.ink : S.ash,
                }}>
                  {s === "scraping" ? "Scraping" : s === "extracting" ? "Extracting" : "Saving"}
                </span>
              </span>
            ))}
          </span>
        </div>
      )}

      {/* Result card */}
      {result && !busy && (
        <div style={{
          marginTop:    16,
          padding:      "16px 18px",
          borderRadius: 7,
          border:       `1px solid ${result.success ? "rgba(46,107,78,0.2)" : "rgba(220,38,38,0.15)"}`,
          background:   result.success ? "rgba(46,107,78,0.04)" : "rgba(220,38,38,0.03)",
        }}>
          {result.success ? (
            <div>
              {/* Success header */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10, flexWrap: "wrap", gap: 8 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <circle cx="7" cy="7" r="6" fill="rgba(46,107,78,0.15)"/>
                    <path d="M4 7l2 2 4-4" stroke="#2E6B4E" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  <span style={{ fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: "#2E6B4E", fontWeight: 700 }}>
                    Added to review queue
                  </span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  {/* Confidence badge */}
                  <span style={{
                    fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase",
                    fontWeight: 600, padding: "3px 8px", borderRadius: 4,
                    background: result.confidence >= 80 ? "rgba(46,107,78,0.10)" : result.confidence >= 60 ? "rgba(191,153,83,0.12)" : "rgba(220,38,38,0.08)",
                    color:      result.confidence >= 80 ? "#2E6B4E"              : result.confidence >= 60 ? "#9E7C3A"              : "#dc2626",
                  }}>
                    {result.confidence}% confidence
                  </span>
                  {/* Opp type */}
                  <span style={{
                    fontSize: 10, letterSpacing: "0.08em", textTransform: "uppercase",
                    color: S.ash, fontWeight: 500, padding: "3px 8px", borderRadius: 4,
                    background: "rgba(26,24,21,0.05)", border: `1px solid ${S.line}`,
                  }}>
                    {OPP_TYPE_LABEL[result.opp_type] ?? result.opp_type}
                  </span>
                </div>
              </div>

              {/* Title + org */}
              <p style={{
                fontFamily:    "'Playfair Display', Georgia, serif",
                fontSize:      17,
                fontWeight:    700,
                color:         S.ink,
                letterSpacing: "-0.01em",
                marginBottom:  3,
              }}>
                {result.title}
              </p>
              <p style={{ fontSize: 12, color: S.ash }}>
                {result.organization}
              </p>

              {/* Confidence bar */}
              <div style={{ marginTop: 12, height: 3, background: "rgba(26,24,21,0.07)", borderRadius: 2, overflow: "hidden" }}>
                <div style={{
                  height: "100%", borderRadius: 2,
                  width: `${result.confidence}%`,
                  background: result.confidence >= 80 ? "#2E6B4E" : result.confidence >= 60 ? S.gold : "#dc2626",
                  transition: "width 0.6s ease",
                }} />
              </div>

              <p style={{ fontSize: 11, color: S.ash, marginTop: 6, letterSpacing: "0.04em" }}>
                Scroll to review queue below to approve or reject ↓
              </p>
            </div>
          ) : (
            <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ flexShrink: 0, marginTop: 2 }}>
                <circle cx="7" cy="7" r="6" fill="rgba(220,38,38,0.12)"/>
                <path d="M7 4v3.5" stroke="#dc2626" strokeWidth="1.5" strokeLinecap="round"/>
                <circle cx="7" cy="10.5" r="0.7" fill="#dc2626"/>
              </svg>
              <div>
                <p style={{ fontSize: 12, color: "#dc2626", fontWeight: 600, marginBottom: 3 }}>
                  {result.stage === "scrape" ? "Scrape failed" :
                   result.stage === "extract" ? "Extraction failed" :
                   result.stage === "save" ? "Save failed" : "Error"}
                </p>
                <p style={{ fontSize: 12, color: S.ash, lineHeight: 1.5 }}>
                  {result.error}
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      <style>{`
        @keyframes fyp-spin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
