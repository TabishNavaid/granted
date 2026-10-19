import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site-url";

const base = siteUrl();

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/inbox", "/opportunities", "/applications", "/pipeline", "/calendar", "/outreach", "/profile", "/activity", "/settings", "/connections", "/social", "/onboarding", "/auth", "/api", "/design"] }],
    sitemap: `${base}/sitemap.xml`,
  };
}
