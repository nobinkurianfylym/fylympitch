"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { sendBroadcast, type BroadcastAudience } from "@/lib/admin-messaging";

const AUDIENCES: { value: BroadcastAudience; label: string }[] = [
  { value: "all", label: "Everyone" },
  { value: "filmmakers", label: "Filmmakers" },
  { value: "producers", label: "Producers" },
];

export default function BroadcastComposer() {
  const router = useRouter();
  const [audience, setAudience] = useState<BroadcastAudience>("all");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [ok, setOk] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function send() {
    if (!body.trim() || pending) return;
    setErr(null);
    setOk(null);
    start(async () => {
      const res = await sendBroadcast({
        audience,
        subject: subject.trim() || undefined,
        body: body.trim(),
      });
      if ("error" in res) {
        setErr(res.error);
        return;
      }
      setOk(
        `Sent to ${res.recipients.toLocaleString()} ${res.recipients === 1 ? "person" : "people"}.`,
      );
      setSubject("");
      setBody("");
      router.refresh();
    });
  }

  return (
    <div className="card p-6">
      <p className="eyebrow">Broadcast</p>
      <h2 className="font-display text-[20px] font-normal mt-1 mb-5">Announce to users</h2>

      <label className="field-label">Audience</label>
      <div className="flex flex-wrap gap-2 mb-5">
        {AUDIENCES.map((a) => (
          <button
            key={a.value}
            type="button"
            onClick={() => setAudience(a.value)}
            className={`btn-ghost ${audience === a.value ? "border-gold text-ink" : ""}`}
          >
            {a.label}
          </button>
        ))}
      </div>

      <label className="field-label">Subject (optional)</label>
      <input
        value={subject}
        onChange={(e) => setSubject(e.target.value)}
        placeholder="A message from PITCH.FYLYM"
        className="field mb-5"
      />

      <label className="field-label">Message</label>
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={4}
        placeholder="Write your announcement…"
        className="field resize-none"
      />

      <div className="flex items-center justify-between gap-4 mt-4">
        <div className="text-[12px]">
          {err && <span className="text-red-600">{err}</span>}
          {ok && <span className="text-green-700">{ok}</span>}
        </div>
        <button
          onClick={send}
          disabled={pending || !body.trim()}
          className="btn-gold disabled:opacity-40"
        >
          {pending ? "Sending…" : "Send broadcast"}
        </button>
      </div>
      <p className="text-[11px] text-ash mt-3 leading-relaxed">
        Delivered to each recipient&rsquo;s notifications and their PITCH.FYLYM inbox. Announcements
        are one-way — recipients can&rsquo;t reply to a broadcast.
      </p>
    </div>
  );
}
