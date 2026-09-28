"use client";
// features/messages/EmptyState.tsx

import React from "react";

interface Props {
  variant?: "no-selection" | "no-messages" | "no-conversations" | "filmmaker-intro";
  className?: string;
}

// Filmmakers cannot start a conversation — producers do. The filmmaker inbox
// used to show producer copy ("open a project to initiate one", "select
// Message filmmaker"), pointing at actions a filmmaker does not have.
const config: Record<
  NonNullable<Props["variant"]>,
  { label: string; heading: string; body: string; hint?: string }
> = {
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
  "filmmaker-intro": {
    label:    "INBOX",
    heading:  "Messaging is producer-led",
    body:     "Conversations begin when a producer takes interest in your project, and you can reply right away.",
    hint:     "Keep your project and materials up to date so the right producers find you.",
  },
};

export const EmptyState = React.memo(function EmptyState({
  variant = "no-selection",
  className = "",
}: Props) {
  const { label, heading, body, hint } = config[variant];

  return (
    <div className={`flex-1 flex flex-col items-center justify-center px-10 text-center ${className}`}>
      <p className="eyebrow mb-6">{label}</p>
      <p className="font-display text-[22px] text-ink mb-3">{heading}</p>
      <p className="text-[13px] text-ash leading-relaxed max-w-xs">{body}</p>
      {hint && (
        <>
          <span aria-hidden="true" className="block w-8 h-px bg-gold/60 my-6" />
          <p className="font-display italic text-[14px] text-ash leading-relaxed max-w-xs">{hint}</p>
        </>
      )}
    </div>
  );
});
