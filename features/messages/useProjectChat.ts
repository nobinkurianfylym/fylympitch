"use client";
// features/messages/useProjectChat.ts

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
  PaginatedMessages,
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
import { notifyNewMessage } from "./message-notification-action";

// ── Types ─────────────────────────────────────────────────────

export interface SendPayload {
  text?: string;
  file?: File;
  fileExtension?: string;
}

export interface UseProjectChatReturn {
  messages:             MessageOrOptimistic[];
  loadingInitial:       boolean;
  loadingOlder:         boolean;
  hasMore:              boolean;
  sendError:            string | null;
  conversations:        ConversationListItem[];
  loadingConversations: boolean;
  send:           (payload: SendPayload) => Promise<void>;
  loadOlder:      () => Promise<void>;
  retry:          (clientId: string) => Promise<void>;
  clearSendError: () => void;
  getUrl:         (bucket: string, path: string) => Promise<string | null>;
}

// ── Helpers ───────────────────────────────────────────────────

function sortByLastMessage(list: ConversationListItem[]): ConversationListItem[] {
  return [...list].sort((a: ConversationListItem, b: ConversationListItem) => {
    const ts = (d: string | null): number => (d ? new Date(d).getTime() : 0);
    return ts(b.last_message_at) - ts(a.last_message_at);
  });
}

// ── Hook ──────────────────────────────────────────────────────

