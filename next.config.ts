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

    // The custom domain (pitch.fylym.com) sits in front of the Cloudflare
    // Worker host (fylympitch.nobinkurian.workers.dev). Without this, Next's
    // CSRF check rejects every Server Action POST with:
    //   "`x-forwarded-host` does not match `origin` … Aborting the action."
    // which surfaces to users as "This page couldn't load. A server error occurred."
    // List origins WITHOUT protocol.
    serverActions: {
      allowedOrigins: ["pitch.fylym.com", "fylympitch.nobinkurian.workers.dev"],
    },
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
      // ── Security headers ─────────────────────────────────────
      // The site had none. These are the cheap, high-value ones: they
      // cost nothing, break nothing, and close off whole classes of
      // attack that otherwise depend on the browser guessing well.
      {
        source: "/:path*",
        headers: [
          // Clickjacking. Without this, pitch.fylym.com can be framed
          // invisibly over a decoy page and a filmmaker can be tricked
          // into clicking "Send this pitch to the producer".
          { key: "X-Frame-Options", value: "DENY" },

          // Stops the browser second-guessing Content-Type. An uploaded
          // file served as text/plain cannot be re-interpreted as HTML
          // and executed.
          { key: "X-Content-Type-Options", value: "nosniff" },

          // Do not leak the full URL of a private page to third parties.
          // A filmmaker following an outbound link from
          // /dashboard/projects/<uuid> should not hand that uuid over.
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },

          // Nothing here needs a camera, microphone or location, and
          // saying so explicitly means an injected script cannot ask.
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()",
          },

          // Two years, subdomains included. Cloudflare already serves
          // HTTPS; this stops the first request of a session being made
          // over HTTP and downgraded. Not preloaded — that is a
          // deliberate, hard-to-reverse commitment and should be a
          // decision, not a side effect.
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains",
          },

          // Content-Security-Policy in REPORT-ONLY.
          //
          // Next.js inlines its RSC payload and hydration scripts, so a
          // strict script-src would white-screen the site. Report-only
          // enforces nothing and breaks nothing: it makes the browser
          // report what WOULD have been blocked, so the policy can be
          // tightened against real traffic instead of guesswork.
          //
          // Move this to Content-Security-Policy once the reports are
          // quiet. Do not flip it blind.
          {
            key: "Content-Security-Policy-Report-Only",
            value: [
              "default-src 'self'",
              // static.cloudflareinsights.com serves the Web Analytics beacon.
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://static.cloudflareinsights.com",
              "style-src 'self' 'unsafe-inline'",
              `img-src 'self' data: blob: https://${SUPABASE_HOSTNAME}`,
              "font-src 'self' data:",
              // cloudflareinsights.com is where the beacon sends page views.
              // Without it here, the day this CSP is switched from
              // report-only to enforcing, analytics would silently stop.
              `connect-src 'self' https://${SUPABASE_HOSTNAME} wss://${SUPABASE_HOSTNAME} https://cloudflareinsights.com`,
              "frame-ancestors 'none'",
              "base-uri 'self'",
              "form-action 'self'",
              "object-src 'none'",
            ].join("; "),
          },
        ],
      },

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
        source: "/u/:path*",
        headers: [{ key: "Cache-Control", value: "public, s-maxage=300, stale-while-revalidate=3600" }],
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
