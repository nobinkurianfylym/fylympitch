import type { Metadata } from "next";
import { ROBOTS_NOINDEX } from "@/lib/seo";

// An auth handoff that redirects immediately. Nothing to index.
//
// This lives in a layout rather than on the page itself because the page is a
// client component, and a "use client" module cannot export metadata — Next
// only reads metadata from server components.
export const metadata: Metadata = {
  title: "Signing in",
  robots: ROBOTS_NOINDEX,
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
