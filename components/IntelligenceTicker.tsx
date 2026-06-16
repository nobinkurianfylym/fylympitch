"use client";

import { useState } from "react";

/* ─────────────────────────────────────────────────────────────────────
   EMBEDDED LOGO SYSTEM
   All logos are inline SVG — zero external requests, never breaks.
   Each org gets a hand-crafted mark. Fallback = styled monogram.
   ───────────────────────────────────────────────────────────────────── */

// Returns an SVG string (used as dangerouslySetInnerHTML)
const LOGOS: Record<string, string> = {
  /* ── Streamers ────────────────────────────────────────────────── */
  "Netflix": `<svg viewBox="0 0 44 44" xmlns="http://www.w3.org/2000/svg">
    <rect width="44" height="44" rx="6" fill="#E50914"/>
    <path fill="#fff" d="M13 11h5l4.5 10.5V11H27v22h-4.7L17.8 22.3V33H13z"/>
  </svg>`,

  "Apple TV+": `<svg viewBox="0 0 44 44" xmlns="http://www.w3.org/2000/svg">
    <rect width="44" height="44" rx="6" fill="#1C1C1E"/>
    <path fill="#fff" d="M22 10c-1.2 0-2.2.5-3 1.4-.7.8-1.1 1.9-1.1 3h.9c.3-.9.8-1.7 1.5-2.2-.3.5-.5 1.1-.5 1.8 0 1.8 1.4 3.2 3.2 3.2s3.2-1.4 3.2-3.2c0-.7-.2-1.3-.5-1.8.7.5 1.2 1.3 1.5 2.2h.9c0-1.1-.4-2.2-1.1-3-.8-.9-1.8-1.4-3-1.4z"/>
    <text x="22" y="31" text-anchor="middle" fill="#fff" font-size="9" font-weight="700" font-family="system-ui,sans-serif">TV+</text>
  </svg>`,

  "MUBI": `<svg viewBox="0 0 44 44" xmlns="http://www.w3.org/2000/svg">
    <rect width="44" height="44" rx="6" fill="#0C2340"/>
    <text x="22" y="27" text-anchor="middle" fill="#fff" font-size="11" font-weight="800" font-family="system-ui,sans-serif" letter-spacing="1">MUBI</text>
  </svg>`,

  "Amazon MGM Studios": `<svg viewBox="0 0 44 44" xmlns="http://www.w3.org/2000/svg">
    <rect width="44" height="44" rx="6" fill="#232F3E"/>
    <text x="22" y="22" text-anchor="middle" fill="#FF9900" font-size="8" font-weight="700" font-family="system-ui,sans-serif">amazon</text>
    <path fill="#FF9900" d="M12 26q10 4 20 0" stroke="#FF9900" stroke-width="1.5" fill="none" stroke-linecap="round"/>
  </svg>`,

  "Disney+": `<svg viewBox="0 0 44 44" xmlns="http://www.w3.org/2000/svg">
    <rect width="44" height="44" rx="6" fill="#113CCF"/>
    <text x="22" y="28" text-anchor="middle" fill="#fff" font-size="12" font-weight="900" font-family="system-ui,sans-serif">D+</text>
  </svg>`,

  /* ── Broadcasters ─────────────────────────────────────────────── */
  "ARTE": `<svg viewBox="0 0 44 44" xmlns="http://www.w3.org/2000/svg">
    <rect width="44" height="44" rx="6" fill="#F00"/>
    <text x="22" y="28" text-anchor="middle" fill="#fff" font-size="13" font-weight="900" font-family="system-ui,sans-serif" letter-spacing="1">arte</text>
  </svg>`,

  "Canal+": `<svg viewBox="0 0 44 44" xmlns="http://www.w3.org/2000/svg">
    <rect width="44" height="44" rx="6" fill="#1A1A1A"/>
    <text x="22" y="27" text-anchor="middle" fill="#fff" font-size="10" font-weight="800" font-family="system-ui,sans-serif" letter-spacing="0.5">CANAL+</text>
  </svg>`,

  "ZDF": `<svg viewBox="0 0 44 44" xmlns="http://www.w3.org/2000/svg">
    <rect width="44" height="44" rx="6" fill="#E8001E"/>
    <text x="22" y="28" text-anchor="middle" fill="#fff" font-size="14" font-weight="900" font-family="system-ui,sans-serif" letter-spacing="1">ZDF</text>
  </svg>`,

  /* ── Production Companies ─────────────────────────────────────── */
  "A24": `<svg viewBox="0 0 44 44" xmlns="http://www.w3.org/2000/svg">
    <rect width="44" height="44" rx="6" fill="#1A1815"/>
    <text x="22" y="28" text-anchor="middle" fill="#fff" font-size="15" font-weight="700" font-family="system-ui,sans-serif" letter-spacing="0.5">A24</text>
  </svg>`,

  "BBC Film": `<svg viewBox="0 0 44 44" xmlns="http://www.w3.org/2000/svg">
    <rect width="44" height="44" rx="6" fill="#1A1A1A"/>
    <rect x="6" y="15" width="9" height="14" rx="1" fill="#fff"/>
    <text x="10.5" y="25" text-anchor="middle" fill="#1A1A1A" font-size="7" font-weight="900" font-family="system-ui,sans-serif">B</text>
    <rect x="18" y="15" width="9" height="14" rx="1" fill="#fff"/>
    <text x="22.5" y="25" text-anchor="middle" fill="#1A1A1A" font-size="7" font-weight="900" font-family="system-ui,sans-serif">B</text>
    <rect x="30" y="15" width="9" height="14" rx="1" fill="#fff"/>
    <text x="34.5" y="25" text-anchor="middle" fill="#1A1A1A" font-size="7" font-weight="900" font-family="system-ui,sans-serif">C</text>
  </svg>`,

  "Film4": `<svg viewBox="0 0 44 44" xmlns="http://www.w3.org/2000/svg">
    <rect width="44" height="44" rx="6" fill="#EA0029"/>
    <text x="22" y="28" text-anchor="middle" fill="#fff" font-size="13" font-weight="800" font-family="system-ui,sans-serif">Film4</text>
  </svg>`,

  "Wild Bunch": `<svg viewBox="0 0 44 44" xmlns="http://www.w3.org/2000/svg">
    <rect width="44" height="44" rx="6" fill="#1A1815"/>
    <text x="22" y="22" text-anchor="middle" fill="#fff" font-size="7" font-weight="600" font-family="system-ui,sans-serif">WILD</text>
    <text x="22" y="32" text-anchor="middle" fill="#BF9953" font-size="7" font-weight="600" font-family="system-ui,sans-serif">BUNCH</text>
  </svg>`,

  "MK2 Productions": `<svg viewBox="0 0 44 44" xmlns="http://www.w3.org/2000/svg">
    <rect width="44" height="44" rx="6" fill="#E8001E"/>
    <text x="22" y="28" text-anchor="middle" fill="#fff" font-size="13" font-weight="900" font-family="system-ui,sans-serif">mk2</text>
  </svg>`,

  /* ── Festivals ────────────────────────────────────────────────── */
  "Cannes Film Festival": `<svg viewBox="0 0 44 44" xmlns="http://www.w3.org/2000/svg">
    <rect width="44" height="44" rx="6" fill="#B8972E"/>
    <text x="22" y="20" text-anchor="middle" fill="#fff" font-size="6" font-weight="600" font-family="system-ui,sans-serif" letter-spacing="1">CANNES</text>
    <text x="22" y="31" text-anchor="middle" fill="#fff" font-size="5.5" font-weight="400" font-family="system-ui,sans-serif" letter-spacing="0.5">FILM FESTIVAL</text>
  </svg>`,

  "Berlinale": `<svg viewBox="0 0 44 44" xmlns="http://www.w3.org/2000/svg">
    <rect width="44" height="44" rx="6" fill="#E8001E"/>
    <circle cx="22" cy="18" r="6" fill="none" stroke="#fff" stroke-width="1.5"/>
    <circle cx="22" cy="18" r="2" fill="#fff"/>
    <text x="22" y="34" text-anchor="middle" fill="#fff" font-size="6" font-weight="700" font-family="system-ui,sans-serif" letter-spacing="0.5">BERLINALE</text>
  </svg>`,

  "Venice Film Festival": `<svg viewBox="0 0 44 44" xmlns="http://www.w3.org/2000/svg">
    <rect width="44" height="44" rx="6" fill="#00356B"/>
    <text x="22" y="20" text-anchor="middle" fill="#C9A227" font-size="7" font-weight="700" font-family="system-ui,sans-serif" letter-spacing="0.5">VENEZIA</text>
    <text x="22" y="31" text-anchor="middle" fill="#fff" font-size="5.5" font-weight="400" font-family="system-ui,sans-serif">FILM FESTIVAL</text>
  </svg>`,

  "TIFF": `<svg viewBox="0 0 44 44" xmlns="http://www.w3.org/2000/svg">
    <rect width="44" height="44" rx="6" fill="#E8001E"/>
    <text x="22" y="28" text-anchor="middle" fill="#fff" font-size="14" font-weight="900" font-family="system-ui,sans-serif" letter-spacing="1">TIFF</text>
  </svg>`,

  "IDFA": `<svg viewBox="0 0 44 44" xmlns="http://www.w3.org/2000/svg">
    <rect width="44" height="44" rx="6" fill="#1A1815"/>
    <text x="22" y="28" text-anchor="middle" fill="#fff" font-size="13" font-weight="800" font-family="system-ui,sans-serif" letter-spacing="1">IDFA</text>
  </svg>`,

  "Locarno": `<svg viewBox="0 0 44 44" xmlns="http://www.w3.org/2000/svg">
    <rect width="44" height="44" rx="6" fill="#F7A600"/>
    <circle cx="22" cy="18" r="5" fill="#1A1815"/>
    <text x="22" y="34" text-anchor="middle" fill="#1A1815" font-size="6" font-weight="700" font-family="system-ui,sans-serif" letter-spacing="0.5">LOCARNO</text>
  </svg>`,

  "SXSW": `<svg viewBox="0 0 44 44" xmlns="http://www.w3.org/2000/svg">
    <rect width="44" height="44" rx="6" fill="#1A1815"/>
    <text x="22" y="28" text-anchor="middle" fill="#00F0FF" font-size="12" font-weight="900" font-family="system-ui,sans-serif" letter-spacing="1">SXSW</text>
  </svg>`,

  "Busan BIFF": `<svg viewBox="0 0 44 44" xmlns="http://www.w3.org/2000/svg">
    <rect width="44" height="44" rx="6" fill="#003478"/>
    <text x="22" y="22" text-anchor="middle" fill="#fff" font-size="7.5" font-weight="700" font-family="system-ui,sans-serif" letter-spacing="0.5">BUSAN</text>
    <text x="22" y="32" text-anchor="middle" fill="#E8C840" font-size="7.5" font-weight="700" font-family="system-ui,sans-serif" letter-spacing="0.5">BIFF</text>
  </svg>`,

  /* ── Funds ────────────────────────────────────────────────────── */
  "Sundance Institute": `<svg viewBox="0 0 44 44" xmlns="http://www.w3.org/2000/svg">
    <rect width="44" height="44" rx="22" fill="#1A1815"/>
    <text x="22" y="22" text-anchor="middle" fill="#fff" font-size="6" font-weight="600" font-family="system-ui,sans-serif" letter-spacing="1">SUNDANCE</text>
    <text x="22" y="31" text-anchor="middle" fill="#BF9953" font-size="5" font-weight="500" font-family="system-ui,sans-serif" letter-spacing="0.5">INSTITUTE</text>
  </svg>`,

  "BFI": `<svg viewBox="0 0 44 44" xmlns="http://www.w3.org/2000/svg">
    <circle cx="22" cy="22" r="22" fill="#1A1815"/>
    <text x="22" y="27" text-anchor="middle" fill="#fff" font-size="13" font-weight="800" font-family="system-ui,sans-serif" letter-spacing="1">BFI</text>
  </svg>`,

  "Eurimages": `<svg viewBox="0 0 44 44" xmlns="http://www.w3.org/2000/svg">
    <rect width="44" height="44" rx="6" fill="#003399"/>
    <text x="22" y="24" text-anchor="middle" fill="#FC0" font-size="5.5" font-weight="600" font-family="system-ui,sans-serif" letter-spacing="0.5">EURIMAGES</text>
    <text x="22" y="33" text-anchor="middle" fill="#fff" font-size="4.5" font-weight="400" font-family="system-ui,sans-serif">Council of Europe</text>
  </svg>`,

  "Creative Europe MEDIA": `<svg viewBox="0 0 44 44" xmlns="http://www.w3.org/2000/svg">
    <rect width="44" height="44" rx="6" fill="#003399"/>
    <circle cx="22" cy="18" r="6" fill="none" stroke="#FC0" stroke-width="1"/>
    <text x="22" y="34" text-anchor="middle" fill="#fff" font-size="5" font-weight="600" font-family="system-ui,sans-serif" letter-spacing="0.3">CREATIVE EUROPE</text>
  </svg>`,

  "Telefilm Canada": `<svg viewBox="0 0 44 44" xmlns="http://www.w3.org/2000/svg">
    <rect width="44" height="44" rx="6" fill="#E8001E"/>
    <text x="22" y="22" text-anchor="middle" fill="#fff" font-size="7" font-weight="700" font-family="system-ui,sans-serif" letter-spacing="0.3">TELEFILM</text>
    <text x="22" y="32" text-anchor="middle" fill="#fff" font-size="7" font-weight="700" font-family="system-ui,sans-serif" letter-spacing="0.3">CANADA</text>
  </svg>`,

  "CNC France": `<svg viewBox="0 0 44 44" xmlns="http://www.w3.org/2000/svg">
    <rect width="44" height="44" rx="6" fill="#1A3A6B"/>
    <text x="22" y="26" text-anchor="middle" fill="#fff" font-size="13" font-weight="800" font-family="system-ui,sans-serif" letter-spacing="1">CNC</text>
  </svg>`,

  "Doha Film Institute": `<svg viewBox="0 0 44 44" xmlns="http://www.w3.org/2000/svg">
    <rect width="44" height="44" rx="6" fill="#8B0000"/>
    <text x="22" y="22" text-anchor="middle" fill="#fff" font-size="7" font-weight="600" font-family="system-ui,sans-serif" letter-spacing="0.5">DOHA</text>
    <text x="22" y="32" text-anchor="middle" fill="#C9A227" font-size="5.5" font-weight="500" font-family="system-ui,sans-serif" letter-spacing="0.3">FILM INSTITUTE</text>
  </svg>`,

  "Hubert Bals Fund": `<svg viewBox="0 0 44 44" xmlns="http://www.w3.org/2000/svg">
    <rect width="44" height="44" rx="6" fill="#E8490A"/>
    <text x="22" y="21" text-anchor="middle" fill="#fff" font-size="8.5" font-weight="700" font-family="system-ui,sans-serif" letter-spacing="0.3">HBF</text>
    <text x="22" y="33" text-anchor="middle" fill="#fff" font-size="4.5" font-weight="400" font-family="system-ui,sans-serif">Rotterdam</text>
  </svg>`,

  "IDFA Bertha Fund": `<svg viewBox="0 0 44 44" xmlns="http://www.w3.org/2000/svg">
    <rect width="44" height="44" rx="6" fill="#1A1815"/>
    <text x="22" y="23" text-anchor="middle" fill="#fff" font-size="10" font-weight="800" font-family="system-ui,sans-serif" letter-spacing="1">IDFA</text>
    <text x="22" y="33" text-anchor="middle" fill="#BF9953" font-size="5.5" font-weight="500" font-family="system-ui,sans-serif">BERTHA FUND</text>
  </svg>`,

  "Chicken & Egg Pictures": `<svg viewBox="0 0 44 44" xmlns="http://www.w3.org/2000/svg">
    <rect width="44" height="44" rx="22" fill="#F4A61C"/>
    <text x="22" y="25" text-anchor="middle" fill="#1A1815" font-size="16" font-family="system-ui,sans-serif">🥚</text>
  </svg>`,

  /* ── Sales Agents ─────────────────────────────────────────────── */
  "Films Boutique": `<svg viewBox="0 0 44 44" xmlns="http://www.w3.org/2000/svg">
    <rect width="44" height="44" rx="6" fill="#1A1815"/>
    <text x="22" y="21" text-anchor="middle" fill="#fff" font-size="6" font-weight="600" font-family="system-ui,sans-serif" letter-spacing="0.5">FILMS</text>
    <text x="22" y="31" text-anchor="middle" fill="#BF9953" font-size="6" font-weight="600" font-family="system-ui,sans-serif" letter-spacing="0.5">BOUTIQUE</text>
  </svg>`,

  "The Match Factory": `<svg viewBox="0 0 44 44" xmlns="http://www.w3.org/2000/svg">
    <rect width="44" height="44" rx="6" fill="#1A1815"/>
    <text x="22" y="21" text-anchor="middle" fill="#fff" font-size="5.5" font-weight="600" font-family="system-ui,sans-serif" letter-spacing="0.3">THE MATCH</text>
    <text x="22" y="31" text-anchor="middle" fill="#BF9953" font-size="5.5" font-weight="600" font-family="system-ui,sans-serif" letter-spacing="0.3">FACTORY</text>
  </svg>`,

  "MK2 Films": `<svg viewBox="0 0 44 44" xmlns="http://www.w3.org/2000/svg">
    <rect width="44" height="44" rx="6" fill="#E8001E"/>
    <text x="22" y="28" text-anchor="middle" fill="#fff" font-size="13" font-weight="900" font-family="system-ui,sans-serif">mk2</text>
  </svg>`,

  "Wild Bunch International": `<svg viewBox="0 0 44 44" xmlns="http://www.w3.org/2000/svg">
    <rect width="44" height="44" rx="6" fill="#1A1815"/>
    <text x="22" y="21" text-anchor="middle" fill="#fff" font-size="6" font-weight="600" font-family="system-ui,sans-serif">WILD BUNCH</text>
    <text x="22" y="31" text-anchor="middle" fill="#BF9953" font-size="5.5" font-weight="500" font-family="system-ui,sans-serif">INTERNATIONAL</text>
  </svg>`,

  "Luxbox": `<svg viewBox="0 0 44 44" xmlns="http://www.w3.org/2000/svg">
    <rect width="44" height="44" rx="6" fill="#1A1815"/>
    <rect x="10" y="14" width="24" height="16" rx="2" fill="none" stroke="#BF9953" stroke-width="1.5"/>
    <text x="22" y="26" text-anchor="middle" fill="#BF9953" font-size="7.5" font-weight="700" font-family="system-ui,sans-serif" letter-spacing="0.5">LUX</text>
  </svg>`,

  /* ── Markets ──────────────────────────────────────────────────── */
  "Marché du Film": `<svg viewBox="0 0 44 44" xmlns="http://www.w3.org/2000/svg">
    <rect width="44" height="44" rx="6" fill="#B8972E"/>
    <text x="22" y="21" text-anchor="middle" fill="#fff" font-size="6" font-weight="600" font-family="system-ui,sans-serif" letter-spacing="0.5">MARCHÉ</text>
    <text x="22" y="31" text-anchor="middle" fill="#fff" font-size="6" font-weight="600" font-family="system-ui,sans-serif" letter-spacing="0.5">DU FILM</text>
  </svg>`,

  "European Film Market": `<svg viewBox="0 0 44 44" xmlns="http://www.w3.org/2000/svg">
    <rect width="44" height="44" rx="6" fill="#E8001E"/>
    <text x="22" y="21" text-anchor="middle" fill="#fff" font-size="5.5" font-weight="700" font-family="system-ui,sans-serif" letter-spacing="0.5">EUROPEAN</text>
    <text x="22" y="30" text-anchor="middle" fill="#fff" font-size="5.5" font-weight="700" font-family="system-ui,sans-serif" letter-spacing="0.5">FILM MARKET</text>
  </svg>`,

  "American Film Market": `<svg viewBox="0 0 44 44" xmlns="http://www.w3.org/2000/svg">
    <rect width="44" height="44" rx="6" fill="#1A3A6B"/>
    <text x="22" y="25" text-anchor="middle" fill="#fff" font-size="11" font-weight="900" font-family="system-ui,sans-serif" letter-spacing="1">AFM</text>
  </svg>`,

  "Ventana Sur": `<svg viewBox="0 0 44 44" xmlns="http://www.w3.org/2000/svg">
    <rect width="44" height="44" rx="6" fill="#005B99"/>
    <text x="22" y="21" text-anchor="middle" fill="#fff" font-size="6" font-weight="700" font-family="system-ui,sans-serif" letter-spacing="0.5">VENTANA</text>
    <text x="22" y="31" text-anchor="middle" fill="#C9A227" font-size="6" font-weight="700" font-family="system-ui,sans-serif" letter-spacing="0.5">SUR</text>
  </svg>`,

  /* ── Labs ─────────────────────────────────────────────────────── */
  "TorinoFilmLab": `<svg viewBox="0 0 44 44" xmlns="http://www.w3.org/2000/svg">
    <rect width="44" height="44" rx="6" fill="#1A1815"/>
    <text x="22" y="21" text-anchor="middle" fill="#fff" font-size="5.5" font-weight="600" font-family="system-ui,sans-serif" letter-spacing="0.3">TORINO</text>
    <text x="22" y="31" text-anchor="middle" fill="#BF9953" font-size="5.5" font-weight="600" font-family="system-ui,sans-serif" letter-spacing="0.3">FILM LAB</text>
  </svg>`,

  "Berlinale Talents": `<svg viewBox="0 0 44 44" xmlns="http://www.w3.org/2000/svg">
    <rect width="44" height="44" rx="6" fill="#E8001E"/>
    <text x="22" y="21" text-anchor="middle" fill="#fff" font-size="6" font-weight="700" font-family="system-ui,sans-serif" letter-spacing="0.3">BERLINALE</text>
    <text x="22" y="31" text-anchor="middle" fill="#fff" font-size="6" font-weight="700" font-family="system-ui,sans-serif" letter-spacing="0.3">TALENTS</text>
  </svg>`,

  "Sundance Labs": `<svg viewBox="0 0 44 44" xmlns="http://www.w3.org/2000/svg">
    <rect width="44" height="44" rx="22" fill="#1A1815"/>
    <text x="22" y="22" text-anchor="middle" fill="#fff" font-size="5.5" font-weight="600" font-family="system-ui,sans-serif" letter-spacing="0.5">SUNDANCE</text>
    <text x="22" y="31" text-anchor="middle" fill="#BF9953" font-size="5.5" font-weight="500" font-family="system-ui,sans-serif">LABS</text>
  </svg>`,

  "MIDPOINT": `<svg viewBox="0 0 44 44" xmlns="http://www.w3.org/2000/svg">
    <rect width="44" height="44" rx="6" fill="#005B99"/>
    <text x="22" y="27" text-anchor="middle" fill="#fff" font-size="8" font-weight="800" font-family="system-ui,sans-serif" letter-spacing="0.5">MID·PT</text>
  </svg>`,

  "Cinefondation": `<svg viewBox="0 0 44 44" xmlns="http://www.w3.org/2000/svg">
    <rect width="44" height="44" rx="6" fill="#B8972E"/>
    <text x="22" y="21" text-anchor="middle" fill="#fff" font-size="5.5" font-weight="600" font-family="system-ui,sans-serif" letter-spacing="0.3">CINÉFON-</text>
    <text x="22" y="31" text-anchor="middle" fill="#fff" font-size="5.5" font-weight="600" font-family="system-ui,sans-serif" letter-spacing="0.3">DATION</text>
  </svg>`,

  "Plan B Entertainment": `<svg viewBox="0 0 44 44" xmlns="http://www.w3.org/2000/svg">
    <rect width="44" height="44" rx="6" fill="#1A1815"/>
    <text x="22" y="22" text-anchor="middle" fill="#fff" font-size="8" font-weight="700" font-family="system-ui,sans-serif">PLAN B</text>
    <text x="22" y="32" text-anchor="middle" fill="#BF9953" font-size="5.5" font-weight="500" font-family="system-ui,sans-serif">ENTERTAINMENT</text>
  </svg>`,

  "Match Factory Productions": `<svg viewBox="0 0 44 44" xmlns="http://www.w3.org/2000/svg">
    <rect width="44" height="44" rx="6" fill="#1A1815"/>
    <text x="22" y="21" text-anchor="middle" fill="#fff" font-size="5.5" font-weight="600" font-family="system-ui,sans-serif">MATCH FACTORY</text>
    <text x="22" y="31" text-anchor="middle" fill="#BF9953" font-size="5.5" font-weight="600" font-family="system-ui,sans-serif">PRODUCTIONS</text>
  </svg>`,
};

