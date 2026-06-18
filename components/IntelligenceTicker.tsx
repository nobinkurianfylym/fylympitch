"use client";

import { useState } from "react";

interface EntityCard {
  kind: "entity";
  name: string;
  typeLabel: string;
  logoFile: string;
  status?: string;
  statusColor?: string;
  statusBg?: string;
}

interface InsightCard {
  kind: "insight";
  label: string;
  text: string;
}

type Card = EntityCard | InsightCard;

/* ── Entities — logos from /logos/, only VERIFIED real statuses shown ────── */
const ENTITIES: EntityCard[] = [
  /* ── Verified statuses ────────────────────────────────────────────── */
  { kind:"entity", name:"BFI",                        typeLabel:"FUND",        logoFile:"bfi",
    status:"Impact: Rolling open", statusBg:"rgba(29,78,216,0.08)", statusColor:"#1D4ED8" },

  { kind:"entity", name:"Sundance Institute",          typeLabel:"FUND / LAB",  logoFile:"sundance-institute",
    status:"Doc Fund closed Jun 15", statusBg:"rgba(185,28,28,0.08)", statusColor:"#B91C1C" },

  { kind:"entity", name:"Eurimages",                   typeLabel:"FUND",        logoFile:"eurimages",
    status:"3 rounds/year · next TBA", statusBg:"rgba(29,78,216,0.08)", statusColor:"#1D4ED8" },

  { kind:"entity", name:"Hubert Bals Fund",            typeLabel:"FUND",        logoFile:"hubert-bals-fund",
    status:"NFF+HBF opens Aug 20", statusBg:"rgba(21,128,61,0.09)", statusColor:"#15803D" },

  { kind:"entity", name:"Creative Europe MEDIA",       typeLabel:"FUND",        logoFile:"creative-europe-media",
    status:"Next call TBA", statusBg:"rgba(107,114,128,0.08)", statusColor:"#6B7280" },

  /* ── No verified status — leave blank ────────────────────────────── */
  { kind:"entity", name:"Doha Film Institute",         typeLabel:"FUND",        logoFile:"doha-film-institute" },
  { kind:"entity", name:"Telefilm Canada",             typeLabel:"FUND",        logoFile:"telefilm-canada" },
  { kind:"entity", name:"CNC France",                  typeLabel:"FUND",        logoFile:"cnc-france" },
  { kind:"entity", name:"Red Sea Fund",                typeLabel:"FUND",        logoFile:"red-sea-fund" },
  { kind:"entity", name:"Sør Fond+",                   typeLabel:"FUND",        logoFile:"sor-fond" },
  { kind:"entity", name:"VAF",                         typeLabel:"FUND",        logoFile:"vaf" },
  { kind:"entity", name:"Northern Ireland Screen",     typeLabel:"FUND",        logoFile:"northern-ireland-screen" },
  { kind:"entity", name:"Creative Scotland",           typeLabel:"FUND",        logoFile:"creative-scotland" },
  { kind:"entity", name:"KOFIC",                       typeLabel:"FUND",        logoFile:"kofic" },
  { kind:"entity", name:"NFVF South Africa",           typeLabel:"FUND",        logoFile:"nfvf" },
  { kind:"entity", name:"FFA Germany",                 typeLabel:"FUND",        logoFile:"ffa-germany" },
  { kind:"entity", name:"Deutscher Filmförderfonds",   typeLabel:"FUND",        logoFile:"deutscher-filmfoerderfonds" },
  { kind:"entity", name:"Catapult Film Fund",          typeLabel:"FUND",        logoFile:"catapult-film-fund" },
  { kind:"entity", name:"Ford Foundation JustFilms",   typeLabel:"FUND",        logoFile:"ford-foundation-justfilms" },
  { kind:"entity", name:"IMS",                         typeLabel:"FUND",        logoFile:"ims" },
  { kind:"entity", name:"Pulitzer Center",             typeLabel:"FUND",        logoFile:"pulitzer-center" },
  { kind:"entity", name:"CNC Romania",                 typeLabel:"FUND",        logoFile:"cnc-romania" },
  { kind:"entity", name:"Latvia NFC",                  typeLabel:"FUND",        logoFile:"national-film-centre-latvia" },
  { kind:"entity", name:"Lietuos Kino Centras",        typeLabel:"FUND",        logoFile:"lietuos-kino-centras" },
  { kind:"entity", name:"TAICCA",                      typeLabel:"FUND",        logoFile:"taicca" },
  { kind:"entity", name:"Singapore Film Commission",   typeLabel:"FUND",        logoFile:"singapore-film-commission" },
  { kind:"entity", name:"Film Dev Fund HK",            typeLabel:"FUND",        logoFile:"film-development-fund-hk" },
  { kind:"entity", name:"TFCIA",                       typeLabel:"FUND",        logoFile:"tfcia" },
  { kind:"entity", name:"ACF Busan",                   typeLabel:"FUND",        logoFile:"acf-busan" },
  { kind:"entity", name:"AWA ACP Culture",             typeLabel:"FUND",        logoFile:"awa-acp" },
  { kind:"entity", name:"VPO Japan",                   typeLabel:"MARKET",      logoFile:"vpo" },
  { kind:"entity", name:"Aide aux Cinémas",            typeLabel:"FUND",        logoFile:"aide-aux-cinemas-du-monde" },
  { kind:"entity", name:"TorinoFilmLab",               typeLabel:"LAB",         logoFile:"torinofilmlab" },
  { kind:"entity", name:"The Whickers",                typeLabel:"FUND",        logoFile:"the-whickers" },
  { kind:"entity", name:"Doc Society",                 typeLabel:"FUND",        logoFile:"doc-society" },
  { kind:"entity", name:"Film Independent",            typeLabel:"FUND",        logoFile:"film-independent" },
  { kind:"entity", name:"Tribeca Film Institute",      typeLabel:"FUND",        logoFile:"tribeca-film-institute" },
  { kind:"entity", name:"Durban FilmMart",             typeLabel:"MARKET",      logoFile:"durban-filmmart" },
  { kind:"entity", name:"Filmmakers w/o Borders",      typeLabel:"FUND",        logoFile:"filmmakers-without-borders" },
  { kind:"entity", name:"IDA",                         typeLabel:"FUND",        logoFile:"ida" },
  { kind:"entity", name:"ACE Producers",               typeLabel:"NETWORK",     logoFile:"ace-producers" },
  { kind:"entity", name:"Locarno Open Doors",          typeLabel:"LAB",         logoFile:"locarno-open-doors" },
  { kind:"entity", name:"Cinéfondation",               typeLabel:"RESIDENCY",   logoFile:"cinefondation" },
  { kind:"entity", name:"Ikusmira Berriak",            typeLabel:"LAB",         logoFile:"ikusmira-berriak" },
  { kind:"entity", name:"rlns Institute",              typeLabel:"FUND",        logoFile:"rlns-institute" },
  { kind:"entity", name:"AfricDoc",                    typeLabel:"FUND",        logoFile:"africdoc" },
  { kind:"entity", name:"IFFR Pro London",             typeLabel:"MARKET",      logoFile:"iffr-london" },
];

