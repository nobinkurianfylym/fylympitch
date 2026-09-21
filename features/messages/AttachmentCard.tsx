"use client";

import { Icon } from "@/components/Icon";
// features/messages/AttachmentCard.tsx

import React, { useState, useEffect } from "react";
import { getFileIcon, formatFileSize } from "./message.utils";
import { IMAGE_ATTACHMENT_EXTENSIONS } from "./message.types";

interface Props {
  name:        string;
  size:        number | null;
  extension:   string | null;
  bucket:      string;
  path:        string;
  getUrl:      (bucket: string, path: string) => Promise<string | null>;
}

export const AttachmentCard = React.memo(function AttachmentCard({
  name,
  size,
  extension,
  bucket,
  path,
  getUrl,
}: Props) {
  const [url,     setUrl]     = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);

    getUrl(bucket, path).then((signed) => {
      if (cancelled) return;
      if (!signed) { setError(true); setLoading(false); return; }
      setUrl(signed);
      setLoading(false);
    });

    return () => { cancelled = true; };
  }, [bucket, path, getUrl]);

  const icon = getFileIcon(extension);
  const isImage = IMAGE_ATTACHMENT_EXTENSIONS.has((extension ?? "").toLowerCase());

  // A photo sent as a grey file card with a download arrow is not what anyone
  // expects in a conversation. Once the signed URL resolves, show the picture;
  // clicking opens it full size. Falls through to the ordinary card while the
  // URL loads or if it fails, so nothing is lost on error.
  if (isImage && url && !error) {
    return (
      <a
        href={url}
        target="_blank"
        rel="noreferrer"
        aria-label={`Open ${name}`}
        onClick={(e: React.MouseEvent) => e.stopPropagation()}
        className="block mt-2 max-w-[300px] rounded-lg overflow-hidden border border-line bg-ivory hover:border-ash transition-colors"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={url}
          alt={name}
          loading="lazy"
          decoding="async"
          className="block w-full h-auto max-h-[320px] object-contain bg-parchment"
        />
        <span className="block px-3 py-1.5 text-[11px] text-ash truncate" title={name}>
          {name}{size !== null ? ` · ${formatFileSize(size)}` : ""}
        </span>
      </a>
    );
  }

  return (
    <div
      className="
        flex items-center gap-3
        px-4 py-3 mt-2
        border border-line
        bg-ivory
        hover:border-ash
        transition-colors
        max-w-[300px]
        rounded-lg
        group
      "
    >
      <Icon
        name={icon}
        className="text-ash group-hover:text-ink"
        style={{ fontSize: 22, flexShrink: 0 }}
      />

      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-medium truncate text-ink" title={name}>
          {name}
        </p>
        <p className="text-[11px] text-ash mt-0.5">
          {extension?.toUpperCase() ?? "FILE"}
          {size !== null ? ` · ${formatFileSize(size)}` : ""}
        </p>
      </div>

      {loading && (
        <Icon
          name="loader"
          className="animate-spin text-ash shrink-0"
          style={{ fontSize: 16 }}
          ariaLabel="Loading download link"
        />
      )}

      {!loading && error && (
        <Icon
          name="alert-triangle"
          className="text-ash shrink-0"
          style={{ fontSize: 16 }}
          ariaLabel="Could not load file"
          title="Could not generate download link."
        />
      )}

      {!loading && !error && url && (
        <a
          href={url}
          download={name}
          target="_blank"
          rel="noreferrer"
          aria-label={`Download ${name}`}
          className="shrink-0 text-ash hover:text-ink transition-colors"
          onClick={(e: React.MouseEvent) => e.stopPropagation()}
        >
          <Icon name="download" style={{ fontSize: 16 }} />
        </a>
      )}
    </div>
  );
});