/* ── Fallback monogram ───────────────────────────────────────────────── */
function monogram(name: string, type: string): string {
  const abbrev = name.replace(/[^a-zA-Z\s]/g, "").split(/\s+/).filter(Boolean)
    .map(w => w[0]).join("").toUpperCase().slice(0, 3);
  const colors: Record<string, [string, string]> = {
    "FUND":               ["#1D3D8F", "#DDEAFF"],
    "PRODUCTION COMPANY": ["#1A1815", "#F0EDE8"],
    "STREAMER":           ["#1A1815", "#F0EDE8"],
    "BROADCASTER":        ["#92400E", "#FEF3C7"],
    "SALES AGENT":        ["#374151", "#F3F4F6"],
    "FESTIVAL":           ["#7F1D1D", "#FEE2E2"],
    "MARKET":             ["#14532D", "#DCFCE7"],
    "LAB":                ["#78350F", "#FEF3C7"],
    "RESIDENCY":          ["#78350F", "#FEF3C7"],
  };
  const [fg, bg] = colors[type] ?? ["#1A1815", "#F0EDE8"];
  const fs = abbrev.length > 2 ? 11 : 14;
  return `<svg viewBox="0 0 44 44" xmlns="http://www.w3.org/2000/svg">
    <rect width="44" height="44" rx="8" fill="${bg}"/>
    <text x="22" y="${22 + fs / 3}" text-anchor="middle" fill="${fg}" font-size="${fs}" font-weight="700" font-family="system-ui,sans-serif" letter-spacing="0.5">${abbrev}</text>
  </svg>`;
}

