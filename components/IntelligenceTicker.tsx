"use client";

import Link from "next/link";
import { useState } from "react";

/* ── Types ───────────────────────────────────────────────────────────── */
interface Badge {
  label: string;
  bg: string;
  text: string;
}

interface EntityCard {
  kind: "entity";
  name: string;
  typeLabel: string;
  flag: string;
  country: string;
  intelligence: string;
  badge: Badge;
  updated: string;
}

interface InsightCard {
  kind: "insight";
  label: string;
  text: string;
}

type Card = EntityCard | InsightCard;

/* ── Badge presets ───────────────────────────────────────────────────── */
const B: Record<string, Badge> = {
  open:      { label: "OPEN",                bg: "rgba(59,130,246,0.16)",  text: "#60A5FA" },
  appOpen:   { label: "APPLICATIONS OPEN",   bg: "rgba(59,130,246,0.16)",  text: "#60A5FA" },
  c3:        { label: "3 DAYS LEFT",         bg: "rgba(239,68,68,0.16)",   text: "#F87171" },
  c6:        { label: "6 DAYS LEFT",         bg: "rgba(239,68,68,0.16)",   text: "#F87171" },
  c12:       { label: "12 DAYS LEFT",        bg: "rgba(239,68,68,0.16)",   text: "#F87171" },
  c48h:      { label: "48 HRS LEFT",         bg: "rgba(239,68,68,0.16)",   text: "#F87171" },
  isNew:     { label: "NEW",                 bg: "rgba(34,197,94,0.16)",   text: "#4ADE80" },
  featured:  { label: "FEATURED",            bg: "rgba(191,153,83,0.20)",  text: "#D4A853" },
  matched:   { label: "MATCHED FOR YOU",     bg: "rgba(168,85,247,0.16)",  text: "#C084FC" },
  seeking:   { label: "SEEKING PROJECTS",    bg: "rgba(245,158,11,0.16)",  text: "#FCD34D" },
  coProd:    { label: "CO-PROD FRIENDLY",    bg: "rgba(6,182,212,0.16)",   text: "#22D3EE" },
  acquiring: { label: "ACTIVE ACQUISITIONS", bg: "rgba(16,185,129,0.16)", text: "#34D399" },
  trending:  { label: "TRENDING",            bg: "rgba(249,115,22,0.16)",  text: "#FB923C" },
};

