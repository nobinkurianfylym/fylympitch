"use client";

import { useState } from "react";
import ResourceForm, { type ResourceRow } from "./ResourceForm";
import { adminToggleResourcePublished, adminDeleteResource } from "@/lib/resource-actions";

export default function ResourcesAdminList({ rows }: { rows: ResourceRow[] }) {
  const [editingId, setEditingId] = useState<string | null>(null);

  if (rows.length === 0) {
    return (
      <p className="text-[14px] text-ash px-5 py-8">
        No resources yet. Add the first one above — it stays invisible to filmmakers until you tick Published.
      </p>
    );
  }

  return (
    <div className="divide-y divide-line">
      {rows.map((r) => {
        const isEditing = editingId === r.id;

        return (
          <div key={r.id} className="px-5 py-4">
            <div className="flex flex-wrap items-start gap-4">
              <div className="w-12 h-12 shrink-0 rounded-card border border-line bg-parchment overflow-hidden flex items-center justify-center">
                {r.image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={r.image_url} alt="" className="w-full h-full object-contain" />
                ) : (
                  <span className="text-[9px] tracking-[0.12em] uppercase text-ash">None</span>
                )}
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[15px]">{r.title}</span>
                  {r.category && (
                    <span className="text-[10px] tracking-[0.16em] uppercase text-ash border border-line rounded-card px-2 py-0.5">
                      {r.category}
                    </span>
                  )}
                  <span
                    className={`text-[10px] tracking-[0.16em] uppercase px-2 py-0.5 rounded-card border ${
                      r.is_published ? "border-gold text-gold" : "border-line text-ash"
                    }`}
                  >
                    {r.is_published ? "Published" : "Draft"}
                  </span>
                </div>
                <p className="text-[13px] text-ash mt-1">{r.description}</p>
                <a
                  href={r.url}
                  target="_blank"
                  rel="noopener noreferrer nofollow"
                  className="text-[12px] text-ash underline underline-offset-4 decoration-line hover:text-gold break-all"
                >
                  {r.url}
                </a>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setEditingId(isEditing ? null : r.id)}
                  className="text-[11px] tracking-[0.16em] uppercase text-ash hover:text-ink"
                >
                  {isEditing ? "Close" : "Edit"}
                </button>

                <form action={adminToggleResourcePublished}>
                  <input type="hidden" name="id" value={r.id} />
                  <input type="hidden" name="next" value={r.is_published ? "false" : "true"} />
                  <button className="text-[11px] tracking-[0.16em] uppercase text-ash hover:text-gold">
                    {r.is_published ? "Unpublish" : "Publish"}
                  </button>
                </form>

                <form
                  action={adminDeleteResource}
                  onSubmit={(e) => {
                    if (!confirm(`Delete "${r.title}"? This cannot be undone.`)) e.preventDefault();
                  }}
                >
                  <input type="hidden" name="id" value={r.id} />
                  <button className="text-[11px] tracking-[0.16em] uppercase text-ash hover:text-red-700">
                    Delete
                  </button>
                </form>
              </div>
            </div>

            {isEditing && (
              <div className="mt-5 pt-5 border-t border-line fylym-fade-in">
                <ResourceForm existing={r} onDone={() => setEditingId(null)} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
