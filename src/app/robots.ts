import type { MetadataRoute } from "next";
import { canonicalUrl } from "@/lib/site-url";

const base = canonicalUrl();

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/admin", "/inbox", "/opportunities", "/applications", "/pipeline", "/calendar", "/outreach", "/profile", "/activity", "/settings", "/connections", "/social", "/onboarding", "/auth", "/api", "/design"] }],
    sitemap: `${base}/sitemap.xml`,
  };
}
