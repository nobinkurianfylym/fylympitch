"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

/** A link whose destination depends on whether the viewer is signed in, resolved
 * client-side so the surrounding page stays cacheable. Defaults to anonHref
 * until auth resolves. */
export default function AuthLink({
  authedHref,
  anonHref,
  className,
  style,
  children,
}: {
  authedHref: string;
  anonHref: string;
  className?: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
}) {
  const [authed, setAuthed] = useState(false);
  useEffect(() => {
    let a = true;
    createClient()
      .auth.getUser()
      .then(({ data }) => a && setAuthed(!!data.user))
      .catch(() => {});
    return () => {
      a = false;
    };
  }, []);
  return (
    <Link href={authed ? authedHref : anonHref} className={className} style={style}>
      {children}
    </Link>
  );
}
