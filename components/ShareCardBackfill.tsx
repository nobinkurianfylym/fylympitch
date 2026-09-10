"use client";

import { useEffect, useRef } from "react";
import { generateAndUploadShareCard } from "@/lib/share-card";
import { saveShareCard } from "@/lib/share-card-actions";

/**
 * Renders nothing. When the OWNER views a project that has artwork but no
 * social share card yet, this composes one and saves the path — the same
 * passive-backfill pattern as DeckCoverBackfill.
 *
 * Why here rather than a migration or an admin tool: composing the card needs
 * a canvas and the site's own fonts, which only exist in a browser. Mounting it
 * on an owner surface means every project that gets looked at repairs itself,
 * with no batch job and no new infrastructure.
 *
 * The artwork is loaded cross-origin from public Storage; if that is refused
 * the canvas taints and toBlob throws, which is caught and simply leaves the
 * project on its poster. Nothing user-visible fails either way.
 */
export default function ShareCardBackfill({
  projectId,
  artUrl,
  hasCard,
  title,
  logline,
  genre,
  country,
}: {
  projectId: string;
  artUrl: string | null;
  hasCard: boolean;
  title: string;
  logline?: string | null;
  genre?: string | null;
  country?: string | null;
}) {
  const fired = useRef(false);

  useEffect(() => {
    if (fired.current || hasCard || !artUrl || !title) return;
    fired.current = true;
    void (async () => {
      const path = await generateAndUploadShareCard(
        artUrl,
        { title, logline, genre, country },
        projectId,
      );
      if (path) await saveShareCard(projectId, path);
    })().catch(() => {});
  }, [projectId, artUrl, hasCard, title, logline, genre, country]);

  return null;
}
