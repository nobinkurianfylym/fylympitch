"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import LoveButton from "@/components/LoveButton";

export default function LoveButtonAuto({
  projectId,
  slug,
  initialCount,
}: {
  projectId: string;
  slug?: string | null;
  initialCount: number;
}) {
  const [auth, setAuth] = useState<{ loggedIn: boolean; liked: boolean } | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return active && setAuth({ loggedIn: false, liked: false });
      const { data } = await supabase
        .from("project_loves")
        .select("user_id")
        .eq("user_id", user.id)
        .eq("project_id", projectId)
        .maybeSingle();
      if (active) setAuth({ loggedIn: true, liked: !!data });
    })().catch(() => active && setAuth({ loggedIn: false, liked: false }));
    return () => {
      active = false;
    };
  }, [projectId]);

  // Reserve space until auth resolves (keeps CLS at 0), then mount LoveButton
  // with the correct initial liked state.
  if (auth === null) return <div style={{ minHeight: 40 }} aria-hidden />;
  return (
    <LoveButton
      projectId={projectId}
      slug={slug}
      initialCount={initialCount}
      initialLiked={auth.liked}
      isLoggedIn={auth.loggedIn}
    />
  );
}
