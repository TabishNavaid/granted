import { expect, test } from "@playwright/test";
import { quiet, watch } from "./helpers";

/**
 * The public demo: an unknown site gets an honest answer, a sample's recorded
 * run streams through the live code from website to letter, the demo is
 * labelled, and two visitors never see each other's changes. The server must
 * run with REPLAY_SPEED set (the Playwright web server sets 10).
 */
test.setTimeout(180_000);

test("an unknown site gets a sample, and the recorded run goes from website to a cited letter", async ({ page }) => {
  await quiet(page);
  const problems = watch(page);
  await page.goto("/onboarding?restart=1");
  // The first question is who is applying; a nonprofit goes on to its website.
  await page.getByRole("radio", { name: "Nonprofit" }).check();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByLabel("Website").fill("example-food-pantry.org");
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByRole("heading", { name: "The demo cannot read example-food-pantry.org." })).toBeVisible();
  await page.getByRole("radio", { name: /Second Furrow Food Network/ }).check();
  await page.getByRole("button", { name: "Continue with this sample" }).click();

  await page.getByRole("button", { name: "Skip for now" }).click();
  await expect(page.getByRole("heading", { name: "Reading secondfurrow.org." })).toBeVisible();
  await expect(page.getByText(/This replays a reading of the sample site recorded on/)).toBeVisible();
  // The live feed shows pages read, then facts with the passage each came from, then what the source check set aside.
  const feed = page.getByRole("region", { name: "What it is doing" });
  await expect(feed.getByText("secondfurrow.org/about", { exact: false }).first()).toBeVisible({ timeout: 60_000 });
  await expect(feed.getByText("Set aside", { exact: true }).first()).toBeVisible({ timeout: 60_000 });

  await page.waitForURL("**/onboarding/profile", { timeout: 90_000 });
  await expect(page.getByText("Food distributed in 2025")).toBeVisible();
  // Facts the recorded model made up or misquoted never reach this screen.
  await expect(page.getByText("Meals provided in 2025")).toHaveCount(0);
  await page.getByRole("button", { name: "Looks right, continue" }).click();

  await page.waitForURL("**/onboarding/gaps");
  await expect(page.locator("label[for=note]")).toContainText("know about Second Furrow");
  await page.locator("#note").fill("We are opening a second warehouse bay next spring.");
  await page.getByRole("button", { name: "Save and find my matches" }).click();

  await page.waitForURL("**/onboarding/matches");
  await expect(page.getByRole("heading", { name: /places to start/ })).toBeVisible({ timeout: 120_000 });
  await expect(page.getByText("Private foundation").first()).toBeVisible();
  await expect(page.getByText(/IRS filing/).first()).toBeVisible();

  await page.getByRole("button", { name: "Draft a letter for this one" }).first().click();
  await page.waitForURL(/\/applications\//, { timeout: 30_000 });
  await expect(page.getByText("Writing the letter").first()).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText("Paragraph", { exact: true }).first()).toBeVisible({ timeout: 90_000 });
  // The editor arrives with citations and the questions the writer could not answer from facts.
  await expect(page.getByText(/^Question 1/).first()).toBeVisible({ timeout: 90_000 });
  await page.getByPlaceholder("Your answer").first().fill("$10,000");
  await page.getByRole("button", { name: "Save" }).first().click();
  await expect(page.getByText("Answer saved", { exact: true })).toBeVisible({ timeout: 30_000 });
  expect(problems).toEqual([]);
});

test("the demo says what is real and what is replayed", async ({ page }) => {
  await quiet(page);
  await page.goto("/inbox");
  await page.getByRole("button", { name: /Demo data/ }).first().click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toContainText("fictional");
  await expect(dialog).toContainText("No AI model is called");
  await expect(dialog).toContainText("IRS Form 990-PF");
});

test("Connections and Social are full screens, not coming soon", async ({ page }) => {
  await quiet(page);
  await page.goto("/inbox");
  const nav = page.getByRole("navigation", { name: "Primary" }).first();
  await expect(nav).toBeVisible();
  await expect(page.locator("aside")).not.toContainText("Soon");
  await page.goto("/connections");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(/Connections/);
});

test("two visitors never see each other's changes", async ({ browser }) => {
  const a = await browser.newContext();
  const b = await browser.newContext();
  const pa = await a.newPage();
  const pb = await b.newPage();
  // The first-visit Inbox tour would cover the page.
  await quiet(pa);
  await quiet(pb);
  await pa.goto("/inbox", { waitUntil: "networkidle" });
  await pb.goto("/inbox", { waitUntil: "networkidle" });
  // Visitor A switches to another sample organization.
  // Under load the first click can land before the page hydrates; open the menu until it shows.
  await expect(async () => {
    await pa.getByRole("button", { name: /Switch organization/ }).first().click();
    await expect(pa.getByRole("menuitem", { name: /Pine Hollow Family Health/ })).toBeVisible({ timeout: 3_000 });
  }).toPass({ timeout: 60_000 });
  await pa.getByRole("menuitem", { name: /Pine Hollow Family Health/ }).click();
  // The switch lands on setup for an empty sample; any signed-in page then shows the new organization.
  await expect
    .poll(
      async () => {
        await pa.goto("/settings");
        return pa.locator("aside").innerText();
      },
      { timeout: 60_000 },
    )
    .toContain("Pine Hollow Family Health");
  // Visitor B still sees the sample they started on.
  await pb.reload();
  await expect(pb.locator("aside")).toContainText("Riverbend Youth Collective");
  await a.close();
  await b.close();
});

const MARKETING = ["/product", "/product/matching", "/product/drafting", "/product/deadlines", "/product/outreach", "/product/connections", "/product/analytics", "/how-it-works", "/who-its-for", "/for/nonprofits", "/for/architecture-and-construction", "/for/research", "/for/students", "/roadmap", "/about"];
for (const path of MARKETING) {
  test(`marketing ${path} renders, with honest copy`, async ({ page }) => {
    const problems = watch(page);
    const res = await page.goto(path);
    expect(res?.ok()).toBe(true);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    const text = await page.locator("main").innerText();
    expect(text, "no em or en dashes").not.toMatch(/[–—]/);
    expect(text, "no exclamation marks").not.toMatch(/!/);
    expect(problems.filter((p) => !/\/screens\//.test(p))).toEqual([]);
  });
}
