// lib/film-identity.ts
// Single source of truth for all film metadata display formatting.
// Every field on every surface must go through these functions.

// ── Country data ──────────────────────────────────────────────────────────────

const COUNTRIES: Record<string, { flag: string; name: string }> = {
  // South Asia
  india:         { flag: "🇮🇳", name: "India" },
  bangladesh:    { flag: "🇧🇩", name: "Bangladesh" },
  pakistan:      { flag: "🇵🇰", name: "Pakistan" },
  "sri lanka":   { flag: "🇱🇰", name: "Sri Lanka" },
  nepal:         { flag: "🇳🇵", name: "Nepal" },
  bhutan:        { flag: "🇧🇹", name: "Bhutan" },
  maldives:      { flag: "🇲🇻", name: "Maldives" },
  // Southeast Asia
  thailand:      { flag: "🇹🇭", name: "Thailand" },
  vietnam:       { flag: "🇻🇳", name: "Vietnam" },
  indonesia:     { flag: "🇮🇩", name: "Indonesia" },
  malaysia:      { flag: "🇲🇾", name: "Malaysia" },
  philippines:   { flag: "🇵🇭", name: "Philippines" },
  singapore:     { flag: "🇸🇬", name: "Singapore" },
  myanmar:       { flag: "🇲🇲", name: "Myanmar" },
  cambodia:      { flag: "🇰🇭", name: "Cambodia" },
  laos:          { flag: "🇱🇦", name: "Laos" },
  "east timor":  { flag: "🇹🇱", name: "East Timor" },
  // East Asia
  japan:         { flag: "🇯🇵", name: "Japan" },
  "south korea": { flag: "🇰🇷", name: "South Korea" },
  korea:         { flag: "🇰🇷", name: "South Korea" },
  china:         { flag: "🇨🇳", name: "China" },
  taiwan:        { flag: "🇹🇼", name: "Taiwan" },
  "hong kong":   { flag: "🇭🇰", name: "Hong Kong" },
  mongolia:      { flag: "🇲🇳", name: "Mongolia" },
  // South Europe
  france:        { flag: "🇫🇷", name: "France" },
  italy:         { flag: "🇮🇹", name: "Italy" },
  spain:         { flag: "🇪🇸", name: "Spain" },
  portugal:      { flag: "🇵🇹", name: "Portugal" },
  greece:        { flag: "🇬🇷", name: "Greece" },
  // West Europe
  germany:       { flag: "🇩🇪", name: "Germany" },
  netherlands:   { flag: "🇳🇱", name: "Netherlands" },
  belgium:       { flag: "🇧🇪", name: "Belgium" },
  switzerland:   { flag: "🇨🇭", name: "Switzerland" },
  austria:       { flag: "🇦🇹", name: "Austria" },
  luxembourg:    { flag: "🇱🇺", name: "Luxembourg" },
  // North Europe
  "united kingdom": { flag: "🇬🇧", name: "United Kingdom" },
  uk:            { flag: "🇬🇧", name: "United Kingdom" },
  ireland:       { flag: "🇮🇪", name: "Ireland" },
  sweden:        { flag: "🇸🇪", name: "Sweden" },
  norway:        { flag: "🇳🇴", name: "Norway" },
  denmark:       { flag: "🇩🇰", name: "Denmark" },
  finland:       { flag: "🇫🇮", name: "Finland" },
  iceland:       { flag: "🇮🇸", name: "Iceland" },
  // Central/East Europe
  poland:        { flag: "🇵🇱", name: "Poland" },
  "czech republic": { flag: "🇨🇿", name: "Czech Republic" },
  czechia:       { flag: "🇨🇿", name: "Czech Republic" },
  hungary:       { flag: "🇭🇺", name: "Hungary" },
  romania:       { flag: "🇷🇴", name: "Romania" },
  ukraine:       { flag: "🇺🇦", name: "Ukraine" },
  russia:        { flag: "🇷🇺", name: "Russia" },
  serbia:        { flag: "🇷🇸", name: "Serbia" },
  croatia:       { flag: "🇭🇷", name: "Croatia" },
  slovenia:      { flag: "🇸🇮", name: "Slovenia" },
  slovakia:      { flag: "🇸🇰", name: "Slovakia" },
  bulgaria:      { flag: "🇧🇬", name: "Bulgaria" },
  // Americas
  "united states": { flag: "🇺🇸", name: "United States" },
  usa:           { flag: "🇺🇸", name: "United States" },
  us:            { flag: "🇺🇸", name: "United States" },
  canada:        { flag: "🇨🇦", name: "Canada" },
  mexico:        { flag: "🇲🇽", name: "Mexico" },
  brazil:        { flag: "🇧🇷", name: "Brazil" },
  argentina:     { flag: "🇦🇷", name: "Argentina" },
  colombia:      { flag: "🇨🇴", name: "Colombia" },
  chile:         { flag: "🇨🇱", name: "Chile" },
  peru:          { flag: "🇵🇪", name: "Peru" },
  venezuela:     { flag: "🇻🇪", name: "Venezuela" },
  cuba:          { flag: "🇨🇺", name: "Cuba" },
  // Middle East
  iran:          { flag: "🇮🇷", name: "Iran" },
  turkey:        { flag: "🇹🇷", name: "Turkey" },
  israel:        { flag: "🇮🇱", name: "Israel" },
  "saudi arabia": { flag: "🇸🇦", name: "Saudi Arabia" },
  uae:           { flag: "🇦🇪", name: "UAE" },
  "united arab emirates": { flag: "🇦🇪", name: "UAE" },
  lebanon:       { flag: "🇱🇧", name: "Lebanon" },
  jordan:        { flag: "🇯🇴", name: "Jordan" },
  iraq:          { flag: "🇮🇶", name: "Iraq" },
  // Africa
  egypt:         { flag: "🇪🇬", name: "Egypt" },
  morocco:       { flag: "🇲🇦", name: "Morocco" },
  nigeria:       { flag: "🇳🇬", name: "Nigeria" },
  "south africa": { flag: "🇿🇦", name: "South Africa" },
  ghana:         { flag: "🇬🇭", name: "Ghana" },
  kenya:         { flag: "🇰🇪", name: "Kenya" },
  ethiopia:      { flag: "🇪🇹", name: "Ethiopia" },
  senegal:       { flag: "🇸🇳", name: "Senegal" },
  tunisia:       { flag: "🇹🇳", name: "Tunisia" },
  cameroon:      { flag: "🇨🇲", name: "Cameroon" },
  "burkina faso": { flag: "🇧🇫", name: "Burkina Faso" },
  // Oceania
  australia:     { flag: "🇦🇺", name: "Australia" },
  "new zealand": { flag: "🇳🇿", name: "New Zealand" },
  "papua new guinea": { flag: "🇵🇬", name: "Papua New Guinea" },
};

