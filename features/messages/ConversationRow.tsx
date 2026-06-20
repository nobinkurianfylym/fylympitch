"use client";
// features/messages/ConversationRow.tsx

import React from "react";
import type { ConversationListItem } from "./message.types";
import { getInitials, formatRelativeTime } from "./message.utils";
import { UnreadBadge } from "./UnreadBadge";

interface Props {
  conversation: ConversationListItem;
  selected:     boolean;
  onClick:      () => void;
}

export const ConversationRow = React.memo(function ConversationRow({
  conversation,
  selected,
  onClick,
}: Props) {
  const { counterparty, project_title, last_message, last_message_at, has_unread } = conversation;
  const initials = getInitials(counterparty.full_name);

  return (
    <button
      onClick={onClick}
      aria-selected={selected}
      aria-label={`Conversation with ${counterparty.full_name ?? "Unknown"} regarding ${project_title}`}
      className={`
        w-full text-left
        flex items-start gap-3
        px-5 py-4
        border-b border-line/60
        hover:bg-parchment/40
        transition-colors
        focus-visible:outline-none
        focus-visible:ring-1 focus-visible:ring-gold focus-visible:ring-inset
        ${selected
          ? "bg-parchment/60 border-l-2 border-l-gold"
          : "border-l-2 border-l-transparent"
        }
      `}
    >
      {/* Avatar */}
      <div
        aria-hidden="true"
        className="
          w-9 h-9 shrink-0 mt-0.5
          border border-line
          bg-parchment
          flex items-center justify-center
          text-[11px] font-medium text-ash
          select-none
        "
        style={{ borderRadius: 2 }}
      >
        {counterparty.avatar_url ? (
          <img
            src={counterparty.avatar_url}
            alt=""
            className="w-full h-full object-cover"
            style={{ borderRadius: 2 }}
          />
        ) : (
          initials
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        {/* Row 1: counterparty + time */}
        <div className="flex items-baseline justify-between gap-2">
          <span
            className={`text-[13px] truncate leading-tight ${
              has_unread ? "font-medium text-ink" : "font-normal text-ink"
            }`}
          >
            {counterparty.full_name ?? "Unknown"}
          </span>
          {last_message_at && (
            <span className="text-[10px] text-ash shrink-0 tracking-[0.04em]">
              {formatRelativeTime(last_message_at)}
            </span>
          )}
        </div>

        {/* Row 2: project title */}
        <p className="text-[11px] text-ash tracking-[0.06em] uppercase mt-0.5 truncate">
          {project_title}
        </p>

        {/* Row 3: last message + unread badge */}
        <div className="flex items-center justify-between gap-2 mt-1">
          <p
            className={`text-[12px] truncate leading-snug ${
              has_unread ? "text-ink" : "text-ash"
            }`}
          >
            {last_message ?? "Start the conversation"}
          </p>
          {has_unread && <UnreadBadge dot />}
        </div>
      </div>
    </button>
  );
});
