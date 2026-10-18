import type { MetadataRoute } from "next";

const base = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/inbox", "/opportunities", "/applications", "/pipeline", "/calendar", "/outreach", "/profile", "/activity", "/settings", "/connections", "/social", "/onboarding", "/auth", "/api", "/design", "/art-review", "/drawings-review"] }],
    sitemap: `${base}/sitemap.xml`,
  };
}
