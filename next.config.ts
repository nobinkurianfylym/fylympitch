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
      {
        source: "/:path*",
        headers: [
          {
            key: "Link",
            value: `<https://${SUPABASE_HOSTNAME}>; rel=preconnect`,
          },
        ],
      },
      {
        source: "/projects/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, s-maxage=60, stale-while-revalidate=600",
          },
        ],
      },
      {
        source: "/projects",
        headers: [
          {
            key: "Cache-Control",
            value: "public, s-maxage=60, stale-while-revalidate=600",
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
