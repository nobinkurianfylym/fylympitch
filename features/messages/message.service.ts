// features/messages/message.service.ts
// All Supabase interactions for the messaging module.
// No state, no hooks — pure async functions.
// Designed for client-side use (browser Supabase client).

import { createClient } from "@/lib/supabase/client";
import type {
  ConversationRow,
  ConversationListItem,
  Message,
  PaginatedMessages,
  MessageCursor,
  SendMessagePayload,
  ServiceResult,
} from "./message.types";
import {
  MESSAGE_PAGE_SIZE,
  MAX_ATTACHMENT_BYTES,
} from "./message.types";
import {
  normalizeMessage,
  toConversationListItem,
  buildAttachmentPath,
  validateAttachment,
} from "./message.utils";

// ── Conversations ─────────────────────────────────────────────

/**
 * Load all project conversations the current user participates in.
 * Returns them enriched as ConversationListItem[].
 */
export async function loadInbox(
  currentUserId: string
): Promise<ServiceResult<ConversationListItem[]>> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("conversations")
    .select(`
      id,
      project_id,
      producer_id,
      filmmaker_id,
      last_message,
      last_message_at,
      producer_last_read_at,
      filmmaker_last_read_at,
      conversation_type,
      created_at,
      updated_at,
      project:projects!conversations_project_id_fkey(title),
      producer:profiles!conversations_producer_id_fkey(id, full_name, company, avatar_url),
      filmmaker:profiles!conversations_filmmaker_id_fkey(id, full_name, company, avatar_url)
    `)
    .or(`producer_id.eq.${currentUserId},filmmaker_id.eq.${currentUserId}`)
    .order("last_message_at", { ascending: false, nullsFirst: false });

  if (error) return { data: null, error: error.message };

  const rows = (data ?? []) as unknown as ConversationRow[];
  const items = rows.map((row) => toConversationListItem(row, currentUserId));

  return { data: items, error: null };
}

/**
 * Initiate a project conversation via the security-definer RPC.
 * Returns the conversation ID.
 */
export async function initiateProjectConversation(payload: {
  projectId: string;
  producerId: string;
  filmakerId: string;
}): Promise<ServiceResult<string>> {
  const supabase = createClient();

  const { data, error } = await supabase.rpc("initiate_project_conversation", {
    p_project_id:   payload.projectId,
    p_producer_id:  payload.producerId,
    p_filmmaker_id: payload.filmakerId,
  });

  if (error) return { data: null, error: error.message };
  return { data: data as string, error: null };
}

// ── Messages ──────────────────────────────────────────────────

/**
 * Load messages for a conversation with cursor pagination.
 * Returns newest-first; caller reverses for display.
 */
export async function loadMessages(
  conversationId: string,
  cursor?: MessageCursor
): Promise<ServiceResult<PaginatedMessages>> {
  const supabase = createClient();

  let query = supabase
    .from("messages")
    .select(
      "id, conversation_id, sender_id, message, " +
      "attachment_name, attachment_size, attachment_extension, attachment_mime, " +
      "storage_bucket, storage_path, " +
      "sent_at, delivered_at, read_at, " +
      "created_at, updated_at, deleted_at, deleted_by"
    )
    .eq("conversation_id", conversationId)
    .order("sent_at", { ascending: false })
    .order("id",      { ascending: false })
    .limit(MESSAGE_PAGE_SIZE + 1); // +1 to detect hasMore

  if (cursor) {
    // Cursor: rows older than (sent_at, id)
    query = query.or(
      `sent_at.lt.${cursor.sent_at},and(sent_at.eq.${cursor.sent_at},id.lt.${cursor.id})`
    );
  }

  const { data, error } = await query;

  if (error) return { data: null, error: error.message };

  const rows = data ?? [];
  const hasMore = rows.length > MESSAGE_PAGE_SIZE;
  const page    = hasMore ? rows.slice(0, MESSAGE_PAGE_SIZE) : rows;

  const messages = page.map(normalizeMessage);

  const lastRow = page[page.length - 1];
  const nextCursor: MessageCursor | null =
    hasMore && lastRow
      ? { sent_at: lastRow.sent_at, id: lastRow.id }
      : null;

  return {
    data:  { messages, nextCursor, hasMore },
    error: null,
  };
}