/* ── Types ───────────────────────────────────────────────────────────── */
interface Badge { label: string; bg: string; text: string }
interface EntityCard {
  kind: "entity"; name: string; typeLabel: string;
  flag: string; country: string; intelligence: string;
  badge: Badge; updated: string;
}
interface InsightCard { kind: "insight"; label: string; text: string }
type Card = EntityCard | InsightCard;

/* ── Badges ──────────────────────────────────────────────────────────── */
const B: Record<string, Badge> = {
  open:      { label:"OPEN",                bg:"rgba(29,78,216,0.08)",  text:"#1D4ED8" },
  appOpen:   { label:"OPEN",                bg:"rgba(29,78,216,0.08)",  text:"#1D4ED8" },
  c3:        { label:"3 DAYS LEFT",         bg:"rgba(185,28,28,0.08)",  text:"#B91C1C" },
  c6:        { label:"6 DAYS LEFT",         bg:"rgba(185,28,28,0.08)",  text:"#B91C1C" },
  c12:       { label:"12 DAYS LEFT",        bg:"rgba(185,28,28,0.08)",  text:"#B91C1C" },
  c48h:      { label:"48 HRS LEFT",         bg:"rgba(185,28,28,0.08)",  text:"#B91C1C" },
  isNew:     { label:"NEW",                 bg:"rgba(21,128,61,0.09)",  text:"#15803D" },
  featured:  { label:"FEATURED",            bg:"rgba(191,153,83,0.14)", text:"#92672A" },
  seeking:   { label:"SEEKING",             bg:"rgba(154,52,18,0.08)",  text:"#9A3412" },
  coProd:    { label:"CO-PROD",             bg:"rgba(14,116,144,0.08)", text:"#0E7490" },
  acquiring: { label:"ACQUIRING",           bg:"rgba(4,120,87,0.08)",   text:"#047857" },
  trending:  { label:"TRENDING",            bg:"rgba(194,65,12,0.08)",  text:"#C2410C" },
};

