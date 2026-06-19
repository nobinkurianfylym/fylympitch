"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useRole } from "@/components/RoleProvider";
import { signOut } from "@/lib/auth-actions";

type Props = {
  isLoggedIn:  boolean;
  userName?:   string;
  avatarUrl?:  string;
  accountRole?: string;
};

export default function HeaderCTA({ isLoggedIn, userName, avatarUrl, accountRole = "FILMMAKER" }: Props) {
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

  // Not logged in — plain role-aware link
  if (!isLoggedIn) {
    const destination = role === "producer" ? "/producer" : "/dashboard";
    return (
      <Link href={`/login?next=${destination}`} className="btn-outline !px-5 !py-2.5 !text-[11px]">
        Get started
      </Link>
    );
  }

  // Derive display name + initials
  const firstName = (userName ?? "").split(" ")[0] || "Account";
  const initials  = (userName ?? "")
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase() || "?";

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2.5 px-3 py-1.5 rounded-card border border-line hover:border-ink/30 transition-colors bg-transparent"
      >
        {/* Avatar */}
        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt={firstName}
            className="w-[26px] h-[26px] rounded-full object-cover shrink-0"
          />
        ) : (
          <span
            className="w-[26px] h-[26px] rounded-full flex items-center justify-center shrink-0 text-[10px] font-medium"
            style={{ background: "#BF9953", color: "#1A1815" }}
          >
            {initials}
          </span>
        )}
        {/* Name + account type */}
        <div className="flex flex-col items-start gap-0">
          <span className="text-[11px] tracking-[0.1em] uppercase text-ink max-w-[96px] truncate leading-tight">
            {firstName}
          </span>
          <span className="text-[9px] tracking-[0.14em] uppercase text-ash/70 leading-tight">
            {accountRole}
          </span>
        </div>
        <span style={{ fontSize: 9, color: "#8A857C", lineHeight: 1 }}>▾</span>
      </button>

      {open && (
        <div
          className="absolute right-0 top-full mt-2 bg-white border border-line rounded-card overflow-hidden z-50"
          style={{ minWidth: 160, boxShadow: "0 4px 24px rgba(26,24,21,0.08)" }}
        >
          <form action={signOut}>
            <button
              type="submit"
              className="w-full flex items-center gap-2.5 px-4 py-3 text-[11px] tracking-[0.1em] uppercase text-ash hover:text-red-600 transition-colors"
            >
              <i className="ti ti-logout" style={{ fontSize: 14 }} aria-hidden="true" />
              Sign out
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
