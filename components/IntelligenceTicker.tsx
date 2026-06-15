"use client";

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
  domain: string;
}

interface InsightCard {
  kind: "insight";
  label: string;
  text: string;
}

type Card = EntityCard | InsightCard;

/* ── Badge presets ───────────────────────────────────────────────────── */
const B: Record<string, Badge> = {
  open:      { label: "OPEN",                bg: "rgba(59,130,246,0.09)",  text: "#1D4ED8" },
  appOpen:   { label: "APPLICATIONS OPEN",   bg: "rgba(59,130,246,0.09)",  text: "#1D4ED8" },
  c3:        { label: "3 DAYS LEFT",         bg: "rgba(220,38,38,0.08)",   text: "#B91C1C" },
  c6:        { label: "6 DAYS LEFT",         bg: "rgba(220,38,38,0.08)",   text: "#B91C1C" },
  c12:       { label: "12 DAYS LEFT",        bg: "rgba(220,38,38,0.08)",   text: "#B91C1C" },
  c48h:      { label: "48 HRS LEFT",         bg: "rgba(220,38,38,0.08)",   text: "#B91C1C" },
  isNew:     { label: "NEW",                 bg: "rgba(22,163,74,0.09)",   text: "#15803D" },
  featured:  { label: "FEATURED",            bg: "rgba(191,153,83,0.14)",  text: "#92672A" },
  seeking:   { label: "SEEKING PROJECTS",    bg: "rgba(180,83,9,0.08)",    text: "#9A3412" },
  coProd:    { label: "CO-PROD FRIENDLY",    bg: "rgba(8,145,178,0.08)",   text: "#0E7490" },
  acquiring: { label: "ACTIVE ACQUISITIONS", bg: "rgba(5,150,105,0.08)",   text: "#047857" },
  trending:  { label: "TRENDING",            bg: "rgba(234,88,12,0.08)",   text: "#C2410C" },
};

