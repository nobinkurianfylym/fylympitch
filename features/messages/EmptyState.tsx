"use client";
// features/messages/EmptyState.tsx

import React from "react";

interface Props {
  variant?: "no-selection" | "no-messages" | "no-conversations";
}

export const EmptyState = React.memo(function EmptyState({
  variant = "no-selection",
}: Props) {
  const config = {
    "no-selection": {
      label:    "INBOX",
      heading:  "No conversation selected",
      body:     "Select a project conversation from the left, or open a project to initiate one.",
    },
    "no-messages": {
      label:    "NEW CONVERSATION",
      heading:  "Begin the conversation",
      body:     "This is the start of your conversation regarding this project.",
    },
    "no-conversations": {
      label:    "INBOX",
      heading:  "No conversations yet",
      body:     "Open a project and select \"Message filmmaker\" to begin a conversation.",
    },
  } as const;

  const { label, heading, body } = config[variant];

  return (
    <div className="flex-1 flex flex-col items-center justify-center px-10 text-center">
      <p className="eyebrow mb-6">{label}</p>
      <p className="font-display text-[22px] text-ink mb-3">{heading}</p>
      <p className="text-[13px] text-ash leading-relaxed max-w-xs">{body}</p>
    </div>
  );
});
