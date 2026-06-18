"use client";

import { useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function SearchInput({
  placeholder,
  basePath,
}: {
  placeholder: string;
  basePath: string;
}) {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const [value, setValue] = useState(searchParams.get("q") ?? "");
  const [, startTransition] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const params = new URLSearchParams(searchParams.toString());
    // Remove sort — search takes priority
    params.delete("sort");
    if (value.trim()) {
      params.set("q", value.trim());
    } else {
      params.delete("q");
    }
    startTransition(() => router.push(`${basePath}?${params.toString()}`));
  }

  function clear() {
    setValue("");
    const params = new URLSearchParams(searchParams.toString());
    params.delete("q");
    params.delete("sort");
    startTransition(() => router.push(`${basePath}?${params.toString()}`));
  }

  return (
    <form onSubmit={submit} className="relative flex items-center gap-0">
      <span className="absolute left-3 text-ash pointer-events-none" style={{ fontSize: 13 }}>
        <i className="ti ti-search" aria-hidden="true" />
      </span>
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        className="field !py-2 !text-[12px] !pl-8 !pr-7 w-[220px]"
      />
      {value && (
        <button
          type="button"
          onClick={clear}
          className="absolute right-2.5 text-ash hover:text-ink transition-colors text-[14px] leading-none"
          aria-label="Clear search"
        >
          ×
        </button>
      )}
    </form>
  );
}
