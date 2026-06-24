"use client";

import { useState, useRef, useEffect } from "react";

interface Props {
  username: string;
  name?: string;
  fullName?: string;
}

export default function ProfileShareButton({ username, name, fullName }: Props) {
  const displayName = fullName ?? name ?? "";
  const [open, setCopied_open] = useState(false);
  const [copied, setCopied]    = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const siteUrl    = typeof window !== "undefined" ? window.location.origin : "https://pitch.fylym.com";
  const profileUrl = `${siteUrl}/u/${username}`;
  const shareText  = `${displayName} — Producer on PITCH.FYLYM`;

  // Close on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setCopied_open(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(profileUrl);
      setCopied(true);
      setTimeout(() => { setCopied(false); setCopied_open(false); }, 1800);
    } catch { /* noop */ }
  }

  const socials = [
    {
      label: "X / Twitter",
      icon: (
        <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
          <path d="M10.93 1h2.07L8.47 6.16 13.5 13H9.62L6.57 8.98 3.06 13H1l4.8-5.5L.5 1h3.98l2.72 3.74L10.93 1zm-.73 10.77h1.15L3.85 2.18H2.62l7.58 9.59z"/>
        </svg>
      ),
      href: `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(profileUrl)}`,
    },
    {
      label: "WhatsApp",
      icon: (
        <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
          <path d="M7 0a7 7 0 00-5.88 10.77L0 14l3.33-1.1A7 7 0 107 0zm0 12.73a5.73 5.73 0 01-2.93-.8l-.2-.13-2.1.69.7-2.04-.14-.21A5.73 5.73 0 117 12.73zm3.15-4.3c-.17-.09-.99-.49-1.15-.54-.15-.06-.26-.08-.38.08-.11.17-.43.55-.53.66-.1.11-.2.13-.37.04a4.63 4.63 0 01-2.28-1.99c-.17-.3.17-.27.5-.9.05-.1.02-.2-.01-.28-.04-.08-.38-.91-.52-1.25-.13-.33-.27-.28-.38-.29h-.33a.63.63 0 00-.46.22c-.16.17-.6.59-.6 1.44 0 .84.61 1.66.7 1.77.08.12 1.2 1.83 2.9 2.57 1.08.46 1.5.5 2.03.42.33-.05 1-.41 1.14-.81.14-.4.14-.74.1-.81-.05-.08-.16-.12-.34-.2z"/>
        </svg>
      ),
      href: `https://wa.me/?text=${encodeURIComponent(shareText + " " + profileUrl)}`,
    },
    {
      label: "LinkedIn",
      icon: (
        <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
          <path d="M1.56 0A1.56 1.56 0 000 1.56c0 .86.7 1.57 1.56 1.57a1.56 1.56 0 000-3.13zM.22 4.67H2.9V14H.22V4.67zm4.3 0H7.2v1.27h.04c.39-.73 1.34-1.5 2.76-1.5C12.56 4.44 13 6.4 13 8.89V14h-2.68V9.43c0-1.08-.02-2.47-1.5-2.47-1.5 0-1.73 1.17-1.73 2.39V14H4.52V4.67z"/>
        </svg>
      ),
      href: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(profileUrl)}`,
    },
    {
      label: "Facebook",
      icon: (
        <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
          <path d="M14 7A7 7 0 100 7a7 7 0 0014 0zm-8.17 5.89V7.55H4.4V5.77h1.43V4.5c0-1.42.87-2.19 2.13-2.19.61 0 1.24.05 1.86.14v2.05H8.81c-1 0-1.2.48-1.2 1.18v1.09h2.38l-.31 1.78H7.61v5.34H5.83z"/>
        </svg>
      ),
      href: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(profileUrl)}`,
    },
  ];

  return (
    <div ref={ref} style={{ position:"relative" }}>
      <button
        type="button"
        onClick={() => setCopied_open(o => !o)}
        style={{
          display:"inline-flex", alignItems:"center", gap:6,
          fontSize:10, letterSpacing:".14em", textTransform:"uppercase", fontWeight:700,
          color:"rgba(26,24,21,0.5)", background:"transparent",
          border:"1px solid rgba(26,24,21,0.12)", borderRadius:100,
          padding:"7px 14px", cursor:"pointer", transition:"all 140ms",
        }}
      >
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
          <circle cx="9.5" cy="2.5" r="1.5" stroke="currentColor" strokeWidth="1.2"/>
          <circle cx="2.5" cy="6" r="1.5" stroke="currentColor" strokeWidth="1.2"/>
          <circle cx="9.5" cy="9.5" r="1.5" stroke="currentColor" strokeWidth="1.2"/>
          <path d="M4 5.1l4-2M4 6.9l4 2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
        </svg>
        Share
      </button>

      {open && (
        <div style={{
          position:"absolute", right:0, top:"calc(100% + 8px)", zIndex:100,
          background:"#fff", borderRadius:14, border:"1px solid rgba(26,24,21,0.08)",
          boxShadow:"0 8px 32px rgba(26,24,21,0.1)", padding:"8px", minWidth:180,
        }}>
          {socials.map(s => (
            <a key={s.label} href={s.href} target="_blank" rel="noopener noreferrer"
              onClick={() => setCopied_open(false)}
              style={{
                display:"flex", alignItems:"center", gap:10, padding:"9px 12px",
                borderRadius:8, textDecoration:"none", color:"rgba(26,24,21,0.65)",
                fontSize:12, fontWeight:500, transition:"background 120ms",
              }}
              onMouseEnter={e => (e.currentTarget.style.background = "rgba(26,24,21,0.04)")}
              onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
            >
              <span style={{ color:"rgba(26,24,21,0.4)", display:"flex" }}>{s.icon}</span>
              {s.label}
            </a>
          ))}

          {/* Divider */}
          <div style={{ height:1, background:"rgba(26,24,21,0.06)", margin:"4px 0" }} />

          {/* Copy link */}
          <button type="button" onClick={copyLink}
            style={{
              display:"flex", alignItems:"center", gap:10, padding:"9px 12px", width:"100%",
              borderRadius:8, background:"transparent", border:"none", cursor:"pointer",
              color: copied ? "#5aab7a" : "rgba(26,24,21,0.65)",
              fontSize:12, fontWeight: copied ? 600 : 500, transition:"all 120ms",
            }}
            onMouseEnter={e => { if (!copied) (e.currentTarget.style.background = "rgba(26,24,21,0.04)"); }}
            onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
          >
            {copied
              ? <><svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 7l3.5 3.5L12 3.5" stroke="#5aab7a" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg> Copied!</>
              : <><svg width="14" height="14" viewBox="0 0 14 14" fill="none"><rect x="1" y="4" width="8" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.2"/><path d="M4 1h7.5A1.5 1.5 0 0113 2.5V10" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg> Copy link</>
            }
          </button>
        </div>
      )}
    </div>
  );
}
