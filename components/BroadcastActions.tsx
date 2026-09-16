"use client";

import { useState, useTransition } from "react";
import { toggleBroadcastLike } from "@/lib/actions";
import ShareLinkButton from "@/components/ShareLinkButton";

/**
 * The like + share row under an admin announcement.
 *
 * Share only appears when there is somewhere to send people. An announcement
 * to everyone gets a public page (/announcements/{slug}); one sent only to
 * filmmakers or only to producers does not, and sharing it would put a segment
 * message on the open web — so the button is simply absent rather than
 * degraded into sharing bare text.
 */
export default function BroadcastActions({
  broadcastId,
  title,
  initialCount,
  initialLiked,
  publicSlug,
}: {
  broadcastId: string;
  title: string;
  initialCount: number;
  initialLiked: boolean;
  publicSlug?: string | null;
}) {
  const [liked, setLiked] = useState(initialLiked);
  const [count, setCount] = useState(initialCount);
  const [pending, start] = useTransition();

  function handleLike(e: React.MouseEvent) {
    // These sit inside notification rows that are wrapped in a <Link>.
    e.preventDefault();
    e.stopPropagation();

    const next = !liked;
    const prevCount = count;
    const prevLiked = liked;

    setLiked(next);
    setCount((c) => (next ? c + 1 : Math.max(0, c - 1)));

    start(async () => {
      const res = await toggleBroadcastLike(broadcastId);
      if (!res?.ok) {
        setLiked(prevLiked);
        setCount(prevCount);
        return;
      }
      // Reconcile against the server rather than trusting the optimistic guess.
      setLiked(res.liked);
      setCount(res.count);
    });
  }

  return (
    <div
      className="mt-3 flex items-center gap-2"
      onClick={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        onClick={handleLike}
        disabled={pending}
        aria-pressed={liked}
        title={liked ? "Remove like" : "Like this announcement"}
        className={`flex items-center gap-1.5 text-[12px] px-2.5 py-1 rounded-full border transition-all disabled:opacity-60 ${
          liked
            ? "bg-rose-50 border-rose-200 text-rose-500"
            : "bg-white border-line text-ash hover:border-rose-200 hover:text-rose-400"
        }`}
      >
        <span className="text-[14px] leading-none">{liked ? "♥" : "♡"}</span>
        {count > 0 && <span className="tabular-nums">{count}</span>}
      </button>

      {publicSlug && (
        <ShareLinkButton
          compact
          label="Share this announcement"
          path={`/announcements/${publicSlug}`}
          title={`${title} — PITCH.FYLYM`}
          text={`${title}. From PITCH.FYLYM — where films find funding.`}
        />
      )}
    </div>
  );
}