/* ── Entity data ─────────────────────────────────────────────────────── */
const ENTITIES: EntityCard[] = [
  // FUNDS
  { kind:"entity", name:"Sundance Institute",        typeLabel:"FUND",               flag:"🇺🇸", country:"USA",          intelligence:"Funding up to $50,000",           badge:B.appOpen,   updated:"2h ago"   },
  { kind:"entity", name:"Eurimages",                 typeLabel:"FUND",               flag:"🇪🇺", country:"Europe",       intelligence:"Co-production support up to €500K", badge:B.open,    updated:"5h ago"   },
  { kind:"entity", name:"Hubert Bals Fund",          typeLabel:"FUND",               flag:"🇳🇱", country:"Netherlands",  intelligence:"Development grants available",      badge:B.appOpen,  updated:"1d ago"   },
  { kind:"entity", name:"IDFA Bertha Fund",          typeLabel:"FUND",               flag:"🇳🇱", country:"Netherlands",  intelligence:"Docs from the Global South",        badge:B.c3,       updated:"1h ago"   },
  { kind:"entity", name:"Doha Film Institute",       typeLabel:"FUND",               flag:"🇶🇦", country:"Qatar",        intelligence:"MENA region films prioritised",     badge:B.appOpen,  updated:"3h ago"   },
  { kind:"entity", name:"Chicken & Egg Pictures",    typeLabel:"FUND",               flag:"🇺🇸", country:"USA",          intelligence:"Female-directed documentaries",     badge:B.isNew,    updated:"1h ago"   },
  { kind:"entity", name:"Catapult Film Fund",        typeLabel:"FUND",               flag:"🇺🇸", country:"USA",          intelligence:"US documentary development",        badge:B.appOpen,  updated:"6h ago"   },
  { kind:"entity", name:"Creative Europe MEDIA",     typeLabel:"FUND",               flag:"🇪🇺", country:"Europe",       intelligence:"Development & distribution grants", badge:B.open,     updated:"8h ago"   },
  { kind:"entity", name:"BFI",                       typeLabel:"FUND",               flag:"🇬🇧", country:"UK",           intelligence:"UK-based productions",              badge:B.open,     updated:"4h ago"   },
  { kind:"entity", name:"Telefilm Canada",           typeLabel:"FUND",               flag:"🇨🇦", country:"Canada",       intelligence:"Feature films & web series",         badge:B.appOpen,  updated:"2h ago"   },
  { kind:"entity", name:"CNC France",                typeLabel:"FUND",               flag:"🇫🇷", country:"France",       intelligence:"French-language productions",        badge:B.trending, updated:"Just now" },
  { kind:"entity", name:"Berlinale World Cinema",    typeLabel:"FUND",               flag:"🇩🇪", country:"Germany",      intelligence:"Global South productions",           badge:B.c48h,     updated:"30m ago"  },
  // PRODUCTION COMPANIES
  { kind:"entity", name:"A24",                       typeLabel:"PRODUCTION COMPANY", flag:"🇺🇸", country:"USA",          intelligence:"Seeking Feature Films",             badge:B.seeking,  updated:"Just now" },
  { kind:"entity", name:"BBC Film",                  typeLabel:"PRODUCTION COMPANY", flag:"🇬🇧", country:"UK",           intelligence:"International co-productions",       badge:B.coProd,   updated:"4h ago"   },
  { kind:"entity", name:"Film4",                     typeLabel:"PRODUCTION COMPANY", flag:"🇬🇧", country:"UK",           intelligence:"UK & international projects",        badge:B.seeking,  updated:"6h ago"   },
  { kind:"entity", name:"Plan B Entertainment",      typeLabel:"PRODUCTION COMPANY", flag:"🇺🇸", country:"USA",          intelligence:"Open to debut directors",            badge:B.seeking,  updated:"3h ago"   },
  { kind:"entity", name:"MK2 Productions",           typeLabel:"PRODUCTION COMPANY", flag:"🇫🇷", country:"France",       intelligence:"Auteur & arthouse films",            badge:B.coProd,   updated:"8h ago"   },
  { kind:"entity", name:"Participant",               typeLabel:"PRODUCTION COMPANY", flag:"🇺🇸", country:"USA",          intelligence:"Social impact documentaries",        badge:B.seeking,  updated:"5h ago"   },
  { kind:"entity", name:"Wild Bunch",                typeLabel:"PRODUCTION COMPANY", flag:"🇫🇷", country:"France",       intelligence:"Art house & auteur cinema",          badge:B.coProd,   updated:"1d ago"   },
  { kind:"entity", name:"Match Factory Productions", typeLabel:"PRODUCTION COMPANY", flag:"🇩🇪", country:"Germany",      intelligence:"International features",             badge:B.coProd,   updated:"2h ago"   },
  // STREAMERS & BROADCASTERS
  { kind:"entity", name:"Netflix",                   typeLabel:"STREAMER",           flag:"🌍", country:"Global",       intelligence:"Acquiring International Features",   badge:B.acquiring, updated:"Just now" },
  { kind:"entity", name:"Apple TV+",                 typeLabel:"STREAMER",           flag:"🌍", country:"Global",       intelligence:"Prestige cinema & documentaries",    badge:B.acquiring, updated:"2h ago"   },
  { kind:"entity", name:"MUBI",                      typeLabel:"STREAMER",           flag:"🌍", country:"Global",       intelligence:"Festival films & art house",         badge:B.acquiring, updated:"5h ago"   },
  { kind:"entity", name:"Amazon MGM Studios",        typeLabel:"STREAMER",           flag:"🌍", country:"Global",       intelligence:"International documentaries",        badge:B.acquiring, updated:"3h ago"   },
  { kind:"entity", name:"ARTE",                      typeLabel:"BROADCASTER",        flag:"🇫🇷", country:"France / DE",  intelligence:"European co-productions",            badge:B.coProd,   updated:"1d ago"   },
  { kind:"entity", name:"ZDF",                       typeLabel:"BROADCASTER",        flag:"🇩🇪", country:"Germany",      intelligence:"Documentary acquisitions open",      badge:B.acquiring, updated:"8h ago"   },
  { kind:"entity", name:"Canal+",                    typeLabel:"BROADCASTER",        flag:"🇫🇷", country:"France",       intelligence:"European features & docs",           badge:B.acquiring, updated:"4h ago"   },
  // SALES AGENTS
  { kind:"entity", name:"Films Boutique",            typeLabel:"SALES AGENT",        flag:"🇩🇪", country:"Germany",      intelligence:"Festival-ready films sought",        badge:B.open,     updated:"6h ago"   },
  { kind:"entity", name:"The Match Factory",         typeLabel:"SALES AGENT",        flag:"🇩🇪", country:"Germany",      intelligence:"International features",             badge:B.seeking,  updated:"4h ago"   },
  { kind:"entity", name:"MK2 Films",                 typeLabel:"SALES AGENT",        flag:"🇫🇷", country:"France",       intelligence:"Art house cinema",                   badge:B.featured, updated:"2h ago"   },
  { kind:"entity", name:"Wild Bunch International",  typeLabel:"SALES AGENT",        flag:"🇫🇷", country:"France",       intelligence:"Genre & art house",                  badge:B.open,     updated:"1d ago"   },
  { kind:"entity", name:"Luxbox",                    typeLabel:"SALES AGENT",        flag:"🇫🇷", country:"France",       intelligence:"Debut features & world cinema",      badge:B.isNew,    updated:"3h ago"   },
  { kind:"entity", name:"Film Constellation",        typeLabel:"SALES AGENT",        flag:"🇬🇧", country:"UK",           intelligence:"Arthouse & genre features",          badge:B.open,     updated:"5h ago"   },
  // FESTIVALS
  { kind:"entity", name:"Cannes Film Festival",      typeLabel:"FESTIVAL",           flag:"🇫🇷", country:"France",       intelligence:"Submission Deadline: 12 Days",       badge:B.c12,      updated:"Just now" },
  { kind:"entity", name:"Berlinale",                 typeLabel:"FESTIVAL",           flag:"🇩🇪", country:"Germany",      intelligence:"Submissions now open",               badge:B.appOpen,  updated:"8h ago"   },
  { kind:"entity", name:"Venice Film Festival",      typeLabel:"FESTIVAL",           flag:"🇮🇹", country:"Italy",        intelligence:"Competition entries open",           badge:B.appOpen,  updated:"5h ago"   },
  { kind:"entity", name:"TIFF",                      typeLabel:"FESTIVAL",           flag:"🇨🇦", country:"Canada",       intelligence:"Early deadline: 6 Days",             badge:B.c6,       updated:"2h ago"   },
  { kind:"entity", name:"IDFA",                      typeLabel:"FESTIVAL",           flag:"🇳🇱", country:"Netherlands",  intelligence:"Feature documentaries sought",       badge:B.appOpen,  updated:"3h ago"   },
  { kind:"entity", name:"Locarno",                   typeLabel:"FESTIVAL",           flag:"🇨🇭", country:"Switzerland",  intelligence:"World premieres only",               badge:B.appOpen,  updated:"1d ago"   },
  { kind:"entity", name:"SXSW",                      typeLabel:"FESTIVAL",           flag:"🇺🇸", country:"USA",          intelligence:"Narratives & documentaries",         badge:B.appOpen,  updated:"6h ago"   },
  { kind:"entity", name:"Busan BIFF",                typeLabel:"FESTIVAL",           flag:"🇰🇷", country:"South Korea",  intelligence:"Asian cinema priority",              badge:B.isNew,    updated:"4h ago"   },
  // MARKETS
  { kind:"entity", name:"Marché du Film",            typeLabel:"MARKET",             flag:"🇫🇷", country:"France",       intelligence:"Registration opens in 12 days",      badge:B.appOpen,  updated:"4h ago"   },
  { kind:"entity", name:"European Film Market",      typeLabel:"MARKET",             flag:"🇩🇪", country:"Germany",      intelligence:"Industry accreditation open",        badge:B.open,     updated:"6h ago"   },
  { kind:"entity", name:"American Film Market",      typeLabel:"MARKET",             flag:"🇺🇸", country:"USA",          intelligence:"Buyers & sellers registration",      badge:B.appOpen,  updated:"8h ago"   },
  { kind:"entity", name:"Ventana Sur",               typeLabel:"MARKET",             flag:"🇦🇷", country:"Argentina",    intelligence:"Latin American projects",            badge:B.isNew,    updated:"2h ago"   },
  // LABS & RESIDENCIES
  { kind:"entity", name:"TorinoFilmLab",             typeLabel:"LAB",                flag:"🇮🇹", country:"Italy",        intelligence:"Development programme open",         badge:B.appOpen,  updated:"2d ago"   },
  { kind:"entity", name:"Berlinale Talents",         typeLabel:"LAB",                flag:"🇩🇪", country:"Germany",      intelligence:"International talents sought",       badge:B.isNew,    updated:"Just now" },
  { kind:"entity", name:"Sundance Labs",             typeLabel:"LAB",                flag:"🇺🇸", country:"USA",          intelligence:"Feature & documentary labs open",    badge:B.appOpen,  updated:"1d ago"   },
  { kind:"entity", name:"Open Doors",                typeLabel:"RESIDENCY",          flag:"🇨🇭", country:"Switzerland",  intelligence:"Global South filmmakers",            badge:B.appOpen,  updated:"3h ago"   },
  { kind:"entity", name:"Cinefondation",             typeLabel:"RESIDENCY",          flag:"🇫🇷", country:"France",       intelligence:"Post-production residency",          badge:B.c48h,     updated:"1h ago"   },
  { kind:"entity", name:"MIDPOINT",                  typeLabel:"LAB",                flag:"🇨🇿", country:"Czech Republic",intelligence:"Script & project development",      badge:B.appOpen,  updated:"5h ago"   },
];

