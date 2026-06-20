"use client";
// features/messages/useProjectChat.ts
// Stateful hook: manages messages, realtime, pagination, optimistic updates,
// read receipts, and attachment uploads for one project conversation.

import {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from "react";
import { createClient } from "@/lib/supabase/client";
import type {
  Message,
  MessageOrOptimistic,
  OptimisticMessage,
  MessageCursor,
  ConversationListItem,
} from "./message.types";
import {
  loadMessages,
  sendTextMessage,
  sendAttachmentMessage,
  markConversationRead,
  loadInbox,
} from "./message.service";
import {
  normalizeMessage,
  createOptimisticMessage,
  isOptimistic,
} from "./message.utils";
import type { ConversationRow } from "./message.types";

// ── Types ─────────────────────────────────────────────────────

export interface SendPayload {
  text?: string;
  file?: File;
  fileExtension?: string;
}

export interface UseProjectChatReturn {
  // Messages
  messages:      MessageOrOptimistic[];
  loadingInitial: boolean;
  loadingOlder:  boolean;
  hasMore:       boolean;
  sendError:     string | null;

  // Inbox
  conversations:     ConversationListItem[];
  loadingConversations: boolean;

  // Actions
  send:     (payload: SendPayload) => Promise<void>;
  loadOlder: () => Promise<void>;
  retry:    (clientId: string) => Promise<void>;
  clearSendError: () => void;

  // Signed URLs cache
  getUrl: (bucket: string, path: string) => Promise<string | null>;
}

// ── Hook ──────────────────────────────────────────────────────

export function useProjectChat(
  conversationId: string | null,
  currentUserId:  string,
  initialConversations: ConversationListItem[] = []
): UseProjectChatReturn {
  // ── State ───────────────────────────────────────────────────
  const [messages,       setMessages]       = useState<MessageOrOptimistic[]>([]);
  const [loadingInitial, setLoadingInitial] = useState(false);
  const [loadingOlder,   setLoadingOlder]   = useState(false);
  const [hasMore,        setHasMore]        = useState(false);
  const [sendError,      setSendError]      = useState<string | null>(null);
  const [conversations,  setConversations]  = useState<ConversationListItem[]>(initialConversations);
  const [loadingConversations, setLoadingConversations] = useState(false);

  // ── Refs ─────────────────────────────────────────────────────
  const cursorRef        = useRef<MessageCursor | null>(null);
  const channelRef       = useRef<ReturnType<ReturnType<typeof createClient>["channel"]> | null>(null);
  /** clientId → SendPayload for retry */
  const retryQueueRef    = useRef<Map<string, SendPayload>>(new Map());
  /** Signed URL cache: `bucket:path` → url */
  const urlCacheRef      = useRef<Map<string, string>>(new Map());

  const supabase = useMemo(() => createClient(), []);

  // ── Load initial messages ────────────────────────────────────
  const loadInitial = useCallback(async (convId: string) => {
    setLoadingInitial(true);
    setMessages([]);
    cursorRef.current = null;

    const result = await loadMessages(convId);
    if (result.error) {
      setLoadingInitial(false);
      return;
    }

    const { messages: msgs, nextCursor, hasMore: more } = result.data;
    // Messages come newest-first from DB; reverse for display (oldest at top)
    setMessages([...msgs].reverse());
    cursorRef.current = nextCursor;
    setHasMore(more);
    setLoadingInitial(false);
  }, []);

  // ── Load older messages (cursor pagination) ─────────────────
  const loadOlder = useCallback(async () => {
    if (!conversationId || !cursorRef.current || loadingOlder) return;
    setLoadingOlder(true);

    const result = await loadMessages(conversationId, cursorRef.current);
    if (result.error) {
      setLoadingOlder(false);
      return;
    }

    const { messages: older, nextCursor, hasMore: more } = result.data;
    setMessages((prev) => [...[...older].reverse(), ...prev]);
    cursorRef.current = nextCursor;
    setHasMore(more);
    setLoadingOlder(false);
  }, [conversationId, loadingOlder]);

  // ── Load inbox ───────────────────────────────────────────────
  const refreshInbox = useCallback(async () => {
    setLoadingConversations(true);
    const result = await loadInbox(currentUserId);
    if (!result.error) setConversations(result.data);
    setLoadingConversations(false);
  }, [currentUserId]);

  // ── Effect: load messages when conversation changes ──────────
  useEffect(() => {
    if (!conversationId) {
      setMessages([]);
      return;
    }
    loadInitial(conversationId);
  }, [conversationId, loadInitial]);

  // ── Effect: realtime subscription ────────────────────────────
  useEffect(() => {
    if (!conversationId) return;

    // Cleanup previous channel
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    const channel = supabase
      .channel(`project-chat:${conversationId}`)
      // New message in this conversation
      .on(
        "postgres_changes",
        {
          event:  "INSERT",
          schema: "public",
          table:  "messages",
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const incoming = normalizeMessage(payload.new as Record<string, unknown>);

          setMessages((prev) => {
            // Deduplicate: skip if already present (server ID match)
            if (prev.some((m) => m.id === incoming.id)) return prev;
            // If this is our own message that replaced an optimistic, skip —
            // the optimistic was already replaced by the insert response.
            return [...prev, incoming];
          });

          // Mark as read if it's from the counterparty
          if (incoming.sender_id !== currentUserId) {
            void markConversationRead(conversationId);
          }
        }
      )
      // read_at / delivered_at updates
      .on(
        "postgres_changes",
        {
          event:  "UPDATE",
          schema: "public",
          table:  "messages",
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const updated = normalizeMessage(payload.new as Record<string, unknown>);
          setMessages((prev) =>
            prev.map((m) => (m.id === updated.id ? updated : m))
          );
        }
      )
      // Conversation-level updates (last_message_at etc.) — refresh inbox list
      .on(
        "postgres_changes",
        {
          event:  "UPDATE",
          schema: "public",
          table:  "conversations",
          filter: `id=eq.${conversationId}`,
        },
        (payload) => {
          const updated = payload.new as Partial<ConversationRow>;
          setConversations((prev) =>
            prev
              .map((c) => {
                if (c.id !== conversationId) return c;
                return {
                  ...c,
                  last_message:    updated.last_message    ?? c.last_message,
                  last_message_at: updated.last_message_at ?? c.last_message_at,
                  has_unread: false, // we're currently viewing it
                };
              })
              .sort((a, b) => {
                const at = (d: string | null) => (d ? new Date(d).getTime() : 0);
                return at(b.last_message_at) - at(a.last_message_at);
              })
          );
        }
      )
      .subscribe();

    channelRef.current = channel;

    // Mark as read when opening conversation
    void markConversationRead(conversationId);
    // Update conversations list to clear has_unread
    setConversations((prev) =>
      prev.map((c) =>
        c.id === conversationId ? { ...c, has_unread: false } : c
      )
    );

    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [conversationId, currentUserId, supabase]);

  // ── Effect: inbox realtime (other conversations) ─────────────
  useEffect(() => {
    const channel = supabase
      .channel(`inbox:${currentUserId}`)
      .on(
        "postgres_changes",
        {
          event:  "UPDATE",
          schema: "public",
          table:  "conversations",
        },
        (payload) => {
          const updated = payload.new as Partial<ConversationRow> & { id: string };
          setConversations((prev) => {
            const exists = prev.some((c) => c.id === updated.id);
            if (!exists) {
              // New conversation arrived — refresh inbox
              void refreshInbox();
              return prev;
            }
            return prev
              .map((c) => {
                if (c.id !== updated.id) return c;
                const lastReadAt = c.my_role === "producer"
                  ? (updated.producer_last_read_at ?? c.my_last_read_at)
                  : (updated.filmmaker_last_read_at ?? c.my_last_read_at);
                const lastMsgAt = updated.last_message_at ?? c.last_message_at;
                return {
                  ...c,
                  last_message:     updated.last_message    ?? c.last_message,
                  last_message_at:  lastMsgAt,
                  my_last_read_at:  lastReadAt,
                  has_unread:
                    lastMsgAt !== null &&
                    (lastReadAt === null || new Date(lastMsgAt) > new Date(lastReadAt)),
                };
              })
              .sort((a, b) => {
                const at = (d: string | null) => (d ? new Date(d).getTime() : 0);
                return at(b.last_message_at) - at(a.last_message_at);
              });
          });
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [currentUserId, supabase, refreshInbox]);

  // ── Send ─────────────────────────────────────────────────────
  const send = useCallback(async (payload: SendPayload) => {
    if (!conversationId) return;
    setSendError(null);

    const clientId = crypto.randomUUID();

    // Optimistic: add to UI immediately
    const optimistic = createOptimisticMessage(clientId, conversationId, currentUserId, {
      message:             payload.text,
      attachmentName:      payload.file?.name,
      attachmentSize:      payload.file?.size,
      attachmentExtension: payload.fileExtension,
      attachmentMime:      payload.file?.type,
    });

    setMessages((prev) => [...prev, optimistic]);
    retryQueueRef.current.set(clientId, payload);

    try {
      let result: Awaited<ReturnType<typeof sendTextMessage>>;

      if (payload.file && payload.fileExtension) {
        result = await sendAttachmentMessage(
          conversationId,
          currentUserId,
          payload.file,
          payload.fileExtension
        );
      } else if (payload.text?.trim()) {
        result = await sendTextMessage(conversationId, currentUserId, payload.text.trim());
      } else {
        setMessages((prev) => prev.filter((m) => m.id !== clientId));
        retryQueueRef.current.delete(clientId);
        return;
      }

      if (result.error) {
        // Mark optimistic as failed
        setMessages((prev) =>
          prev.map((m): MessageOrOptimistic => {
            if (m.id !== clientId) return m;
            return { ...(m as OptimisticMessage), delivery_status: "failed" } as OptimisticMessage;
          })
        );
        setSendError(result.error);
        return;
      }

      const confirmed = result.data;

      // Replace optimistic with confirmed, avoiding double-add from realtime
      setMessages((prev) => {
        if (prev.some((m) => !isOptimistic(m) && m.id === confirmed.id)) {
          // Realtime already added it — remove optimistic
          return prev.filter((m) => m.id !== clientId);
        }
        return prev.map((m) => (m.id === clientId ? confirmed : m));
      });

      retryQueueRef.current.delete(clientId);

      // Update inbox last_message optimistically
      setConversations((prev) =>
        prev
          .map((c) =>
            c.id === conversationId
              ? {
                  ...c,
                  last_message:    confirmed.message ?? confirmed.attachment_name ?? "[Attachment]",
                  last_message_at: confirmed.sent_at,
                  has_unread:      false,
                }
              : c
          )
          .sort((a, b) => {
            const at = (d: string | null) => (d ? new Date(d).getTime() : 0);
            return at(b.last_message_at) - at(a.last_message_at);
          })
      );
    } catch {
      setMessages((prev) =>
        prev.map((m): MessageOrOptimistic => {
          if (m.id !== clientId) return m;
          return { ...(m as OptimisticMessage), delivery_status: "failed" } as OptimisticMessage;
        })
      );
      setSendError("Failed to send. Check your connection.");
    }
  }, [conversationId, currentUserId]);

  // ── Retry failed message ──────────────────────────────────────
  const retry = useCallback(async (clientId: string) => {
    const payload = retryQueueRef.current.get(clientId);
    if (!payload) return;
    // Remove the failed message first
    setMessages((prev) => prev.filter((m) => m.id !== clientId));
    retryQueueRef.current.delete(clientId);
    await send(payload);
  }, [send]);

  // ── Signed URL cache ──────────────────────────────────────────
  const getUrl = useCallback(async (
    bucket: string,
    path: string
  ): Promise<string | null> => {
    const key = `${bucket}:${path}`;
    if (urlCacheRef.current.has(key)) {
      return urlCacheRef.current.get(key)!;
    }
    const { data, error } = await supabase.storage
      .from(bucket)
      .createSignedUrl(path, 3600);
    if (error || !data?.signedUrl) return null;
    urlCacheRef.current.set(key, data.signedUrl);
    // Invalidate after 55 minutes
    setTimeout(() => urlCacheRef.current.delete(key), 55 * 60 * 1000);
    return data.signedUrl;
  }, [supabase]);

  return {
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
    clearSendError: () => setSendError(null),
    getUrl,
  };
}
