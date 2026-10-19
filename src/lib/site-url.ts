/**
 * The public address of this deployment, with no configuration needed on
 * Vercel: NEXT_PUBLIC_SITE_URL when set, then the address Vercel provides,
 * then localhost.
 */
export function siteUrl(): string {
  const raw =
    process.env.NEXT_PUBLIC_SITE_URL ||
    (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "") ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "") ||
    `http://localhost:${process.env.PORT ?? 3000}`;
  return raw.replace(/\/$/, "");
}
