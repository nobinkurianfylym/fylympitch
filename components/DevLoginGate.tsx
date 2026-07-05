"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { unlockDevLogin } from "@/lib/dev-login-actions";
import Wordmark from "@/components/Wordmark";

export default function DevLoginGate() {
  const router = useRouter();
  const [passcode, setPasscode] = useState("");
  const [error, setError]       = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const fd = new FormData();
      fd.set("passcode", passcode);
      const result = await unlockDevLogin(fd);
      if (result?.error) setError(result.error);
      else router.refresh();
    });
  }

  return (
    <div className="min-h-screen bg-ivory flex flex-col">
      <header className="border-b border-line">
        <div className="max-w-[1100px] mx-auto px-6 py-5">
          <Wordmark />
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center px-6">
        <form onSubmit={handleSubmit} className="w-full max-w-sm">
          <p className="eyebrow mb-3">Restricted</p>
          <h1 className="font-display text-[28px] font-[400] leading-tight mb-2">Dev login</h1>
          <p className="text-[13px] text-ash mb-6 leading-relaxed">
            This tool is not part of the public site. Enter the passcode to continue.
          </p>
          <input
            type="password"
            value={passcode}
            onChange={(e) => setPasscode(e.target.value)}
            placeholder="Passcode"
            autoFocus
            disabled={pending}
            className="field w-full mb-3"
          />
          {error && <p className="text-[12px] text-red-600 mb-3">{error}</p>}
          <button
            type="submit"
            disabled={pending || !passcode}
            className="btn-gold w-full disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {pending ? "Checking…" : "Continue"}
          </button>
        </form>
      </main>
    </div>
  );
}
