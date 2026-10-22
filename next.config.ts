import type { NextConfig } from "next";

const dev = process.env.NODE_ENV !== "production";
const supabase = (() => {
  try {
    return process.env.NEXT_PUBLIC_SUPABASE_URL ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).origin : "";
  } catch {
    return "";
  }
})();

// Next.js inlines small scripts and styles, so script-src keeps 'unsafe-inline'; everything else is same origin,
// plus the Supabase project (API, storage uploads, realtime) and Vercel Analytics (served from this origin).
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${dev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  `connect-src 'self'${supabase ? ` ${supabase} ${supabase.replace(/^http/, "ws")}` : ""}${dev ? " ws: http://localhost:* http://127.0.0.1:*" : ""}`,
  "worker-src 'self' blob:",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "object-src 'none'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // The floating dev badge covers the sidebar footer and lands in screenshots.
  devIndicators: false,
  // Landing screenshots are UI text; 90 keeps it crisp. 75 is the default for everything else.
  images: { qualities: [75, 90] },
  // pdf-parse and cheerio run on the server only and should not be bundled.
  serverExternalPackages: ["pdf-parse"],
  poweredByHeader: false,
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      // Brand files and product screenshots change only with a deploy; cache them for a day, serve stale for a week.
      { source: "/:dir(brand|screens|art)/:file*", headers: [{ key: "Cache-Control", value: "public, max-age=86400, stale-while-revalidate=604800" }] },
    ];
  },
  async redirects() {
    return [
      { source: "/pricing", destination: "/free", permanent: true },
      // www goes to the apex, which is the canonical address. Vercel's domain setting does the same; this covers both.
      { source: "/:path*", has: [{ type: "host", value: "www.fundfellows.com" }], destination: "https://fundfellows.com/:path*", permanent: true },
    ];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
