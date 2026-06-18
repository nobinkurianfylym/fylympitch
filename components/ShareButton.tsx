"use client";

import { useState } from "react";

interface Props {
  projectId: string;
  title: string;
  genre?: string | null;
  country?: string | null;
  size?: "sm" | "md";
}

export default function ShareButton({ projectId, title, genre, country, size = "md" }: Props) {
  const [open, setOpen]     = useState(false);
  const [copied, setCopied] = useState(false);

  const siteUrl  = process.env.NEXT_PUBLIC_SITE_URL ?? "https://pitch.fylym.com";
  const url      = `${siteUrl}/projects/${projectId}`;
  const tagline  = [genre, country].filter(Boolean).join(" · ");
  const shareText = `${title}${tagline ? ` — ${tagline}` : ""} · Now pitching on FYLYMPITCH`;

  const links = [
    {
      label: "Twitter / X",
      icon: "𝕏",
      href: `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(url)}`,
    },
    {
      label: "LinkedIn",
      icon: "in",
      href: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`,
    },
    {
      label: "WhatsApp",
      icon: "◉",
      href: `https://wa.me/?text=${encodeURIComponent(shareText + " " + url)}`,
    },
  ];

  async function copyLink(e: React.MouseEvent) {
    e.preventDefault();
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => { setCopied(false); setOpen(false); }, 1500);
    } catch { /* noop */ }
  }

  async function nativeShare(e: React.MouseEvent) {
    e.preventDefault();
    if (typeof navigator !== "undefined" && navigator.share) {
      await navigator.share({ title, text: shareText, url });
      setOpen(false);
    }
  }

  const isSmall = size === "sm";

  return (
    <div className="relative" onClick={e => e.stopPropagation()}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className={`flex items-center gap-1.5 transition-all border bg-white border-line text-ash hover:border-ink/30 hover:text-ink ${
          isSmall ? "text-[11px] px-2 py-1 rounded-full" : "text-[13px] px-3 py-1.5 rounded-full"
        }`}
      >
        <span className={isSmall ? "text-[12px]" : "text-[14px]"}>↑</span>
        <span>Share</span>
      </button>

      {open && (
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          {/* Dropdown */}
          <div className="absolute right-0 bottom-full mb-2 z-20 bg-white border border-line rounded-card shadow-lg py-1 min-w-[160px]">
            {/* Native share if available */}
            {typeof navigator !== "undefined" && navigator.share && (
              <button onClick={nativeShare}
                className="w-full text-left px-4 py-2.5 text-[13px] text-ink hover:bg-parchment flex items-center gap-2">
                <span>⬆</span> Share via…
              </button>
            )}
            {links.map((l) => (
              <a key={l.label} href={l.href} target="_blank" rel="noopener noreferrer"
                onClick={() => setOpen(false)}
                className="flex items-center gap-2 px-4 py-2.5 text-[13px] text-ash hover:text-ink hover:bg-parchment transition-colors">
                <span className="text-[11px] font-mono w-4">{l.icon}</span>
                {l.label}
              </a>
            ))}
            <button onClick={copyLink}
              className="w-full text-left px-4 py-2.5 text-[13px] text-ash hover:text-ink hover:bg-parchment flex items-center gap-2 border-t border-line mt-1">
              <span>⎘</span> {copied ? "Copied!" : "Copy link"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