/* ── Insight cards ───────────────────────────────────────────────────── */
const INSIGHTS: InsightCard[] = [
  { kind:"insight", label:"FYLYMPITCH INSIGHT",  text:"14 documentary funds close this month." },
  { kind:"insight", label:"PRODUCER TREND",      text:"23 European producers currently seeking India co-productions." },
  { kind:"insight", label:"ACQUISITION ALERT",   text:"4 streamers currently acquiring international documentaries." },
  { kind:"insight", label:"FESTIVAL TREND",      text:"127 festivals currently accepting submissions worldwide." },
  { kind:"insight", label:"INDUSTRY SNAPSHOT",   text:"$42M currently available across active funding opportunities." },
  { kind:"insight", label:"MARKET ALERT",        text:"5 major funding opportunities close this week." },
  { kind:"insight", label:"CO-PROD TREND",       text:"India–Europe co-production activity up 34% this quarter." },
  { kind:"insight", label:"DEBUT DIRECTORS",     text:"18 funds currently prioritising debut feature films." },
];

/* ── Stats bar data ──────────────────────────────────────────────────── */
const STATS = [
  { value: "1,847",   label: "Active Funding Opportunities" },
  { value: "6,293",   label: "Production Companies" },
  { value: "782",     label: "Sales Agents" },
  { value: "411",     label: "Festivals" },
  { value: "127",     label: "Film Markets" },
  { value: "89",      label: "Streamers & Broadcasters" },
  { value: "23,000+", label: "Organizations Indexed" },
  { value: "$3.2B+",  label: "Funding Tracked" },
];

