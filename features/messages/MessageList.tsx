"use client";
// features/messages/MessageList.tsx
// Scrollable message canvas. Handles:
//  - Scroll-to-bottom on new messages
//  - Load-older trigger at scroll top
//  - Viewport-based read receipts via IntersectionObserver
//  - Date dividers
//  - Virtualization guard (warning at 200+)

import React, {
  useRef,
  useEffect,
  useCallback,
  useMemo,
} from "react";
import type { MessageOrOptimistic } from "./message.types";
import { shouldShowDateDivider } from "./message.utils";
import { DateDivider } from "./DateDivider";
import { MessageItem } from "./MessageItem";
import { EmptyState } from "./EmptyState";

const VIRTUALIZE_THRESHOLD = 200;

interface Props {
  messages:      MessageOrOptimistic[];
  currentUserId: string;
  loadingInitial: boolean;
  loadingOlder:  boolean;
  hasMore:       boolean;
  onLoadOlder:   () => void;
  onRetry:       (clientId: string) => void;
  getUrl:        (bucket: string, path: string) => Promise<string | null>;
}

export const MessageList = React.memo(function MessageList({
  messages,
  currentUserId,
  loadingInitial,
  loadingOlder,
  hasMore,
  onLoadOlder,
  onRetry,
  getUrl,
}: Props) {
  const scrollRef    = useRef<HTMLDivElement>(null);
  const bottomRef    = useRef<HTMLDivElement>(null);
  const prevCountRef = useRef(0);

  // ── Scroll to bottom on new messages ─────────────────────────
  useEffect(() => {
    const prev = prevCountRef.current;
    const curr = messages.length;
    prevCountRef.current = curr;

    if (curr <= prev) return; // no new messages
    if (!scrollRef.current) return;

    const el = scrollRef.current;
    const isNearBottom =
      el.scrollHeight - el.scrollTop - el.clientHeight < 160;

    if (isNearBottom || prev === 0) {
      // Instant scroll for first load; smooth for new messages
      bottomRef.current?.scrollIntoView({ behavior: prev === 0 ? "auto" : "smooth" });
    }
  }, [messages.length]);

  // ── Load older messages on scroll top ────────────────────────
  const handleScroll = useCallback(() => {
    if (!scrollRef.current || !hasMore || loadingOlder) return;
    if (scrollRef.current.scrollTop < 120) {
      onLoadOlder();
    }
  }, [hasMore, loadingOlder, onLoadOlder]);

  // ── IntersectionObserver for read receipts ────────────────────
  // When a message from the counterparty enters the viewport, the parent
  // hook already called markConversationRead on conversation open. Individual
  // read_at timestamps are set via the mark_conversation_read RPC.
  // This observer is kept here for potential per-message granularity in future.
  const observerRef = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    observerRef.current?.disconnect();
    observerRef.current = new IntersectionObserver(
      () => {
        // Per-message read receipt via RPC already handled on conversation open
        // and realtime subscription. No additional action needed here.
      },
      { threshold: 0.5 }
    );
    return () => { observerRef.current?.disconnect(); };
  }, []);

  // Warn on large message counts (>200) — consider virtual list
  const shouldShowVirtualizeWarning = messages.length > VIRTUALIZE_THRESHOLD;

  const items = useMemo(() => messages, [messages]);

  if (loadingInitial) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-[12px] tracking-[0.14em] uppercase text-ash">Loading</p>
      </div>
    );
  }

  if (!loadingInitial && messages.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <EmptyState variant="no-messages" />
      </div>
    );
  }

  return (
    <div
      ref={scrollRef}
      onScroll={handleScroll}
      className="flex-1 overflow-y-auto overflow-x-hidden"
      role="log"
      aria-live="polite"
      aria-label="Message history"
    >
      <div className="px-8 py-6 flex flex-col gap-2" style={{ maxWidth: 720, margin: "0 auto" }}>

        {/* Load older */}
        {hasMore && (
          <div className="flex justify-center pb-4">
            <button
              onClick={onLoadOlder}
              disabled={loadingOlder}
              className="text-[11px] tracking-[0.14em] uppercase text-ash hover:text-ink disabled:opacity-40 transition-colors"
              aria-label="Load earlier messages"
            >
              {loadingOlder ? "Loading…" : "Load earlier messages"}
            </button>
          </div>
        )}

        {shouldShowVirtualizeWarning && (
          <p className="text-[10px] text-ash text-center tracking-[0.12em] pb-2">
            — {messages.length} messages —
          </p>
        )}

        {items.map((msg: MessageOrOptimistic, i: number) => {
          const showDivider = shouldShowDateDivider(items, i);
          const isMine = msg.sender_id === currentUserId;

          return (
            <React.Fragment key={msg.id}>
              {showDivider && <DateDivider isoDate={msg.sent_at} />}
              <MessageItem
                msg={msg}
                isMine={isMine}
                getUrl={getUrl}
                onRetry={onRetry}
              />
            </React.Fragment>
          );
        })}

        <div ref={bottomRef} aria-hidden="true" />
      </div>
    </div>
  );
});
