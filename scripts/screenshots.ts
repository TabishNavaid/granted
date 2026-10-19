/**
 * Generates the landing page screenshots from the real app running on demo
 * data. Capture from a production build so no dev tooling lands in the shots:
 *
 *   npm run build && PORT=3100 npm run start   (in one terminal)
 *   npx tsx scripts/screenshots.ts             (in another)
 */
import { chromium } from "@playwright/test";
import sharp from "sharp";
import { mkdirSync } from "node:fs";
import path from "node:path";

const base = process.env.BASE_URL ?? `http://localhost:${process.env.PORT ?? "3100"}`;
const out = path.join(process.cwd(), "public", "screens");

type Page = import("@playwright/test").Page;

/** The reading screen mid-run: a sample's recorded setup, with facts arriving in the live feed. */
async function readingMidRun(page: Page) {
  await page.goto(`${base}/onboarding?restart=1`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Second Furrow Food Network" }).click();
  await page.getByRole("button", { name: "Skip for now" }).click();
  await page.waitForURL("**/onboarding/reading");
  await page.getByText("Fact", { exact: true }).nth(5).waitFor({ timeout: 90_000 });
  await page.mouse.wheel(0, 330);
  await page.waitForTimeout(400);
}

const shots: { name: string; path: string; height?: number; run?: (page: Page) => Promise<void>; scroll?: number }[] = [
  { name: "inbox", path: "/inbox", height: 900 },
  { name: "opportunities", path: "/opportunities", height: 900 },
  { name: "opportunity", path: "/opportunities/opp_meridian_2027", height: 900 },
  { name: "workspace", path: "/applications/app_meridian", height: 900 },
  { name: "calendar", path: "/calendar", height: 900 },
  { name: "profile", path: "/onboarding/profile", height: 900 },
  { name: "pipeline", path: "/pipeline", height: 900 },
  { name: "funder", path: "/funders/pf_310727384", height: 900 },
  { name: "analytics", path: "/analytics", height: 900 },
  { name: "outreach", path: "/outreach", height: 900 },
  { name: "connections", path: "/connections", height: 900 },
  { name: "year-plan", path: "/calendar?view=year", height: 900 },
  { name: "reading", path: "", height: 900, run: readingMidRun },
];

async function main() {
  mkdirSync(out, { recursive: true });
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2, colorScheme: "light", reducedMotion: "reduce" });
  const page = await context.newPage();
  // The first-visit tour would dim the Inbox under its dialog.
  await page.addInitScript(() => localStorage.setItem("inbox_tour_seen", "1"));
  const only = process.argv.slice(2);
  for (const s of shots.filter((x) => !only.length || only.includes(x.name))) {
    if (s.run) await s.run(page);
    else {
      await page.goto(`${base}${s.path}`, { waitUntil: "networkidle" });
      await page.waitForTimeout(600);
    }
    // The visible viewport, wherever the page is scrolled to.
    const png = await page.screenshot({ fullPage: false });
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
