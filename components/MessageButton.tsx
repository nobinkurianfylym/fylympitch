"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { findOrCreateConversation } from "@/lib/actions";

export default function MessageButton({
  otherUserId,
  label = "Message",
  projectId,
  className,
}: {
  otherUserId: string;
  label?: string;
  projectId?: string;
  className?: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setLoading(true);
    setError(null);
    const result = await findOrCreateConversation(otherUserId, projectId);
    if (result?.error) {
      setError(result.error);
      setLoading(false);
      return;
    }
    if (result?.conversationId) {
      router.push(`/dashboard/messages?conv=${result.conversationId}`);
    }
    setLoading(false);
  }

  return (
    <div>
      <button
        onClick={handleClick}
        disabled={loading}
        className={className ?? "btn-ghost gap-2 disabled:opacity-50"}
      >
        <i className="ti ti-message-circle" style={{ fontSize: 15, verticalAlign: "-2px" }} aria-hidden="true" />
        {loading ? "Opening…" : label}
      </button>
      {error && <p className="text-[12px] text-red-600 mt-1">{error}</p>}
    </div>
  );
}
