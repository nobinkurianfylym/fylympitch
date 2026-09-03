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
  const [sendEmail, setSendEmail] = useState(false);
  const [ok, setOk] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function send() {
    if (!body.trim() || pending) return;
    if (sendEmail && !subject.trim()) {
      setErr("Subject is required when sending as email.");
      return;
    }
    setErr(null);
    setOk(null);
    start(async () => {
      const res = await sendBroadcast({
        audience,
        subject: subject.trim() || undefined,
        body: body.trim(),
        sendEmail,
      });
      if ("error" in res) {
        setErr(res.error);
        return;
      }
      let msg = `In-app notification sent to ${res.recipients.toLocaleString()} ${res.recipients === 1 ? "person" : "people"}.`;
      if (res.emailsSent != null) {
        msg += ` Emails delivered: ${res.emailsSent.toLocaleString()}`;
        if (res.emailsFailed) msg += ` (${res.emailsFailed} failed)`;
        msg += ".";
      }
      setOk(msg);
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

      <label className="field-label">
        Subject{sendEmail ? " (required for email)" : " (optional)"}
      </label>
      <input
        value={subject}
        onChange={(e) => setSubject(e.target.value)}
        placeholder="e.g. New funds added this week on PITCH.FYLYM"
        className="field mb-5"
      />

      <label className="field-label">Message</label>
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={6}
        placeholder="Write your announcement — new fund added, platform update, etc."
        className="field resize-none"
      />

      {/* Email toggle */}
      <label className="flex items-start gap-3 cursor-pointer mt-5 mb-1 select-none">
        <button
          type="button"
          role="switch"
          aria-checked={sendEmail}
          onClick={() => setSendEmail((v) => !v)}
          className={`relative mt-0.5 inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${
            sendEmail ? "bg-gold" : "bg-ash/30"
          }`}
        >
          <span
            className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform ${
              sendEmail ? "translate-x-4" : "translate-x-0.5"
            }`}
          />
        </button>
        <span className="text-[13px] text-ink leading-snug">
          Also send as email to all registered users
          <span className="block text-[11px] text-ash mt-0.5">
            Sends a formatted PITCH.FYLYM branded email via Resend to every account in the selected audience.
          </span>
        </span>
      </label>

      <div className="flex items-center justify-between gap-4 mt-5">
        <div className="text-[12px] max-w-xs leading-relaxed">
          {err && <span className="text-red-600">{err}</span>}
          {ok && <span className="text-green-700">{ok}</span>}
        </div>
        <button
          onClick={send}
          disabled={pending || !body.trim()}
          className="btn-gold disabled:opacity-40 shrink-0"
        >
          {pending ? "Sending…" : sendEmail ? "Send broadcast + email" : "Send broadcast"}
        </button>
      </div>
      <p className="text-[11px] text-ash mt-3 leading-relaxed">
        In-app notifications are delivered to each recipient&rsquo;s PITCH.FYLYM inbox.
        {sendEmail
          ? " Emails are sent via Resend in batches of 100 and require a subject line."
          : " Toggle email above to also send a real email."}
      </p>
    </div>
  );
}