/* ── Entity data ─────────────────────────────────────────────────────── */
const ENTITIES: EntityCard[] = [
  // FUNDS
  { kind:"entity", name:"Sundance Institute",        typeLabel:"FUND",               flag:"🇺🇸", country:"USA",           intelligence:"Funding up to $50,000",              badge:B.appOpen,   updated:"2h ago",   domain:"sundance.org"              },
  { kind:"entity", name:"Eurimages",                 typeLabel:"FUND",               flag:"🇪🇺", country:"Europe",        intelligence:"Co-production support up to €500K",  badge:B.open,      updated:"5h ago",   domain:"coe.int"                   },
  { kind:"entity", name:"Hubert Bals Fund",          typeLabel:"FUND",               flag:"🇳🇱", country:"Netherlands",   intelligence:"Development grants available",        badge:B.appOpen,   updated:"1d ago",   domain:"filmfestivalrotterdam.com" },
  { kind:"entity", name:"IDFA Bertha Fund",          typeLabel:"FUND",               flag:"🇳🇱", country:"Netherlands",   intelligence:"Docs from the Global South",          badge:B.c3,        updated:"1h ago",   domain:"idfa.nl"                   },
  { kind:"entity", name:"Doha Film Institute",       typeLabel:"FUND",               flag:"🇶🇦", country:"Qatar",         intelligence:"MENA region films prioritised",       badge:B.appOpen,   updated:"3h ago",   domain:"dohafilminstitute.com"     },
  { kind:"entity", name:"Chicken & Egg Pictures",    typeLabel:"FUND",               flag:"🇺🇸", country:"USA",           intelligence:"Female-directed documentaries",        badge:B.isNew,     updated:"1h ago",   domain:"chickeneggpics.org"        },
  { kind:"entity", name:"Creative Europe MEDIA",     typeLabel:"FUND",               flag:"🇪🇺", country:"Europe",        intelligence:"Development & distribution grants",    badge:B.open,      updated:"8h ago",   domain:"creative-europe.eu"        },
  { kind:"entity", name:"BFI",                       typeLabel:"FUND",               flag:"🇬🇧", country:"UK",            intelligence:"UK-based productions",                badge:B.open,      updated:"4h ago",   domain:"bfi.org.uk"                },
  { kind:"entity", name:"Telefilm Canada",           typeLabel:"FUND",               flag:"🇨🇦", country:"Canada",        intelligence:"Feature films & web series",           badge:B.appOpen,   updated:"2h ago",   domain:"telefilm.ca"               },
  { kind:"entity", name:"CNC France",                typeLabel:"FUND",               flag:"🇫🇷", country:"France",        intelligence:"French-language productions",          badge:B.trending,  updated:"Just now", domain:"cnc.fr"                    },
  // PRODUCTION COMPANIES
  { kind:"entity", name:"A24",                       typeLabel:"PRODUCTION COMPANY", flag:"🇺🇸", country:"USA",           intelligence:"Seeking Feature Films",               badge:B.seeking,   updated:"Just now", domain:"a24films.com"              },
  { kind:"entity", name:"BBC Film",                  typeLabel:"PRODUCTION COMPANY", flag:"🇬🇧", country:"UK",            intelligence:"International co-productions",         badge:B.coProd,    updated:"4h ago",   domain:"bbc.co.uk"                 },
  { kind:"entity", name:"Film4",                     typeLabel:"PRODUCTION COMPANY", flag:"🇬🇧", country:"UK",            intelligence:"UK & international projects",          badge:B.seeking,   updated:"6h ago",   domain:"film4.com"                 },
  { kind:"entity", name:"Plan B Entertainment",      typeLabel:"PRODUCTION COMPANY", flag:"🇺🇸", country:"USA",           intelligence:"Open to debut directors",              badge:B.seeking,   updated:"3h ago",   domain:"planbentertainment.com"    },
  { kind:"entity", name:"MK2 Productions",           typeLabel:"PRODUCTION COMPANY", flag:"🇫🇷", country:"France",        intelligence:"Auteur & arthouse films",              badge:B.coProd,    updated:"8h ago",   domain:"mk2.com"                   },
  { kind:"entity", name:"Wild Bunch",                typeLabel:"PRODUCTION COMPANY", flag:"🇫🇷", country:"France",        intelligence:"Art house & auteur cinema",            badge:B.coProd,    updated:"1d ago",   domain:"wildbunch.eu"              },
  { kind:"entity", name:"Match Factory Productions", typeLabel:"PRODUCTION COMPANY", flag:"🇩🇪", country:"Germany",       intelligence:"International features",               badge:B.coProd,    updated:"2h ago",   domain:"the-match-factory.com"     },
  // STREAMERS & BROADCASTERS
  { kind:"entity", name:"Netflix",                   typeLabel:"STREAMER",           flag:"🌍", country:"Global",        intelligence:"Acquiring International Features",     badge:B.acquiring, updated:"Just now", domain:"netflix.com"               },
  { kind:"entity", name:"Apple TV+",                 typeLabel:"STREAMER",           flag:"🌍", country:"Global",        intelligence:"Prestige cinema & documentaries",       badge:B.acquiring, updated:"2h ago",   domain:"apple.com"                 },
  { kind:"entity", name:"MUBI",                      typeLabel:"STREAMER",           flag:"🌍", country:"Global",        intelligence:"Festival films & art house",            badge:B.acquiring, updated:"5h ago",   domain:"mubi.com"                  },
  { kind:"entity", name:"Amazon MGM Studios",        typeLabel:"STREAMER",           flag:"🌍", country:"Global",        intelligence:"International documentaries",           badge:B.acquiring, updated:"3h ago",   domain:"amazon.com"                },
  { kind:"entity", name:"ARTE",                      typeLabel:"BROADCASTER",        flag:"🇫🇷", country:"France / DE",   intelligence:"European co-productions",              badge:B.coProd,    updated:"1d ago",   domain:"arte.tv"                   },
  { kind:"entity", name:"ZDF",                       typeLabel:"BROADCASTER",        flag:"🇩🇪", country:"Germany",       intelligence:"Documentary acquisitions open",         badge:B.acquiring, updated:"8h ago",   domain:"zdf.de"                    },
  { kind:"entity", name:"Canal+",                    typeLabel:"BROADCASTER",        flag:"🇫🇷", country:"France",        intelligence:"European features & docs",              badge:B.acquiring, updated:"4h ago",   domain:"canalplus.com"             },
  // SALES AGENTS
  { kind:"entity", name:"Films Boutique",            typeLabel:"SALES AGENT",        flag:"🇩🇪", country:"Germany",       intelligence:"Festival-ready films sought",          badge:B.open,      updated:"6h ago",   domain:"filmsboutique.com"         },
  { kind:"entity", name:"The Match Factory",         typeLabel:"SALES AGENT",        flag:"🇩🇪", country:"Germany",       intelligence:"International features",               badge:B.seeking,   updated:"4h ago",   domain:"the-match-factory.com"     },
  { kind:"entity", name:"MK2 Films",                 typeLabel:"SALES AGENT",        flag:"🇫🇷", country:"France",        intelligence:"Art house cinema",                     badge:B.featured,  updated:"2h ago",   domain:"mk2.com"                   },
  { kind:"entity", name:"Wild Bunch International",  typeLabel:"SALES AGENT",        flag:"🇫🇷", country:"France",        intelligence:"Genre & art house",                    badge:B.open,      updated:"1d ago",   domain:"wildbunch.eu"              },
  { kind:"entity", name:"Luxbox",                    typeLabel:"SALES AGENT",        flag:"🇫🇷", country:"France",        intelligence:"Debut features & world cinema",         badge:B.isNew,     updated:"3h ago",   domain:"luxboxfilms.com"           },
  // FESTIVALS
  { kind:"entity", name:"Cannes Film Festival",      typeLabel:"FESTIVAL",           flag:"🇫🇷", country:"France",        intelligence:"Submission Deadline: 12 Days",         badge:B.c12,       updated:"Just now", domain:"festival-cannes.com"       },
  { kind:"entity", name:"Berlinale",                 typeLabel:"FESTIVAL",           flag:"🇩🇪", country:"Germany",       intelligence:"Submissions now open",                 badge:B.appOpen,   updated:"8h ago",   domain:"berlinale.de"              },
  { kind:"entity", name:"Venice Film Festival",      typeLabel:"FESTIVAL",           flag:"🇮🇹", country:"Italy",         intelligence:"Competition entries open",              badge:B.appOpen,   updated:"5h ago",   domain:"labiennale.org"            },
  { kind:"entity", name:"TIFF",                      typeLabel:"FESTIVAL",           flag:"🇨🇦", country:"Canada",        intelligence:"Early deadline: 6 Days",               badge:B.c6,        updated:"2h ago",   domain:"tiff.net"                  },
  { kind:"entity", name:"IDFA",                      typeLabel:"FESTIVAL",           flag:"🇳🇱", country:"Netherlands",   intelligence:"Feature documentaries sought",          badge:B.appOpen,   updated:"3h ago",   domain:"idfa.nl"                   },
  { kind:"entity", name:"Locarno",                   typeLabel:"FESTIVAL",           flag:"🇨🇭", country:"Switzerland",   intelligence:"World premieres only",                 badge:B.appOpen,   updated:"1d ago",   domain:"locarnofestival.ch"        },
  { kind:"entity", name:"SXSW",                      typeLabel:"FESTIVAL",           flag:"🇺🇸", country:"USA",           intelligence:"Narratives & documentaries",            badge:B.appOpen,   updated:"6h ago",   domain:"sxsw.com"                  },
  { kind:"entity", name:"Busan BIFF",                typeLabel:"FESTIVAL",           flag:"🇰🇷", country:"South Korea",   intelligence:"Asian cinema priority",                badge:B.isNew,     updated:"4h ago",   domain:"biff.kr"                   },
  // MARKETS
  { kind:"entity", name:"Marché du Film",            typeLabel:"MARKET",             flag:"🇫🇷", country:"France",        intelligence:"Registration opens in 12 days",         badge:B.appOpen,   updated:"4h ago",   domain:"marchedufilm.com"          },
  { kind:"entity", name:"European Film Market",      typeLabel:"MARKET",             flag:"🇩🇪", country:"Germany",       intelligence:"Industry accreditation open",           badge:B.open,      updated:"6h ago",   domain:"efm-berlinale.de"          },
  { kind:"entity", name:"American Film Market",      typeLabel:"MARKET",             flag:"🇺🇸", country:"USA",           intelligence:"Buyers & sellers registration",         badge:B.appOpen,   updated:"8h ago",   domain:"americanfilmmarket.com"    },
  { kind:"entity", name:"Ventana Sur",               typeLabel:"MARKET",             flag:"🇦🇷", country:"Argentina",     intelligence:"Latin American projects",               badge:B.isNew,     updated:"2h ago",   domain:"ventanasur.net"            },
  // LABS
  { kind:"entity", name:"TorinoFilmLab",             typeLabel:"LAB",                flag:"🇮🇹", country:"Italy",         intelligence:"Development programme open",            badge:B.appOpen,   updated:"2d ago",   domain:"torinofilmlab.org"         },
  { kind:"entity", name:"Berlinale Talents",         typeLabel:"LAB",                flag:"🇩🇪", country:"Germany",       intelligence:"International talents sought",          badge:B.isNew,     updated:"Just now", domain:"berlinale-talents.de"      },
  { kind:"entity", name:"Sundance Labs",             typeLabel:"LAB",                flag:"🇺🇸", country:"USA",           intelligence:"Feature & documentary labs open",       badge:B.appOpen,   updated:"1d ago",   domain:"sundance.org"              },
  { kind:"entity", name:"Cinefondation",             typeLabel:"RESIDENCY",          flag:"🇫🇷", country:"France",        intelligence:"Post-production residency",             badge:B.c48h,      updated:"1h ago",   domain:"festival-cannes.com"       },
  { kind:"entity", name:"MIDPOINT",                  typeLabel:"LAB",                flag:"🇨🇿", country:"Czech Republic", intelligence:"Script & project development",         badge:B.appOpen,   updated:"5h ago",   domain:"midpoint-center.eu"        },
];

