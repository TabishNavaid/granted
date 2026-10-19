import { expect, test, type Page } from "@playwright/test";
import { quiet, watch } from "./helpers";

/**
 * The demo with no keys keeps each visitor's workspaces in their browser, so
 * it runs on serverless hosts where server memory does not last between
 * requests. These reload pages in the middle of a flow and check that what
 * the visitor did is still there, and that a reload during a run never saves
 * half of it.
 */
test.setTimeout(240_000);

const all = (page: Page) => page.getByRole("tab", { name: /^All/ });

test("an approval in the Inbox is still there after a reload", async ({ page }) => {
  await quiet(page);
  const problems = watch(page);
  await page.goto("/inbox");
  await expect(page.getByRole("heading", { name: "Waiting on you" })).toBeVisible();
  await expect(all(page)).toHaveText(/6/);
  await page.getByRole("button", { name: "Approve draft" }).first().click();
  await expect(page.getByText("Draft approved", { exact: true })).toBeVisible();
  await expect(all(page)).toHaveText(/5/);
  await page.getByRole("button", { name: "Approve plan" }).click();
  await expect(page.getByText(/plan approved/i).first()).toBeVisible();

  await page.reload();
  await expect(page.getByRole("heading", { name: "Waiting on you" })).toBeVisible();
  await expect(all(page)).toHaveText(/5/);
  await expect(page.getByRole("button", { name: "Approve plan" })).toHaveCount(0);
  // The approved draft moved on in the pipeline, and the sidebar count agrees.
  await page.goto("/pipeline");
  await expect(page.getByRole("heading", { name: /^Review/ })).toBeVisible();
  expect(problems).toEqual([]);
});

test("a bid's decision and compliance matrix survive reloads, and a reload mid-draft saves nothing half done", async ({ page }) => {
  await quiet(page);
  const problems = watch(page);
  await page.goto("/api/demo/open?sample=org_cibolo_line&next=/opportunities");
  await expect(page.getByRole("heading", { name: "From SAM.gov" })).toBeVisible();
  await page.getByRole("button", { name: "Add an RFP" }).first().click();
  await page.getByRole("button", { name: "Use the sample notice" }).click();
  await page.waitForURL("**/applications/**", { timeout: 120_000 });
  const bid = page.url().split("?")[0];
  await page.getByRole("button", { name: "Go", exact: true }).click();
  await expect(page.getByText(/Decided go by/)).toBeVisible();

  await page.reload();
  await expect(page.getByText(/Decided go by/)).toBeVisible();

  // Reload while the draft is being written: the saved copy is the one from before the run.
  await page.getByRole("button", { name: "Draft the proposal" }).click();
  await page.waitForTimeout(300);
  await page.reload();
  await expect(page.getByRole("button", { name: "Draft the proposal" })).toBeVisible();
  await page.getByRole("button", { name: "Draft the proposal" }).click();
  await expect(page.getByText(/requirements met/).first()).toBeVisible({ timeout: 120_000 });

  await page.goto(bid);
  await page.getByRole("tab", { name: /Compliance matrix/ }).click();
  const summary = await page.getByText(/\d+ met, \d+ partly/).first().innerText();
  await page.reload();
  await page.getByRole("tab", { name: /Compliance matrix/ }).click();
  await expect(page.getByRole("table").getByText("SDVOSB set-aside under VAAR 819.7004")).toBeVisible();
  await expect(page.getByText(summary, { exact: true }).first()).toBeVisible();
  await page.goto(`${bid}/draft`);
  await expect(page.getByRole("heading", { name: "Cover letter" })).toBeVisible();
  expect(problems).toEqual([]);
});

test("setup picks up where it was after a reload, including in the middle of reading the website", async ({ page }) => {
  await quiet(page);
  const problems = watch(page);
  await page.goto("/onboarding?type=nonprofit");
  await page.getByRole("button", { name: "Second Furrow Food Network" }).click();
  await page.getByRole("button", { name: "Skip for now" }).click();
  await page.waitForURL("**/onboarding/reading");
  const feed = page.getByRole("region", { name: "What it is doing" });
  await expect(feed.getByText("secondfurrow.org/about", { exact: false }).first()).toBeVisible({ timeout: 60_000 });

  // A reload mid-run starts the reading again; nothing from the interrupted run was saved.
  await page.reload();
  await page.waitForURL("**/onboarding/reading");
  await page.waitForURL("**/onboarding/profile", { timeout: 120_000 });
  await expect(page.getByText("Food distributed in 2025")).toBeVisible();

  await page.reload();
  await expect(page.getByText("Food distributed in 2025")).toBeVisible();
  await page.getByRole("button", { name: "Looks right, continue" }).click();
  await page.waitForURL("**/onboarding/gaps");
  await page.reload();
  await expect(page.locator("label[for=note]")).toContainText("know about Second Furrow");
  // Opening setup again goes to the step the visitor left on.
  await page.goto("/onboarding");
  await page.waitForURL("**/onboarding/gaps");
  expect(problems).toEqual([]);
});

test("without localStorage the demo keeps working and a reload in the same tab keeps changes", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, "localStorage", {
      get() {
        throw new DOMException("The user denied storage.", "SecurityError");
      },
    });
  });
  // With nothing remembered, the first-visit tour opens each time; skip it.
  const skipTour = () => page.getByRole("button", { name: "Skip the tour" }).click();
  await page.goto("/inbox");
  await skipTour();
  await expect(page.getByRole("heading", { name: "Waiting on you" })).toBeVisible();
  await expect(all(page)).toHaveText(/6/);
  await page.getByRole("button", { name: "Approve draft" }).first().click();
  await expect(all(page)).toHaveText(/5/);
  await page.reload();
  await skipTour();
  await expect(all(page)).toHaveText(/5/);
});
