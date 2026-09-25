"use client";
// app/admin/featured/FeaturedForm.tsx
// Add a card. Upload goes straight to storage from the browser, the
// same as the Resources form, so a 4MB poster never passes through a
// server action.

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { createFeaturedSlot } from "@/lib/featured-actions";

const BUCKET = "featured-images";
const MAX_BYTES = 4 * 1024 * 1024;
const IMMUTABLE_CACHE = "31536000";

const KINDS = [
  { key: "fund",     label: "Fund",     help: "Paste the opportunity id. Everything else fills itself in." },
  { key: "producer", label: "Producer", help: "Paste the producer's profile id. Get their consent first." },
  { key: "project",  label: "Project",  help: "Paste the project id. Public projects only." },
  { key: "custom",   label: "Custom",   help: "Anything else: a partner, a market, a call. You supply all of it." },
];

export default function FeaturedForm() {
  const [kind, setKind]         = useState("fund");
  const [imageUrl, setImageUrl] = useState("");
  const [uploading, setUp]      = useState(false);
  const [error, setError]       = useState<string | null>(null);
  const [pending, start]        = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const router  = useRouter();

  const custom = kind === "custom";
  const help   = KINDS.find(k => k.key === kind)?.help ?? "";

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_BYTES) {
      setError("That image is over 4MB. Resize it and try again.");
      e.target.value = "";
      return;
    }
    setError(null);
    setUp(true);

    const supabase = createClient();
    const safe = file.name.replace(/[^a-zA-Z0-9_.-]/g, "_");
    const path = `${crypto.randomUUID()}/${safe}`;

    const { error: upErr } = await supabase.storage
      .from(BUCKET)
      .upload(path, file, { contentType: file.type || "image/png", cacheControl: IMMUTABLE_CACHE });

    setUp(false);
    if (upErr) {
      setError(`Upload failed: ${upErr.message}. If it says the bucket is missing, run migration 096.`);
      e.target.value = "";
      return;
    }
    setImageUrl(supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl);
  }

  function submit(formData: FormData) {
    setError(null);
    start(async () => {
      const res = await createFeaturedSlot(formData);
      if (res?.error) { setError(res.error); return; }
      formRef.current?.reset();
      setImageUrl("");
      if (fileRef.current) fileRef.current.value = "";
      router.refresh();
    });
  }

  return (
    <form ref={formRef} action={submit} className="border border-line rounded-card bg-white p-6">
      <input type="hidden" name="image_url" value={imageUrl} />

      <div className="flex flex-wrap gap-2 mb-2">
        {KINDS.map(k => (
          <button
            key={k.key} type="button" onClick={() => setKind(k.key)}
            className={`text-[10px] tracking-[0.14em] uppercase rounded-full px-3.5 py-2 border transition-colors ${
              kind === k.key ? "bg-ink text-ivory border-ink" : "border-line text-ash hover:border-gold"
            }`}
          >{k.label}</button>
        ))}
      </div>
      <input type="hidden" name="kind" value={kind} />
      <p className="text-[12.5px] text-ash mb-5">{help}</p>

      <div className="grid sm:grid-cols-2 gap-5">
        {!custom && (
          <label className="block sm:col-span-2">
            <span className="eyebrow block mb-2">Id</span>
            <input name="ref_id" className="field w-full" placeholder="00000000-0000-0000-0000-000000000000" />
          </label>
        )}

        <label className="block">
          <span className="eyebrow block mb-2">Title {custom ? "" : "(optional override)"}</span>
          <input name="title" maxLength={60} className="field w-full" />
        </label>

        <label className="block">
          <span className="eyebrow block mb-2">Subtitle</span>
          <input name="subtitle" maxLength={60} className="field w-full" />
        </label>

        <label className="block sm:col-span-2">
          <span className="eyebrow block mb-2">Hook line</span>
          <input name="hook" maxLength={120} className="field w-full"
                 placeholder="Left empty on a fund, this counts matching projects automatically." />
        </label>

        <label className="block">
          <span className="eyebrow block mb-2">Link {custom ? "" : "(optional override)"}</span>
          <input name="link_url" className="field w-full" placeholder="https:// or /opportunities/slug" />
        </label>

        <label className="block">
          <span className="eyebrow block mb-2">Button label</span>
          <input name="cta_label" maxLength={28} className="field w-full" placeholder="See if you qualify" />
        </label>

        <label className="block sm:col-span-2">
          <span className="eyebrow block mb-2">Rows — one per line, label | value | gold</span>
          <textarea name="rows_text" rows={3} className="field w-full font-mono text-[12px]"
                    placeholder={"Up to | $120,000 | gold\nOpen to | Worldwide\nCloses | in 24 days | gold"} />
          <span className="block mt-1.5 text-[12px] text-ash">
            Leave blank on a fund, producer or project and these are read live from the record. Three rows maximum.
          </span>
        </label>

        <div className="sm:col-span-2">
          <span className="eyebrow block mb-2">Poster or image</span>
          <input ref={fileRef} type="file" accept="image/*" onChange={onFile}
                 className="text-[13px] text-ash file:mr-3 file:rounded-full file:border file:border-line file:bg-parchment file:px-4 file:py-1.5 file:text-[11px] file:uppercase file:tracking-[0.12em] file:text-ink" />
          {uploading && <p className="mt-2 text-[12px] text-ash">Uploading…</p>}
          {imageUrl && (
            <div className="mt-3 flex items-center gap-3">
              <img src={imageUrl} alt="" className="h-[60px] w-11 rounded-[3px] border border-line object-cover" />
              <button type="button" onClick={() => { setImageUrl(""); if (fileRef.current) fileRef.current.value = ""; }}
                      className="text-[11px] tracking-[0.14em] uppercase text-ash hover:text-red-600">Remove</button>
            </div>
          )}
          <p className="mt-2 text-[12px] text-ash">
            Portrait suits the column best, roughly 2:3. Under 4MB. A project with a poster already uses it automatically.
          </p>
        </div>
      </div>

      <label className="mt-5 flex items-center gap-3 cursor-pointer">
        <input type="checkbox" name="is_active" defaultChecked />
        <span className="text-[14px] text-ash">Active — include it in the rotation straight away</span>
      </label>

      {error && <p className="mt-4 text-[13px] text-red-600">{error}</p>}

      <button type="submit" disabled={pending || uploading} className="btn-gold mt-6 disabled:opacity-50">
        {pending ? "Adding…" : "Add to the queue"}
      </button>
    </form>
  );
}
