"use client";

import { useState, useTransition } from "react";
import { pitchExistingProject } from "@/lib/actions";
import { sized, srcSet2x } from "@/lib/image-url";

export type PitchableProject = {
  id: string;
  title: string;
  logline: string | null;
  poster_path: string | null;
  target_producer_id: string | null;
  is_public: boolean | null;
};

export default function PitchExistingList({
  projects,
  producerId,
  producerName,
}: {
  projects: PitchableProject[];
  producerId: string;
  producerName: string;
}) {
  const [pending, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function send(projectId: string) {
    setError(null);
    setBusyId(projectId);
    const fd = new FormData();
    fd.set("project_id", projectId);
    fd.set("producer_id", producerId);
    startTransition(async () => {
      // A success redirects and never returns; only a refusal comes back.
      const result = await pitchExistingProject(fd);
      setBusyId(null);
      if (result?.error) setError(result.error);
    });
  }

  return (
    <div className="card divide-y divide-line">
      {projects.map((p) => {
        // Already spoken for. Shown rather than hidden: a filmmaker looking
        // for a project that is missing from the list deserves to know why it
        // cannot be sent, not to wonder whether it was deleted.
        const taken = !!p.target_producer_id;
        const takenByThisProducer = p.target_producer_id === producerId;
        const isBusy = busyId === p.id;

        return (
          <div key={p.id} className="px-5 py-4 flex items-start gap-4">
            <div className="w-[44px] h-[58px] shrink-0 rounded-[4px] overflow-hidden border border-line bg-parchment flex items-center justify-center">
              {p.poster_path ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={sized(p.poster_path, 56)}
                  srcSet={srcSet2x(p.poster_path, 56)}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="font-display text-[16px] text-ash">
                  {p.title.trim().charAt(0).toUpperCase()}
                </span>
              )}
            </div>

            <div className="min-w-0 flex-1">
              <p className="text-[15px] leading-snug">{p.title}</p>
              {p.logline && (
                <p className="text-[13px] text-ash mt-1 line-clamp-2 leading-relaxed">{p.logline}</p>
              )}
              {taken && (
                <p className="text-[11px] tracking-[0.1em] uppercase text-ash/70 mt-2">
                  {takenByThisProducer
                    ? "Already pitched to this producer"
                    : "Already pitched to another producer"}
                </p>
              )}
            </div>

            <div className="shrink-0 self-center">
              {taken ? (
                <span className="btn-ghost opacity-40 cursor-not-allowed !py-2 !px-4 text-[12px]">
                  Sent
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => send(p.id)}
                  disabled={pending}
                  className="btn-gold !py-2 !px-5 text-[12px] disabled:opacity-50 whitespace-nowrap"
                >
                  {isBusy ? "Sending…" : "Send this →"}
                </button>
              )}
            </div>
          </div>
        );
      })}

      {error && (
        <p className="px-5 py-4 text-[13px] text-red-700 bg-red-50">{error}</p>
      )}

      <p className="px-5 py-3 text-[12px] text-ash/70">
        Sending addresses the project to {producerName} and notifies them. A project can be
        pitched to one producer at a time.
      </p>
    </div>
  );
}
