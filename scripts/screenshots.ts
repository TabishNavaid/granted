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
  await page.goto(`${base}/onboarding?type=nonprofit`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Second Furrow Food Network" }).click();
  await page.getByRole("button", { name: "Skip for now" }).click();
  await page.waitForURL("**/onboarding/reading");
  await page.getByText("Fact", { exact: true }).nth(5).waitFor({ timeout: 90_000 });
  await page.mouse.wheel(0, 330);
  await page.waitForTimeout(400);
}

/** Open a sample workspace from the switcher in the sidebar. */
async function openSample(page: Page, label: string) {
  await page.goto(`${base}/inbox`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: /Switch organization/ }).click();
  await page.getByRole("menu").getByText(label, { exact: true }).click();
  await page.waitForTimeout(1200);
}

let bidUrl = "";
/** The sample firm adds the sample VA notice and drafts it; the bid page is reused by the next shots. */
async function bidAdded(page: Page) {
  await openSample(page, "Cibolo Line Architecture + Engineering");
  await page.goto(`${base}/opportunities`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Add an RFP" }).first().click();
  await page.getByRole("button", { name: "Use the sample notice" }).click();
  await page.waitForURL("**/applications/**", { timeout: 120_000 });
  bidUrl = page.url().split("?")[0];
  await page.getByRole("button", { name: "Draft the proposal" }).click();
  await page.getByText("12 of 21 requirements met").first().waitFor({ timeout: 180_000 });
  await page.goto(bidUrl, { waitUntil: "networkidle" });
}
async function bidTab(page: Page, tab: string) {
  if (!bidUrl) await bidAdded(page);
  await page.goto(bidUrl, { waitUntil: "networkidle" });
  await page.getByRole("tab", { name: new RegExp(`^${tab}`) }).click();
  await page.waitForTimeout(500);
}

/** A research team's setup, then its first proposal drafted with the funder's AI rule on the checklist. */
async function researchDraft(page: Page) {
  await page.goto(`${base}/onboarding?restart=1`, { waitUntil: "networkidle" });
  await page.getByRole("radio", { name: "Research team" }).check();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.waitForURL("**/onboarding/profile", { timeout: 120_000 });
  await page.getByRole("button", { name: /Looks right/ }).click();
  await page.getByRole("button", { name: "Save and find funding" }).click();
  await page.getByRole("button", { name: "Start a proposal for this one" }).first().click({ timeout: 180_000 });
  await page.waitForURL("**/applications/**");
  await page.getByRole("button", { name: "Draft the research proposal" }).click();
  await page.getByRole("tab", { name: "Questions" }).waitFor({ timeout: 180_000 });
  await page.getByRole("tab", { name: "Checks" }).click();
  await page.waitForTimeout(600);
}

/** A student's setup from the sample résumé, then an essay in their own words. */
async function studentEssay(page: Page) {
  await page.goto(`${base}/onboarding?restart=1`, { waitUntil: "networkidle" });
  await page.getByRole("radio", { name: "Individual" }).check();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "Use the sample résumé" }).click();
  await page.waitForURL("**/onboarding/profile", { timeout: 60_000 });
  await page.getByRole("button", { name: /find scholarships/ }).click();
  await page.getByRole("button", { name: "Apply to this one" }).first().click({ timeout: 120_000 });
  await page.waitForURL("**/applications/**");
  await page.getByRole("button", { name: "Draft my essay" }).click();
  await page.getByRole("tab", { name: "Questions" }).waitFor({ timeout: 120_000 });
  await page.waitForTimeout(600);
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
  { name: "firm-opportunities", path: "", run: async (p) => { await openSample(p, "Cibolo Line Architecture + Engineering"); await p.goto(`${base}/opportunities`, { waitUntil: "networkidle" }); await p.mouse.wheel(0, 420); await p.waitForTimeout(400); } },
  { name: "bid-decide", path: "", run: bidAdded },
  { name: "bid-matrix", path: "", run: (p) => bidTab(p, "Compliance matrix") },
  { name: "bid-sf330", path: "", run: (p) => bidTab(p, "SF 330") },
  { name: "bid-fee", path: "", run: (p) => bidTab(p, "Fee") },
  { name: "bid-draft", path: "", run: async (p) => { if (!bidUrl) await bidAdded(p); await p.goto(`${bidUrl}/draft`, { waitUntil: "networkidle" }); await p.waitForTimeout(600); } },
  { name: "firm-records", path: "", run: async (p) => { await openSample(p, "Cibolo Line Architecture + Engineering"); await p.goto(`${base}/profile?tab=projects`, { waitUntil: "networkidle" }); } },
  { name: "firm-pipeline", path: "", run: async (p) => { await openSample(p, "Cibolo Line Architecture + Engineering"); await p.goto(`${base}/pipeline`, { waitUntil: "networkidle" }); } },
  { name: "research-draft", path: "", run: researchDraft },
  { name: "student-essay", path: "", run: studentEssay },
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