/* ── Entity data ─────────────────────────────────────────────────────── */
const ENTITIES: EntityCard[] = [
  { kind:"entity", name:"Sundance Institute",        typeLabel:"FUND",               flag:"🇺🇸", country:"USA",          intelligence:"Funding up to $50,000",              badge:B.appOpen,   updated:"2h ago"   },
  { kind:"entity", name:"Eurimages",                 typeLabel:"FUND",               flag:"🇪🇺", country:"Europe",       intelligence:"Co-production up to €500K",          badge:B.open,      updated:"5h ago"   },
  { kind:"entity", name:"A24",                       typeLabel:"PRODUCTION COMPANY", flag:"🇺🇸", country:"USA",          intelligence:"Seeking Feature Films",              badge:B.seeking,   updated:"Just now" },
  { kind:"entity", name:"Netflix",                   typeLabel:"STREAMER",           flag:"🌍", country:"Global",       intelligence:"Acquiring International Features",    badge:B.acquiring, updated:"Just now" },
  { kind:"entity", name:"BFI",                       typeLabel:"FUND",               flag:"🇬🇧", country:"UK",           intelligence:"UK-based productions",               badge:B.open,      updated:"4h ago"   },
  { kind:"entity", name:"Cannes Film Festival",      typeLabel:"FESTIVAL",           flag:"🇫🇷", country:"France",       intelligence:"Submission Deadline: 12 Days",        badge:B.c12,       updated:"Just now" },
  { kind:"entity", name:"MUBI",                      typeLabel:"STREAMER",           flag:"🌍", country:"Global",       intelligence:"Festival films & art house",          badge:B.acquiring, updated:"5h ago"   },
  { kind:"entity", name:"Berlinale",                 typeLabel:"FESTIVAL",           flag:"🇩🇪", country:"Germany",      intelligence:"Submissions now open",               badge:B.appOpen,   updated:"8h ago"   },
  { kind:"entity", name:"ARTE",                      typeLabel:"BROADCASTER",        flag:"🇫🇷", country:"France / DE",  intelligence:"European co-productions",            badge:B.coProd,    updated:"1d ago"   },
  { kind:"entity", name:"Film4",                     typeLabel:"PRODUCTION COMPANY", flag:"🇬🇧", country:"UK",           intelligence:"UK & international projects",        badge:B.seeking,   updated:"6h ago"   },
  { kind:"entity", name:"Apple TV+",                 typeLabel:"STREAMER",           flag:"🌍", country:"Global",       intelligence:"Prestige cinema & docs",              badge:B.acquiring, updated:"2h ago"   },
  { kind:"entity", name:"IDFA",                      typeLabel:"FESTIVAL",           flag:"🇳🇱", country:"Netherlands",  intelligence:"Feature documentaries sought",        badge:B.appOpen,   updated:"3h ago"   },
  { kind:"entity", name:"CNC France",                typeLabel:"FUND",               flag:"🇫🇷", country:"France",       intelligence:"French-language productions",         badge:B.trending,  updated:"Just now" },
  { kind:"entity", name:"Marché du Film",            typeLabel:"MARKET",             flag:"🇫🇷", country:"France",       intelligence:"Registration opens in 12 days",       badge:B.appOpen,   updated:"4h ago"   },
  { kind:"entity", name:"Amazon MGM Studios",        typeLabel:"STREAMER",           flag:"🌍", country:"Global",       intelligence:"International documentaries",         badge:B.acquiring, updated:"3h ago"   },
  { kind:"entity", name:"Locarno",                   typeLabel:"FESTIVAL",           flag:"🇨🇭", country:"Switzerland",  intelligence:"World premieres only",               badge:B.appOpen,   updated:"1d ago"   },
  { kind:"entity", name:"BBC Film",                  typeLabel:"PRODUCTION COMPANY", flag:"🇬🇧", country:"UK",           intelligence:"International co-productions",        badge:B.coProd,    updated:"4h ago"   },
  { kind:"entity", name:"Telefilm Canada",           typeLabel:"FUND",               flag:"🇨🇦", country:"Canada",       intelligence:"Feature films & web series",          badge:B.appOpen,   updated:"2h ago"   },
  { kind:"entity", name:"TIFF",                      typeLabel:"FESTIVAL",           flag:"🇨🇦", country:"Canada",       intelligence:"Early deadline: 6 Days",              badge:B.c6,        updated:"2h ago"   },
  { kind:"entity", name:"MK2 Films",                 typeLabel:"SALES AGENT",        flag:"🇫🇷", country:"France",       intelligence:"Art house cinema",                   badge:B.featured,  updated:"2h ago"   },
  { kind:"entity", name:"Creative Europe MEDIA",     typeLabel:"FUND",               flag:"🇪🇺", country:"Europe",       intelligence:"Development & distribution",          badge:B.open,      updated:"8h ago"   },
  { kind:"entity", name:"Berlinale Talents",         typeLabel:"LAB",                flag:"🇩🇪", country:"Germany",      intelligence:"International talents sought",        badge:B.isNew,     updated:"Just now" },
  { kind:"entity", name:"Canal+",                    typeLabel:"BROADCASTER",        flag:"🇫🇷", country:"France",       intelligence:"European features & docs",            badge:B.acquiring, updated:"4h ago"   },
  { kind:"entity", name:"Venice Film Festival",      typeLabel:"FESTIVAL",           flag:"🇮🇹", country:"Italy",        intelligence:"Competition entries open",            badge:B.appOpen,   updated:"5h ago"   },
  { kind:"entity", name:"Films Boutique",            typeLabel:"SALES AGENT",        flag:"🇩🇪", country:"Germany",      intelligence:"Festival-ready films",               badge:B.open,      updated:"6h ago"   },
  { kind:"entity", name:"Hubert Bals Fund",          typeLabel:"FUND",               flag:"🇳🇱", country:"Netherlands",  intelligence:"Development grants available",        badge:B.appOpen,   updated:"1d ago"   },
  { kind:"entity", name:"IDFA Bertha Fund",          typeLabel:"FUND",               flag:"🇳🇱", country:"Netherlands",  intelligence:"Docs from the Global South",          badge:B.c3,        updated:"1h ago"   },
  { kind:"entity", name:"Sundance Labs",             typeLabel:"LAB",                flag:"🇺🇸", country:"USA",          intelligence:"Feature & doc labs open",            badge:B.appOpen,   updated:"1d ago"   },
  { kind:"entity", name:"American Film Market",      typeLabel:"MARKET",             flag:"🇺🇸", country:"USA",          intelligence:"Buyers & sellers registration",       badge:B.appOpen,   updated:"8h ago"   },
  { kind:"entity", name:"TorinoFilmLab",             typeLabel:"LAB",                flag:"🇮🇹", country:"Italy",        intelligence:"Development programme open",          badge:B.appOpen,   updated:"2d ago"   },
  { kind:"entity", name:"Wild Bunch",                typeLabel:"PRODUCTION COMPANY", flag:"🇫🇷", country:"France",       intelligence:"Art house & auteur cinema",           badge:B.coProd,    updated:"1d ago"   },
  { kind:"entity", name:"ZDF",                       typeLabel:"BROADCASTER",        flag:"🇩🇪", country:"Germany",      intelligence:"Documentary acquisitions",            badge:B.acquiring, updated:"8h ago"   },
  { kind:"entity", name:"SXSW",                      typeLabel:"FESTIVAL",           flag:"🇺🇸", country:"USA",          intelligence:"Narratives & documentaries",          badge:B.appOpen,   updated:"6h ago"   },
  { kind:"entity", name:"Luxbox",                    typeLabel:"SALES AGENT",        flag:"🇫🇷", country:"France",       intelligence:"Debut features & world cinema",       badge:B.isNew,     updated:"3h ago"   },
  { kind:"entity", name:"Busan BIFF",                typeLabel:"FESTIVAL",           flag:"🇰🇷", country:"South Korea",  intelligence:"Asian cinema priority",              badge:B.isNew,     updated:"4h ago"   },
  { kind:"entity", name:"MIDPOINT",                  typeLabel:"LAB",                flag:"🇨🇿", country:"Czech Republic",intelligence:"Script & project development",       badge:B.appOpen,   updated:"5h ago"   },
  { kind:"entity", name:"MK2 Productions",           typeLabel:"PRODUCTION COMPANY", flag:"🇫🇷", country:"France",       intelligence:"Auteur & arthouse films",            badge:B.coProd,    updated:"8h ago"   },
  { kind:"entity", name:"Doha Film Institute",       typeLabel:"FUND",               flag:"🇶🇦", country:"Qatar",        intelligence:"MENA region films",                  badge:B.appOpen,   updated:"3h ago"   },
  { kind:"entity", name:"The Match Factory",         typeLabel:"SALES AGENT",        flag:"🇩🇪", country:"Germany",      intelligence:"International features",             badge:B.seeking,   updated:"4h ago"   },
  { kind:"entity", name:"European Film Market",      typeLabel:"MARKET",             flag:"🇩🇪", country:"Germany",      intelligence:"Industry accreditation open",         badge:B.open,      updated:"6h ago"   },
  { kind:"entity", name:"Plan B Entertainment",      typeLabel:"PRODUCTION COMPANY", flag:"🇺🇸", country:"USA",          intelligence:"Open to debut directors",            badge:B.seeking,   updated:"3h ago"   },
  { kind:"entity", name:"Cinefondation",             typeLabel:"RESIDENCY",          flag:"🇫🇷", country:"France",       intelligence:"Post-production residency",           badge:B.c48h,      updated:"1h ago"   },
  { kind:"entity", name:"Ventana Sur",               typeLabel:"MARKET",             flag:"🇦🇷", country:"Argentina",    intelligence:"Latin American projects",             badge:B.isNew,     updated:"2h ago"   },
  { kind:"entity", name:"Match Factory Productions", typeLabel:"PRODUCTION COMPANY", flag:"🇩🇪", country:"Germany",      intelligence:"International features",             badge:B.coProd,    updated:"2h ago"   },
  { kind:"entity", name:"Chicken & Egg Pictures",    typeLabel:"FUND",               flag:"🇺🇸", country:"USA",          intelligence:"Female-directed documentaries",       badge:B.isNew,     updated:"1h ago"   },
  { kind:"entity", name:"Wild Bunch International",  typeLabel:"SALES AGENT",        flag:"🇫🇷", country:"France",       intelligence:"Genre & art house",                  badge:B.open,      updated:"1d ago"   },
];

