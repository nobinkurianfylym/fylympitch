"use client";

import { useState } from "react";

/* ── Types ───────────────────────────────────────────────────────────── */
interface Badge {
  label: string;
  bg: string;
  text: string;
  border: string;
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
  logo: string; // domain for clearbit or direct URL
  logoBg?: string;
}

interface InsightCard {
  kind: "insight";
  label: string;
  text: string;
}

type Card = EntityCard | InsightCard;

/* ── Badge presets ───────────────────────────────────────────────────── */
const B: Record<string, Badge> = {
  open:      { label: "OPEN",                bg: "rgba(59,130,246,0.08)",   text: "#2563EB", border: "rgba(59,130,246,0.2)"  },
  appOpen:   { label: "APPLICATIONS OPEN",   bg: "rgba(59,130,246,0.08)",   text: "#2563EB", border: "rgba(59,130,246,0.2)"  },
  c3:        { label: "3 DAYS LEFT",         bg: "rgba(220,38,38,0.07)",    text: "#DC2626", border: "rgba(220,38,38,0.2)"   },
  c6:        { label: "6 DAYS LEFT",         bg: "rgba(220,38,38,0.07)",    text: "#DC2626", border: "rgba(220,38,38,0.2)"   },
  c12:       { label: "12 DAYS LEFT",        bg: "rgba(220,38,38,0.07)",    text: "#DC2626", border: "rgba(220,38,38,0.2)"   },
  c48h:      { label: "48 HRS LEFT",         bg: "rgba(220,38,38,0.07)",    text: "#DC2626", border: "rgba(220,38,38,0.2)"   },
  isNew:     { label: "NEW",                 bg: "rgba(22,163,74,0.08)",    text: "#16A34A", border: "rgba(22,163,74,0.2)"   },
  featured:  { label: "FEATURED",            bg: "rgba(191,153,83,0.12)",   text: "#92672A", border: "rgba(191,153,83,0.3)"  },
  seeking:   { label: "SEEKING PROJECTS",    bg: "rgba(180,83,9,0.07)",     text: "#B45309", border: "rgba(180,83,9,0.2)"    },
  coProd:    { label: "CO-PROD FRIENDLY",    bg: "rgba(8,145,178,0.07)",    text: "#0891B2", border: "rgba(8,145,178,0.2)"   },
  acquiring: { label: "ACTIVE ACQUISITIONS", bg: "rgba(5,150,105,0.07)",    text: "#059669", border: "rgba(5,150,105,0.2)"   },
  trending:  { label: "TRENDING",            bg: "rgba(234,88,12,0.07)",    text: "#EA580C", border: "rgba(234,88,12,0.2)"   },
};

/* ── Clearbit logo helper ────────────────────────────────────────────── */
const LOGO_DOMAINS: Record<string, string> = {
  "Sundance Institute":        "sundance.org",
  "Eurimages":                 "coe.int",
  "Hubert Bals Fund":          "filmfestivalrotterdam.com",
  "IDFA Bertha Fund":          "idfa.nl",
  "Doha Film Institute":       "dohafilminstitute.com",
  "Chicken & Egg Pictures":    "chickeneggpics.org",
  "Catapult Film Fund":        "catapultfilmfund.org",
  "Creative Europe MEDIA":     "ec.europa.eu",
  "BFI":                       "bfi.org.uk",
  "Telefilm Canada":           "telefilm.ca",
  "CNC France":                "cnc.fr",
  "Berlinale World Cinema":    "berlinale.de",
  "A24":                       "a24films.com",
  "BBC Film":                  "bbc.co.uk",
  "Film4":                     "film4.com",
  "Plan B Entertainment":      "planbentertainment.com",
  "MK2 Productions":           "mk2.com",
  "Participant":               "participant.com",
  "Wild Bunch":                "wildbunch.eu",
  "Match Factory Productions": "the-match-factory.com",
  "Netflix":                   "netflix.com",
  "Apple TV+":                 "apple.com",
  "MUBI":                      "mubi.com",
  "Amazon MGM Studios":        "amazon.com",
  "ARTE":                      "arte.tv",
  "ZDF":                       "zdf.de",
  "Canal+":                    "canalplus.com",
  "Films Boutique":            "filmsboutique.com",
  "The Match Factory":         "the-match-factory.com",
  "MK2 Films":                 "mk2.com",
  "Wild Bunch International":  "wildbunch.eu",
  "Luxbox":                    "luxboxfilms.com",
  "Film Constellation":        "filmconstellation.com",
  "Cannes Film Festival":      "festival-cannes.com",
  "Berlinale":                 "berlinale.de",
  "Venice Film Festival":      "labiennale.org",
  "TIFF":                      "tiff.net",
  "IDFA":                      "idfa.nl",
  "Locarno":                   "locarnofestival.ch",
  "SXSW":                      "sxsw.com",
  "Busan BIFF":                "biff.kr",
  "Marché du Film":            "marchedufilm.com",
  "European Film Market":      "efm-berlinale.de",
  "American Film Market":      "americanfilmmarket.com",
  "Ventana Sur":               "ventanasur.net",
  "TorinoFilmLab":             "torinofilmlab.org",
  "Berlinale Talents":         "berlinale-talents.de",
  "Sundance Labs":             "sundance.org",
  "Open Doors":                "locarnofestival.ch",
  "Cinefondation":             "festival-cannes.com",
  "MIDPOINT":                  "midpoint-center.eu",
};

