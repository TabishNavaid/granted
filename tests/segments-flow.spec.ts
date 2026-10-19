import { expect, test } from "@playwright/test";
import { quiet, watch } from "./helpers";

/**
 * The firm, research, and student paths in the browser, on the demo's
 * recorded runs. The server must run with REPLAY_SPEED set (the Playwright
 * web server sets 10).
 */
test.setTimeout(240_000);

async function openFirm(page: import("@playwright/test").Page) {
  await page.goto("/inbox");
  await page.getByRole("button", { name: /Switch organization/ }).click();
  await page.getByRole("menu").getByText("Cibolo Line Architecture + Engineering", { exact: true }).click();
  await expect(page.getByRole("button", { name: /Organization: Cibolo Line/ })).toBeVisible();
}

test("a firm adds the sample RFP, decides, drafts, tracks addenda, and builds the SF 330", async ({ page }) => {
  await quiet(page);
  const problems = watch(page);
  await openFirm(page);
  await page.goto("/opportunities");
  await expect(page.getByRole("heading", { name: "From SAM.gov" })).toBeVisible();
  await expect(page.getByText(/Recorded from SAM.gov on/)).toBeVisible();
  await page.getByRole("button", { name: "Add an RFP" }).first().click();
  await page.getByRole("button", { name: "Use the sample notice" }).click();
  await page.waitForURL("**/applications/**", { timeout: 120_000 });
  const bid = page.url().split("?")[0];

  // Go/no-go: a score, the reasons behind it, and the solicitation's facts.
  await expect(page.getByRole("heading", { name: "Worth pursuing" })).toBeVisible();
  await expect(page.getByText("Fit with past projects")).toBeVisible();
  await expect(page.getByText(/You hold the status this set-aside requires/)).toBeVisible();
  await page.getByRole("button", { name: "Go", exact: true }).click();
  await expect(page.getByText(/Decided go by/)).toBeVisible();

  await page.getByRole("button", { name: "Draft the proposal" }).click();
  await expect(page.getByText(/requirements met/).first()).toBeVisible({ timeout: 120_000 });

  // The compliance matrix: every requirement with where it is set and its status.
  await page.getByRole("tab", { name: /Compliance matrix/ }).click();
  const matrix = page.getByRole("table");
  await expect(matrix.getByText("SDVOSB set-aside under VAAR 819.7004")).toBeVisible();
  await expect(matrix.getByRole("link", { name: "Relevant past projects" }).first()).toBeVisible();
  await matrix.getByRole("button", { name: "Only the first 20 pages are kept" }).click();
  await expect(matrix.getByText(/Only the first twenty \(20\) pages/)).toBeVisible();

  // Addenda: the notice's amendments, read and tracked.
  await page.getByRole("tab", { name: /Addenda/ }).click();
  await page.getByRole("button", { name: "Add the notice's next amendment" }).click();
  await expect(page.getByRole("heading", { name: "Addendum A0001" })).toBeVisible();
  await expect(page.getByText(/answers 4 questions/)).toBeVisible();

  // Fee: the structure, never a price.
  await page.getByRole("tab", { name: "Fee" }).click();
  await expect(page.getByText(/every number is yours/)).toBeVisible();
  await expect(page.getByText(/Brooks Act/)).toBeVisible();

  // SF 330: preview and a Word file.
  await page.getByRole("tab", { name: "SF 330" }).click();
  await expect(page.getByRole("heading", { name: /F\. Example projects \(10 of 10\)/ })).toBeVisible();
  // The Word file is built where the bid lives (in the browser, in the demo with no keys).
  const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("link", { name: "Download the SF 330 (Word)" }).click()]);
  expect(download.suggestedFilename()).toMatch(/^SF330-.*\.docx$/);
  const file = await download.createReadStream();
  const head: Buffer = await new Promise((resolve) => file.once("data", (c) => resolve(Buffer.from(c))));
  expect(head.subarray(0, 2).toString()).toBe("PK");

  // The draft cites the firm's records.
  await page.goto(`${bid}/draft`);
  await expect(page.getByRole("heading", { name: "Cover letter" })).toBeVisible();
  await expect(page.getByText("Certifications and licenses").first()).toBeVisible();
  await expect(page.getByRole("link", { name: /Bid: matrix, go\/no-go, fee/ })).toBeVisible();
  expect(problems).toEqual([]);
});