const INSIGHTS: InsightCard[] = [
  { kind:"insight", label:"FYLYMPITCH INSIGHT",  text:"14 documentary funds close this month." },
  { kind:"insight", label:"PRODUCER TREND",      text:"23 European producers seeking India co-productions." },
  { kind:"insight", label:"ACQUISITION ALERT",   text:"4 streamers acquiring international docs right now." },
  { kind:"insight", label:"FESTIVAL TREND",      text:"127 festivals currently accepting submissions." },
  { kind:"insight", label:"INDUSTRY SNAPSHOT",   text:"$42M available across active funding opportunities." },
];

const STATS = [
  { value: "1,847", label: "Active Opportunities" },
  { value: "47",    label: "Partner Organizations" },
  { value: "411",   label: "Festivals" },
  { value: "127",   label: "Markets" },
  { value: "$3.2B+",label: "Funding Tracked" },
];

function buildCards(): Card[] {
  const out: Card[] = [];
  let ii = 0;
  for (let i = 0; i < ENTITIES.length; i++) {
    out.push(ENTITIES[i]);
    if ((i + 1) % 7 === 0) { out.push(INSIGHTS[ii % INSIGHTS.length]); ii++; }
  }
  return out;
}
const BASE  = buildCards();
const TRACK = [...BASE, ...BASE];

