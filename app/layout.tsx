import type { Metadata } from "next";
import "./globals.css";
import { Montserrat, Playfair_Display } from "next/font/google";

// ── Fonts ────────────────────────────────────────────────────────────────────
// next/font self-hosts woff2 files at build time — no external CDN request,
// no render-blocking stylesheet, no FOUT. The `variable` prop injects a CSS
// custom property on <html> that Tailwind picks up via tailwind.config.ts.
const montserrat = Montserrat({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-montserrat",
  display: "swap",
  preload: true,
});

const playfair = Playfair_Display({
  subsets: ["latin"],
  weight: ["400"],
  style: ["normal", "italic"],
  variable: "--font-playfair",
  display: "swap",
  preload: true,
});

export const metadata: Metadata = {
  title: "PITCH.FYLYM — Where films find their financiers",
  description:
    "Intelligent matchmaking between film projects and producers, funds, grants, labs, markets, distributors and investors worldwide.",
};

const SUPABASE_HOST = process.env.NEXT_PUBLIC_SUPABASE_URL
  ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname
  : "hwwilevvoinecedexmok.supabase.co";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${montserrat.variable} ${playfair.variable}`}>
      <head>
        {/* Icons are inline SVG (components/Icon.tsx) — no icon-font CDN,
            no render-blocking stylesheet. */}
        {/* Supabase DNS prefetch — cheap and safe on every route. The eager
            TLS preconnect is scoped to authenticated data routes in
            next.config headers so it is not wasted on public marketing pages. */}
        <link rel="dns-prefetch" href={`https://${SUPABASE_HOST}`} />
      </head>
      <body>{children}</body>
    </html>
  );
}
