"use client";
// features/messages/AttachmentCard.tsx

import React, { useState, useEffect } from "react";
import { getFileIcon, formatFileSize } from "./message.utils";

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
      <i
        className={`ti ${icon} text-ash group-hover:text-ink`}
        style={{ fontSize: 22, flexShrink: 0 }}
        aria-hidden="true"
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
        <i
          className="ti ti-loader animate-spin text-ash shrink-0"
          style={{ fontSize: 16 }}
          aria-label="Loading download link"
        />
      )}

      {!loading && error && (
        <i
          className="ti ti-alert-triangle text-ash shrink-0"
          style={{ fontSize: 16 }}
          aria-label="Could not load file"
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
          <i className="ti ti-download" style={{ fontSize: 16 }} aria-hidden="true" />
        </a>
      )}
    </div>
  );
});