/**
 * Resolve a raw country string to { flag, name }.
 * Returns { flag: '', name: titleCased } if the country isn't in the lookup.
 * Returns null if input is empty.
 */
export function formatCountry(
  raw: string | null | undefined
): { flag: string; name: string } | null {
  if (!raw?.trim()) return null;
  const key = raw.toLowerCase().trim();
  if (COUNTRIES[key]) return COUNTRIES[key];
  // Title-case fallback — at least normalise the display name
  const name = raw
    .split(" ")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
  return { flag: "", name };
}

// ── Format ────────────────────────────────────────────────────────────────────

const FORMAT_DISPLAY: Record<string, string> = {
  feature:         "Feature",
  short:           "Short",
  documentary:     "Documentary",
  series:          "Series",
  animation:       "Animation",
  experimental:    "Experimental",
  "limited series":"Limited Series",
};

export function formatFormat(raw: string | null | undefined): string {
  if (!raw) return "";
  return FORMAT_DISPLAY[raw.toLowerCase().trim()] ?? titleCase(raw);
}

// ── Stage / Status ─────────────────────────────────────────────────────────────

export const STAGE_DISPLAY: Record<string, string> = {
  development:     "Development",
  pre_production:  "Pre-Production",
  production:      "Production",
  post_production: "Post-Production",
  completed:       "Completed",
  released:        "Released",
  cancelled:       "Cancelled",
};

