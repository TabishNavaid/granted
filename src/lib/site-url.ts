/**
 * The public address of this deployment, with no configuration needed on
 * the common free hosts: NEXT_PUBLIC_SITE_URL when set, then the address
 * Render or Vercel provide, then localhost.
 */
export function siteUrl(): string {
  const raw =
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.RENDER_EXTERNAL_URL ||
    (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "") ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "") ||
    `http://localhost:${process.env.PORT ?? 3000}`;
  return raw.replace(/\/$/, "");
}
