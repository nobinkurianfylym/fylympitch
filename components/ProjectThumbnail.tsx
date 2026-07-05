// ProjectThumbnail — poster image, pitch deck cover, or pastel SVG title card fallback.
//
// Priority:
//   1. poster_path → Supabase public storage URL
//   2. deckUrl     → Rendered page 1 of the pitch deck (authenticated surfaces only)
//   3. Neither     → Generated pastel title card (inline, instant, no network)

import DeckCoverThumbnail from "./DeckCoverThumbnail";

const PALETTES = [
  { bg: "#F0E8FF", accent: "#C4A8E8", text: "#4A1D96" },  // lavender
  { bg: "#E8F8F0", accent: "#A8E8C4", text: "#1A5C3A" },  // sage
  { bg: "#FFF0E8", accent: "#F5C4A0", text: "#8B3A0F" },  // peach
  { bg: "#E8F0FF", accent: "#A8C0F0", text: "#1A2E7A" },  // periwinkle
  { bg: "#FFF0F5", accent: "#F0B0C8", text: "#7A1A3C" },  // rose
  { bg: "#F5FFE8", accent: "#C0E888", text: "#2A5C0A" },  // lime
  { bg: "#FFFCE8", accent: "#F0DCA0", text: "#6B4A00" },  // butter
  { bg: "#E8FFFD", accent: "#A0E8E4", text: "#0A4A48" },  // aqua
];

function hashTitle(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function PastelCard({ title, genre, className }: { title: string; genre: string | null; className?: string }) {
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
    <div
      className={className}
      style={{
        background: p.bg,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Bottom accent band */}
      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: "22%", background: p.accent, opacity: 0.4 }} />
      {/* Corner dots */}
      {([["top", "left"], ["top", "right"], ["bottom", "left"], ["bottom", "right"]] as const).map(([v, h], i) => (
        <div key={i} style={{
          position: "absolute",
          [v]: 8, [h]: 8,
          width: 6, height: 6, borderRadius: 2,
          background: p.accent,
        }} />
      ))}
      <svg viewBox="0 0 300 200" style={{ width: "90%", height: "90%", position: "relative" }}>
        {display.map((line, i) => (
          <text
            key={i}
            x="150" y={y0 + i * 42}
            textAnchor="middle"
            fontFamily="Georgia, serif"
            fontSize="28"
            fontWeight="400"
            fill={p.text}
          >
            {line}
          </text>
        ))}
        <text
          x="150" y="180"
          textAnchor="middle"
          fontFamily="Arial, sans-serif"
          fontSize="10"
          letterSpacing="3"
          fill={p.text}
          opacity="0.55"
        >
          {(genre ?? "").toUpperCase()}
        </text>
      </svg>
    </div>
  );
}

interface Props {
  posterPath?: string | null;
  // Signed URL for the project's pitch deck PDF. Only pass this on authenticated
  // surfaces (dashboard, producer studio, Discover) — decks live in a private
  // bucket, so public pages should omit it and fall through to the pastel card.
  deckUrl?: string | null;
  title: string;
  genre?: string | null;
  supabaseUrl: string;
  className?: string;
}

export default function ProjectThumbnail({ posterPath, deckUrl, title, genre, supabaseUrl, className = "" }: Props) {
  // Priority: poster > pitch deck page 1 > pastel title card
  if (posterPath) {
    return (
      <img
        src={`${supabaseUrl}/storage/v1/object/public/thumbnails/${posterPath}`}
        alt={`${title} poster`}
        className={`${className} object-cover`}
        loading="lazy"
      />
    );
  }

  if (deckUrl) {
    return <DeckCoverThumbnail deckUrl={deckUrl} title={title} genre={genre} className={className} />;
  }

  return <PastelCard title={title} genre={genre ?? ""} className={`${className} rounded-card`} />;
}
