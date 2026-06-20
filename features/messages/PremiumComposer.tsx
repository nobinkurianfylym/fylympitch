"use client";
// features/messages/PremiumComposer.tsx
// Fixed-bottom composer:
//  - Auto-expanding textarea (Enter = send, Shift+Enter = newline)
//  - Attachment support: PDF, DOCX, XLSX, ZIP (max 50 MB)
//  - Upload validation before send
//  - Rate limit error display

import React, {
  useState,
  useRef,
  useEffect,
  useCallback,
} from "react";
import type { SendPayload } from "./useProjectChat";
import {
  validateAttachment,
  formatFileSize,
  getFileIcon,
} from "./message.utils";
import {
  ALLOWED_ATTACHMENT_EXTENSIONS,
  MAX_ATTACHMENT_BYTES,
} from "./message.types";

interface Props {
  onSend:    (payload: SendPayload) => Promise<void>;
  sendError: string | null;
  onClearError: () => void;
  disabled?: boolean;
}

const ACCEPT = ALLOWED_ATTACHMENT_EXTENSIONS.map((e) => `.${e}`).join(",");

export function PremiumComposer({ onSend, sendError, onClearError, disabled }: Props) {
  const [text,            setText]           = useState("");
  const [stagedFile,      setStagedFile]     = useState<File | null>(null);
  const [stagedExtension, setStagedExtension] = useState<string>("");
  const [fileError,       setFileError]      = useState<string | null>(null);
  const [sending,         setSending]        = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileRef     = useRef<HTMLInputElement>(null);

  // ── Auto-resize textarea ──────────────────────────────────────
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 140)}px`;
  }, [text]);

  // ── File selection ────────────────────────────────────────────
  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = ""; // reset so same file can be re-selected

    const validation = validateAttachment(file);
    if (!validation.valid) {
      setFileError(validation.error ?? "Invalid file.");
      return;
    }

    setFileError(null);
    onClearError();
    setStagedFile(file);
    setStagedExtension(validation.extension!);
  }, [onClearError]);

  const removeStagedFile = useCallback(() => {
    setStagedFile(null);
    setStagedExtension("");
    setFileError(null);
  }, []);

  // ── Send ──────────────────────────────────────────────────────
  const handleSend = useCallback(async () => {
    if (sending || disabled) return;
    if (!text.trim() && !stagedFile) return;

    setSending(true);
    onClearError();

    const payload: SendPayload = {
      text:          text.trim() || undefined,
      file:          stagedFile ?? undefined,
      fileExtension: stagedFile ? stagedExtension : undefined,
    };

    setText("");
    setStagedFile(null);
    setStagedExtension("");

    await onSend(payload);
    setSending(false);

    // Refocus textarea after send
    textareaRef.current?.focus();
  }, [sending, disabled, text, stagedFile, stagedExtension, onSend, onClearError]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  }, [handleSend]);

  const canSend = !sending && !disabled && (text.trim().length > 0 || stagedFile !== null);
  const error   = fileError ?? sendError;

  return (
    <div
      className="border-t border-line bg-white"
      role="region"
      aria-label="Message composer"
    >
      {/* ── Staged attachment ── */}
      {stagedFile && (
        <div className="px-5 pt-3">
          <div
            className="flex items-center gap-3 px-3 py-2 border border-line bg-ivory"
            style={{ borderRadius: 2, maxWidth: 300 }}
          >
            <i
              className={`ti ${getFileIcon(stagedExtension)} text-ash`}
              style={{ fontSize: 18, flexShrink: 0 }}
              aria-hidden="true"
            />
            <div className="flex-1 min-w-0">
              <p className="text-[12px] font-medium truncate">{stagedFile.name}</p>
              <p className="text-[10px] text-ash">
                {stagedExtension.toUpperCase()} · {formatFileSize(stagedFile.size)}
              </p>
            </div>
            <button
              onClick={removeStagedFile}
              aria-label={`Remove ${stagedFile.name}`}
              className="text-ash hover:text-ink transition-colors shrink-0"
            >
              <i className="ti ti-x" style={{ fontSize: 14 }} aria-hidden="true" />
            </button>
          </div>
        </div>
      )}

      {/* ── Error ── */}
      {error && (
        <div className="px-5 pt-2">
          <p
            role="alert"
            className="text-[11px] tracking-[0.04em] text-red-600"
          >
            {error}
          </p>
        </div>
      )}

      {/* ── Input row ── */}
      <div className="flex items-end gap-3 px-5 py-3">
        {/* Attach */}
        <button
          onClick={() => fileRef.current?.click()}
          disabled={disabled}
          aria-label="Attach file"
          title="Attach file (PDF, DOCX, XLSX, ZIP · max 50 MB)"
          className="
            shrink-0 p-2 text-ash
            hover:text-ink hover:bg-parchment
            disabled:opacity-30
            transition-colors
          "
          style={{ borderRadius: 2 }}
        >
          <i className="ti ti-paperclip" style={{ fontSize: 18 }} aria-hidden="true" />
        </button>

        <input
          ref={fileRef}
          type="file"
          accept={ACCEPT}
          className="hidden"
          onChange={handleFileChange}
          aria-hidden="true"
          tabIndex={-1}
        />

        {/* Textarea */}
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => { setText(e.target.value); onClearError(); }}
          onKeyDown={handleKeyDown}
          placeholder="Write a message…"
          rows={1}
          disabled={disabled}
          aria-label="Message text"
          aria-multiline="true"
          className="
            flex-1 resize-none
            bg-transparent
            text-[14px] text-ink
            placeholder:text-ash/60
            leading-[1.55]
            py-2 pr-2
            focus:outline-none
            disabled:opacity-40
          "
          style={{ maxHeight: 140 }}
        />

        {/* Send */}
        <button
          onClick={() => void handleSend()}
          disabled={!canSend}
          aria-label="Send message"
          title="Send (Enter)"
          className="
            shrink-0
            px-4 py-2
            text-[11px] tracking-[0.14em] uppercase font-medium
            border border-ink text-ink
            hover:bg-ink hover:text-ivory
            disabled:opacity-25 disabled:cursor-not-allowed
            transition-colors
          "
          style={{ borderRadius: 2 }}
        >
          {sending ? (
            <i className="ti ti-loader animate-spin" style={{ fontSize: 14 }} aria-hidden="true" />
          ) : (
            "Send"
          )}
        </button>
      </div>

      {/* ── Keyboard hint ── */}
      <div className="px-5 pb-3 flex items-center gap-4">
        <p className="text-[10px] tracking-[0.1em] text-ash/50 select-none">
          Enter to send · Shift+Enter for new line
        </p>
        <p className="text-[10px] tracking-[0.1em] text-ash/40 select-none">
          Attach: {ALLOWED_ATTACHMENT_EXTENSIONS.map((e) => e.toUpperCase()).join(", ")} · max {formatFileSize(MAX_ATTACHMENT_BYTES)}
        </p>
      </div>
    </div>
  );
}
