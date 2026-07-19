import type { NextConfig } from "next";

const SUPABASE_HOSTNAME = process.env.NEXT_PUBLIC_SUPABASE_URL
  ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname
  : "hwwilevvoinecedexmok.supabase.co";

const nextConfig: NextConfig = {
  reactStrictMode: true,

  // ── TypeScript ────────────────────────────────────────────────
  // Do not fail production builds on type errors — type-check
  // separately in CI. Cloudflare Workers builds must not silently
  // roll back because of pre-existing TS issues in admin pages.
  typescript: { ignoreBuildErrors: true },

  // ── Tree-shake large server packages ─────────────────────────
  // Note: pdf-parse is now used CLIENT-SIDE only via pdfjs-dist in the browser.
  // Cloudflare Workers lacks canvas, so PDF parsing must happen in the browser.
  experimental: {
    optimizePackageImports: ["resend", "@supabase/ssr", "@supabase/supabase-js"],
  },

  // ── Compiler optimisations ────────────────────────────────────
  compiler: {
    // Strip console.log in production — preserves errors and warnings.
    removeConsole: {
      exclude: ["error", "warn"],
    },
  },

  // ── Image optimisation ────────────────────────────────────────
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: SUPABASE_HOSTNAME,
        pathname: "/storage/v1/object/public/**",
      },
    ],
    formats: ["image/avif", "image/webp"],
    minimumCacheTTL: 60 * 60 * 24 * 7,
  },

  // ── Response headers ──────────────────────────────────────────
  async headers() {
    return [
      // Eager Supabase TLS preconnect ONLY on authenticated data routes that hit
      // Supabase immediately on load. Kept off public pages (/, /filmprojects) where
      // it is unused — PageSpeed flagged it there. dns-prefetch (layout) still covers all routes.
      ...["/dashboard/:path*", "/producerstudio/:path*", "/admin/:path*"].map((source) => ({
        source,
        headers: [
          { key: "Link", value: `<https://${SUPABASE_HOSTNAME}>; rel=preconnect` },
        ],
      })),
      {
        source: "/filmprojects/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, s-maxage=60, stale-while-revalidate=600",
          },
        ],
      },
      {
        source: "/filmprojects",
        headers: [
          {
            key: "Cache-Control",
            value: "public, s-maxage=60, stale-while-revalidate=600",
          },
        ],
      },
      {
        source: "/opportunities/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, s-maxage=300, stale-while-revalidate=3600",
          },
        ],
      },
      {
        source: "/opportunities",
        headers: [
          {
            key: "Cache-Control",
            value: "public, s-maxage=300, stale-while-revalidate=3600",
          },
        ],
      },
      {
        source: "/guides/:path*",
        headers: [{ key: "Cache-Control", value: "public, s-maxage=86400, stale-while-revalidate=604800" }],
      },
      {
        source: "/glossary/:path*",
        headers: [{ key: "Cache-Control", value: "public, s-maxage=86400, stale-while-revalidate=604800" }],
      },
      {
        source: "/deadlines",
        headers: [{ key: "Cache-Control", value: "public, s-maxage=3600, stale-while-revalidate=86400" }],
      },
      {
        source: "/logos/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
      {
        source: "/public/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=86400, stale-while-revalidate=604800",
          },
        ],
      },
      {
        source: "/_next/static/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
    ];
  },
};

export default nextConfig;

import('@opennextjs/cloudflare').then(m => m.initOpenNextCloudflareForDev());
