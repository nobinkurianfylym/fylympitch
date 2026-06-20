"use client";
// features/messages/ConversationList.tsx

import React, { useState, useMemo } from "react";
import type { ConversationListItem } from "./message.types";
import { filterConversations } from "./message.utils";
import { ConversationRow } from "./ConversationRow";
import { EmptyState } from "./EmptyState";

interface Props {
  conversations: ConversationListItem[];
  selectedId:    string | null;
  loading:       boolean;
  onSelect:      (id: string) => void;
}

export function ConversationList({
  conversations,
  selectedId,
  loading,
  onSelect,
}: Props) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(
    () => filterConversations(conversations, query),
    [conversations, query]
  );

  const totalUnread = useMemo(
    () => conversations.filter((c) => c.has_unread).length,
    [conversations]
  );

  return (
    <aside
      className="
        flex flex-col
        w-full md:w-[340px] shrink-0
        border-r border-line
        bg-white
        h-full
        overflow-hidden
      "
      aria-label="Project conversations"
    >
      {/* ── Header ── */}
      <div className="px-5 pt-5 pb-4 border-b border-line shrink-0">
        <div className="flex items-baseline gap-3 mb-4">
          <h2 className="font-display text-[20px] text-ink leading-tight">Inbox</h2>
          {totalUnread > 0 && (
            <span className="text-[10px] tracking-[0.14em] uppercase text-ash">
              {totalUnread} unread
            </span>
          )}
        </div>

        {/* Search */}
        <div className="relative">
          <i
            className="ti ti-search absolute left-3 top-1/2 -translate-y-1/2 text-ash"
            style={{ fontSize: 14 }}
            aria-hidden="true"
          />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search projects or contacts…"
            aria-label="Search conversations"
            className="
              field !pl-9 !py-2 w-full
              text-[13px]
              placeholder:text-ash/60
            "
          />
        </div>
      </div>

      {/* ── List ── */}
      <div
        className="flex-1 overflow-y-auto"
        role="listbox"
        aria-label="Conversation list"
      >
        {loading && (
          <div className="px-5 py-8 text-center">
            <p className="text-[11px] tracking-[0.14em] uppercase text-ash">Loading</p>
          </div>
        )}

        {!loading && conversations.length === 0 && (
          <div className="py-12 px-4">
            <EmptyState variant="no-conversations" />
          </div>
        )}

        {!loading && conversations.length > 0 && filtered.length === 0 && (
          <div className="px-5 py-10 text-center">
            <p className="text-[12px] text-ash">No conversations match "{query}"</p>
          </div>
        )}

        {filtered.map((conv) => (
          <ConversationRow
            key={conv.id}
            conversation={conv}
            selected={conv.id === selectedId}
            onClick={() => onSelect(conv.id)}
          />
        ))}
      </div>
    </aside>
  );
}
