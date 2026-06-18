"use client";

import { useState, useRef } from "react";
import { createClient } from "@/lib/supabase/client";

interface Props {
  currentUrl?: string | null;
  userId: string;
  name?: string;
  onUpload: (url: string) => void;
}

export default function AvatarUpload({ currentUrl, userId, name, onUpload }: Props) {
  const [preview, setPreview] = useState<string | null>(currentUrl ?? null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const initials = name
    ? name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase()
    : "?";

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      setError("Max 2MB");
      return;
    }

    setError(null);
    setPreview(URL.createObjectURL(file));
    setUploading(true);

    try {
      const supabase = createClient();
      const ext = file.name.split(".").pop() ?? "jpg";
      const path = `${userId}/avatar.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(path, file, { upsert: true, contentType: file.type });

      if (uploadError) {
        setError("Upload failed");
        return;
      }

      const { data } = supabase.storage.from("avatars").getPublicUrl(path);
      // Add cache-bust so updated avatar shows immediately
      onUpload(`${data.publicUrl}?t=${Date.now()}`);
    } catch {
      setError("Upload failed");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="flex items-center gap-5">
      {/* Avatar circle */}
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="relative w-20 h-20 rounded-full overflow-hidden bg-parchment border-2 border-line hover:border-gold transition-colors group shrink-0"
      >
        {preview ? (
          <img src={preview} alt="Avatar" className="w-full h-full object-cover" />
        ) : (
          <span className="font-display text-[22px] text-ash group-hover:text-gold transition-colors">
            {initials}
          </span>
        )}
        {/* Overlay on hover */}
        <div className="absolute inset-0 bg-ink/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
          <span className="text-white text-[11px] tracking-[0.1em]">
            {uploading ? "…" : "Edit"}
          </span>
        </div>
      </button>

      {/* Label */}
      <div>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="text-[13px] text-ash hover:text-ink transition-colors underline underline-offset-2"
        >
          {uploading ? "Uploading…" : preview ? "Change photo" : "Upload photo"}
        </button>
        <p className="text-[11px] text-ash/60 mt-1">JPG, PNG or WebP · max 2MB</p>
        {error && <p className="text-[11px] text-red-500 mt-1">{error}</p>}
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={handleFile}
          className="hidden"
        />
      </div>
    </div>
  );
}
