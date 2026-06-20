// features/messages/message.types.ts
// Strict types for the FYLYMPITCH project-scoped messaging system.
// No `any`. No placeholders.

// ── Primitives ────────────────────────────────────────────────

export type ConversationRole = "producer" | "filmmaker";

/** Delivery status is computed from timestamps — never stored as enum. */
export type MessageDeliveryStatus =
  | "sending"    // optimistic — not yet confirmed by server
  | "sent"       // sent_at set, delivered_at null
  | "delivered"  // delivered_at set, read_at null
  | "read"       // read_at set
  | "failed";    // optimistic failed — can retry

// ── Conversation ──────────────────────────────────────────────

export interface ConversationParty {
  id: string;
  full_name: string | null;
  company: string | null;
  avatar_url: string | null;
}

/** Raw conversation row joined with project + both parties. */
export interface ConversationRow {
  id: string;
  project_id: string;
  producer_id: string;
  filmmaker_id: string;
  last_message: string | null;
  last_message_at: string | null;
  producer_last_read_at: string | null;
  filmmaker_last_read_at: string | null;
  conversation_type: "project";
  created_at: string;
  updated_at: string;
  project: { title: string } | null;
  producer: ConversationParty | null;
  filmmaker: ConversationParty | null;
}

/** Enriched view used in the inbox list — viewer-relative. */
export interface ConversationListItem {
  id: string;
  project_id: string;
  project_title: string;
  producer_id: string;
  filmmaker_id: string;
  my_role: ConversationRole;
  counterparty: ConversationParty;
  last_message: string | null;
  last_message_at: string | null;
  my_last_read_at: string | null;
  /** True if last_message_at > my_last_read_at */
  has_unread: boolean;
}

// ── Message ───────────────────────────────────────────────────

export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  message: string | null;
  // Attachment — stored metadata only; URLs are always signed (never stored)
  attachment_name: string | null;
  attachment_size: number | null;
  attachment_extension: string | null;
  attachment_mime: string | null;
  storage_bucket: string | null;
  storage_path: string | null;
  // Delivery timestamps
  sent_at: string;
  delivered_at: string | null;
  read_at: string | null;
  // Audit
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  deleted_by: string | null;
  // Computed client-side
  delivery_status: MessageDeliveryStatus;
}

/** Optimistic message: exists in UI before server confirmation. */
export interface OptimisticMessage {
  /** Temporary client-generated UUID (replaced by server UUID on confirmation). */
  id: string;
  _client_id: string;
  _optimistic: true;
  conversation_id: string;
  sender_id: string;
  message: string | null;
  attachment_name: string | null;
  attachment_size: number | null;
  attachment_extension: string | null;
  attachment_mime: string | null;
  storage_bucket: null;
  storage_path: null;
  sent_at: string;
  delivered_at: null;
  read_at: null;
  created_at: string;
  updated_at: string;
  deleted_at: null;
  deleted_by: null;
  delivery_status: "sending" | "failed";
}

export type MessageOrOptimistic = Message | OptimisticMessage;

// ── Attachment ────────────────────────────────────────────────

export type AllowedAttachmentExtension = "pdf" | "docx" | "xlsx" | "zip";
export const ALLOWED_ATTACHMENT_EXTENSIONS: AllowedAttachmentExtension[] = [
  "pdf",
  "docx",
  "xlsx",
  "zip",
];
export const ALLOWED_MIME_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/zip",
  "application/x-zip-compressed",
];
export const MAX_ATTACHMENT_BYTES = 52_428_800; // 50 MB

export interface AttachmentMeta {
  name: string;
  size: number;
  extension: AllowedAttachmentExtension;
  mime: string;
  storagePath: string;
  storageBucket: string;
}

// ── Pagination ────────────────────────────────────────────────

export interface MessageCursor {
  sent_at: string;
  id: string;
}

export interface PaginatedMessages {
  messages: Message[];
  nextCursor: MessageCursor | null;
  hasMore: boolean;
}

export const MESSAGE_PAGE_SIZE = 30;

// ── Send payload ──────────────────────────────────────────────

export interface SendMessagePayload {
  message?: string;
  attachment?: AttachmentMeta;
}

// ── Service result ────────────────────────────────────────────

export type ServiceResult<T> =
  | { data: T; error: null }
  | { data: null; error: string };

// ── Initiation ────────────────────────────────────────────────

export interface InitiateConversationPayload {
  projectId: string;
  producerId: string;
  filmakerId: string;
}

// ── Realtime events ───────────────────────────────────────────

export interface RealtimeMessageInsert {
  type: "INSERT";
  table: "messages";
  new: Omit<Message, "delivery_status">;
}

export interface RealtimeMessageUpdate {
  type: "UPDATE";
  table: "messages";
  new: Omit<Message, "delivery_status">;
  old: Partial<Omit<Message, "delivery_status">>;
}

export interface RealtimeConversationUpdate {
  type: "UPDATE";
  table: "conversations";
  new: Partial<ConversationRow>;
  old: Partial<ConversationRow>;
}
