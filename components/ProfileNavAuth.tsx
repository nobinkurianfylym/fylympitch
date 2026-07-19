"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

/** Resolves viewer auth client-side so a profile page can stay cacheable.
 * Renders ownerNode to the owner, authedNode to any other signed-in viewer,
 * nothing to anonymous viewers (or while resolving). */
export default function ProfileNavAuth({
  ownerId,
  ownerNode,
  authedNode,
}: {
  ownerId: string;
  ownerNode?: React.ReactNode;
  authedNode?: React.ReactNode;
}) {
  const [s, setS] = useState<{ owner: boolean; authed: boolean } | null>(null);
  useEffect(() => {
    let a = true;
    createClient()
      .auth.getUser()
      .then(({ data }) => a && setS({ owner: data.user?.id === ownerId, authed: !!data.user }))
      .catch(() => a && setS({ owner: false, authed: false }));
    return () => {
      a = false;
    };
  }, [ownerId]);
  if (s === null) return null;
  if (s.owner) return <>{ownerNode ?? null}</>;
  if (s.authed) return <>{authedNode ?? null}</>;
  return null;
}
