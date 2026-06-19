"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useRole } from "@/components/RoleProvider";
import { signOut } from "@/lib/auth-actions";

export default function HeaderCTA({ isLoggedIn }: { isLoggedIn: boolean }) {
  const { role } = useRole();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const destination = role === "producer" ? "/producer" : "/dashboard";

  // Not logged in — plain link, role-aware destination
  if (!isLoggedIn) {
    return (
      <Link href={`/login?next=${destination}`} className="btn-outline !px-5 !py-2.5 !text-[11px]">
        Get started
      </Link>
    );
  }

  // Logged in — same label, adds dropdown with sign out
  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="btn-outline !px-5 !py-2.5 !text-[11px] inline-flex items-center gap-2"
      >
        Get started
        <span style={{ fontSize: 9, lineHeight: 1 }}>▾</span>
      </button>

      {open && (
        <div
          className="absolute right-0 top-full mt-2 bg-white border border-line rounded-card overflow-hidden z-50"
          style={{ minWidth: 180, boxShadow: "0 4px 24px rgba(26,24,21,0.08)" }}
        >
          <Link href="/dashboard" onClick={() => setOpen(false)}
            className="flex items-center gap-2.5 px-4 py-3 text-[11px] tracking-[0.1em] uppercase text-ash hover:text-ink hover:bg-parchment/60 transition-colors">
            <i className="ti ti-movie" style={{ fontSize: 14 }} aria-hidden="true" />
            Filmmaker
          </Link>
          <Link href="/producer" onClick={() => setOpen(false)}
            className="flex items-center gap-2.5 px-4 py-3 text-[11px] tracking-[0.1em] uppercase text-ash hover:text-ink hover:bg-parchment/60 transition-colors">
            <i className="ti ti-building" style={{ fontSize: 14 }} aria-hidden="true" />
            Producer Studio
          </Link>
          <div className="border-t border-line" />
          <form action={signOut}>
            <button type="submit"
              className="w-full flex items-center gap-2.5 px-4 py-3 text-[11px] tracking-[0.1em] uppercase text-ash hover:text-red-600 transition-colors">
              <i className="ti ti-logout" style={{ fontSize: 14 }} aria-hidden="true" />
              Sign out
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