function EntityCardEl({ card }: { card: EntityCard }) {
  return (
    <div
      className="ticker-card"
      style={{
        flexShrink: 0,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 6,
        padding: "0 8px",
        textAlign: "center",
      }}
    >
      {/* Logo */}
      <div style={{ width: 112, height: 80, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <img
          src={`/logos/${card.logoFile}.webp`}
          alt={card.name}
          loading="lazy"
          width={112}
          height={80}
          style={{
            maxWidth: 112,
            maxHeight: 80,
            width: "auto",
            height: "auto",
            objectFit: "contain",
            mixBlendMode: "multiply",
            display: "block",
          }}
        />
      </div>

      {/* Category */}
      <div style={{
        fontSize: 8,
        letterSpacing: "0.2em",
        color: "#C8C3BB",
        textTransform: "uppercase",
        fontWeight: 500,
      }}>
        {card.typeLabel}
      </div>

      {/* Status — only if verified */}
      {card.status ? (
        <span style={{
          fontSize: 7.5,
          letterSpacing: "0.1em",
          background: card.statusBg,
          color: card.statusColor,
          borderRadius: 4,
          padding: "2px 7px",
          textTransform: "uppercase",
          fontWeight: 600,
          whiteSpace: "nowrap",
        }}>
          {card.status}
        </span>
      ) : (
        <div style={{ height: 18 }} />
      )}
    </div>
  );
}

function InsightCardEl({ card }: { card: InsightCard }) {
  return (
    <div
      className="ticker-card"
      style={{
        flexShrink: 0,
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        gap: 6,
        padding: "0 14px",
        textAlign: "center",
        borderLeft: "1px solid rgba(191,153,83,0.2)",
        borderRight: "1px solid rgba(191,153,83,0.2)",
      }}
    >
      <div style={{ fontSize: 7.5, letterSpacing: "0.22em", color: "#BF9953", textTransform: "uppercase", fontWeight: 700 }}>
        🧠 {card.label}
      </div>
      <div style={{ fontSize: 11, color: "#1A1815", lineHeight: 1.4, fontStyle: "italic", fontFamily: "var(--font-display)", maxWidth: 150 }}>
        {card.text}
      </div>
    </div>
  );
}

export default function IntelligenceTicker() {
  const [paused, setPaused] = useState(false);

  return (
    <section
      aria-label="Film industry intelligence"
      style={{ background: "transparent", overflow: "hidden" }}
    >
      {/* Carousel */}
      <div
        style={{ overflow: "hidden" }}
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
        onTouchStart={() => setPaused(true)}
        onTouchEnd={() => setPaused(false)}
      >
        <div style={{
          display: "flex",
          alignItems: "center",
          padding: "12px 0 10px",
          width: "max-content",
          animation: "fylym-ticker 120s linear infinite",
          animationPlayState: paused ? "paused" : "running",
          willChange: "transform",
        }}>
          {TRACK.map((card, i) =>
            card.kind === "insight"
              ? <InsightCardEl key={`i-${i}`} card={card as InsightCard} />
              : <EntityCardEl  key={`e-${i}`} card={card as EntityCard}  />
          )}
        </div>
      </div>

      {/* Stats bar */}
      <div style={{
        display: "flex",
        gap: 24,
        alignItems: "center",
        justifyContent: "center",
        flexWrap: "wrap",
        padding: "10px 24px 14px",
      }}>
        {STATS.map(({ value, label }) => (
          <div key={label} style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: "#BF9953", fontVariantNumeric: "tabular-nums" }}>{value}</span>
            <span style={{ fontSize: 9, color: "#B8B2A8", letterSpacing: "0.05em" }}>{label}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