const INSIGHTS: InsightCard[] = [
  { kind:"insight", label:"INSIGHT",   text:"14 documentary funds close this month." },
  { kind:"insight", label:"TREND",     text:"23 European producers seeking India co-productions." },
  { kind:"insight", label:"ALERT",     text:"4 streamers acquiring international docs." },
  { kind:"insight", label:"SNAPSHOT",  text:"$42M available across active fund opportunities." },
  { kind:"insight", label:"TREND",     text:"127 festivals currently accepting submissions." },
  { kind:"insight", label:"ALERT",     text:"5 major funding opportunities close this week." },
];

const STATS = [
  { value: "1,847", label: "Active Opportunities" },
  { value: "6,293", label: "Production Companies" },
  { value: "782",   label: "Sales Agents" },
  { value: "411",   label: "Festivals" },
  { value: "127",   label: "Film Markets" },
  { value: "89",    label: "Streamers" },
  { value: "23K+",  label: "Organizations" },
  { value: "$3.2B+",label: "Funding Tracked" },
];

function buildCards(): Card[] {
  const out: Card[] = [];
  let ii = 0;
  for (let i = 0; i < ENTITIES.length; i++) {
    out.push(ENTITIES[i]);
    if ((i + 1) % 6 === 0) { out.push(INSIGHTS[ii % INSIGHTS.length]); ii++; }
  }
  return out;
}
const BASE  = buildCards();
const TRACK = [...BASE, ...BASE];