export const STAGE_BADGE: Record<string, { bg: string; color: string }> = {
  development:     { bg: "rgba(212,168,67,0.10)",  color: "#7A5A1A" },
  pre_production:  { bg: "rgba(212,168,67,0.10)",  color: "#7A5A1A" },
  production:      { bg: "rgba(91,138,107,0.10)",  color: "#2E6B4E" },
  post_production: { bg: "rgba(123,111,170,0.10)", color: "#4E3E8A" },
  completed:       { bg: "rgba(74,127,165,0.10)",  color: "#1E5A8A" },
  released:        { bg: "rgba(74,127,165,0.10)",  color: "#1E5A8A" },
  cancelled:       { bg: "rgba(154,90,90,0.10)",   color: "#7A2A2A" },
};

export function formatStage(raw: string | null | undefined): string {
  if (!raw) return "";
  return STAGE_DISPLAY[raw.toLowerCase().trim()] ?? titleCase(raw);
}

// ── Runtime ───────────────────────────────────────────────────────────────────

/** Returns "118 min" or "" if no value. Never "118 Minutes" or "1h 58m". */
export function formatRuntime(min: number | null | undefined): string {
  if (!min) return "";
  return `${min} min`;
}

// ── Dates ─────────────────────────────────────────────────────────────────────

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

/** Returns "14 Jun 2025". Never ISO, never slashes, never American. */
export function formatFilmDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
  } catch {
    return "—";
  }
}

// ── Budget ────────────────────────────────────────────────────────────────────

/**
 * Formats a USD value using $K/$M shorthand.
 * The DB stores everything in USD. Display in $K/$M.
 */
export function formatBudgetDisplay(usd: number | null | undefined): string {
  if (!usd) return "—";
  if (usd >= 1_000_000) return `$${(usd / 1_000_000).toFixed(1)}M`;
  if (usd >= 1_000) return `$${Math.round(usd / 1_000)}K`;
  return `$${usd.toLocaleString()}`;
}

// ── Project short ID ──────────────────────────────────────────────────────────

/** Generates a deterministic FP-NNNNN display ID from a UUID. */
export function formatShortId(uuid: string): string {
  let hash = 0;
  for (let i = 0; i < uuid.length; i++) {
    hash = (Math.imul(31, hash) + uuid.charCodeAt(i)) | 0;
  }
  const n = Math.abs(hash) % 100000;
  return `FP-${String(n).padStart(5, "0")}`;
}

// ── Seeking chip values (canonical allowed list) ──────────────────────────────

export const SEEKING_CHIPS = [
  "Co-Producer",
  "Executive Producer",
  "Gap Financing",
  "Sales Agent",
  "Distributor",
  "Streamer",
  "Completion Fund",
  "Festival Premiere",
  "International Sales",
  "Private Equity",
  "Brand Partner",
  "Co-Production",
] as const;

export type SeekingChip = (typeof SEEKING_CHIPS)[number];

// ── Metadata row builder ──────────────────────────────────────────────────────

export interface MetadataRowConfig {
  format?: string | null;
  genre?: string | null;
  country?: string | null;
  language?: string | null;
  runtime_min?: number | null;
  stage?: string | null;
}

/**
 * Builds the ordered metadata items array.
 * full  = all 6 fields (collapses missing ones)
 * short = Format · Genre · Country  (compact card, 3 fields)
 * mini  = Format · Country           (messaging preview)
 */
export function buildMetadataItems(
  config: MetadataRowConfig,
  mode: "full" | "short" | "mini" = "full"
): Array<{ type: "text"; value: string } | { type: "country"; flag: string; name: string }> {
  const items: Array<
    { type: "text"; value: string } | { type: "country"; flag: string; name: string }
  > = [];

  const fmt = formatFormat(config.format);
  if (fmt) items.push({ type: "text", value: fmt });

  if (mode !== "mini" && config.genre)
    items.push({ type: "text", value: config.genre });

  const country = formatCountry(config.country);
  if (country) items.push({ type: "country", flag: country.flag, name: country.name });

  if (mode === "full" && config.language)
    items.push({ type: "text", value: config.language });

  if (mode === "full") {
    const rt = formatRuntime(config.runtime_min);
    if (rt) items.push({ type: "text", value: rt });

    const stage = formatStage(config.stage);
    if (stage) items.push({ type: "text", value: stage });
  }

  return items;
}

// ── Internal helpers ──────────────────────────────────────────────────────────

function titleCase(s: string): string {
  return s.replace(/\w\S*/g, (t) => t.charAt(0).toUpperCase() + t.slice(1).toLowerCase());
}