/* ── Build carousel array (insights every 5 entity cards) ───────────── */
function buildCards(): Card[] {
  const result: Card[] = [];
  let insightIdx = 0;
  for (let i = 0; i < ENTITIES.length; i++) {
    result.push(ENTITIES[i]);
    if ((i + 1) % 5 === 0) {
      result.push(INSIGHTS[insightIdx % INSIGHTS.length]);
      insightIdx++;
    }
  }
  return result;
}

const BASE_CARDS = buildCards();
const TRACK_CARDS: Card[] = [...BASE_CARDS, ...BASE_CARDS]; // duplicate → seamless loop

/* ── Sub-components ──────────────────────────────────────────────────── */
function EntityCardEl({ card }: { card: EntityCard }) {
  return (
    <div
      className="ticker-card"
      style={{
        flexShrink: 0,
        background: "rgba(255,255,255,0.028)",
        border: "1px solid rgba(255,255,255,0.07)",
        borderRadius: "12px",
        padding: "11px 13px",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        gap: "6px",
      }}
    >
      {/* Type + Name */}
      <div>
        <div style={{
          fontSize: "9px",
          letterSpacing: "0.22em",
          color: "rgba(255,255,255,0.3)",
          textTransform: "uppercase",
          marginBottom: "3px",
          fontWeight: 500,
        }}>
          {card.typeLabel}
        </div>
        <div style={{
          fontSize: "13px",
          fontWeight: 600,
          color: "#E8E4DE",
          lineHeight: 1.25,
          fontFamily: "var(--font-display)",
          letterSpacing: "0.01em",
        }}>
          {card.name}
        </div>
      </div>

      {/* Intelligence */}
      <div style={{
        fontSize: "11px",
        color: "rgba(255,255,255,0.45)",
        lineHeight: 1.35,
      }}>
        {card.intelligence}
      </div>

      {/* Badge + country/time */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "6px" }}>
        <span style={{
          fontSize: "8px",
          letterSpacing: "0.12em",
          background: card.badge.bg,
          color: card.badge.text,
          borderRadius: "4px",
          padding: "2px 6px",
          textTransform: "uppercase",
          fontWeight: 600,
          whiteSpace: "nowrap",
          flexShrink: 0,
        }}>
          {card.badge.label}
        </span>
        <span style={{
          fontSize: "9px",
          color: "rgba(255,255,255,0.22)",
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}>
          {card.flag} · {card.updated}
        </span>
      </div>
    </div>
  );
}