/* ── Insight cards ───────────────────────────────────────────────────── */
const INSIGHTS: InsightCard[] = [
  { kind:"insight", label:"FYLYMPITCH INSIGHT",  text:"14 documentary funds close this month." },
  { kind:"insight", label:"PRODUCER TREND",      text:"23 European producers seeking India co-productions." },
  { kind:"insight", label:"ACQUISITION ALERT",   text:"4 streamers acquiring international documentaries." },
  { kind:"insight", label:"FESTIVAL TREND",      text:"127 festivals currently accepting submissions." },
  { kind:"insight", label:"INDUSTRY SNAPSHOT",   text:"$42M available across active funding opportunities." },
  { kind:"insight", label:"MARKET ALERT",        text:"5 major funding opportunities close this week." },
  { kind:"insight", label:"CO-PROD TREND",       text:"India–Europe co-production activity up 34% this quarter." },
];

/* ── Stats ───────────────────────────────────────────────────────────── */
const STATS = [
  { value: "1,847",   label: "Active Opportunities" },
  { value: "6,293",   label: "Production Companies" },
  { value: "782",     label: "Sales Agents" },
  { value: "411",     label: "Festivals" },
  { value: "127",     label: "Film Markets" },
  { value: "89",      label: "Streamers & Broadcasters" },
  { value: "23,000+", label: "Organizations" },
  { value: "$3.2B+",  label: "Funding Tracked" },
];

