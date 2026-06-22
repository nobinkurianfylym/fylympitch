"use client";
// features/messages/ConversationHeader.tsx

import React from "react";
import Link from "next/link";
import type { ConversationListItem } from "./message.types";
import { getInitials } from "./message.utils";

interface Props {
  conversation: ConversationListItem;
  onBack?: () => void;
}

export const ConversationHeader = React.memo(function ConversationHeader({
  conversation,
  onBack,
}: Props) {
  const { counterparty, project_title, project_id } = conversation;
  const initials = getInitials(counterparty.full_name);

  return (
    <header
      className="
        flex items-center gap-4
        px-6 py-4
        border-b border-line
        bg-white
        shrink-0
      "
      aria-label="Conversation header"
    >
      {/* Mobile back */}
      {onBack && (
        <button
          onClick={onBack}
          aria-label="Back to inbox"
          className="md:hidden text-ash hover:text-ink transition-colors mr-1 shrink-0"
        >
          <i className="ti ti-arrow-left" style={{ fontSize: 20 }} aria-hidden="true" />
        </button>
      )}

      {/* Avatar */}
      <div
        aria-hidden="true"
        className="
          w-9 h-9 shrink-0
          border border-line
          bg-parchment
          flex items-center justify-center
          text-[12px] font-medium text-ash
          select-none
          rounded-full
        "
      >
        {counterparty.avatar_url ? (
          <img
            src={counterparty.avatar_url}
            alt={counterparty.full_name ?? ""}
            className="w-full h-full object-cover rounded-full"
          />
        ) : (
          initials
        )}
      </div>

      {/* Identity */}
      <div className="flex-1 min-w-0">
        <p className="text-[14px] font-medium text-ink truncate leading-tight">
          {counterparty.full_name ?? "Unknown"}
          {counterparty.company && (
            <span className="font-normal text-ash"> · {counterparty.company}</span>
          )}
        </p>
        <div className="flex items-center gap-1.5 mt-0.5">
          <span className="text-[10px] tracking-[0.14em] uppercase text-ash">Project</span>
          <span className="text-ash text-[10px]">·</span>
          <Link
            href={`/dashboard/projects/${project_id}`}
            className="text-[12px] text-ash hover:text-ink transition-colors truncate"
          >
            {project_title}
          </Link>
        </div>
      </div>

      {/* Project link pill */}
      <Link
        href={`/dashboard/projects/${project_id}`}
        className="
          hidden sm:flex items-center gap-1.5
          px-3 py-1.5
          border border-line
          text-[11px] tracking-[0.1em] uppercase text-ash
          hover:border-ash hover:text-ink
          transition-colors shrink-0
          rounded-lg
        "
        aria-label={`View project: ${project_title}`}
      >
        <i className="ti ti-external-link" style={{ fontSize: 12 }} aria-hidden="true" />
        View project
      </Link>
    </header>
  );
});
