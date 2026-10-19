import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "geolocation=(self), camera=(), microphone=()" },
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      // Next.js requires inline styles (and eval only in dev HMR). MapLibre
      // injects inline styles for its own controls and layers.
      "style-src 'self' 'unsafe-inline'",
      `script-src 'self' 'unsafe-inline'${process.env.NODE_ENV === "development" ? " 'unsafe-eval'" : ""}`,
      "img-src 'self' data: blob: https:",
      "font-src 'self' data:",
      // MapLibre loads style JSON, vector tiles and glyphs over fetch/XHR and
      // runs its tile worker from a blob; raster tile providers load as images
      // (covered by img-src https:). OpenFreeMap is the default keyless
      // basemap. ORBIS_TILE_URL providers that need fetch access must be added
      // here too.
      "connect-src 'self' https://tiles.openfreemap.org",
      "worker-src 'self' blob:",
      `frame-ancestors 'none'`,
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; "),
  },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Pin the Turbopack root to this project so a lockfile in a parent
  // directory is never inferred as the workspace root.
  turbopack: { root: process.cwd() },
  // The E2E suite (and Playwright's webServer readiness check) reach the dev
  // server via 127.0.0.1; without this, Next dev blocks its own dev resources
  // cross-origin and client JS never hydrates.
  allowedDevOrigins: ["127.0.0.1", "localhost"],
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
