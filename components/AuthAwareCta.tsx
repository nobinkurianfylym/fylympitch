"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

/**
 * Renders an auth-dependent CTA WITHOUT forcing the server page to read auth —
 * so public record pages stay fully edge-cacheable. Signed-out visitors (and
 * crawlers) see `children`; signed-in visitors see the authed link.
 */
export default function AuthAwareCta({
  authedHref,
  authedLabel,
  authedClassName = "btn-gold",
  children,
}: {
  authedHref: string;
  authedLabel: string;
  authedClassName?: string;
  children: React.ReactNode;
}) {
  const [authed, setAuthed] = useState<boolean | null>(null);

  useEffect(() => {
    let active = true;
    createClient()
      .auth.getUser()
      .then(({ data }) => {
        if (active) setAuthed(!!data.user);
      })
      .catch(() => active && setAuthed(false));
    return () => {
      active = false;
    };
  }, []);

  // Reserve space while resolving to avoid layout shift (CLS).
  if (authed === null) return <span aria-hidden style={{ display: "inline-block", minHeight: 1 }} />;

  return authed ? (
    <Link href={authedHref} className={authedClassName}>
      {authedLabel}
    </Link>
  ) : (
    <>{children}</>
  );
}
