import type { NextConfig } from "next";

const SUPABASE_HOSTNAME = process.env.NEXT_PUBLIC_SUPABASE_URL
  ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname
  : "hwwilevvoinecedexmok.supabase.co";

const nextConfig: NextConfig = {
  reactStrictMode: true,

  // ── Image optimisation ───────────────────────────────────────
  // Allows next/image to proxy, resize and serve WebP from these domains.
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: SUPABASE_HOSTNAME,
        pathname: "/storage/v1/object/public/**",
      },
    ],
    // Serve modern formats — reduces image payload 30-60%
    formats: ["image/avif", "image/webp"],
    // Cache optimised images for 1 week on the CDN
    minimumCacheTTL: 60 * 60 * 24 * 7,
  },

  // ── Response headers ────────────────────────────────────────
  async headers() {
    return [
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
        // Static assets — cache aggressively
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