/* ── Card components ─────────────────────────────────────────────────── */
function EntityCardEl({ card }: { card: EntityCard }) {
  const svg = LOGOS[card.name] ?? monogram(card.name, card.typeLabel);
  return (
    <div
      className="ticker-card"
      style={{ flexShrink: 0, display:"flex", flexDirection:"column", alignItems:"center", gap:7, padding:"0 18px", textAlign:"center" }}
    >
      <div
        style={{ width:44, height:44, flexShrink:0 }}
        dangerouslySetInnerHTML={{ __html: svg }}
      />
      <div style={{ fontSize:8, letterSpacing:"0.2em", color:"#B8B2A8", textTransform:"uppercase", fontWeight:500 }}>
        {card.typeLabel}
      </div>
      <span style={{
        fontSize:7.5, letterSpacing:"0.12em",
        background:card.badge.bg, color:card.badge.text,
        borderRadius:4, padding:"2px 7px",
        textTransform:"uppercase", fontWeight:700, whiteSpace:"nowrap",
      }}>
        {card.badge.label}
      </span>
    </div>
  );
}

function InsightCardEl({ card }: { card: InsightCard }) {
  return (
    <div
      className="ticker-card"
      style={{ flexShrink:0, display:"flex", flexDirection:"column", justifyContent:"center", gap:5, padding:"0 22px", textAlign:"center" }}
    >
      <div style={{ fontSize:7.5, letterSpacing:"0.22em", color:"#BF9953", textTransform:"uppercase", fontWeight:700 }}>
        🧠 {card.label}
      </div>
      <div style={{ fontSize:11, color:"#1A1815", lineHeight:1.4, fontStyle:"italic", fontFamily:"var(--font-display)", maxWidth:160 }}>
        {card.text}
      </div>
    </div>
  );
}

