"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { sendBroadcast, type BroadcastAudience } from "@/lib/admin-messaging";

const AUDIENCES: { value: BroadcastAudience; label: string; who: string }[] = [
  { value: "all",        label: "Everyone",   who: "Every account except admins." },
  { value: "filmmakers", label: "Filmmakers", who: "Accounts with the filmmaker role." },
  { value: "producers",  label: "Producers",  who: "Producers, investors and organizations." },
];

const MAX_FILE_MB = 25;
const MAX_FILES   = 5;

type Attachment = { name: string; url: string; size: number };

function prettySize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export default function BroadcastComposer() {
  const router = useRouter();
  const [audience, setAudience] = useState<BroadcastAudience>("all");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [sendEmail, setSendEmail] = useState(false);
  const [copyMe, setCopyMe] = useState(true);
  const [files, setFiles] = useState<Attachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const [ok, setOk] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const fileInput = useRef<HTMLInputElement>(null);

  const selected = AUDIENCES.find((a) => a.value === audience)!;

  async function handleFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = Array.from(e.target.files ?? []);
    if (!picked.length) return;
    e.target.value = "";                       // allow re-picking the same file
    if (files.length + picked.length > MAX_FILES) {
      setErr(`Up to ${MAX_FILES} attachments per broadcast.`);
      return;
    }
    setErr(null);
    setUploading(true);
    const supabase = createClient();
    const added: Attachment[] = [];
    for (const f of picked) {
      if (f.size > MAX_FILE_MB * 1024 * 1024) {
        setErr(`"${f.name}" is over ${MAX_FILE_MB} MB.`);
        continue;
      }
      const safe = f.name.replace(/[^a-zA-Z0-9_.-]/g, "_");
      const path = `${crypto.randomUUID()}/${safe}`;
      const { error } = await supabase.storage
        .from("broadcast-attachments")
        .upload(path, f, { contentType: f.type || "application/octet-stream" });
      if (error) {
        setErr(`Upload failed for "${f.name}": ${error.message}`);
        continue;
      }
      const { data } = supabase.storage.from("broadcast-attachments").getPublicUrl(path);
      added.push({ name: f.name, url: data.publicUrl, size: f.size });
    }
    setFiles((prev) => [...prev, ...added]);
    setUploading(false);
  }

  function send() {
    if (!body.trim() || pending || uploading) return;
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
        attachments: files,
        includeSelf: copyMe,
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
      setFiles([]);
      router.refresh();
    });
  }

  return (
    <div className="card p-6">
      <p className="eyebrow">Broadcast</p>
      <h2 className="font-display text-[20px] font-normal mt-1 mb-5">Announce to users</h2>

      {/* ── Audience ──────────────────────────────────────────────────────────
          The selected option is filled, not just outlined: this control decides
          who receives an irreversible send, so "which one is on" must be
          readable at a glance rather than inferred from a border colour. */}
      <label className="field-label">Audience</label>
      <div
        role="radiogroup"
        aria-label="Audience"
        className="inline-flex flex-wrap gap-1.5 p-1.5 rounded-card bg-parchment border border-line mb-2"
      >
        {AUDIENCES.map((a) => {
          const on = audience === a.value;
          return (
            <button
              key={a.value}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => setAudience(a.value)}
              className={`inline-flex items-center gap-2 rounded-[10px] px-5 py-2.5 text-[12px] tracking-[0.12em] uppercase transition-colors ${
                on
                  ? "bg-ink text-ivory shadow-sm"
                  : "text-ash hover:text-ink hover:bg-white/70"
              }`}
              style={on ? { fontWeight: 500 } : undefined}
            >
              <span
                aria-hidden
                className={`inline-block w-1.5 h-1.5 rounded-full ${on ? "bg-gold" : "bg-ash/35"}`}
              />
              {a.label}
            </button>
          );
        })}
      </div>
      <p className="text-[12px] text-ash mb-5">
        Sending to <span className="text-ink">{selected.label}</span> — {selected.who}
      </p>

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

      {/* ── Attachments ─────────────────────────────────────────────────────── */}
      <div className="mt-5">
        <label className="field-label">Attachments (optional)</label>

        {files.length > 0 && (
          <ul className="mb-3 divide-y divide-line border border-line rounded-card overflow-hidden">
            {files.map((f, i) => (
              <li key={f.url} className="flex items-center gap-3 px-4 py-2.5 bg-white/60">
                <span className="text-gold text-[13px] shrink-0">◆</span>
                <a
                  href={f.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[13px] text-ink truncate hover:text-gold transition-colors"
                >
                  {f.name}
                </a>
                <span className="text-[11px] text-ash shrink-0 ml-auto">{prettySize(f.size)}</span>
                <button
                  type="button"
                  aria-label={`Remove ${f.name}`}
                  onClick={() => setFiles((prev) => prev.filter((_, j) => j !== i))}
                  className="text-ash/50 hover:text-red-600 transition-colors text-[18px] leading-none shrink-0"
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}

        <input
          ref={fileInput}
          type="file"
          multiple
          className="hidden"
          onChange={handleFiles}
          accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip,image/*"
        />
        <button
          type="button"
          onClick={() => fileInput.current?.click()}
          disabled={uploading || files.length >= MAX_FILES}
          className="btn-ghost !px-5 !py-2.5 !text-[12px] disabled:opacity-40"
        >
          {uploading ? "Uploading…" : files.length ? "Add another file" : "Attach files"}
        </button>
        <p className="text-[11px] text-ash mt-2 leading-relaxed">
          Up to {MAX_FILES} files, {MAX_FILE_MB} MB each. Sent as links, so they keep working when
          someone reopens the email later — which also means anyone with the link can open them.
          Don&rsquo;t attach anything confidential.
        </p>
      </div>

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

      {/* Copy to self. Admins are excluded from every audience, so without this
          the only way to see what you actually sent is to sign in as someone
          else — which is exactly what made a working broadcast look broken. */}
      <label className="flex items-start gap-3 cursor-pointer mt-4 select-none">
        <button
          type="button"
          role="switch"
          aria-checked={copyMe}
          onClick={() => setCopyMe((v) => !v)}
          className={`relative mt-0.5 inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${
            copyMe ? "bg-gold" : "bg-ash/30"
          }`}
        >
          <span
            className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform ${
              copyMe ? "translate-x-4" : "translate-x-0.5"
            }`}
          />
        </button>
        <span className="text-[13px] text-ink leading-snug">
          Send me a copy
          <span className="block text-[11px] text-ash mt-0.5">
            Admins are not part of any audience. Turn this on to receive the broadcast
            yourself{sendEmail ? ", in your inbox and by email" : ""}, so you can check how it landed.
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
          disabled={pending || uploading || !body.trim()}
          className="btn-gold disabled:opacity-40 shrink-0"
        >
          {pending
            ? "Sending…"
            : `${sendEmail ? "Send broadcast + email" : "Send broadcast"} to ${selected.label}`}
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
