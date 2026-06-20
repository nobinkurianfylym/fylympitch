"use client";
// components/MessageButton.tsx
// Entry point for initiating a project conversation.
// Requires projectId + producerId + filmakerId — no free-form DMs.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { initiateProjectConversation } from "@/features/messages/message.service";

interface Props {
  projectId:  string;
  producerId: string;
  filmakerId: string;
  label?:     string;
  className?: string;
  /** Override redirect target (defaults to /producer/messages for producers) */
  inboxPath?: string;
}

export default function MessageButton({
  projectId,
  producerId,
  filmakerId,
  label     = "Message filmmaker regarding this project",
  className,
  inboxPath = "/producer/messages",
}: Props) {
  const router  = useRouter();
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  async function handleClick() {
    setLoading(true);
    setError(null);

    const result = await initiateProjectConversation({
      projectId,
      producerId,
      filmakerId,
    });

    if (result.error) {
      setError(result.error);
      setLoading(false);
      return;
    }

    router.push(`${inboxPath}?conv=${result.data}`);
  }

  return (
    <div>
      <button
        onClick={handleClick}
        disabled={loading}
        className={
          className ??
          "btn-ghost gap-2 disabled:opacity-40 text-[12px] tracking-[0.1em] uppercase"
        }
      >
        <i
          className="ti ti-message-circle"
          style={{ fontSize: 14, verticalAlign: "-2px" }}
          aria-hidden="true"
        />
        {loading ? "Opening…" : label}
      </button>
      {error && (
        <p className="text-[11px] text-red-600 mt-1 tracking-[0.04em]">{error}</p>
      )}
    </div>
  );
}
