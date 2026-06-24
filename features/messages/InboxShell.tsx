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
import { ProofNotificationThread } from "./ProofNotificationThread";

interface Props {
  currentUserId:        string;
  initialConversations: ConversationListItem[];
  /** Conversation ID from URL query param — pre-selects on load. */
  initialConversationId: string | null;
  /** Path prefix for inbox URL: "/dashboard/messages" or "/producerstudio/messages" */
  inboxPath: string;
  /** Unread proof notification count, passed from server */
  initialProofUnreadCount?: number;
}

const PROOF_THREAD_ID = "proof-notifications";

export default function InboxShell({
  currentUserId,
  initialConversations,
  initialConversationId,
  inboxPath,
  initialProofUnreadCount = 0,
}: Props) {
  const router   = useRouter();
  const pathname = usePathname();

  const [selectedId,      setSelectedId]      = useState<string | null>(initialConversationId);
  const [mobileShowPanel, setMobileShowPanel] = useState(!!initialConversationId);
  const [proofUnreadCount, setProofUnreadCount] = useState(initialProofUnreadCount);

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
        {/* ── PITCH.FYLYM system thread — pinned above conversations ── */}
        <div className="shrink-0 border-b border-line">
          <button
            onClick={() => { setSelectedId(PROOF_THREAD_ID); setMobileShowPanel(true); }}
            className={`w-full flex items-center gap-3 px-5 py-3.5 transition-colors hover:bg-gold/5 ${
              selectedId === PROOF_THREAD_ID ? "bg-gold/8 border-l-2 border-l-gold" : "border-l-2 border-l-transparent"
            }`}
          >
            <div className="w-8 h-8 rounded-full bg-ink flex items-center justify-center shrink-0">
              <span className="text-gold text-[13px]">₿</span>
            </div>
            <div className="flex-1 text-left min-w-0">
              <p className="text-[12px] font-medium text-ink truncate">PITCH.FYLYM</p>
              <p className="text-[10px] text-ash truncate">Proof of Existence Certificates</p>
            </div>
            {proofUnreadCount > 0 && (
              <span className="bg-gold text-white text-[9px] rounded-full px-1.5 py-0.5 font-mono">
                {proofUnreadCount}
              </span>
            )}
          </button>
        </div>

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
        {!selected && selectedId !== PROOF_THREAD_ID ? (
          <EmptyState variant="no-selection" />
        ) : selectedId === PROOF_THREAD_ID ? (
          <ProofNotificationThread
            filmakerId={currentUserId}
            onUnreadChange={setProofUnreadCount}
          />
        ) : (
          <>
            <ConversationHeader
              conversation={selected!}
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
