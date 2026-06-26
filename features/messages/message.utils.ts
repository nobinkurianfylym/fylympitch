// features/messages/message.utils.ts
// Pure utility functions — no side effects, no imports from Supabase.

import type {
  Message,
  MessageOrOptimistic,
  OptimisticMessage,
  ConversationRow,
  ConversationListItem,
  MessageDeliveryStatus,
  AllowedAttachmentExtension,
  ConversationRole,
} from "./message.types";
import {
  ALLOWED_ATTACHMENT_EXTENSIONS,
  ALLOWED_MIME_TYPES,
  MAX_ATTACHMENT_BYTES,
} from "./message.types";

// ── Delivery status ───────────────────────────────────────────

export function computeDeliveryStatus(msg: {
  sent_at: string | null;
  delivered_at: string | null;
  read_at: string | null;
}): MessageDeliveryStatus {
  if (msg.read_at)      return "read";
  if (msg.delivered_at) return "delivered";
  if (msg.sent_at)      return "sent";
  return "sent";
}

export function isOptimistic(
  msg: MessageOrOptimistic
): msg is OptimisticMessage {
  return "_optimistic" in msg && msg._optimistic === true;
}

// ── Conversation transformation ────────────────────────────────

export function toConversationListItem(
  row: ConversationRow,
  currentUserId: string
): ConversationListItem {
  const myRole: ConversationRole =
    row.producer_id === currentUserId ? "producer" : "filmmaker";

  const counterparty =
    myRole === "producer"
      ? row.filmmaker ?? { id: row.filmmaker_id, full_name: null, company: null, avatar_url: null }
      : row.producer  ?? { id: row.producer_id,  full_name: null, company: null, avatar_url: null };

  const myLastReadAt =
    myRole === "producer"
      ? row.producer_last_read_at
      : row.filmmaker_last_read_at;

  const hasUnread =
    row.last_message_at !== null &&
    (myLastReadAt === null ||
      new Date(row.last_message_at) > new Date(myLastReadAt));

  return {
    id:              row.id,
    project_id:      row.project_id,
    project_title:   row.project?.title ?? "Untitled Project",
    producer_id:     row.producer_id,
    filmmaker_id:    row.filmmaker_id,
    my_role:         myRole,
    counterparty: {
      id:         counterparty.id,
      full_name:  counterparty.full_name,
      company:    counterparty.company,
      avatar_url: counterparty.avatar_url,
    },
    last_message:     row.last_message,
    last_message_at:  row.last_message_at,
    my_last_read_at:  myLastReadAt,
    has_unread:       hasUnread,
  };
}

// ── Date grouping ─────────────────────────────────────────────

export function getDateLabel(isoDate: string): string {
  const d   = new Date(isoDate);
  const now = new Date();

  const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth()    === b.getMonth()    &&
    a.getDate()     === b.getDate();

  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);

  if (sameDay(d, now))       return "TODAY";
  if (sameDay(d, yesterday)) return "YESTERDAY";

  // Same year — omit year
  if (d.getFullYear() === now.getFullYear()) {
    return d.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" }).toUpperCase();
  }

  return d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }).toUpperCase();
}

export function shouldShowDateDivider(
  messages: MessageOrOptimistic[],
  index: number
): boolean {
  if (index === 0) return true;
  const prev    = messages[index - 1];
  const current = messages[index];
  const prevDate    = new Date(prev.sent_at).toDateString();
  const currentDate = new Date(current.sent_at).toDateString();
  return prevDate !== currentDate;
}

// ── Timestamp formatting ──────────────────────────────────────

export function formatRelativeTime(isoDate: string): string {
  const d    = new Date(isoDate);
  const now  = new Date();
  const diff = (now.getTime() - d.getTime()) / 1000;

  if (diff < 60)      return "just now";
  if (diff < 3_600)   return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86_400) {
    return d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  }
  if (diff < 7 * 86_400) {
    return d.toLocaleDateString("en-GB", { weekday: "short" });
  }
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

export function formatTimestamp(isoDate: string): string {
  return new Date(isoDate).toLocaleTimeString("en-GB", {
    hour:   "2-digit",
    minute: "2-digit",
  });
}

// ── File size ─────────────────────────────────────────────────

export function formatFileSize(bytes: number): string {
  if (bytes < 1_024)           return `${bytes} B`;
  if (bytes < 1_048_576)       return `${(bytes / 1_024).toFixed(1)} KB`;
  return `${(bytes / 1_048_576).toFixed(1)} MB`;
}

// ── Attachment validation ─────────────────────────────────────

export interface AttachmentValidationResult {
  valid: boolean;
  error?: string;
  extension?: AllowedAttachmentExtension;
}

