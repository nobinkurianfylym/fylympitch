// components/FilmIdentity.tsx
// Universal Film Identity Component — FYLYMPITCH Design System v1.0
//
// Enforces strict visual hierarchy and data standardisation across all surfaces.
// Pass variant prop to control data density.

import Link from "next/link";
import { Fragment } from "react";
import type { ReactNode } from "react";
import ProjectThumbnail from "./ProjectThumbnail";
import {
  buildMetadataItems,
  formatBudgetDisplay,
  formatFilmDate,
  formatFormat,
  formatShortId,
  formatStage,
  STAGE_BADGE,
} from "@/lib/film-identity";

// ── Types ─────────────────────────────────────────────────────────────────────

export type FilmIdentityVariant =
  | "full"
  | "compact-card"
  | "table-row"
  | "search-result"
  | "messaging-preview"
  | "notification";

export interface FilmIdentityProject {
  id: string;
  title: string;
  genre?: string | null;
  format?: string | null;
  language?: string | null;
  country?: string | null;
  stage?: string | null;
  logline?: string | null;
  budget_usd?: number | null;
  funding_needed_usd?: number | null;
  finance_secured_usd?: number | null;
  poster_path?: string | null;
  director_name?: string | null;
  producer_info?: string | null;
  writer_name?: string | null;
  created_at?: string | null;
  is_public?: boolean;
  // Optional extended fields — populated as DB schema grows
  runtime_min?: number | null;
  seeking?: string[];
  territory?: string | null;
  expected_delivery?: string | null;
  filmmaker?: { full_name: string; username?: string | null; career_stage?: string | null } | null;
}

export interface FilmIdentityProps {
  project: FilmIdentityProject;
  variant?: FilmIdentityVariant;
  supabaseUrl: string;
  matchScore?: number;
  /** Slot for action buttons — caller provides the right buttons for context */
  actions?: ReactNode;
  /** href override — defaults to /producer/projects/[id] */
  href?: string;
  className?: string;
}

// ── Sub-components ─────────────────────────────────────────────────────────────

/** Metadata row with strict separator and country flag handling */
function MetadataRow({
  project,
  mode = "full",
}: {
  project: FilmIdentityProject;
  mode?: "full" | "short" | "mini";
}) {
  const items = buildMetadataItems(project, mode);
  if (items.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[13px] text-ink/70 leading-tight">
      {items.map((item, i) => (
        <Fragment key={i}>
          {i > 0 && (
            <span className="text-ash select-none" aria-hidden="true">
              ·
            </span>
          )}
          {item.type === "country" ? (
            <span>
              {item.flag && (
                <span aria-label={item.name} role="img">
                  {item.flag}{" "}
                </span>
              )}
              {item.name}
            </span>
          ) : (
            <span>{item.value}</span>
          )}
        </Fragment>
      ))}
    </div>
  );
}

/** Director / filmmaker name — rendered directly below MetadataRow on every surface */
function DirectorLine({ project }: { project: FilmIdentityProject }) {
  const name     = project.director_name ?? project.filmmaker?.full_name ?? null;
  const username = project.filmmaker?.username ?? null;
  if (!name) return null;
  return (
    <p className="text-[12px] text-ash leading-tight mt-1.5">
      <span className="text-[10px] font-medium tracking-[0.08em] uppercase text-ash/60 mr-1">
        Dir.
      </span>
      {username ? (
        <Link
          href={`/u/${username}`}
          className="text-ash hover:text-gold transition-colors underline-offset-2 hover:underline"
        >
          {name}
        </Link>
      ) : (
        name
      )}
    </p>
  );
}

/** Canonical status badge with semantic colours */
function StatusBadge({ stage }: { stage: string | null | undefined }) {
  if (!stage) return null;
  const display = formatStage(stage);
  const colors = STAGE_BADGE[stage] ?? STAGE_BADGE["development"];

  return (
    <span
      className="inline-block text-[10px] font-medium tracking-[0.08em] uppercase px-2.5 py-1 rounded"
      style={{ background: colors.bg, color: colors.color }}
      role="status"
      aria-label={`Project status: ${display}`}
    >
      {display}
    </span>
  );
}

