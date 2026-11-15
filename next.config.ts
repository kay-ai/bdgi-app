import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "Permissions-Policy", value: "camera=(), geolocation=(), microphone=(self)" },
];

const config: NextConfig = {
  poweredByHeader: false,
  // Lets a production build run beside `next dev` without sharing .next (NEXT_DIST_DIR=.next-build).
  distDir: process.env.NEXT_DIST_DIR || ".next",
  serverExternalPackages: ["@electric-sql/pglite"],
  async headers() {
    return [
      { source: "/((?!embed/).*)", headers: [...securityHeaders, { key: "X-Frame-Options", value: "DENY" }] },
      { source: "/embed/:path*", headers: [...securityHeaders, { key: "Content-Security-Policy", value: "frame-ancestors *" }] },
    ];
  },
};

export default withNextIntl(config);
