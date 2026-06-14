// ProjectThumbnail — three-tier image with instant render, no blocking.
//
// Priority:
//   1. poster_path  → Supabase public storage URL → next/image (WebP, lazy, sized)
//   2. No poster    → Generated SVG title card (inline, instant, no network)
//
// The PDF.js deck-extraction tier was removed: it loaded ~3 MB of JS
// from CDN per tile, blocked the main thread, and caused visible delay
// on every page that showed thumbnails without posters. Poster upload
// is the intended path; the SVG card is the elegant permanent fallback.

import Image from "next/image";

const PALETTES = [
  { bg: "#F0E8FF", accent: "#C4A8E8", text: "#4A1D96" },
  { bg: "#E8F8F0", accent: "#A8E8C4", text: "#1A5C3A" },
  { bg: "#FFF0E8", accent: "#F5C4A0", text: "#8B3A0F" },
  { bg: "#E8F0FF", accent: "#A8C0F0", text: "#1A2E7A" },
  { bg: "#FFF0F5", accent: "#F0B0C8", text: "#7A1A3C" },
  { bg: "#F5FFE8", accent: "#C0E888", text: "#2A5C0A" },
  { bg: "#FFFCE8", accent: "#F0DCA0", text: "#6B4A00" },
  { bg: "#E8FFFD", accent: "#A0E8E4", text: "#0A4A48" },
];

function hashTitle(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function SVGCard({ title, genre, className }: { title: string; genre: string; className?: string }) {
  const p = PALETTES[hashTitle(title) % PALETTES.length];
  const words = title.split(" ");
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    if ((cur + " " + w).trim().length > 16 && cur) { lines.push(cur.trim()); cur = w; }
    else { cur = (cur + " " + w).trim(); }
  }
  if (cur) lines.push(cur.trim());
  const display = lines.slice(0, 2);
  if (lines.length > 2) display[1] = display[1].slice(0, 13) + "…";
  const y0 = display.length === 1 ? 88 : 72;

  return (
    <div className={className} style={{ background: p.bg, aspectRatio: "3/2", display: "flex", alignItems: "center", justifyContent: "center", position: "relative", overflow: "hidden" }}>
      {/* Bottom accent band */}
      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: "22%", background: p.accent, opacity: 0.4 }} />
      {/* Corner dots */}
      {[[10, 10], [10, "auto"], ["auto", 10], ["auto", "auto"]].map(([t, r], i) => (
        <div key={i} style={{ position: "absolute", top: t === "auto" ? undefined : 12, bottom: t === "auto" ? 12 : undefined, left: r === "auto" ? undefined : 12, right: r === "auto" ? 12 : undefined, width: 7, height: 7, borderRadius: 2, background: p.accent }} />
      ))}
      <svg viewBox="0 0 300 200" style={{ width: "90%", height: "90%", position: "relative" }}>
        {display.map((line, i) => (
          <text key={i} x="150" y={y0 + i * 42} textAnchor="middle" fontFamily="Georgia, serif" fontSize="28" fontWeight="400" fill={p.text}>
            {line}
          </text>
        ))}
        <text x="150" y="180" textAnchor="middle" fontFamily="Arial, sans-serif" fontSize="10" letterSpacing="3" fill={p.text} opacity="0.55">
          {genre.toUpperCase()}
        </text>
      </svg>
    </div>
  );
}

interface Props {
  posterPath: string | null;
  deckPath?: string | null;  // kept for API compatibility, not used for extraction
  title: string;
  genre: string;
  supabaseUrl: string;
  className?: string;
}

export default function ProjectThumbnail({ posterPath, title, genre, supabaseUrl, className = "" }: Props) {
  if (!posterPath) {
    return <SVGCard title={title} genre={genre} className={`${className} rounded-card`} />;
  }

  const src = `${supabaseUrl}/storage/v1/object/public/thumbnails/${posterPath}`;

  return (
    <div className={`${className} relative overflow-hidden`} style={{ aspectRatio: "3/2" }}>
      <Image
        src={src}
        alt={`${title} poster`}
        fill
        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
        className="object-cover"
        loading="lazy"
        placeholder="empty"
      />
    </div>
  );
}
