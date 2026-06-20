"use client";
// features/messages/MessageItem.tsx

import React, { forwardRef } from "react";
import type { MessageOrOptimistic } from "./message.types";
import { isOptimistic, formatTimestamp } from "./message.utils";
import { AttachmentCard } from "./AttachmentCard";

interface Props {
  msg:           MessageOrOptimistic;
  isMine:        boolean;
  getUrl:        (bucket: string, path: string) => Promise<string | null>;
  onRetry?:      (clientId: string) => void;
}

const DeliveryMark = React.memo(function DeliveryMark({
  status,
}: {
  status: MessageOrOptimistic["delivery_status"];
}) {
  if (status === "sending") {
    return (
      <i
        className="ti ti-clock text-ash/60"
        style={{ fontSize: 11 }}
        aria-label="Sending"
        title="Sending…"
      />
    );
  }
  if (status === "failed") {
    return (
      <i
        className="ti ti-alert-circle text-red-500"
        style={{ fontSize: 11 }}
        aria-label="Failed to send"
        title="Failed to send"
      />
    );
  }
  if (status === "read") {
    return (
      <span className="text-gold text-[10px]" aria-label="Read" title="Read">✓✓</span>
    );
  }
  if (status === "delivered") {
    return (
      <span className="text-ash text-[10px]" aria-label="Delivered" title="Delivered">✓✓</span>
    );
  }
  // sent
  return (
    <span className="text-ash text-[10px]" aria-label="Sent" title="Sent">✓</span>
  );
});

export const MessageItem = React.memo(
  forwardRef<HTMLDivElement, Props>(function MessageItem(
    { msg, isMine, getUrl, onRetry },
    ref
  ) {
    const deleted  = !isOptimistic(msg) && msg.deleted_at !== null;
    const hasAttachment =
      !isOptimistic(msg) &&
      msg.storage_path !== null &&
      msg.storage_bucket !== null;

    return (
      <div
        ref={ref}
        data-msg-id={msg.id}
        className={`flex ${isMine ? "justify-end" : "justify-start"}`}
        aria-label={isMine ? "Your message" : "Received message"}
      >
        <div
          className="flex flex-col gap-1"
          style={{ maxWidth: "min(520px, 72%)" }}
        >
          {/* ── Message card ── */}
          <div
            className={`
              px-4 py-3
              border
              text-[14px] leading-[1.6]
              ${
                deleted
                  ? "border-line bg-ivory text-ash italic"
                  : isMine
                  ? "border-ink bg-ink text-ivory"
                  : "border-line bg-white text-ink"
              }
            `}
            style={{ borderRadius: 2 }}
          >
            {deleted ? (
              <span className="text-[13px]">This message has been removed.</span>
            ) : (
              <>
                {msg.message && (
                  <p className="whitespace-pre-wrap break-words">{msg.message}</p>
                )}

                {hasAttachment && !isOptimistic(msg) && (
                  <AttachmentCard
                    name={msg.attachment_name ?? "Attachment"}
                    size={msg.attachment_size}
                    extension={msg.attachment_extension}
                    bucket={msg.storage_bucket!}
                    path={msg.storage_path!}
                    getUrl={getUrl}
                  />
                )}

                {/* Optimistic attachment placeholder */}
                {isOptimistic(msg) && msg.attachment_name && (
                  <div
                    className="flex items-center gap-3 px-4 py-3 mt-2 border border-white/20 bg-white/10"
                    style={{ borderRadius: 2, maxWidth: 300 }}
                  >
                    <i
                      className="ti ti-loader animate-spin"
                      style={{ fontSize: 18, flexShrink: 0 }}
                      aria-hidden="true"
                    />
                    <p className="text-[13px] truncate">{msg.attachment_name}</p>
                  </div>
                )}
              </>
            )}
          </div>

          {/* ── Meta row ── */}
          <div
            className={`flex items-center gap-1.5 px-0.5 ${
              isMine ? "justify-end" : "justify-start"
            }`}
          >
            <span className="text-[10px] tracking-[0.04em] text-ash select-none">
              {formatTimestamp(msg.sent_at)}
            </span>

            {isMine && <DeliveryMark status={msg.delivery_status} />}

            {isMine && msg.delivery_status === "failed" && onRetry && isOptimistic(msg) && (
              <button
                onClick={() => onRetry(msg._client_id)}
                className="text-[10px] tracking-[0.08em] uppercase text-red-500 hover:text-red-700 ml-1"
                aria-label="Retry sending this message"
              >
                Retry
              </button>
            )}
          </div>
        </div>
      </div>
    );
  })
);
