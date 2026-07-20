"use client";

import { useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { generateAndUploadDeckCover } from "@/lib/deck-cover";
import { saveDeckCover } from "@/lib/deck-cover-actions";

/**
 * Renders nothing. When the OWNER views a project whose deck has no static cover
 * yet, this quietly renders one (via pdf.js), uploads it, and saves the path —
 * so the next public visitor gets a plain image instead of client-side pdf.js.
 * Mount only on owner-facing project surfaces (owner has Storage write access).
 */
export default function DeckCoverBackfill({
  projectId,
  deckPath,
  hasCover,
}: {
  projectId: string;
  deckPath?: string | null;
  hasCover: boolean;
}) {
  const ran = useRef(false);
  useEffect(() => {
    if (ran.current || hasCover || !deckPath) return;
    ran.current = true;
    (async () => {
      const supabase = createClient();
      const { data } = await supabase.storage.from("pitch-decks").createSignedUrl(deckPath, 3600);
      if (!data?.signedUrl) return;
      const cover = await generateAndUploadDeckCover(data.signedUrl, projectId);
      if (cover) await saveDeckCover(projectId, cover);
    })().catch(() => {});
  }, [projectId, deckPath, hasCover]);

  return null;
}
