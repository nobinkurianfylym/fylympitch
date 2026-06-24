"use client";

import { useState, useTransition } from "react";
import { deleteAccount } from "@/lib/actions";

export default function DeleteAccountModal() {
  const [open, setOpen]         = useState(false);
  const [confirm, setConfirm]   = useState("");
  const [error, setError]       = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleDelete() {
    if (confirm !== "DELETE") { setError("Type DELETE to confirm."); return; }
    setError(null);
    startTransition(async () => {
      const result = await deleteAccount();
      if (result?.error) { setError(result.error); }
      // On success, server redirects to "/"
    });
  }

  return (
    <>
      {/* Trigger */}
      <button
        type="button"
        onClick={() => { setOpen(true); setConfirm(""); setError(null); }}
        className="text-[11px] tracking-[0.1em] uppercase text-red-400 hover:text-red-600 transition-colors"
      >
        Delete account
      </button>

      {/* Modal */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(26,24,21,0.5)", backdropFilter: "blur(4px)" }}>
          <div className="bg-ivory rounded-[18px] border border-line w-full max-w-md p-8 shadow-xl">

            <h2 className="font-display text-[22px] text-ink mb-2">Delete account</h2>
            <p className="text-[13px] text-ash leading-relaxed mb-6">
              This permanently deletes your account, all your projects, applications,
              messages and pipeline entries. <span className="text-ink font-medium">This cannot be undone.</span>
            </p>

            <div className="bg-red-50 border border-red-200 rounded-card px-4 py-3 mb-6">
              <p className="text-[12px] text-red-700">
                Type <span className="font-bold tracking-widest">DELETE</span> to confirm.
              </p>
            </div>

            <input
              value={confirm}
              onChange={e => { setConfirm(e.target.value); setError(null); }}
              placeholder="DELETE"
              className="field w-full mb-4 tracking-widest font-medium placeholder:tracking-normal placeholder:font-normal"
              autoComplete="off"
              disabled={pending}
            />

            {error && (
              <p className="text-[12px] text-red-600 mb-4">{error}</p>
            )}

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleDelete}
                disabled={pending || confirm !== "DELETE"}
                className="flex-1 py-2.5 rounded-card bg-red-600 text-white text-[12px] font-semibold tracking-[0.08em] hover:bg-red-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {pending ? "Deleting…" : "Permanently delete"}
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                disabled={pending}
                className="btn-ghost !py-2.5 text-[12px]"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
