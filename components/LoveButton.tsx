"use client";

import { useState, useTransition } from "react";
import { toggleProjectLove } from "@/lib/actions";
import { useRouter } from "next/navigation";

interface Props {
  projectId: string;
  /** Canonical public slug — used for the post-login return path */
  slug?: string | null;
  initialCount: number;
  initialLiked: boolean;
  isLoggedIn: boolean;
  size?: "sm" | "md";
}

export default function LoveButton({ projectId, slug, initialCount, initialLiked, isLoggedIn, size = "md" }: Props) {
  const [liked, setLiked]   = useState(initialLiked);
  const [count, setCount]   = useState(initialCount);
  const [pending, start]    = useTransition();
  const router              = useRouter();

  function handleClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();

    if (!isLoggedIn) {
      router.push(`/login?next=${encodeURIComponent(`/filmprojects/${slug || projectId}`)}`);
      return;
    }

    const next  = !liked;
    const prevC = count;
    setLiked(next);
    setCount(c => next ? c + 1 : Math.max(0, c - 1));

    start(async () => {
      const res = await toggleProjectLove(projectId);
      if (!res?.ok) {
        // Roll back — the write did not persist
        setLiked(!next);
        setCount(prevC);
        return;
      }
      // Reconcile against the server's authoritative count
      setLiked(res.loved);
      setCount(res.count);
    });
  }

  const isSmall = size === "sm";

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={pending}
      title={liked ? "Remove love" : "Love this project"}
      className={`flex items-center gap-1.5 transition-all disabled:opacity-60 ${
        isSmall
          ? "text-[11px] px-2 py-1 rounded-full border"
          : "text-[13px] px-3 py-1.5 rounded-full border"
      } ${
        liked
          ? "bg-rose-50 border-rose-200 text-rose-500"
          : "bg-white border-line text-ash hover:border-rose-200 hover:text-rose-400"
      }`}
    >
      <span className={isSmall ? "text-[13px]" : "text-[16px]"}>{liked ? "♥" : "♡"}</span>
      {count > 0 && <span className="tabular-nums">{count}</span>}
    </button>
  );
}
