"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { sendAdminMessage, markThreadRead } from "@/lib/admin-messaging";

export type AdminChatMessage = {
  id: string;
  is_admin: boolean;
  body: string;
  sent_at: string;
};

/**
 * Message thread + composer shared by the admin thread view and the user's
 * /support page. `viewerIsAdmin` decides which bubbles are "mine".
 */
export default function AdminChat({
  threadId,
  viewerIsAdmin,
  initialMessages,
  emptyHint,
}: {
  threadId: string;
  viewerIsAdmin: boolean;
  initialMessages: AdminChatMessage[];
  emptyHint?: string;
}) {
  const router = useRouter();
  const [messages, setMessages] = useState<AdminChatMessage[]>(initialMessages);
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const bottomRef = useRef<HTMLDivElement>(null);

  // Reconcile with fresh server data after router.refresh().
  useEffect(() => setMessages(initialMessages), [initialMessages]);

  // Mark read on open.
  useEffect(() => {
    markThreadRead(threadId).catch(() => {});
  }, [threadId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  function submit() {
    const body = value.trim();
    if (!body || pending) return;
    setError(null);
    const optimistic: AdminChatMessage = {
      id: `tmp-${Date.now()}`,
      is_admin: viewerIsAdmin,
      body,
      sent_at: new Date().toISOString(),
    };
    setMessages((m) => [...m, optimistic]);
    setValue("");
    start(async () => {
      const res = await sendAdminMessage(threadId, body);
      if ("error" in res) {
        setError(res.error);
        setMessages((m) => m.filter((x) => x.id !== optimistic.id));
        setValue(body);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col">
      <div className="space-y-3 max-h-[52vh] overflow-y-auto pr-1">
        {messages.length === 0 ? (
          <p className="text-[13px] text-ash py-6">{emptyHint ?? "No messages yet."}</p>
        ) : (
          messages.map((m) => {
            const mine = m.is_admin === viewerIsAdmin;
            return (
              <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                <div
                  className={`px-4 py-3 border text-[14px] leading-[1.6] whitespace-pre-wrap ${
                    mine
                      ? "rounded-2xl rounded-br-md bg-ink text-ivory border-ink"
                      : "rounded-2xl rounded-bl-md bg-white/80 text-ink border-line"
                  }`}
                  style={{ maxWidth: "min(520px, 78%)" }}
                >
                  {m.body}
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      {error && <p className="text-[12px] text-red-600 mt-2">{error}</p>}

      <div className="mt-4 flex items-end gap-2">
        <textarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submit();
          }}
          rows={2}
          placeholder={viewerIsAdmin ? "Write a message…" : "Reply to the PITCH.FYLYM team…"}
          className="field !py-2 resize-none flex-1"
        />
        <button
          onClick={submit}
          disabled={pending || !value.trim()}
          className="btn-gold disabled:opacity-40 shrink-0"
        >
          {pending ? "Sending…" : "Send"}
        </button>
      </div>
      <p className="text-[10px] text-ash mt-2 tracking-[0.06em]">⌘ / Ctrl + Enter to send</p>
    </div>
  );
}