export function useProjectChat(
  conversationId:       string | null,
  currentUserId:        string,
  initialConversations: ConversationListItem[] = []
): UseProjectChatReturn {

  const [messages,             setMessages]             = useState<MessageOrOptimistic[]>([]);
  const [loadingInitial,       setLoadingInitial]       = useState<boolean>(false);
  const [loadingOlder,         setLoadingOlder]         = useState<boolean>(false);
  const [hasMore,              setHasMore]              = useState<boolean>(false);
  const [sendError,            setSendError]            = useState<string | null>(null);
  const [conversations,        setConversations]        = useState<ConversationListItem[]>(initialConversations);
  const [loadingConversations, setLoadingConversations] = useState<boolean>(false);

  const cursorRef     = useRef<MessageCursor | null>(null);
  const retryQueueRef = useRef<Map<string, SendPayload>>(new Map());
  const urlCacheRef   = useRef<Map<string, string>>(new Map());

  const supabase = useMemo(() => createClient(), []);

  // ── Load initial messages ──────────────────────────────────

  const loadInitial = useCallback(async (convId: string): Promise<void> => {
    setLoadingInitial(true);
    setMessages([]);
    cursorRef.current = null;

    const result = await loadMessages(convId);
    if (!result.data) { setLoadingInitial(false); return; }

    const { messages: msgs, nextCursor, hasMore: more }: PaginatedMessages = result.data;
    setMessages([...msgs].reverse());
    cursorRef.current = nextCursor;
    setHasMore(more);
    setLoadingInitial(false);
  }, []);

  // ── Load older ─────────────────────────────────────────────

  const loadOlder = useCallback(async (): Promise<void> => {
    if (!conversationId || !cursorRef.current || loadingOlder) return;
    setLoadingOlder(true);

    const result = await loadMessages(conversationId, cursorRef.current);
    if (!result.data) { setLoadingOlder(false); return; }

    const { messages: older, nextCursor, hasMore: more }: PaginatedMessages = result.data;
    setMessages((prev: MessageOrOptimistic[]) => [...[...older].reverse(), ...prev]);
    cursorRef.current = nextCursor;
    setHasMore(more);
    setLoadingOlder(false);
  }, [conversationId, loadingOlder]);

  // ── Refresh inbox ──────────────────────────────────────────

  const refreshInbox = useCallback(async (): Promise<void> => {
    setLoadingConversations(true);
    const result = await loadInbox(currentUserId);
    if (!result.error && result.data) setConversations(result.data);
    setLoadingConversations(false);
  }, [currentUserId]);

  // ── Load messages when conversation changes ─────────────────

  useEffect(() => {
    if (!conversationId) { setMessages([]); return; }
    void loadInitial(conversationId);
  }, [conversationId, loadInitial]);

  // ── Realtime: active conversation ──────────────────────────

  useEffect(() => {
    if (!conversationId) return;

    const channel = supabase
      .channel(`project-chat:${conversationId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages",
          filter: `conversation_id=eq.${conversationId}` },
        (payload: { new: Record<string, unknown> }) => {
          const incoming: Message = normalizeMessage(payload.new);
          setMessages((prev: MessageOrOptimistic[]) => {
            if (prev.some((m: MessageOrOptimistic) => m.id === incoming.id)) return prev;
            return [...prev, incoming];
          });
          if (incoming.sender_id !== currentUserId) {
            void markConversationRead(conversationId);
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "messages",
          filter: `conversation_id=eq.${conversationId}` },
        (payload: { new: Record<string, unknown> }) => {
          const updated: Message = normalizeMessage(payload.new);
          setMessages((prev: MessageOrOptimistic[]) =>
            prev.map((m: MessageOrOptimistic) => m.id === updated.id ? updated : m)
          );
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "conversations",
          filter: `id=eq.${conversationId}` },
        (payload: { new: Partial<ConversationRow> }) => {
          const u = payload.new;
          setConversations((prev: ConversationListItem[]) =>
            sortByLastMessage(prev.map((c: ConversationListItem) => {
              if (c.id !== conversationId) return c;
              return {
                ...c,
                last_message:    u.last_message    ?? c.last_message,
                last_message_at: u.last_message_at ?? c.last_message_at,
                has_unread:      false,
              };
            }))
          );
        }
      )
      .subscribe();

    void markConversationRead(conversationId);
    setConversations((prev: ConversationListItem[]) =>
      prev.map((c: ConversationListItem) =>
        c.id === conversationId ? { ...c, has_unread: false } : c
      )
    );

    return () => { void supabase.removeChannel(channel); };
  }, [conversationId, currentUserId, supabase]);

  // ── Realtime: inbox (all conversations) ───────────────────

  useEffect(() => {
    const channel = supabase
      .channel(`inbox:${currentUserId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "conversations" },
        (payload: { new: Partial<ConversationRow> & { id: string } }) => {
          const u = payload.new;
          setConversations((prev: ConversationListItem[]) => {
            if (!prev.some((c: ConversationListItem) => c.id === u.id)) {
              void refreshInbox();
              return prev;
            }
            return sortByLastMessage(
              prev.map((c: ConversationListItem) => {
                if (c.id !== u.id) return c;
                const lastReadAt: string | null = c.my_role === "producer"
                  ? (u.producer_last_read_at ?? c.my_last_read_at)
                  : (u.filmmaker_last_read_at ?? c.my_last_read_at);
                const lastMsgAt: string | null = u.last_message_at ?? c.last_message_at;
                return {
                  ...c,
                  last_message:    u.last_message ?? c.last_message,
                  last_message_at: lastMsgAt,
                  my_last_read_at: lastReadAt,
                  has_unread:
                    lastMsgAt !== null &&
                    (lastReadAt === null || new Date(lastMsgAt) > new Date(lastReadAt)),
                };
              })
            );
          });
        }
      )
      .subscribe();

    return () => { void supabase.removeChannel(channel); };
  }, [currentUserId, supabase, refreshInbox]);

  // ── Send ──────────────────────────────────────────────────

  const send = useCallback(async (payload: SendPayload): Promise<void> => {
    if (!conversationId) return;
    setSendError(null);

    const clientId: string = crypto.randomUUID();
    const optimistic: OptimisticMessage = createOptimisticMessage(
      clientId, conversationId, currentUserId, {
        message:             payload.text,
        attachmentName:      payload.file?.name,
        attachmentSize:      payload.file?.size,
        attachmentExtension: payload.fileExtension,
        attachmentMime:      payload.file?.type,
      }
    );

    setMessages((prev: MessageOrOptimistic[]) => [...prev, optimistic]);
    retryQueueRef.current.set(clientId, payload);

    try {
      type SendResult = Awaited<ReturnType<typeof sendTextMessage>>;
      let result: SendResult;

      if (payload.file && payload.fileExtension) {
        result = await sendAttachmentMessage(
          conversationId, currentUserId, payload.file, payload.fileExtension
        );
      } else if (payload.text?.trim()) {
        result = await sendTextMessage(conversationId, currentUserId, payload.text.trim());
      } else {
        setMessages((prev: MessageOrOptimistic[]) => prev.filter((m: MessageOrOptimistic) => m.id !== clientId));
        retryQueueRef.current.delete(clientId);
        return;
      }

      if (!result.data) {
        setMessages((prev: MessageOrOptimistic[]) =>
          prev.map((m: MessageOrOptimistic): MessageOrOptimistic => {
            if (m.id !== clientId) return m;
            return { ...(m as OptimisticMessage), delivery_status: "failed" } as OptimisticMessage;
          })
        );
        setSendError(result.error ?? "Failed to send.");
        return;
      }

      const confirmed: Message = result.data;

      // Replace optimistic — deduplicate against realtime
      setMessages((prev: MessageOrOptimistic[]) => {
        if (prev.some((m: MessageOrOptimistic) => !isOptimistic(m) && m.id === confirmed.id)) {
          return prev.filter((m: MessageOrOptimistic) => m.id !== clientId);
        }
        return prev.map((m: MessageOrOptimistic) => m.id === clientId ? confirmed : m);
      });

      retryQueueRef.current.delete(clientId);

      // Fire-and-forget: notify the counterparty by email.
      // Throttled server-side (skips if recipient was active recently).
      void notifyNewMessage({
        conversationId,
        senderId: currentUserId,
        messageText: confirmed.message ?? confirmed.attachment_name ?? null,
      });

      setConversations((prev: ConversationListItem[]) =>
        sortByLastMessage(prev.map((c: ConversationListItem) =>
          c.id !== conversationId ? c : {
            ...c,
            last_message:    confirmed.message ?? confirmed.attachment_name ?? "[Attachment]",
            last_message_at: confirmed.sent_at,
            has_unread:      false,
          }
        ))
      );
    } catch {
      setMessages((prev: MessageOrOptimistic[]) =>
        prev.map((m: MessageOrOptimistic): MessageOrOptimistic => {
          if (m.id !== clientId) return m;
          return { ...(m as OptimisticMessage), delivery_status: "failed" } as OptimisticMessage;
        })
      );
      setSendError("Failed to send. Check your connection.");
    }
  }, [conversationId, currentUserId]);

  // ── Retry ─────────────────────────────────────────────────

  const retry = useCallback(async (clientId: string): Promise<void> => {
    const payload = retryQueueRef.current.get(clientId);
    if (!payload) return;
    setMessages((prev: MessageOrOptimistic[]) => prev.filter((m: MessageOrOptimistic) => m.id !== clientId));
    retryQueueRef.current.delete(clientId);
    await send(payload);
  }, [send]);

  // ── Signed URL cache ──────────────────────────────────────

  const getUrl = useCallback(async (bucket: string, path: string): Promise<string | null> => {
    const key = `${bucket}:${path}`;
    if (urlCacheRef.current.has(key)) return urlCacheRef.current.get(key)!;
    const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, 3600);
    if (error || !data?.signedUrl) return null;
    urlCacheRef.current.set(key, data.signedUrl);
    setTimeout(() => urlCacheRef.current.delete(key), 55 * 60 * 1000);
    return data.signedUrl;
  }, [supabase]);

  return {
    messages, loadingInitial, loadingOlder, hasMore, sendError,
    conversations, loadingConversations,
    send, loadOlder, retry,
    clearSendError: () => setSendError(null),
    getUrl,
  };
}