/* ── Main ────────────────────────────────────────────────────────────── */
export default function IntelligenceTicker() {
  const [paused, setPaused] = useState(false);

  return (
    <section aria-label="Film industry intelligence" style={{ background:"transparent", overflow:"hidden" }}>

      {/* eyebrow */}
      <p style={{
        textAlign:"center", fontSize:9, letterSpacing:"0.3em",
        color:"#B8B2A8", textTransform:"uppercase", fontWeight:500,
        padding:"32px 24px 16px",
      }}>
        Trusted by the global film industry
      </p>

      {/* carousel */}
      <div
        style={{ overflow:"hidden" }}
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
        onTouchStart={() => setPaused(true)}
        onTouchEnd={() => setPaused(false)}
      >
        <div style={{
          display:"flex", alignItems:"center",
          padding:"4px 0 20px",
          width:"max-content",
          animation:"fylym-ticker 120s linear infinite",
          animationPlayState: paused ? "paused" : "running",
          willChange:"transform",
        }}>
          {TRACK.map((card, i) =>
            card.kind === "insight"
              ? <InsightCardEl key={`i-${i}`} card={card as InsightCard} />
              : <EntityCardEl  key={`e-${i}`} card={card as EntityCard}  />
          )}
        </div>
      </div>

      {/* stats */}
      <div style={{
        borderTop:"1px solid #E5E0D5",
        display:"flex", gap:24, alignItems:"center", justifyContent:"center",
        flexWrap:"wrap", padding:"12px 24px",
      }}>
        {STATS.map(({ value, label }) => (
          <div key={label} style={{ display:"flex", alignItems:"baseline", gap:4 }}>
            <span style={{ fontSize:12, fontWeight:700, color:"#BF9953" }}>{value}</span>
            <span style={{ fontSize:9, color:"#B8B2A8", letterSpacing:"0.05em" }}>{label}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
