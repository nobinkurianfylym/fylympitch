"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { IMMUTABLE_CACHE } from "@/lib/image-resize";
import { adminCreateResource, adminUpdateResource } from "@/lib/resource-actions";

export type ResourceRow = {
  id: string;
  title: string;
  description: string;
  url: string;
  image_url: string | null;
  category: string | null;
  sort_order: number;
  is_published: boolean;
};

const MAX_DESCRIPTION = 280;
const MAX_IMAGE_MB = 2;

export default function ResourceForm({
  existing,
  onDone,
}: {
  existing?: ResourceRow;
  onDone?: () => void;
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();

  const [imageUrl, setImageUrl] = useState(existing?.image_url ?? "");
  const [description, setDescription] = useState(existing?.description ?? "");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > MAX_IMAGE_MB * 1024 * 1024) {
      setError(`"${file.name}" is ${(file.size / 1024 / 1024).toFixed(1)} MB. The limit is ${MAX_IMAGE_MB} MB.`);
      e.target.value = "";
      return;
    }

    setError(null);
    setUploading(true);
    const supabase = createClient();
    const safe = file.name.replace(/[^a-zA-Z0-9_.-]/g, "_");
    const path = `${crypto.randomUUID()}/${safe}`;

    const { error: upErr } = await supabase.storage
      .from("resource-images")
      .upload(path, file, { contentType: file.type || "image/png", cacheControl: IMMUTABLE_CACHE });

    setUploading(false);

    if (upErr) {
      // Most likely cause is that migration 084 has not been run, so the
      // bucket does not exist yet. Say so rather than just echoing the error.
      setError(`Upload failed: ${upErr.message}. If this says the bucket is missing, run migration 084.`);
      e.target.value = "";
      return;
    }

    const { data } = supabase.storage.from("resource-images").getPublicUrl(path);
    setImageUrl(data.publicUrl);
  }

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = existing
        ? await adminUpdateResource(formData)
        : await adminCreateResource(formData);

      if (result?.error) {
        setError(result.error);
        return;
      }
      if (!existing) {
        setImageUrl("");
        setDescription("");
        if (fileRef.current) fileRef.current.value = "";
      }
      router.refresh();
      onDone?.();
    });
  }

  const remaining = MAX_DESCRIPTION - description.length;

  return (
    <form action={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {existing && <input type="hidden" name="id" value={existing.id} />}

      <label className="block sm:col-span-2">
        <span className="eyebrow">Name *</span>
        <input
          name="title"
          required
          defaultValue={existing?.title}
          placeholder="e.g. Final Draft"
          className="field mt-1.5"
        />
      </label>

      <label className="block sm:col-span-2">
        <span className="eyebrow">Link *</span>
        <input
          name="url"
          required
          defaultValue={existing?.url}
          placeholder="finaldraft.com"
          className="field mt-1.5"
        />
        <span className="block text-[11px] text-ash mt-1.5">
          No need for https:// — it is added for you. Any domain works, not just .com.
        </span>
      </label>

      <label className="block sm:col-span-2">
        <span className="eyebrow">Short description *</span>
        <textarea
          name="description"
          required
          rows={2}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={MAX_DESCRIPTION}
          placeholder="Industry-standard screenwriting software."
          className="field mt-1.5"
        />
        <span className={`block text-[11px] mt-1.5 ${remaining < 40 ? "text-gold" : "text-ash"}`}>
          {remaining} characters left. Keep it short — it shows on a card beside the image.
        </span>
      </label>

      {/* Image: upload a file, or paste a URL. Both write the same field. */}
      <div className="sm:col-span-2 border border-line rounded-card p-4">
        <span className="eyebrow">Image</span>

        <div className="mt-3 flex flex-wrap items-start gap-4">
          <div className="w-[104px] h-[104px] shrink-0 rounded-card border border-line bg-parchment overflow-hidden flex items-center justify-center">
            {imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={imageUrl} alt="" className="w-full h-full object-contain" />
            ) : (
              <span className="text-[10px] tracking-[0.16em] uppercase text-ash">No image</span>
            )}
          </div>

          <div className="flex-1 min-w-[220px]">
            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/svg+xml,image/gif"
              onChange={handleFile}
              disabled={uploading || pending}
              className="block w-full text-[13px] text-ash file:mr-3 file:rounded-card file:border file:border-line file:bg-white/80 file:px-4 file:py-2 file:text-[12px] file:tracking-[0.12em] file:uppercase file:text-ink hover:file:border-gold"
            />
            <p className="text-[11px] text-ash mt-2">
              PNG, JPG, WebP, SVG or GIF, up to {MAX_IMAGE_MB} MB.
            </p>

            <div className="mt-3">
              <span className="eyebrow">or paste an image URL</span>
              <input
                name="image_url"
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                placeholder="https://…/logo.png"
                className="field mt-1.5"
              />
            </div>

            {imageUrl && (
              <button
                type="button"
                onClick={() => {
                  setImageUrl("");
                  if (fileRef.current) fileRef.current.value = "";
                }}
                className="text-[11px] tracking-[0.16em] uppercase text-ash hover:text-gold mt-2"
              >
                Remove image
              </button>
            )}
          </div>
        </div>

        {uploading && <p className="text-[12px] text-gold mt-3">Uploading…</p>}
      </div>

      <label className="block">
        <span className="eyebrow">Category</span>
        <input
          name="category"
          defaultValue={existing?.category ?? ""}
          placeholder="e.g. Software, Legal, Post"
          className="field mt-1.5"
        />
      </label>

      <label className="block">
        <span className="eyebrow">Order</span>
        <input
          name="sort_order"
          type="number"
          defaultValue={existing?.sort_order ?? 0}
          className="field mt-1.5"
        />
        <span className="block text-[11px] text-ash mt-1.5">Lower numbers come first.</span>
      </label>

      <label className="flex items-center gap-3 sm:col-span-2 mt-1">
        <input
          type="checkbox"
          name="is_published"
          defaultChecked={existing?.is_published ?? false}
          className="w-4 h-4 accent-[#BF9953]"
        />
        <span className="text-[13px]">
          Published
          <span className="text-ash"> — visible to filmmakers in the sidebar and on their resources page.</span>
        </span>
      </label>

      {error && (
        <p className="sm:col-span-2 text-[13px] text-red-700 bg-red-50 border border-red-200 rounded-card px-4 py-3">
          {error}
        </p>
      )}

      <div className="sm:col-span-2 flex items-center gap-3 mt-2">
        <button type="submit" disabled={pending || uploading} className="btn-gold disabled:opacity-50">
          {pending ? "Saving…" : existing ? "Save changes" : "Add resource"}
        </button>
        {existing && onDone && (
          <button type="button" onClick={onDone} className="btn-ghost">
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}
