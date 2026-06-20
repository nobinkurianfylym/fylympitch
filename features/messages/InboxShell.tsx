"use client";
// features/messages/InboxShell.tsx
// Top-level client component. Wires all messaging components together.
// Receives SSR-bootstrapped data; client state takes over immediately.

import { useState, useCallback, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import type { ConversationListItem } from "./message.types";
import { useProjectChat } from "./useProjectChat";
import { ConversationList } from "./ConversationList";
import { ConversationHeader } from "./ConversationHeader";
import { MessageList } from "./MessageList";
import { PremiumComposer } from "./PremiumComposer";
import { EmptyState } from "./EmptyState";

interface Props {
  currentUserId:        string;
  initialConversations: ConversationListItem[];
  /** Conversation ID from URL query param — pre-selects on load. */
  initialConversationId: string | null;
  /** Path prefix for inbox URL: "/dashboard/messages" or "/producer/messages" */
  inboxPath: string;
}

export default function InboxShell({
  currentUserId,
  initialConversations,
  initialConversationId,
  inboxPath,
}: Props) {
  const router   = useRouter();
  const pathname = usePathname();

  const [selectedId,      setSelectedId]      = useState<string | null>(initialConversationId);
  const [mobileShowPanel, setMobileShowPanel] = useState(!!initialConversationId);

  const {
    messages,
    loadingInitial,
    loadingOlder,
    hasMore,
    sendError,
    conversations,
    loadingConversations,
    send,
    loadOlder,
    retry,
    clearSendError,
    getUrl,
  } = useProjectChat(selectedId, currentUserId, initialConversations);

  const selected = conversations.find((c) => c.id === selectedId) ?? null;

  // ── Sync URL with selected conversation ───────────────────────
  useEffect(() => {
    if (!selectedId) {
      if (pathname !== inboxPath) router.replace(inboxPath, { scroll: false });
      return;
    }
    router.replace(`${inboxPath}?conv=${selectedId}`, { scroll: false });
  }, [selectedId, pathname, inboxPath, router]);

  // ── Select conversation ───────────────────────────────────────
  const handleSelect = useCallback((id: string) => {
    setSelectedId(id);
    setMobileShowPanel(true);
  }, []);

  const handleBack = useCallback(() => {
    setMobileShowPanel(false);
    setSelectedId(null);
  }, []);

  return (
    // Full viewport height — strips parent layout padding via negative margin wrapper in page.tsx
    <div className="flex h-screen overflow-hidden bg-ivory">

      {/* ── LEFT SIDEBAR ── */}
      <div
        className={`
          ${mobileShowPanel ? "hidden md:flex" : "flex"}
          flex-col
          w-full md:w-[340px] md:shrink-0
          h-full
        `}
      >
        <ConversationList
          conversations={conversations}
          selectedId={selectedId}
          loading={loadingConversations && conversations.length === 0}
          onSelect={handleSelect}
        />
      </div>

      {/* ── RIGHT PANEL ── */}
      <div
        className={`
          ${!mobileShowPanel ? "hidden md:flex" : "flex"}
          flex-col flex-1 min-w-0
          bg-white
        `}
        aria-label="Message panel"
      >
        {!selected ? (
          <EmptyState variant="no-selection" />
        ) : (
          <>
            <ConversationHeader
              conversation={selected}
              onBack={handleBack}
            />

            <MessageList
              messages={messages}
              currentUserId={currentUserId}
              loadingInitial={loadingInitial}
              loadingOlder={loadingOlder}
              hasMore={hasMore}
              onLoadOlder={loadOlder}
              onRetry={retry}
              getUrl={getUrl}
            />

            <PremiumComposer
              onSend={send}
              sendError={sendError}
              onClearError={clearSendError}
            />
          </>
        )}
      </div>
    </div>
  );
}
