"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { openThread } from "@/lib/admin-messaging";

export default function MessageUserButton({ userId }: { userId: string }) {
  const router = useRouter();
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();

  return (
    <div className="inline-flex flex-col items-start gap-1">
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          start(async () => {
            setErr(null);
            const res = await openThread(userId);
            if ("error" in res) {
              setErr(res.error);
              return;
            }
            router.push(`/admin/messages/${res.threadId}`);
          })
        }
        className="btn-ghost disabled:opacity-40"
      >
        {pending ? "Opening…" : "Message"}
      </button>
      {err && <span className="text-[11px] text-red-600">{err}</span>}
    </div>
  );
}
