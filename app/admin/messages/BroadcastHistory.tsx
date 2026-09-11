"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { editBroadcast } from "@/lib/admin-messaging";
import { parseBroadcastBody } from "@/lib/broadcast-body";

const AUDIENCE_LABEL: Record<string, string> = {
  all: "Everyone",
  filmmakers: "Filmmakers",
  producers: "Producers",
};

export type BroadcastRow = {
  id: string;
  audience: string;
  subject: string | null;
  body: string;
  recipient_count: number;
  created_at: string;
  edited_at?: string | null;
};

function timeAgo(iso: string | null): string {
  if (!iso) return "";
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString();
}

export default function BroadcastHistory({ broadcasts }: { broadcasts: BroadcastRow[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<string | null>(null);
  const [subject, setSubject] = useState("");
  const [text, setText] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function open(b: BroadcastRow) {
    // Edit the message only. The attachment trailer is split off here and
    // re-appended on save, so files survive an edit untouched.
    const { text: body } = parseBroadcastBody(b.body);
    setEditing(b.id);
    setSubject(b.subject ?? "");
    setText(body);
    setErr(null);
    setOk(null);
  }

  function save(b: BroadcastRow) {
    if (!text.trim() || pending) return;
    setErr(null);
    start(async () => {
      const { files } = parseBroadcastBody(b.body);
      const res = await editBroadcast({
        id: b.id,
        subject: subject.trim() || undefined,
        body: text.trim(),
        attachments: files.map((f) => ({ name: f.name, url: f.url })),
      });
      if ("error" in res) {
        setErr(res.error);
        return;
      }
      setOk(`Updated ${res.updated.toLocaleString()} ${res.updated === 1 ? "copy" : "copies"}.`);
      setEditing(null);
      router.refresh();
    });
  }

  if (broadcasts.length === 0) {
    return <p className="px-5 py-6 text-[13px] text-ash">No broadcasts sent yet.</p>;
  }

  return (
    <>
      {ok && <p className="px-5 pt-4 text-[12px] text-green-700">{ok}</p>}
      {broadcasts.map((b) => {
        const isEditing = editing === b.id;
        const { text: preview, files } = parseBroadcastBody(b.body);

        return (
          <div key={b.id} className="px-5 py-4">
            {isEditing ? (
              <div>
                <label className="field-label">Subject</label>
                <input
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="field mb-3"
                  placeholder="A message from PITCH.FYLYM"
                />
                <label className="field-label">Message</label>
                <textarea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  rows={5}
                  className="field resize-none"
                />
                {files.length > 0 && (
                  <p className="mt-2 text-[11px] text-ash">
                    {files.length === 1 ? "1 attachment is" : `${files.length} attachments are`} kept
                    as-is.
                  </p>
                )}
                <p className="mt-3 text-[11px] text-ash leading-relaxed">
                  Updates every in-app copy and the announcement on /support. Email already sent
                  cannot be changed — recipients keep the version in their inbox. Nobody is notified
                  again, and read state is left alone.
                </p>
                {err && <p className="mt-2 text-[12px] text-red-600">{err}</p>}
                <div className="flex items-center gap-2 mt-4">
                  <button
                    onClick={() => save(b)}
                    disabled={pending || !text.trim()}
                    className="btn-gold !px-5 !py-2.5 !text-[12px] disabled:opacity-40"
                  >
                    {pending ? "Saving…" : "Save changes"}
                  </button>
                  <button
                    onClick={() => setEditing(null)}
                    className="btn-ghost !px-5 !py-2.5 !text-[12px]"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between gap-4">
                  <p className="font-normal text-ink">
                    {b.subject ?? "A message from PITCH.FYLYM"}
                  </p>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-[11px] text-ash">{timeAgo(b.created_at)}</span>
                    <button
                      onClick={() => open(b)}
                      className="text-[11px] tracking-[0.14em] uppercase text-ash hover:text-gold transition-colors"
                    >
                      Edit
                    </button>
                  </div>
                </div>
                <p className="text-[13px] text-ash mt-1 line-clamp-2 leading-relaxed">{preview}</p>
                <p className="text-[10px] tracking-[0.14em] uppercase text-ash mt-2">
                  {AUDIENCE_LABEL[b.audience] ?? b.audience} ·{" "}
                  {b.recipient_count.toLocaleString()}{" "}
                  {b.recipient_count === 1 ? "recipient" : "recipients"}
                  {files.length > 0 && <> · {files.length === 1 ? "1 file" : `${files.length} files`}</>}
                  {b.edited_at && <span className="text-gold"> · Edited {timeAgo(b.edited_at)}</span>}
                </p>
              </>
            )}
          </div>
        );
      })}
    </>
  );
}
