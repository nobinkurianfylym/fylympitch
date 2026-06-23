"use client";

import { useState } from "react";

interface Props {
  username: string;
  fullName: string;
}

export default function ProfileShareButton({ username, fullName }: Props) {
  const [copied, setCopied] = useState(false);

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://pitch.fylym.com";
  const profileUrl = `${siteUrl}/u/${username}`;
  const shareText = `${fullName} · Filmmaker on PITCH.FYLYM`;

  async function handleNativeShare(e: React.MouseEvent) {
    e.preventDefault();
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title: fullName, text: shareText, url: profileUrl });
      } catch {/* cancelled */}
    }
  }

  async function handleCopy(e: React.MouseEvent) {
    e.preventDefault();
    try {
      await navigator.clipboard.writeText(profileUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {/* noop */}
  }

  const hasNativeShare = typeof navigator !== "undefined" && !!navigator.share;

  return (
    <button
      type="button"
      onClick={hasNativeShare ? handleNativeShare : handleCopy}
      className="inline-flex items-center gap-2 border border-line rounded-card px-4 py-2.5 text-[12px] tracking-[0.14em] uppercase text-ash hover:border-ink/30 hover:text-ink transition-colors bg-white/60"
    >
      <span className="text-[13px]">↑</span>
      {copied ? "Copied!" : "Share Profile"}
    </button>
  );
}