/** Flex-wrap chip grid — never paragraph text */
function SeekingChips({ seeking }: { seeking: string[] }) {
  if (!seeking?.length) return null;
  const visible = seeking.slice(0, 6);
  const overflow = seeking.length - 6;

  return (
    <div role="group" aria-label="Seeking" className="flex flex-wrap gap-2">
      {visible.map((chip) => (
        <span
          key={chip}
          className="text-[12px] font-medium px-3 py-1.5 rounded border border-line bg-parchment text-ink"
        >
          {chip}
        </span>
      ))}
      {overflow > 0 && (
        <span className="text-[12px] font-medium px-3 py-1.5 rounded border border-line bg-parchment text-ash">
          +{overflow} more
        </span>
      )}
    </div>
  );
}

/** Equal-width 3-column business data grid */
function BusinessGrid({ project }: { project: FilmIdentityProject }) {
  const budget = formatBudgetDisplay(project.budget_usd);
  const secured = project.finance_secured_usd;
  const securedPct =
    project.budget_usd && secured
      ? Math.round((secured / project.budget_usd) * 100)
      : null;
  const securedDisplay = secured
    ? `${formatBudgetDisplay(secured)}${securedPct !== null ? ` (${securedPct}%)` : ""}`
    : "—";

  const territory = project.territory ?? project.country ?? "—";
  const dateAdded = project.created_at ? formatFilmDate(project.created_at) : "—";
  const projectId = formatShortId(project.id);

  const required = [
    { label: "BUDGET", value: budget },
    { label: "FINANCING SECURED", value: securedDisplay },
    { label: "TERRITORY", value: territory },
    { label: "DATE ADDED", value: dateAdded },
    { label: "PROJECT ID", value: projectId },
  ];

  const optional: { label: string; value: string }[] = [
    ...(project.expected_delivery
      ? [{ label: "TARGET DELIVERY", value: project.expected_delivery }]
      : []),
    ...(project.funding_needed_usd && !project.finance_secured_usd
      ? [{ label: "SEEKING", value: formatBudgetDisplay(project.funding_needed_usd) }]
      : []),
  ];

  const all = [...required, ...optional];

  return (
    <div
      role="table"
      aria-label="Project details"
      className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-5"
    >
      {all.map(({ label, value }) => (
        <div key={label} className="border-b border-line pb-3">
          <p className="text-[10px] font-medium tracking-[0.08em] uppercase text-ash mb-0.5">
            {label}
          </p>
          <p className="text-[14px] font-semibold text-ink">{value}</p>
        </div>
      ))}
    </div>
  );
}

// ── VARIANT: Full ──────────────────────────────────────────────────────────────

