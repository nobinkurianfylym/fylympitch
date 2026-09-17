import * as React from "react";
import { parseBroadcastBody } from "@/lib/broadcast-body";
import { sized, srcSet2x } from "@/lib/image-url";

/**
 * Bare URLs inside the message text are not clickable in pre-wrapped text.
 * Split on http(s) runs and render those as links; everything else stays plain
 * text, so nothing in a message is ever interpreted as markup.
 */
function linkify(text: string): React.ReactNode[] {
  return text.split(/(https?:\/\/[^\s]+)/g).map((part, i) =>
    /^https?:\/\//.test(part) ? (
      <a
        key={i}
        href={part}
        target="_blank"
        rel="noopener noreferrer"
        className="text-gold underline underline-offset-2 break-all hover:text-ink transition-colors"
      >
        {part}
      </a>
    ) : (
      part
    ),
  );
}

/**
 * A broadcast's own text, then its attachments. Images render as images — a
 * poster is the message, and a raw storage URL is not something anyone reads.
 * Everything else stays a named link.
 *
 * Lifted out of app/support so the public announcement page renders exactly
 * what the recipient saw in their inbox. Two copies of this had already
 * started to drift.
 */
export default function BroadcastBody({
  body,
  size = "sm",
}: {
  body: string | null;
  size?: "sm" | "lg";
}) {
  if (!body) return null;
  const { text, files } = parseBroadcastBody(body);
  const images = files.filter((f) => f.isImage);
  const others = files.filter((f) => !f.isImage);
  const isLarge = size === "lg";

  return (
    <>
      {text && (
        <p
          className={`text-ink/80 mt-1 whitespace-pre-wrap leading-relaxed ${
            isLarge ? "text-[17px] leading-[1.75]" : "text-[14px]"
          }`}
        >
          {linkify(text)}
        </p>
      )}

      {images.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-3">
          {images.map((f) => (
            <a
              key={f.url}
              href={f.url}
              target="_blank"
              rel="noopener noreferrer"
              className="block rounded-card overflow-hidden border border-line hover:border-gold transition-colors"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={sized(f.url, isLarge ? 520 : 320, 70, "height")}
                srcSet={srcSet2x(f.url, isLarge ? 520 : 320, 70, "height")}
                alt={f.name}
                loading="lazy"
                decoding="async"
                className={`block w-auto object-contain bg-parchment ${
                  isLarge ? "max-h-[520px]" : "max-h-[320px]"
                }`}
              />
            </a>
          ))}
        </div>
      )}

      {others.length > 0 && (
        <ul className="mt-4 space-y-1.5">
          {others.map((f) => (
            <li key={f.url}>
              <a
                href={f.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-[13px] text-ink hover:text-gold transition-colors"
              >
                <span className="text-gold">◆</span>
                <span className="underline underline-offset-2 decoration-ash/40">{f.name}</span>
              </a>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

/** The first image in a broadcast, for use as its share card. */
export function firstBroadcastImage(body: string | null): string | null {
  if (!body) return null;
  return parseBroadcastBody(body).files.find((f) => f.isImage)?.url ?? null;
}