/* ── Build carousel ──────────────────────────────────────────────────── */
function buildCards(): Card[] {
  const result: Card[] = [];
  let ii = 0;
  for (let i = 0; i < ENTITIES.length; i++) {
    result.push(ENTITIES[i]);
    if ((i + 1) % 5 === 0) {
      result.push(INSIGHTS[ii % INSIGHTS.length]);
      ii++;
    }
  }
  return result;
}
const BASE  = buildCards();
const TRACK = [...BASE, ...BASE];

/* ── Logo — tries Clearbit, then Google favicon, then monogram ───────── */
function OrgLogo({ name, domain }: { name: string; domain: string }) {
  const [stage, setStage] = useState<0|1|2>(0);

  const initials = name
    .replace(/[^a-zA-Z\s]/g, "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(w => w[0])
    .join("")
    .toUpperCase() || name.slice(0, 2).toUpperCase();

  const sources: string[] = [
    `https://logo.clearbit.com/${domain}`,
    `https://t3.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=https://${domain}&size=128`,
  ];

  if (stage === 2) {
    return (
      <div style={{
        width: 44, height: 44, borderRadius: 8, flexShrink: 0,
        background: "rgba(191,153,83,0.1)",
        border: "1px solid rgba(191,153,83,0.22)",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 13, fontWeight: 700, color: "#92672A",
        letterSpacing: "0.04em", fontFamily: "var(--font-sans)",
      }}>
        {initials}
      </div>
    );
  }

  return (
    <div style={{ width: 44, height: 44, flexShrink: 0, display:"flex", alignItems:"center", justifyContent:"center" }}>
      <img
        src={sources[stage]}
        alt={name}
        loading="lazy"
        style={{
          maxWidth: 44, maxHeight: 44,
          width: "auto", height: "auto",
          objectFit: "contain",
          display: "block",
        }}
        onError={() => {
          if (stage < 1) setStage(1);
          else setStage(2);
        }}
      />
    </div>
  );
}

/* ── Entity card ─────────────────────────────────────────────────────── */
function EntityCardEl({ card }: { card: EntityCard }) {
  return (
    <div
      className="ticker-card"
      style={{
        flexShrink: 0,
        display: "flex",
        flexDirection: "column",
        gap: 8,
        padding: "0 20px",
        borderRight: "1px solid #E5E0D5",
      }}
    >
      {/* Logo */}
      <OrgLogo name={card.name} domain={card.domain} />

      {/* Type label */}
      <div style={{
        fontSize: 8.5,
        letterSpacing: "0.22em",
        color: "#B8B2A8",
        textTransform: "uppercase",
        fontWeight: 500,
      }}>
        {card.typeLabel}
      </div>

      {/* Name */}
      <div style={{
        fontSize: 13,
        fontWeight: 600,
        color: "#1A1815",
        lineHeight: 1.2,
        fontFamily: "var(--font-display)",
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "ellipsis",
        maxWidth: "100%",
      }}>
        {card.name}
      </div>

      {/* Intelligence */}
      <div style={{
        fontSize: 11,
        color: "#8A857C",
        lineHeight: 1.35,
        flexGrow: 1,
      }}>
        {card.intelligence}
      </div>

      {/* Badge row */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6 }}>
        <span style={{
          fontSize: 7.5,
          letterSpacing: "0.13em",
          background: card.badge.bg,
          color: card.badge.text,
          borderRadius: 4,
          padding: "2px 6px",
          textTransform: "uppercase",
          fontWeight: 600,
          whiteSpace: "nowrap",
          flexShrink: 0,
        }}>
          {card.badge.label}
        </span>
        <span style={{ fontSize: 9, color: "#C8C3BB", whiteSpace: "nowrap" }}>
          {card.flag} {card.updated}
        </span>
      </div>
    </div>
  );
}