export function validateAttachment(file: File): AttachmentValidationResult {
  if (file.size > MAX_ATTACHMENT_BYTES) {
    return { valid: false, error: `File exceeds 50 MB limit (${formatFileSize(file.size)}).` };
  }

  const parts = file.name.split(".");
  const rawExt = parts.length > 1 ? parts[parts.length - 1].toLowerCase() : "";

  if (!ALLOWED_ATTACHMENT_EXTENSIONS.includes(rawExt as AllowedAttachmentExtension)) {
    return {
      valid: false,
      error: `Unsupported file type. Accepted: ${ALLOWED_ATTACHMENT_EXTENSIONS.join(", ").toUpperCase()}.`,
    };
  }

  if (!ALLOWED_MIME_TYPES.includes(file.type)) {
    return {
      valid: false,
      error: `MIME type not permitted. Upload a PDF, DOCX, XLSX, or ZIP file.`,
    };
  }

  return {
    valid:     true,
    extension: rawExt as AllowedAttachmentExtension,
  };
}

/** Generate a server-safe storage path — never use the raw client filename. */
export function buildAttachmentPath(
  conversationId: string,
  senderId: string,
  extension: string
): string {
  const timestamp = Date.now();
  const random    = Math.random().toString(36).slice(2, 8);
  return `${conversationId}/${senderId}/${timestamp}-${random}.${extension}`;
}

// ── Initials ──────────────────────────────────────────────────

export function getInitials(name: string | null): string {
  if (!name) return "?";
  return name
    .split(" ")
    .filter(Boolean)
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

// ── Optimistic message factory ────────────────────────────────

export function createOptimisticMessage(
  clientId: string,
  conversationId: string,
  senderId: string,
  payload: { message?: string; attachmentName?: string; attachmentSize?: number; attachmentExtension?: string; attachmentMime?: string }
): OptimisticMessage {
  const now = new Date().toISOString();
  return {
    id:                   clientId,
    _client_id:           clientId,
    _optimistic:          true,
    conversation_id:      conversationId,
    sender_id:            senderId,
    message:              payload.message ?? null,
    attachment_name:      payload.attachmentName ?? null,
    attachment_size:      payload.attachmentSize ?? null,
    attachment_extension: payload.attachmentExtension ?? null,
    attachment_mime:      payload.attachmentMime ?? null,
    storage_bucket:       null,
    storage_path:         null,
    sent_at:              now,
    delivered_at:         null,
    read_at:              null,
    created_at:           now,
    updated_at:           now,
    deleted_at:           null,
    deleted_by:           null,
    delivery_status:      "sending",
  };
}

// ── Message normalisation from DB row ─────────────────────────

export function normalizeMessage(
  row: Record<string, any>
): Message {
  return {
    id:                   row.id,
    conversation_id:      row.conversation_id,
    sender_id:            row.sender_id,
    message:              row.message ?? null,
    attachment_name:      row.attachment_name ?? null,
    attachment_size:      row.attachment_size ?? null,
    attachment_extension: row.attachment_extension ?? null,
    attachment_mime:      row.attachment_mime ?? null,
    storage_bucket:       row.storage_bucket ?? null,
    storage_path:         row.storage_path ?? null,
    sent_at:              row.sent_at,
    delivered_at:         row.delivered_at ?? null,
    read_at:              row.read_at ?? null,
    created_at:           row.created_at,
    updated_at:           row.updated_at,
    deleted_at:           row.deleted_at ?? null,
    deleted_by:           row.deleted_by ?? null,
    delivery_status:      computeDeliveryStatus(row as { sent_at: string | null; delivered_at: string | null; read_at: string | null }),
  };
}

// ── Conversation search (client-side) ─────────────────────────

export function filterConversations(
  conversations: ConversationListItem[],
  query: string
): ConversationListItem[] {
  if (!query.trim()) return conversations;
  const q = query.toLowerCase().trim();
  return conversations.filter((c) => {
    return (
      c.project_title.toLowerCase().includes(q) ||
      (c.counterparty.full_name?.toLowerCase().includes(q) ?? false) ||
      (c.counterparty.company?.toLowerCase().includes(q) ?? false) ||
      (c.last_message?.toLowerCase().includes(q) ?? false)
    );
  });
}

// ── File icon ─────────────────────────────────────────────────

export function getFileIcon(extension: string | null): string {
  switch (extension?.toLowerCase()) {
    case "pdf":  return "ti-file-type-pdf";
    case "docx": return "ti-file-type-doc";
    case "xlsx": return "ti-file-type-xls";
    case "zip":  return "ti-file-zip";
    default:     return "ti-file";
  }
}
