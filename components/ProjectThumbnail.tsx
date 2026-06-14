"use client";

import { useEffect, useRef, useState } from "react";

// Deterministic pastel palette from title string
const PALETTES = [
  { bg: "#F0E8FF", accent: "#C4A8E8", text: "#4A1D96" }, // lavender
  { bg: "#E8F8F0", accent: "#A8E8C4", text: "#1A5C3A" }, // sage
  { bg: "#FFF0E8", accent: "#F5C4A0", text: "#8B3A0F" }, // peach
  { bg: "#E8F0FF", accent: "#A8C0F0", text: "#1A2E7A" }, // periwinkle
  { bg: "#FFF0F5", accent: "#F0B0C8", text: "#7A1A3C" }, // rose
  { bg: "#F5FFE8", accent: "#C0E888", text: "#2A5C0A" }, // lime
  { bg: "#FFFCE8", accent: "#F0DCA0", text: "#6B4A00" }, // butter
  { bg: "#E8FFFD", accent: "#A0E8E4", text: "#0A4A48" }, // aqua
];

function hashTitle(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function generateSVGCard(title: string, genre: string): string {
  const p = PALETTES[hashTitle(title) % PALETTES.length];
  // Wrap title into up to 2 lines of ~18 chars each
  const words = title.split(" ");
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    if ((cur + " " + w).trim().length > 18 && cur) {
      lines.push(cur.trim());
      cur = w;
    } else {
      cur = (cur + " " + w).trim();
    }
  }
  if (cur) lines.push(cur.trim());
  const displayLines = lines.slice(0, 2);
  if (lines.length > 2) displayLines[1] = displayLines[1].slice(0, 15) + "…";

  const titleY = displayLines.length === 1 ? 90 : 80;

  const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400">
    <rect width="600" height="400" fill="${p.bg}"/>
    <rect x="0" y="320" width="600" height="80" fill="${p.accent}" opacity="0.45"/>
    <rect x="40" y="40" width="8" height="8" rx="2" fill="${p.accent}"/>
    <rect x="552" y="40" width="8" height="8" rx="2" fill="${p.accent}"/>
    <rect x="40" y="352" width="8" height="8" rx="2" fill="${p.accent}"/>
    <rect x="552" y="352" width="8" height="8" rx="2" fill="${p.accent}"/>
    ${displayLines.map((line, i) => `<text x="300" y="${titleY + i * 52}" text-anchor="middle" font-family="Georgia, serif" font-size="38" font-weight="400" fill="${p.text}">${line}</text>`).join("")}
    <text x="300" y="360" text-anchor="middle" font-family="Arial, sans-serif" font-size="13" letter-spacing="3" fill="${p.text}" opacity="0.6">${genre.toUpperCase()}</text>
  </svg>`;

  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgContent)}`;
}

interface Props {
  posterPath: string | null;
  deckPath: string | null;
  title: string;
  genre: string;
  supabaseUrl: string;
  className?: string;
}

export default function ProjectThumbnail({ posterPath, deckPath, title, genre, supabaseUrl, className = "" }: Props) {
  const [deckThumb, setDeckThumb] = useState<string | null>(null);
  const [deckFailed, setDeckFailed] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const posterUrl = posterPath
    ? `${supabaseUrl}/storage/v1/object/public/thumbnails/${posterPath}`
    : null;

  // Try to render first page of pitch deck via PDF.js (client-only)
  useEffect(() => {
    if (posterUrl || !deckPath || deckFailed) return;
    let cancelled = false;

    async function extractDeckThumb() {
      try {
        // Dynamically load PDF.js from CDN (only when actually needed)
        const script = document.createElement("script");
        script.src = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
        await new Promise<void>((res, rej) => {
          script.onload = () => res();
          script.onerror = () => rej();
          document.head.appendChild(script);
        });

        const pdfjsLib = (window as any)["pdfjs-dist/build/pdf"];
        pdfjsLib.GlobalWorkerOptions.workerSrc =
          "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";

        // Get signed URL for the deck (private bucket)
        const res = await fetch(`/api/deck-url?path=${encodeURIComponent(deckPath)}`);
        if (!res.ok) throw new Error("no url");
        const { url } = await res.json();

        const pdf = await pdfjsLib.getDocument(url).promise;
        const page = await pdf.getPage(1);
        const viewport = page.getViewport({ scale: 1.5 });

        const canvas = document.createElement("canvas");
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        await page.render({ canvasContext: canvas.getContext("2d"), viewport }).promise;

        if (!cancelled) setDeckThumb(canvas.toDataURL("image/jpeg", 0.85));
      } catch {
        if (!cancelled) setDeckFailed(true);
      }
    }

    extractDeckThumb();
    return () => { cancelled = true; };
  }, [posterUrl, deckPath, deckFailed]);

  const src = posterUrl ?? deckThumb ?? generateSVGCard(title, genre);
  const isGenerated = !posterUrl && !deckThumb;

  return (
    <div className={`relative overflow-hidden bg-ivory ${className}`} style={{ aspectRatio: "3/2" }}>
      <img
        src={src}
        alt={`${title} thumbnail`}
        className="w-full h-full object-cover"
        style={isGenerated ? { objectFit: "contain" } : undefined}
        onError={() => {
          if (!isGenerated) setDeckFailed(true);
        }}
      />
    </div>
  );
}
