import { CANONICAL_URL } from "@/lib/brand";

/**
 * The address this deployment answers on, for links that must come back to
 * the same server: OAuth callbacks, magic-link redirects, and calendar feeds.
 * NEXT_PUBLIC_SITE_URL when set, then the address Vercel provides, then localhost.
 */
export function siteUrl(): string {
  const raw =
    process.env.NEXT_PUBLIC_SITE_URL ||
    (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "") ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "") ||
    `http://localhost:${process.env.PORT ?? 3000}`;
  return raw.replace(/\/$/, "");
}

/**
 * The public, canonical address: https://fundfellows.com unless
 * NEXT_PUBLIC_SITE_URL says otherwise. Canonical tags, the sitemap, robots,
 * social cards, and links in email use it, so a preview deployment never
 * competes with the real site in search.
 */
export function canonicalUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL || CANONICAL_URL).replace(/\/$/, "");
}