function FullVariant({
  project,
  supabaseUrl,
  actions,
}: {
  project: FilmIdentityProject;
  supabaseUrl: string;
  actions?: ReactNode;
}) {
  // Producer: first line of producer_info
  const producerName = project.producer_info?.split("\n")[0]?.trim() ?? null;

  // Credits grid: PRODUCER + WRITER — DIRECTOR shown via DirectorLine below metadata
  const credits = [
    producerName ? { label: "PRODUCER", value: producerName } : null,
    project.writer_name ? { label: "WRITER", value: project.writer_name } : null,
  ].filter((c): c is { label: string; value: string } => c !== null);

  return (
    <div>
      {/* POSTER + CONTENT — side by side on desktop */}
      <div className="flex gap-7 items-start">
        {/* Poster */}
        <div className="shrink-0 hidden md:block" style={{ width: 140 }}>
          <div className="rounded-card overflow-hidden" style={{ width: 140, height: 210 }}>
            <ProjectThumbnail
              posterPath={project.poster_path}
              title={project.title}
              genre={project.genre}
              supabaseUrl={supabaseUrl}
              className="w-full h-full object-cover"
            />
          </div>
        </div>

        {/* Content column */}
        <div className="flex-1 min-w-0">
          {/* Mobile poster — full width above title */}
          <div className="block md:hidden mb-5 rounded-card overflow-hidden aspect-[3/4] max-w-[160px]">
            <ProjectThumbnail
              posterPath={project.poster_path}
              title={project.title}
              genre={project.genre}
              supabaseUrl={supabaseUrl}
              className="w-full h-full object-cover"
            />
          </div>

          {/* L1: Title */}
          <h1
            className="font-display font-bold text-ink leading-[1.08] uppercase"
            style={{ fontSize: "clamp(22px, 3vw, 34px)", letterSpacing: "-0.01em" }}
            aria-label={project.title}
          >
            {project.title}
          </h1>

          {/* L2: Primary metadata row */}
          <div className="mt-3">
            <MetadataRow project={project} mode="full" />
            <DirectorLine project={project} />
          </div>

          {/* L3: Credits */}
          {credits.length > 0 && (
            <div className="mt-5 flex flex-wrap gap-x-8 gap-y-3">
              {credits.map(({ label, value }) => (
                <div key={label}>
                  <p className="text-[10px] font-medium tracking-[0.08em] uppercase text-ash mb-0.5">
                    {label}
                  </p>
                  <p className="text-[14px] font-semibold text-ink">{value}</p>
                </div>
              ))}
            </div>
          )}

          {/* L4: Status badge + expected delivery */}
          {project.stage && (
            <div className="mt-5">
              <StatusBadge stage={project.stage} />
              {project.expected_delivery && (
                <p className="mt-1 text-[12px] text-ash">
                  Expected {project.expected_delivery}
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* L5: Logline — full width below the poster/content row */}
      {project.logline && (
        <p className="mt-6 text-[16px] italic leading-[1.65] text-ink/85 line-clamp-3">
          {project.logline}
        </p>
      )}

      {/* L6: Seeking chips */}
      {project.seeking && project.seeking.length > 0 && (
        <div className="mt-5">
          <SeekingChips seeking={project.seeking} />
        </div>
      )}

      {/* L7: Business metadata grid */}
      <div className="mt-6">
        <BusinessGrid project={project} />
      </div>

      {/* L8: Actions — one primary CTA, rest secondary/icon */}
      {actions && <div className="mt-6">{actions}</div>}
    </div>
  );
}

// ── VARIANT: Compact Card ──────────────────────────────────────────────────────

function CompactCardVariant({
  project,
  supabaseUrl,
  matchScore,
  actions,
  href,
}: {
  project: FilmIdentityProject;
  supabaseUrl: string;
  matchScore?: number;
  actions?: ReactNode;
  href?: string;
}) {
  const cardHref = href ?? `/producer/projects/${project.id}`;

  const secured = project.finance_secured_usd;
  const securedPct =
    project.budget_usd && secured
      ? Math.round((secured / project.budget_usd) * 100)
      : null;

  const scoreBg =
    matchScore !== undefined
      ? matchScore >= 80
        ? "bg-emerald-600 text-white"
        : matchScore >= 60
        ? "bg-gold text-white"
        : "bg-ink/70 text-ivory"
      : "";

  return (
    <div className="group flex flex-col bg-white/70 border border-line rounded-card overflow-hidden hover:border-gold/40 hover:shadow-sm transition-all">
      {/* Thumbnail + badges */}
      <div className="relative">
        <Link href={cardHref} aria-label={`View ${project.title}`}>
          <div className="aspect-[3/2] overflow-hidden">
            <ProjectThumbnail
              posterPath={project.poster_path}
              title={project.title}
              genre={project.genre}
              supabaseUrl={supabaseUrl}
              className="w-full h-full rounded-t-card"
            />
          </div>
        </Link>
        {project.is_public === false && (
          <span className="absolute top-2 left-2 text-[10px] tracking-[0.14em] uppercase font-medium px-2 py-0.5 rounded-full bg-ink/80 text-ivory">
            Private
          </span>
        )}
        {matchScore !== undefined && (
          <span
            className={`absolute top-2 right-2 text-[11px] font-medium tracking-[0.06em] px-2 py-0.5 rounded-full ${scoreBg}`}
            aria-label={`Match score: ${matchScore}`}
          >
            {matchScore}
          </span>
        )}
      </div>

      {/* Body */}
      <div className="p-5 flex flex-col flex-1">
        {/* L4 mini: status badge */}
        {project.stage && (
          <div className="mb-2.5">
            <StatusBadge stage={project.stage} />
          </div>
        )}

        {/* L1: Title */}
        <Link href={cardHref} className="block mb-2">
          <h2
            className="font-display font-bold text-ink leading-tight uppercase transition-colors group-hover:text-gold"
            style={{ fontSize: "clamp(16px, 2vw, 20px)", letterSpacing: "-0.01em" }}
          >
            {project.title}
          </h2>
        </Link>

        {/* L2 short: Format · Genre · Country + Director */}
        <div className="mb-3">
          <MetadataRow project={project} mode="short" />
          <DirectorLine project={project} />
        </div>

        {/* L5 mini: Logline — 2 lines, italic */}
        {project.logline && (
          <p className="text-[13px] italic leading-[1.55] text-ash line-clamp-2 flex-1 mb-3">
            {project.logline}
          </p>
        )}

        {/* Budget inline */}
        {project.budget_usd && (
          <div className="flex items-center gap-1.5 text-[11px] text-ash mb-3">
            <span>{formatBudgetDisplay(project.budget_usd)}</span>
            {securedPct !== null && (
              <>
                <span className="text-line">·</span>
                <span className="text-gold">{securedPct}% secured</span>
              </>
            )}
          </div>
        )}

        {/* L8: Actions */}
        {actions && (
          <div className="mt-auto pt-3 border-t border-line">{actions}</div>
        )}
      </div>
    </div>
  );
}

// ── VARIANT: Table Row ────────────────────────────────────────────────────────

function TableRowVariant({
  project,
  actions,
  href,
}: {
  project: FilmIdentityProject;
  actions?: ReactNode;
  href?: string;
}) {
  const rowHref = href ?? `/producer/projects/${project.id}`;
  const titleDisplay =
    project.title.length > 28
      ? project.title.slice(0, 27) + "…"
      : project.title;

  const items = buildMetadataItems(project, "short");
  const metaParts = items.map((item) =>
    item.type === "country" ? `${item.flag} ${item.name}` : item.value
  );

  return (
    <div
      className="flex items-center gap-4 px-4 py-3 border-b border-line hover:bg-parchment/50 transition-colors"
      style={{ minHeight: 56 }}
    >
      <Link href={rowHref} className="flex-1 min-w-0">
        <p
          className="text-[13px] font-semibold uppercase text-ink truncate"
          style={{ letterSpacing: "-0.01em" }}
        >
          {titleDisplay}
        </p>
        <DirectorLine project={project} />
      </Link>

      <div className="hidden md:flex items-center gap-1.5 text-[12px] text-ash shrink-0">
        {metaParts.map((p, i) => (
          <Fragment key={i}>
            {i > 0 && (
              <span className="text-line" aria-hidden="true">
                ·
              </span>
            )}
            <span>{p}</span>
          </Fragment>
        ))}
      </div>

      {project.stage && (
        <div className="shrink-0">
          <StatusBadge stage={project.stage} />
        </div>
      )}

      {project.budget_usd && (
        <span className="text-[12px] text-ash shrink-0 hidden lg:block">
          {formatBudgetDisplay(project.budget_usd)}
        </span>
      )}

      {actions && <div className="shrink-0">{actions}</div>}
    </div>
  );
}

// ── VARIANT: Search Result ─────────────────────────────────────────────────────

function SearchResultVariant({
  project,
  supabaseUrl,
  href,
}: {
  project: FilmIdentityProject;
  supabaseUrl: string;
  href?: string;
}) {
  const resultHref = href ?? `/producer/projects/${project.id}`;
  const items = buildMetadataItems(project, "short");
  const metaParts = items.map((item) =>
    item.type === "country" ? `${item.flag} ${item.name}` : item.value
  );

  return (
    <Link
      href={resultHref}
      className="flex items-start gap-3 px-4 py-3 hover:bg-parchment/50 transition-colors"
      style={{ minHeight: 80 }}
    >
      <div
        className="shrink-0 rounded overflow-hidden"
        style={{ width: 48, height: 72 }}
      >
        <ProjectThumbnail
          posterPath={project.poster_path}
          title={project.title}
          genre={project.genre}
          supabaseUrl={supabaseUrl}
          className="w-full h-full object-cover"
        />
      </div>

      <div className="flex-1 min-w-0">
        <p
          className="text-[14px] font-semibold uppercase text-ink leading-tight mb-0.5 truncate"
          style={{ letterSpacing: "-0.01em" }}
        >
          {project.title}
        </p>
        <div className="flex flex-wrap gap-1 items-center text-[12px] text-ash mb-0.5">
          {metaParts.map((p, i) => (
            <Fragment key={i}>
              {i > 0 && <span aria-hidden="true">·</span>}
              <span>{p}</span>
            </Fragment>
          ))}
        </div>
        <DirectorLine project={project} />
        {project.logline && (
          <p className="text-[12px] text-ash line-clamp-2 leading-snug">
            {project.logline}
          </p>
        )}
      </div>
    </Link>
  );
}

// ── VARIANT: Messaging Preview ─────────────────────────────────────────────────

function MessagingPreviewVariant({
  project,
  supabaseUrl,
  href,
}: {
  project: FilmIdentityProject;
  supabaseUrl: string;
  href?: string;
}) {
  const previewHref = href ?? `/producer/projects/${project.id}`;
  const items = buildMetadataItems(project, "mini");
  const meta = items
    .map((item) => (item.type === "country" ? item.name : item.value))
    .filter(Boolean)
    .join(" · ");

  const truncatedTitle =
    project.title.length > 24
      ? project.title.slice(0, 23) + "…"
      : project.title;

  return (
    <Link
      href={previewHref}
      className="flex items-center gap-2.5 hover:bg-parchment/40 rounded transition-colors p-1.5"
    >
      <div
        className="shrink-0 rounded overflow-hidden"
        style={{ width: 40, height: 60 }}
      >
        <ProjectThumbnail
          posterPath={project.poster_path}
          title={project.title}
          genre={project.genre}
          supabaseUrl={supabaseUrl}
          className="w-full h-full object-cover"
        />
      </div>
      <div className="min-w-0">
        <p
          className="text-[13px] font-semibold uppercase text-ink leading-tight"
          style={{ letterSpacing: "-0.01em" }}
        >
          {truncatedTitle}
        </p>
        {meta && <p className="text-[11px] text-ash">{meta}</p>}
        <DirectorLine project={project} />
      </div>
    </Link>
  );
}

// ── VARIANT: Notification ─────────────────────────────────────────────────────

function NotificationVariant({
  project,
  body,
  href,
}: {
  project: FilmIdentityProject;
  body?: string;
  href?: string;
}) {
  const notifHref = href ?? `/producer/projects/${project.id}`;

  return (
    <div className="text-[13px] text-ink leading-snug">
      {body && (
        <p className="mb-1">
          {body}{" "}
          <strong
            className="font-semibold uppercase"
            style={{ letterSpacing: "-0.01em" }}
          >
            {project.title}
          </strong>
        </p>
      )}
      <Link
        href={notifHref}
        className="text-gold text-[12px] font-medium hover:underline"
        aria-label={`View project: ${project.title}`}
      >
        View Project →
      </Link>
    </div>
  );
}

// ── Main Export ────────────────────────────────────────────────────────────────

export default function FilmIdentity({
  project,
  variant = "full",
  supabaseUrl,
  matchScore,
  actions,
  href,
  className = "",
}: FilmIdentityProps) {
  switch (variant) {
    case "compact-card":
      return (
        <CompactCardVariant
          project={project}
          supabaseUrl={supabaseUrl}
          matchScore={matchScore}
          actions={actions}
          href={href}
        />
      );

    case "table-row":
      return (
        <TableRowVariant project={project} actions={actions} href={href} />
      );

    case "search-result":
      return (
        <SearchResultVariant
          project={project}
          supabaseUrl={supabaseUrl}
          href={href}
        />
      );

    case "messaging-preview":
      return (
        <MessagingPreviewVariant
          project={project}
          supabaseUrl={supabaseUrl}
          href={href}
        />
      );

    case "notification":
      return (
        <NotificationVariant
          project={project}
          body={undefined}
          href={href}
        />
      );

    default:
      return (
        <div className={className}>
          <FullVariant
            project={project}
            supabaseUrl={supabaseUrl}
            actions={actions}
          />
        </div>
      );
  }
}
