"use client";

import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";

interface Props {
  projectId: string;
  title: string;
  genre?: string | null;
  country?: string | null;
  size?: "sm" | "md";
}

export default function ShareButton({ projectId, title, genre, country, size = "md" }: Props) {
  const [open, setOpen]         = useState(false);
  const [copied, setCopied]     = useState(false);
  const [mounted, setMounted]   = useState(false);
  const [menuStyle, setMenuStyle] = useState<React.CSSProperties>({});
  const btnRef = useRef<HTMLButtonElement>(null);

  // Portal requires document — only available client-side
  useEffect(() => { setMounted(true); }, []);

  const siteUrl   = process.env.NEXT_PUBLIC_SITE_URL ?? "https://pitch.fylym.com";
  const url       = `${siteUrl}/projects/${projectId}`;
  const tagline   = [genre, country].filter(Boolean).join(" · ");
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

  function handleToggle(e: React.MouseEvent) {
    e.stopPropagation();
    if (!open && btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      setMenuStyle({
        position: "fixed",
        // Open above the button
        bottom: `${window.innerHeight - rect.top + 8}px`,
        // Align to button's right edge
        right: `${window.innerWidth - rect.right}px`,
        zIndex: 9999,
      });
    }
    setOpen((o) => !o);
  }

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

  const dropdown = open && mounted ? createPortal(
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0"
        style={{ zIndex: 9998 }}
        onClick={(e) => { e.stopPropagation(); setOpen(false); }}
      />
      {/* Menu */}
      <div
        className="bg-white border border-line rounded-card shadow-lg py-1 min-w-[160px]"
        style={menuStyle}
        onClick={(e) => e.stopPropagation()}
      >
        {typeof navigator !== "undefined" && navigator.share && (
          <button
            onClick={nativeShare}
            className="w-full text-left px-4 py-2.5 text-[13px] text-ink hover:bg-parchment flex items-center gap-2"
          >
            <span>⬆</span> Share via…
          </button>
        )}
        {links.map((l) => (
          <a
            key={l.label}
            href={l.href}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2 px-4 py-2.5 text-[13px] text-ash hover:text-ink hover:bg-parchment transition-colors"
          >
            <span className="text-[11px] font-mono w-4">{l.icon}</span>
            {l.label}
          </a>
        ))}
        <button
          onClick={copyLink}
          className="w-full text-left px-4 py-2.5 text-[13px] text-ash hover:text-ink hover:bg-parchment flex items-center gap-2 border-t border-line mt-1"
        >
          <span>⎘</span> {copied ? "Copied!" : "Copy link"}
        </button>
      </div>
    </>,
    document.body
  ) : null;

  return (
    <div className="relative" onClick={(e) => e.stopPropagation()}>
      <button
        ref={btnRef}
        type="button"
        onClick={handleToggle}
        className={`flex items-center gap-1.5 transition-all border bg-white border-line text-ash hover:border-ink/30 hover:text-ink ${
          isSmall ? "text-[11px] px-2 py-1 rounded-full" : "text-[13px] px-3 py-1.5 rounded-full"
        }`}
      >
        <span className={isSmall ? "text-[12px]" : "text-[14px]"}>↑</span>
        <span>Share</span>
      </button>
      {dropdown}
    </div>
  );
}
