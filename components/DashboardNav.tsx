"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type NavItem = { href: string; label: string; gold?: boolean };

export default function DashboardNav({ items }: { items: NavItem[] }) {
  const path = usePathname();

  return (
    <nav className="flex md:flex-col gap-5 md:gap-0 md:mt-12 whitespace-nowrap">
      {items.map((n) => {
        const isExternal = n.href.startsWith("http");
        const isActive = !isExternal && (
          n.href === "/dashboard"
            ? path === "/dashboard"
            : path === n.href || path.startsWith(n.href + "/") || path.startsWith(n.href + "?")
        );

        return (
          <Link
            key={n.href}
            href={n.href}
            style={{
              display:       "block",
              padding:       "7px 0 7px 14px",
              fontSize:      12,
              letterSpacing: "0.16em",
              textTransform: "uppercase" as const,
              fontWeight:    isActive ? 700 : 400,
              color:         isActive ? "#1A1815" : n.gold ? "#BF9953" : "#8A857C",
              borderLeft:    isActive ? "2px solid #BF9953" : "2px solid transparent",
              transition:    "color 0.15s, border-color 0.15s, font-weight 0.1s",
              textDecoration:"none",
            }}
            className="hover:text-ink"
          >
            {n.label}
          </Link>
        );
      })}
    </nav>
  );
}