function logoUrl(name: string): string {
  const domain = LOGO_DOMAINS[name];
  if (!domain) return "";
  return `https://logo.clearbit.com/${domain}?size=48`;
}

/* ── Entity data ─────────────────────────────────────────────────────── */
const ENTITIES: EntityCard[] = [
  // FUNDS
  { kind:"entity", name:"Sundance Institute",        typeLabel:"FUND",               flag:"🇺🇸", country:"USA",           intelligence:"Funding up to $50,000",              badge:B.appOpen,   updated:"2h ago",   logo:"sundance.org"               },
  { kind:"entity", name:"Eurimages",                 typeLabel:"FUND",               flag:"🇪🇺", country:"Europe",        intelligence:"Co-production support up to €500K",  badge:B.open,      updated:"5h ago",   logo:"coe.int"                    },
  { kind:"entity", name:"Hubert Bals Fund",          typeLabel:"FUND",               flag:"🇳🇱", country:"Netherlands",   intelligence:"Development grants available",        badge:B.appOpen,   updated:"1d ago",   logo:"filmfestivalrotterdam.com"  },
  { kind:"entity", name:"IDFA Bertha Fund",          typeLabel:"FUND",               flag:"🇳🇱", country:"Netherlands",   intelligence:"Docs from the Global South",          badge:B.c3,        updated:"1h ago",   logo:"idfa.nl"                    },
  { kind:"entity", name:"Doha Film Institute",       typeLabel:"FUND",               flag:"🇶🇦", country:"Qatar",         intelligence:"MENA region films prioritised",       badge:B.appOpen,   updated:"3h ago",   logo:"dohafilminstitute.com"      },
  { kind:"entity", name:"Chicken & Egg Pictures",    typeLabel:"FUND",               flag:"🇺🇸", country:"USA",           intelligence:"Female-directed documentaries",        badge:B.isNew,     updated:"1h ago",   logo:"chickeneggpics.org"         },
  { kind:"entity", name:"Creative Europe MEDIA",     typeLabel:"FUND",               flag:"🇪🇺", country:"Europe",        intelligence:"Development & distribution grants",    badge:B.open,      updated:"8h ago",   logo:"ec.europa.eu"               },
  { kind:"entity", name:"BFI",                       typeLabel:"FUND",               flag:"🇬🇧", country:"UK",            intelligence:"UK-based productions",                badge:B.open,      updated:"4h ago",   logo:"bfi.org.uk"                 },
  { kind:"entity", name:"Telefilm Canada",           typeLabel:"FUND",               flag:"🇨🇦", country:"Canada",        intelligence:"Feature films & web series",           badge:B.appOpen,   updated:"2h ago",   logo:"telefilm.ca"                },
  { kind:"entity", name:"CNC France",                typeLabel:"FUND",               flag:"🇫🇷", country:"France",        intelligence:"French-language productions",          badge:B.trending,  updated:"Just now", logo:"cnc.fr"                     },
  // PRODUCTION COMPANIES
  { kind:"entity", name:"A24",                       typeLabel:"PRODUCTION COMPANY", flag:"🇺🇸", country:"USA",           intelligence:"Seeking Feature Films",               badge:B.seeking,   updated:"Just now", logo:"a24films.com"               },
  { kind:"entity", name:"BBC Film",                  typeLabel:"PRODUCTION COMPANY", flag:"🇬🇧", country:"UK",            intelligence:"International co-productions",         badge:B.coProd,    updated:"4h ago",   logo:"bbc.co.uk"                  },
  { kind:"entity", name:"Film4",                     typeLabel:"PRODUCTION COMPANY", flag:"🇬🇧", country:"UK",            intelligence:"UK & international projects",          badge:B.seeking,   updated:"6h ago",   logo:"film4.com"                  },
  { kind:"entity", name:"Plan B Entertainment",      typeLabel:"PRODUCTION COMPANY", flag:"🇺🇸", country:"USA",           intelligence:"Open to debut directors",              badge:B.seeking,   updated:"3h ago",   logo:"planbentertainment.com"     },
  { kind:"entity", name:"MK2 Productions",           typeLabel:"PRODUCTION COMPANY", flag:"🇫🇷", country:"France",        intelligence:"Auteur & arthouse films",              badge:B.coProd,    updated:"8h ago",   logo:"mk2.com"                    },
  { kind:"entity", name:"Participant",               typeLabel:"PRODUCTION COMPANY", flag:"🇺🇸", country:"USA",           intelligence:"Social impact documentaries",          badge:B.seeking,   updated:"5h ago",   logo:"participant.com"            },
  { kind:"entity", name:"Wild Bunch",                typeLabel:"PRODUCTION COMPANY", flag:"🇫🇷", country:"France",        intelligence:"Art house & auteur cinema",            badge:B.coProd,    updated:"1d ago",   logo:"wildbunch.eu"               },
  { kind:"entity", name:"Match Factory Productions", typeLabel:"PRODUCTION COMPANY", flag:"🇩🇪", country:"Germany",       intelligence:"International features",               badge:B.coProd,    updated:"2h ago",   logo:"the-match-factory.com"      },
  // STREAMERS & BROADCASTERS
  { kind:"entity", name:"Netflix",                   typeLabel:"STREAMER",           flag:"🌍", country:"Global",        intelligence:"Acquiring International Features",     badge:B.acquiring, updated:"Just now", logo:"netflix.com"                },
  { kind:"entity", name:"Apple TV+",                 typeLabel:"STREAMER",           flag:"🌍", country:"Global",        intelligence:"Prestige cinema & documentaries",       badge:B.acquiring, updated:"2h ago",   logo:"apple.com"                  },
  { kind:"entity", name:"MUBI",                      typeLabel:"STREAMER",           flag:"🌍", country:"Global",        intelligence:"Festival films & art house",            badge:B.acquiring, updated:"5h ago",   logo:"mubi.com"                   },
  { kind:"entity", name:"Amazon MGM Studios",        typeLabel:"STREAMER",           flag:"🌍", country:"Global",        intelligence:"International documentaries",           badge:B.acquiring, updated:"3h ago",   logo:"amazon.com"                 },
  { kind:"entity", name:"ARTE",                      typeLabel:"BROADCASTER",        flag:"🇫🇷", country:"France / DE",   intelligence:"European co-productions",              badge:B.coProd,    updated:"1d ago",   logo:"arte.tv"                    },
  { kind:"entity", name:"ZDF",                       typeLabel:"BROADCASTER",        flag:"🇩🇪", country:"Germany",       intelligence:"Documentary acquisitions open",         badge:B.acquiring, updated:"8h ago",   logo:"zdf.de"                     },
  { kind:"entity", name:"Canal+",                    typeLabel:"BROADCASTER",        flag:"🇫🇷", country:"France",        intelligence:"European features & docs",              badge:B.acquiring, updated:"4h ago",   logo:"canalplus.com"              },
  // SALES AGENTS
  { kind:"entity", name:"Films Boutique",            typeLabel:"SALES AGENT",        flag:"🇩🇪", country:"Germany",       intelligence:"Festival-ready films sought",          badge:B.open,      updated:"6h ago",   logo:"filmsboutique.com"          },
  { kind:"entity", name:"The Match Factory",         typeLabel:"SALES AGENT",        flag:"🇩🇪", country:"Germany",       intelligence:"International features",               badge:B.seeking,   updated:"4h ago",   logo:"the-match-factory.com"      },
  { kind:"entity", name:"MK2 Films",                 typeLabel:"SALES AGENT",        flag:"🇫🇷", country:"France",        intelligence:"Art house cinema",                     badge:B.featured,  updated:"2h ago",   logo:"mk2.com"                    },
  { kind:"entity", name:"Wild Bunch International",  typeLabel:"SALES AGENT",        flag:"🇫🇷", country:"France",        intelligence:"Genre & art house",                    badge:B.open,      updated:"1d ago",   logo:"wildbunch.eu"               },
  { kind:"entity", name:"Luxbox",                    typeLabel:"SALES AGENT",        flag:"🇫🇷", country:"France",        intelligence:"Debut features & world cinema",         badge:B.isNew,     updated:"3h ago",   logo:"luxboxfilms.com"            },
  { kind:"entity", name:"Film Constellation",        typeLabel:"SALES AGENT",        flag:"🇬🇧", country:"UK",            intelligence:"Arthouse & genre features",             badge:B.open,      updated:"5h ago",   logo:"filmconstellation.com"      },
  // FESTIVALS
  { kind:"entity", name:"Cannes Film Festival",      typeLabel:"FESTIVAL",           flag:"🇫🇷", country:"France",        intelligence:"Submission Deadline: 12 Days",         badge:B.c12,       updated:"Just now", logo:"festival-cannes.com"        },
  { kind:"entity", name:"Berlinale",                 typeLabel:"FESTIVAL",           flag:"🇩🇪", country:"Germany",       intelligence:"Submissions now open",                 badge:B.appOpen,   updated:"8h ago",   logo:"berlinale.de"               },
  { kind:"entity", name:"Venice Film Festival",      typeLabel:"FESTIVAL",           flag:"🇮🇹", country:"Italy",         intelligence:"Competition entries open",              badge:B.appOpen,   updated:"5h ago",   logo:"labiennale.org"             },
  { kind:"entity", name:"TIFF",                      typeLabel:"FESTIVAL",           flag:"🇨🇦", country:"Canada",        intelligence:"Early deadline: 6 Days",               badge:B.c6,        updated:"2h ago",   logo:"tiff.net"                   },
  { kind:"entity", name:"IDFA",                      typeLabel:"FESTIVAL",           flag:"🇳🇱", country:"Netherlands",   intelligence:"Feature documentaries sought",          badge:B.appOpen,   updated:"3h ago",   logo:"idfa.nl"                    },
  { kind:"entity", name:"Locarno",                   typeLabel:"FESTIVAL",           flag:"🇨🇭", country:"Switzerland",   intelligence:"World premieres only",                 badge:B.appOpen,   updated:"1d ago",   logo:"locarnofestival.ch"         },
  { kind:"entity", name:"SXSW",                      typeLabel:"FESTIVAL",           flag:"🇺🇸", country:"USA",           intelligence:"Narratives & documentaries",            badge:B.appOpen,   updated:"6h ago",   logo:"sxsw.com"                   },
  { kind:"entity", name:"Busan BIFF",                typeLabel:"FESTIVAL",           flag:"🇰🇷", country:"South Korea",   intelligence:"Asian cinema priority",                badge:B.isNew,     updated:"4h ago",   logo:"biff.kr"                    },
  // MARKETS
  { kind:"entity", name:"Marché du Film",            typeLabel:"MARKET",             flag:"🇫🇷", country:"France",        intelligence:"Registration opens in 12 days",         badge:B.appOpen,   updated:"4h ago",   logo:"marchedufilm.com"           },
  { kind:"entity", name:"European Film Market",      typeLabel:"MARKET",             flag:"🇩🇪", country:"Germany",       intelligence:"Industry accreditation open",           badge:B.open,      updated:"6h ago",   logo:"efm-berlinale.de"           },
  { kind:"entity", name:"American Film Market",      typeLabel:"MARKET",             flag:"🇺🇸", country:"USA",           intelligence:"Buyers & sellers registration",         badge:B.appOpen,   updated:"8h ago",   logo:"americanfilmmarket.com"     },
  { kind:"entity", name:"Ventana Sur",               typeLabel:"MARKET",             flag:"🇦🇷", country:"Argentina",     intelligence:"Latin American projects",               badge:B.isNew,     updated:"2h ago",   logo:"ventanasur.net"             },
  // LABS & RESIDENCIES
  { kind:"entity", name:"TorinoFilmLab",             typeLabel:"LAB",                flag:"🇮🇹", country:"Italy",         intelligence:"Development programme open",            badge:B.appOpen,   updated:"2d ago",   logo:"torinofilmlab.org"          },
  { kind:"entity", name:"Berlinale Talents",         typeLabel:"LAB",                flag:"🇩🇪", country:"Germany",       intelligence:"International talents sought",          badge:B.isNew,     updated:"Just now", logo:"berlinale-talents.de"       },
  { kind:"entity", name:"Sundance Labs",             typeLabel:"LAB",                flag:"🇺🇸", country:"USA",           intelligence:"Feature & documentary labs open",       badge:B.appOpen,   updated:"1d ago",   logo:"sundance.org"               },
  { kind:"entity", name:"Open Doors",                typeLabel:"RESIDENCY",          flag:"🇨🇭", country:"Switzerland",   intelligence:"Global South filmmakers",               badge:B.appOpen,   updated:"3h ago",   logo:"locarnofestival.ch"         },
  { kind:"entity", name:"Cinefondation",             typeLabel:"RESIDENCY",          flag:"🇫🇷", country:"France",        intelligence:"Post-production residency",             badge:B.c48h,      updated:"1h ago",   logo:"festival-cannes.com"        },
  { kind:"entity", name:"MIDPOINT",                  typeLabel:"LAB",                flag:"🇨🇿", country:"Czech Republic", intelligence:"Script & project development",         badge:B.appOpen,   updated:"5h ago",   logo:"midpoint-center.eu"         },
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

/* ── Build card array ────────────────────────────────────────────────── */
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
const TRACK_CARDS: Card[] = [...BASE_CARDS, ...BASE_CARDS];

/* ── Logo component with graceful fallback ───────────────────────────── */
function Logo({ name, domain }: { name: string; domain: string }) {
  const url = `https://logo.clearbit.com/${domain}?size=48`;
  const initials = name.split(" ").slice(0, 2).map(w => w[0]).join("").toUpperCase();

  return (
    <div style={{
      width: "32px",
      height: "32px",
      borderRadius: "6px",
      overflow: "hidden",
      flexShrink: 0,
      background: "rgba(26,24,21,0.06)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      position: "relative",
    }}>
      <img
        src={url}
        alt={name}
        width={28}
        height={28}
        loading="lazy"
        style={{ objectFit: "contain", width: "28px", height: "28px" }}
        onError={(e: { currentTarget: HTMLImageElement }) => {
          const target = e.currentTarget;
          target.style.display = "none";
          const fallback = target.nextElementSibling as HTMLElement;
          if (fallback) fallback.style.display = "flex";
        }}
      />
      <span style={{
        display: "none",
        fontSize: "10px",
        fontWeight: 700,
        color: "#8A857C",
        letterSpacing: "0.05em",
        alignItems: "center",
        justifyContent: "center",
        width: "100%",
        height: "100%",
      }}>
        {initials}
      </span>
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
        background: "#FFFFFF",
        border: "1px solid rgba(26,24,21,0.09)",
        borderRadius: "12px",
        padding: "12px 13px",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        gap: "7px",
        boxShadow: "0 1px 4px rgba(0,0,0,0.05)",
      }}
    >
      {/* Logo + name row */}
      <div style={{ display: "flex", alignItems: "center", gap: "9px" }}>
        <Logo name={card.name} domain={LOGO_DOMAINS[card.name] ?? card.logo} />
        <div style={{ overflow: "hidden" }}>
          <div style={{
            fontSize: "8.5px",
            letterSpacing: "0.2em",
            color: "#8A857C",
            textTransform: "uppercase",
            fontWeight: 500,
            marginBottom: "1px",
          }}>
            {card.typeLabel}
          </div>
          <div style={{
            fontSize: "12.5px",
            fontWeight: 600,
            color: "#1A1815",
            lineHeight: 1.2,
            fontFamily: "var(--font-display)",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}>
            {card.name}
          </div>
        </div>
      </div>

      {/* Intelligence */}
      <div style={{
        fontSize: "11px",
        color: "#8A857C",
        lineHeight: 1.35,
      }}>
        {card.intelligence}
      </div>

      {/* Badge + meta */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "4px" }}>
        <span style={{
          fontSize: "7.5px",
          letterSpacing: "0.12em",
          background: card.badge.bg,
          color: card.badge.text,
          border: `1px solid ${card.badge.border}`,
          borderRadius: "4px",
          padding: "2px 5px",
          textTransform: "uppercase",
          fontWeight: 600,
          whiteSpace: "nowrap",
          flexShrink: 0,
        }}>
          {card.badge.label}
        </span>
        <span style={{
          fontSize: "9px",
          color: "#B8B2A8",
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

/* ── Insight card ────────────────────────────────────────────────────── */
function InsightCardEl({ card }: { card: InsightCard }) {
  return (
    <div
      className="ticker-card"
      style={{
        flexShrink: 0,
        background: "rgba(191,153,83,0.06)",
        border: "1px solid rgba(191,153,83,0.22)",
        borderRadius: "12px",
        padding: "13px 15px",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        gap: "7px",
        boxShadow: "0 1px 4px rgba(191,153,83,0.06)",
      }}
    >
      <div style={{
        fontSize: "8px",
        letterSpacing: "0.22em",
        color: "#92672A",
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
        color: "#1A1815",
        lineHeight: 1.45,
        fontWeight: 400,
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
      {/* Header */}
      <div style={{
        maxWidth: "1152px",
        margin: "0 auto",
        padding: "28px 24px 10px",
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "space-between",
      }}>
        <div>
          <p style={{
            fontSize: "10px",
            letterSpacing: "0.28em",
            color: "#8A857C",
            textTransform: "uppercase",
            marginBottom: "3px",
            fontWeight: 500,
          }}>
            Global Film Industry Intelligence
          </p>
          <p style={{
            fontSize: "11px",
            color: "#B8B2A8",
            letterSpacing: "0.03em",
          }}>
            Live funding, producers, festivals, markets, acquisitions and co-production opportunities worldwide.
          </p>
        </div>
      </div>

      {/* Carousel */}
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
            padding: "6px 24px 10px",
            width: "max-content",
            animation: "fylym-ticker 90s linear infinite",
            animationPlayState: paused ? "paused" : "running",
            willChange: "transform",
          }}
        >
          {TRACK_CARDS.map((card, i) =>
            card.kind === "insight"
              ? <InsightCardEl key={`ins-${i}`} card={card} />
              : <EntityCardEl   key={`ent-${i}`} card={card} />
          )}
        </div>
      </div>

      {/* Hairline + stats bar */}
      <div style={{
        borderTop: "1px solid #E5E0D5",
        margin: "0 24px",
        paddingTop: "10px",
        paddingBottom: "10px",
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
            <div key={label} style={{ display: "flex", alignItems: "baseline", gap: "5px", flexShrink: 0 }}>
              <span style={{
                fontSize: "12px",
                fontWeight: 700,
                color: "#BF9953",
                fontVariantNumeric: "tabular-nums",
              }}>
                {value}
              </span>
              <span style={{ fontSize: "10px", color: "#B8B2A8", letterSpacing: "0.05em" }}>
                {label}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
