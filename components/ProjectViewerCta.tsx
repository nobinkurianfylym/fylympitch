"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { addToPipeline } from "@/app/filmprojects/[id]/pipeline-action";

type State = { loggedIn: boolean; isOwner: boolean; isProducer: boolean };

export default function ProjectViewerCta({
  projectId,
  ownerId,
}: {
  projectId: string;
  ownerId: string;
}) {
  const [state, setState] = useState<State | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return active && setState({ loggedIn: false, isOwner: false, isProducer: false });
      const { data: pp } = await supabase
        .from("producer_profiles")
        .select("user_id")
        .eq("user_id", user.id)
        .maybeSingle();
      if (active) setState({ loggedIn: true, isOwner: user.id === ownerId, isProducer: !!pp });
    })().catch(() => active && setState({ loggedIn: false, isOwner: false, isProducer: false }));
    return () => {
      active = false;
    };
  }, [ownerId]);

  // Hidden for the owner and while resolving.
  if (state === null || state.isOwner) return null;

  const wrap = "mt-14 border border-line rounded-card bg-white/70 p-7 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-5";

  if (!state.loggedIn) {
    return (
      <div className={wrap}>
        <p className="font-display text-[18px] font-normal italic">Every great film starts with the right discovery.</p>
        <Link href="/signup" className="btn-gold shrink-0 whitespace-nowrap">Get started</Link>
      </div>
    );
  }

  if (state.isProducer) {
    return (
      <div className={wrap}>
        <div>
          <p className="text-[16px]">Interested in this project?</p>
          <p className="mt-1 text-[13px] text-ash">Message the filmmaker or add it to your pipeline.</p>
        </div>
        <div className="flex gap-3 flex-wrap shrink-0">
          <Link href="/producerstudio/messages" className="btn-ghost whitespace-nowrap">Message filmmaker</Link>
          <form action={addToPipeline}>
            <input type="hidden" name="project_id" value={projectId} />
            <input type="hidden" name="status" value="saved" />
            <button className="btn-gold whitespace-nowrap">Add to pipeline</button>
          </form>
        </div>
      </div>
    );
  }

  return null;
}