/**
 * Send a text message (no attachment).
 * sender_id is derived server-side from auth.uid() — never pass it from client.
 */
export async function sendTextMessage(
  conversationId: string,
  senderId: string,
  text: string
): Promise<ServiceResult<Message>> {
  const supabase = createClient();
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from("messages")
    .insert({
      conversation_id: conversationId,
      sender_id:       senderId,
      message:         text.trim(),
      sent_at:         now,
      created_by:      senderId,
      updated_by:      senderId,
    })
    .select(
      "id, conversation_id, sender_id, message, " +
      "attachment_name, attachment_size, attachment_extension, attachment_mime, " +
      "storage_bucket, storage_path, " +
      "sent_at, delivered_at, read_at, " +
      "created_at, updated_at, deleted_at, deleted_by"
    )
    .single();

  if (error) {
    const msg = error.message.includes("rate_limit_exceeded")
      ? "Too many messages. Please wait a moment."
      : error.message;
    return { data: null, error: msg };
  }

  return { data: normalizeMessage(data), error: null };
}

/**
 * Upload attachment to Supabase Storage, then insert the message row.
 * Returns the confirmed message.
 */
export async function sendAttachmentMessage(
  conversationId: string,
  senderId: string,
  file: File,
  extension: string
): Promise<ServiceResult<Message>> {
  const supabase = createClient();

  if (file.size > MAX_ATTACHMENT_BYTES) {
    return { data: null, error: "File exceeds 50 MB limit." };
  }

  const storagePath = buildAttachmentPath(conversationId, senderId, extension);

  const { error: uploadError } = await supabase.storage
    .from("message-attachments")
    .upload(storagePath, file, {
      contentType: file.type,
      upsert:      false,
    });

  if (uploadError) {
    return { data: null, error: `Upload failed: ${uploadError.message}` };
  }

  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from("messages")
    .insert({
      conversation_id:      conversationId,
      sender_id:            senderId,
      attachment_name:      file.name,
      attachment_size:      file.size,
      attachment_extension: extension,
      attachment_mime:      file.type,
      storage_bucket:       "message-attachments",
      storage_path:         storagePath,
      sent_at:              now,
      created_by:           senderId,
      updated_by:           senderId,
    })
    .select(
      "id, conversation_id, sender_id, message, " +
      "attachment_name, attachment_size, attachment_extension, attachment_mime, " +
      "storage_bucket, storage_path, " +
      "sent_at, delivered_at, read_at, " +
      "created_at, updated_at, deleted_at, deleted_by"
    )
    .single();

  if (error) {
    // Best-effort cleanup of orphaned upload
    await supabase.storage.from("message-attachments").remove([storagePath]);
    return { data: null, error: error.message };
  }

  return { data: normalizeMessage(data), error: null };
}

/**
 * Mark a conversation as read for the current user.
 * Calls the security-definer RPC which updates producer_last_read_at or
 * filmmaker_last_read_at and batch-marks individual messages.
 */
export async function markConversationRead(
  conversationId: string
): Promise<void> {
  const supabase = createClient();
  await supabase.rpc("mark_conversation_read", {
    p_conversation_id: conversationId,
  });
}

/**
 * Generate a time-limited signed URL for a private attachment.
 * Expiry: 1 hour. Never cache; generate fresh on demand.
 */
export async function getSignedUrl(
  bucket: string,
  path: string,
  expiresIn = 3600
): Promise<ServiceResult<string>> {
  const supabase = createClient();

  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, expiresIn);

  if (error || !data?.signedUrl) {
    return { data: null, error: error?.message ?? "Failed to generate signed URL." };
  }

  return { data: data.signedUrl, error: null };
}
