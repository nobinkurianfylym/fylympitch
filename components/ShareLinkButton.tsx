"use client";

import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";

/**
 * Share control for any page on the site.
 *
 * Was ListShareButton, hard-coded to /list. Opportunities needed the same
 * thing, and a third share component was not the answer — there were already
 * two. Deliberately still separate from ShareButton, which is bound to a film
 * project's id and slug and builds a /filmprojects URL.
 *
 * Email leads the menu: these links are sent to a person far more often than
 * they are posted.
 */
export default function ShareLinkButton({
  path,
  title,
  text,
  label = "Share this page",
  compact = false,
}: {
  /** Site-relative, e.g. "/list" or "/opportunities/sundance-doc-fund". */
  path: string;
  title: string;
  text: string;
  label?: string;
  /** Icon-only, for sitting beside a heading rather than under a paragraph. */
  compact?: boolean;
}) {
  const [open, setOpen]           = useState(false);
  const [copied, setCopied]       = useState(false);
  const [mounted, setMounted]     = useState(false);
  const [canNativeShare, setCanNativeShare] = useState(false);
  const [menuStyle, setMenuStyle] = useState<React.CSSProperties>({});
  const btnRef = useRef<HTMLButtonElement>(null);

  // navigator is client-only, and the share sheet exists mainly on mobile.
  useEffect(() => {
    setMounted(true);
    setCanNativeShare(typeof navigator.share === "function");
  }, []);

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://pitch.fylym.com";
  const url     = `${siteUrl}${path}`;

  const links = [
    {
      label: "Email",
      icon: "✉",
      href: `mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(`${text}\n\n${url}`)}`,
    },
    {
      label: "LinkedIn",
      icon: "in",
      href: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`,
    },
    {
      label: "Twitter / X",
      icon: "𝕏",
      href: `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`,
    },
    {
      label: "WhatsApp",
      icon: "◉",
      href: `https://wa.me/?text=${encodeURIComponent(`${text} ${url}`)}`,
    },
  ];

  function handleToggle() {
    if (!open && btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      const openUp = rect.top > window.innerHeight / 2;
      setMenuStyle({
        position: "fixed",
        ...(openUp
          ? { bottom: `${window.innerHeight - rect.top + 8}px` }
          : { top: `${rect.bottom + 8}px` }),
        left: `${rect.left + rect.width / 2}px`,
        transform: "translateX(-50%)",
        zIndex: 9999,
      });
    }
    setOpen((o) => !o);
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => { setCopied(false); setOpen(false); }, 1500);
    } catch { /* clipboard blocked — the other options still work */ }
  }

  async function nativeShare() {
    if (canNativeShare) {
      try { await navigator.share({ title, text, url }); } catch { /* dismissed */ }
      setOpen(false);
    }
  }

  const dropdown = open && mounted ? createPortal(
    <>
      <div className="fixed inset-0" style={{ zIndex: 9998 }} onClick={() => setOpen(false)} />
      <div
        className="bg-white border border-line rounded-card shadow-lg py-1 min-w-[190px]"
        style={menuStyle}
      >
        {canNativeShare && (
          <button
            onClick={nativeShare}
            className="w-full text-left px-4 py-2.5 text-[13px] text-ink hover:bg-parchment flex items-center gap-2.5"
          >
            <span className="text-[11px] w-4">⬆</span> Share via…
          </button>
        )}
        {links.map((l) => (
          <a
            key={l.label}
            href={l.href}
            target={l.label === "Email" ? undefined : "_blank"}
            rel="noopener noreferrer"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2.5 px-4 py-2.5 text-[13px] text-ash hover:text-ink hover:bg-parchment transition-colors"
          >
            <span className="text-[11px] font-mono w-4">{l.icon}</span>
            {l.label}
          </a>
        ))}
        <button
          onClick={copyLink}
          className="w-full text-left px-4 py-2.5 text-[13px] text-ash hover:text-ink hover:bg-parchment flex items-center gap-2.5 border-t border-line mt-1"
        >
          <span className="text-[11px] w-4">⎘</span> {copied ? "Copied!" : "Copy link"}
        </button>
      </div>
    </>,
    document.body
  ) : null;

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={handleToggle}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={label}
        title={label}
        className={
          compact
            ? "inline-flex items-center justify-center w-9 h-9 rounded-full border border-line bg-white text-ash transition-colors hover:border-gold hover:text-ink"
            : "inline-flex items-center gap-2 rounded-full border border-line bg-white px-5 py-2.5 text-[12px] tracking-[0.14em] uppercase text-ash transition-colors hover:border-gold hover:text-ink"
        }
      >
        {/* Standard share glyph: a node linked to two others. Reads as "send
            this elsewhere" far better than an arrow, which people take for
            upload. */}
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
             strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <circle cx="18" cy="5" r="3" />
          <circle cx="6" cy="12" r="3" />
          <circle cx="18" cy="19" r="3" />
          <line x1="8.6" y1="10.5" x2="15.4" y2="6.5" />
          <line x1="8.6" y1="13.5" x2="15.4" y2="17.5" />
        </svg>
        {!compact && label}
      </button>
      {dropdown}
    </>
  );
}
