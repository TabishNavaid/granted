/**
 * Generates the landing page screenshots from the real app running on demo
 * data. Start the dev server first (PORT=3100 npm run dev) or pass BASE_URL.
 *
 *   npx tsx scripts/screenshots.ts
 */
import { chromium } from "@playwright/test";
import sharp from "sharp";
import { mkdirSync } from "node:fs";
import path from "node:path";

const base = process.env.BASE_URL ?? `http://localhost:${process.env.PORT ?? "3100"}`;
const out = path.join(process.cwd(), "public", "screens");

const shots: { name: string; path: string; height?: number; before?: string }[] = [
  { name: "inbox", path: "/inbox", height: 900 },
  { name: "opportunities", path: "/opportunities", height: 900 },
  { name: "opportunity", path: "/opportunities/opp_meridian_2027", height: 900 },
  { name: "workspace", path: "/applications/app_meridian", height: 900 },
  { name: "calendar", path: "/calendar", height: 900 },
  { name: "profile", path: "/onboarding/profile", height: 900 },
  { name: "pipeline", path: "/pipeline", height: 900 },
];

async function main() {
  mkdirSync(out, { recursive: true });
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2, colorScheme: "light", reducedMotion: "reduce" });
  const page = await context.newPage();
  for (const s of shots) {
    await page.goto(`${base}${s.path}`, { waitUntil: "networkidle" });
    await page.waitForTimeout(600);
    const png = await page.screenshot({ clip: { x: 0, y: 0, width: 1440, height: s.height ?? 900 } });
    // WebP at 2x keeps the text crisp at a fraction of the PNG size.
    await sharp(png).webp({ quality: 82 }).toFile(path.join(out, `${s.name}.webp`));
    console.log(`wrote ${s.name}.webp`);
  }
  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
