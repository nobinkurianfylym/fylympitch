import type { NextConfig } from "next";

const SUPABASE_HOSTNAME = process.env.NEXT_PUBLIC_SUPABASE_URL
  ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname
  : "hwwilevvoinecedexmok.supabase.co";

const nextConfig: NextConfig = {
  reactStrictMode: true,

  // ── Keep Node-only packages out of the client bundle ─────────
  // pdf-parse uses Node.js fs/crypto — never belongs in the browser.
  // Without this, Next.js tries to polyfill it → bloated client JS.
  serverExternalPackages: ["pdf-parse"],

  // ── Tree-shake large server packages ─────────────────────────
  // Tells the bundler which packages to analyse for used-only imports,
  // avoiding the full package weight even when partially used.
  experimental: {
    optimizePackageImports: ["resend", "@supabase/ssr", "@supabase/supabase-js"],
  },

  // ── Compiler optimisations ────────────────────────────────────
  compiler: {
    // Strip console.log in production — saves a few KB and speeds up V8.
    // Errors and warnings are preserved for debugging.
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
        // Preconnect to Supabase on every page load — saves ~150ms RTT
        // on first API/auth call by establishing the TCP+TLS handshake early.
        source: "/:path*",
        headers: [
          {
            key: "Link",
            value: `<https://${SUPABASE_HOSTNAME}>; rel=preconnect`,
          },
        ],
      },
      {
        // Public project pages — cache at edge for 60s, revalidate in background
        source: "/projects/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, s-maxage=60, stale-while-revalidate=600",
          },
        ],
      },
      {
        // Public film showcase — same edge cache
        source: "/projects",
        headers: [
          {
            key: "Cache-Control",
            value: "public, s-maxage=60, stale-while-revalidate=600",
          },
        ],
      },
      {
        // Static assets — immutable CDN cache (hash in filename = safe forever)
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