function InsightCardEl({ card }: { card: InsightCard }) {
  return (
    <div
      className="ticker-card"
      style={{
        flexShrink: 0,
        background: "rgba(191,153,83,0.07)",
        border: "1px solid rgba(191,153,83,0.18)",
        borderRadius: "12px",
        padding: "13px 15px",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        gap: "7px",
      }}
    >
      <div style={{
        fontSize: "8.5px",
        letterSpacing: "0.22em",
        color: "#BF9953",
        textTransform: "uppercase",
        fontWeight: 600,
        display: "flex",
        alignItems: "center",
        gap: "5px",
      }}>
        <span>🧠</span>
        <span>{card.label}</span>
      </div>
      <div style={{
        fontSize: "11.5px",
        color: "rgba(255,255,255,0.68)",
        lineHeight: 1.45,
        fontWeight: 400,
      }}>
        {card.text}
      </div>
    </div>
  );
}

/* ── Main component ──────────────────────────────────────────────────── */
export default function IntelligenceTicker() {
  const [paused, setPaused] = useState(false);

  return (
    <section
      aria-label="Global Film Industry Intelligence Ticker"
      style={{
        background: "#050814",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
        overflow: "hidden",
      }}
    >
      {/* ── Header ── */}
      <div
        style={{
          maxWidth: "1152px",
          margin: "0 auto",
          padding: "14px 24px 10px",
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: "12px",
        }}
      >
        <div>
          <p style={{
            fontSize: "10px",
            letterSpacing: "0.26em",
            color: "rgba(255,255,255,0.5)",
            textTransform: "uppercase",
            marginBottom: "3px",
            fontWeight: 600,
          }}>
            GLOBAL FILM INDUSTRY INTELLIGENCE
          </p>
          <p style={{
            fontSize: "11px",
            color: "rgba(255,255,255,0.26)",
            lineHeight: 1.4,
            letterSpacing: "0.02em",
          }}>
            Live funding, producers, festivals, markets, acquisitions and co-production opportunities worldwide.
          </p>
        </div>
        <Link
          href="/dashboard"
          style={{
            fontSize: "10px",
            letterSpacing: "0.18em",
            color: "#BF9953",
            textTransform: "uppercase",
            whiteSpace: "nowrap",
            fontWeight: 500,
            flexShrink: 0,
            paddingTop: "2px",
            textDecoration: "none",
          }}
          aria-label="View all intelligence"
        >
          View All →
        </Link>
      </div>

      {/* ── Carousel ── */}
      <div
        style={{ overflow: "hidden" }}
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
        onTouchStart={() => setPaused(true)}
        onTouchEnd={() => setPaused(false)}
      >
        <div
          style={{
            display: "flex",
            gap: "10px",
            padding: "4px 24px 8px",
            width: "max-content",
            animation: "fylym-ticker 36s linear infinite",
            animationPlayState: paused ? "paused" : "running",
            willChange: "transform",
          }}
        >
          {TRACK_CARDS.map((card, i) =>
            card.kind === "insight"
              ? <InsightCardEl key={i} card={card} />
              : <EntityCardEl   key={i} card={card} />
          )}
        </div>
      </div>

      {/* ── Live Stats Bar ── */}
      <div style={{
        borderTop: "1px solid rgba(255,255,255,0.05)",
        padding: "8px 24px",
        overflowX: "auto",
        scrollbarWidth: "none",
      }}>
        <div
          style={{
            display: "flex",
            gap: "28px",
            alignItems: "center",
            whiteSpace: "nowrap",
            maxWidth: "1152px",
            margin: "0 auto",
          }}
          role="status"
          aria-label="Live platform statistics"
        >
          {STATS.map(({ value, label }) => (
            <div
              key={label}
              style={{ display: "flex", alignItems: "baseline", gap: "5px", flexShrink: 0 }}
            >
              <span style={{
                fontSize: "12px",
                fontWeight: 700,
                color: "#BF9953",
                fontVariantNumeric: "tabular-nums",
                letterSpacing: "0.01em",
              }}>
                {value}
              </span>
              <span style={{
                fontSize: "10px",
                color: "rgba(255,255,255,0.28)",
                letterSpacing: "0.06em",
              }}>
                {label}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
