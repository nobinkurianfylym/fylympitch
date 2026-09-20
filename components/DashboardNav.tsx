"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/** A link-out listed beneath a nav item. Not a nav destination itself. */
type SubItem = { href: string; label: string; title?: string };

type NavItem = { href: string; label: string; gold?: boolean; sub?: SubItem[] };

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
          <div key={n.href} className="contents md:block">
            <Link
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

            {/* Sub-links sit under their nav item, quieter and in sentence case,
                so they read as contents rather than as more navigation. Hidden
                on mobile, where the sidebar is a single scrolling row. */}
            {n.sub && n.sub.length > 0 && (
              <div className="hidden md:flex md:flex-col">
                {n.sub.map((s) => (
                  <a
                    key={s.href}
                    href={s.href}
                    target="_blank"
                    rel="noopener noreferrer nofollow"
                    title={s.title}
                    style={{
                      display:       "block",
                      padding:       "4px 0 4px 26px",
                      fontSize:      11,
                      letterSpacing: "0.06em",
                      color:         "#8A857C",
                      opacity:       0.78,
                      textDecoration:"none",
                      maxWidth:      182,
                      overflow:      "hidden",
                      textOverflow:  "ellipsis",
                      whiteSpace:    "nowrap",
                      transition:    "color 0.15s, opacity 0.15s",
                    }}
                    className="hover:!text-gold hover:opacity-100"
                  >
                    {s.label}
                  </a>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </nav>
  );
}