/* ── Insight card ────────────────────────────────────────────────────── */
function InsightCardEl({ card }: { card: InsightCard }) {
  return (
    <div
      className="ticker-card"
      style={{
        flexShrink: 0,
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        gap: 8,
        padding: "0 22px",
        borderRight: "1px solid rgba(191,153,83,0.25)",
        borderLeft: "1px solid rgba(191,153,83,0.25)",
      }}
    >
      <div style={{
        fontSize: 8,
        letterSpacing: "0.22em",
        color: "#BF9953",
        textTransform: "uppercase",
        fontWeight: 600,
        display: "flex",
        alignItems: "center",
        gap: 5,
      }}>
        <span>🧠</span>
        <span>{card.label}</span>
      </div>
      <div style={{
        fontSize: 12,
        color: "#1A1815",
        lineHeight: 1.45,
        fontStyle: "italic",
        fontFamily: "var(--font-display)",
        maxWidth: "100%",
      }}>
        {card.text}
      </div>
    </div>
  );
}

/* ── Main export ─────────────────────────────────────────────────────── */
export default function IntelligenceTicker() {
  const [paused, setPaused] = useState(false);

  return (
    <section
      aria-label="Global Film Industry Intelligence"
      style={{ background: "transparent", overflow: "hidden" }}
    >
      {/* ── Section header ── */}
      <div style={{
        maxWidth: "1152px",
        margin: "0 auto",
        padding: "40px 24px 20px",
        display: "flex",
        alignItems: "center",
        gap: 16,
      }}>
        <p style={{
          fontSize: 10,
          letterSpacing: "0.28em",
          color: "#8A857C",
          textTransform: "uppercase",
          fontWeight: 500,
          whiteSpace: "nowrap",
          flexShrink: 0,
        }}>
          Global Intelligence
        </p>
        <span style={{ flex: 1, height: 1, background: "#E5E0D5" }} />
        <p style={{ fontSize: 10, color: "#C8C3BB", whiteSpace: "nowrap", flexShrink: 0, letterSpacing: "0.04em" }}>
          Live · Updated continuously
        </p>
      </div>

      {/* ── Carousel ── */}
      <div
        style={{ overflow: "hidden", borderTop: "1px solid #E5E0D5", borderBottom: "1px solid #E5E0D5" }}
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
        onTouchStart={() => setPaused(true)}
        onTouchEnd={() => setPaused(false)}
      >
        <div
          style={{
            display: "flex",
            alignItems: "stretch",
            padding: "20px 0",
            width: "max-content",
            animation: "fylym-ticker 120s linear infinite",
            animationPlayState: paused ? "paused" : "running",
            willChange: "transform",
          }}
        >
          {TRACK.map((card, i) =>
            card.kind === "insight"
              ? <InsightCardEl key={`i-${i}`} card={card as InsightCard} />
              : <EntityCardEl  key={`e-${i}`} card={card as EntityCard}  />
          )}
        </div>
      </div>

      {/* ── Stats bar ── */}
      <div style={{
        maxWidth: "1152px",
        margin: "0 auto",
        padding: "14px 24px",
        display: "flex",
        gap: 28,
        alignItems: "center",
        overflowX: "auto",
        scrollbarWidth: "none",
        whiteSpace: "nowrap",
      }}>
        {STATS.map(({ value, label }) => (
          <div key={label} style={{ display: "flex", alignItems: "baseline", gap: 5, flexShrink: 0 }}>
            <span style={{
              fontSize: 12, fontWeight: 700, color: "#BF9953",
              fontVariantNumeric: "tabular-nums",
            }}>
              {value}
            </span>
            <span style={{ fontSize: 10, color: "#B8B2A8", letterSpacing: "0.05em" }}>
              {label}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
