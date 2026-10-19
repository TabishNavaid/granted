import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site-url";

const base = siteUrl();

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return [
    "/",
    "/product",
    "/product/matching",
    "/product/drafting",
    "/product/deadlines",
    "/product/outreach",
    "/product/connections",
    "/product/analytics",
    "/how-it-works",
    "/who-its-for",
    "/for/nonprofits",
    "/for/architecture-and-construction",
    "/for/research",
    "/for/students",
    "/pricing",
    "/roadmap",
    "/about",
    "/security",
    "/privacy",
    "/terms",
    "/contact",
    "/sign-in",
    "/sign-up",
  ].map((path) => ({
    url: `${base}${path}`,
    lastModified: now,
    changeFrequency: path === "/" ? "weekly" : "monthly",
    priority: path === "/" ? 1 : 0.6,
  }));
}