test("a firm's pipeline uses bid stages and its analytics break down by client, sector, and size", async ({ page }) => {
  await quiet(page);
  await openFirm(page);
  await page.goto("/pipeline");
  for (const stage of ["Found", "Go/no-go", "Preparing", "Shortlisted", "Interview"]) await expect(page.getByRole("heading", { name: new RegExp(`^${stage}`) })).toBeVisible();
  await page.goto("/analytics");
  await expect(page.getByRole("heading", { name: "By client" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "By sector" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "By project size" })).toBeVisible();
  await expect(page.getByText(/A no-go is a decision, not a loss/)).toBeVisible();
  await page.goto("/profile?tab=projects");
  await expect(page.getByRole("heading", { name: "Calaveras Lake Outpatient Clinic Renovation" })).toBeVisible();
});

test("a research team's setup reads its lab page and drafts a proposal with the funder's AI rule", async ({ page }) => {
  await quiet(page);
  const problems = watch(page);
  await page.goto("/onboarding?restart=1");
  await page.getByRole("radio", { name: "Research team" }).check();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.waitForURL("**/onboarding/profile", { timeout: 120_000 });
  await expect(page.getByText("Investigator: Dr. Anika Sorensen", { exact: false })).toBeVisible();
  await page.getByRole("button", { name: /Looks right/ }).click();
  await expect(page.getByRole("heading", { name: "What should we search for?" })).toBeVisible();
  await page.getByRole("button", { name: "Save and find funding" }).click();
  await page.getByRole("button", { name: "Start a proposal for this one" }).first().click({ timeout: 120_000 });
  await page.waitForURL("**/applications/**");
  await page.getByRole("button", { name: "Draft the research proposal" }).click();
  await expect(page.getByRole("heading", { name: "Project summary" })).toBeVisible({ timeout: 120_000 });
  await page.getByRole("tab", { name: "Checks" }).click();
  await expect(page.getByText(/rules on AI/).first()).toBeVisible();
  await page.goto("/profile?tab=funded");
  await expect(page.getByRole("heading", { name: "Programs that fund this work" })).toBeVisible();
  expect(problems).toEqual([]);
});

test("a student starts from a résumé, finds scholarships, and drafts an essay from their own experiences", async ({ page }) => {
  await quiet(page);
  const problems = watch(page);
  await page.goto("/onboarding?restart=1");
  await page.getByRole("radio", { name: "Individual" }).check();
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByRole("heading", { name: "Start from your résumé." })).toBeVisible();
  await page.getByRole("button", { name: "Use the sample résumé" }).click();
  await page.waitForURL("**/onboarding/profile");
  await expect(page.getByText("Mad River Cleanup Crew", { exact: false })).toBeVisible();
  await page.getByRole("button", { name: /find scholarships/ }).click();
  await expect(page.getByText("Bernard-Wentz Scholarship Fund scholarship")).toBeVisible({ timeout: 120_000 });
  await page.getByRole("button", { name: "Apply to this one" }).first().click();
  await page.waitForURL("**/applications/**");
  await page.getByRole("button", { name: "Draft my essay" }).click();
  await expect(page.getByText(/The first time I walked the Mad River/)).toBeVisible({ timeout: 120_000 });
  // A detail the résumé does not give becomes a question, not an invented story.
  await expect(page.getByText(/What happened after you gave the map to the watershed office/)).toBeVisible();
  expect(problems).toEqual([]);
});
