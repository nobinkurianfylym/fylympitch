"use client";
// features/messages/UnreadBadge.tsx

import React from "react";

interface Props {
  count?: number;
  /** If true, shows a simple dot instead of a number */
  dot?: boolean;
}

export const UnreadBadge = React.memo(function UnreadBadge({ count, dot }: Props) {
  if (dot) {
    return (
      <span
        aria-label="Unread messages"
        className="inline-block w-1.5 h-1.5 rounded-full bg-gold shrink-0"
      />
    );
  }

  if (!count || count <= 0) return null;

  return (
    <span
      aria-label={`${count} unread message${count !== 1 ? "s" : ""}`}
      className="
        inline-flex items-center justify-center
        min-w-[18px] h-[18px] px-1
        text-[10px] tracking-[0.04em] font-medium
        bg-ink text-ivory
        rounded-sm
        shrink-0
      "
    >
      {count > 99 ? "99+" : count}
    </span>
  );
});
