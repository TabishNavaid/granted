import { expect, test } from "@playwright/test";

/** Every P0 route renders without a console error and shows its main heading. */
const routes: { path: string; heading: RegExp }[] = [
  { path: "/", heading: /grants, bids, and scholarships from your own records/i },
  { path: "/pricing", heading: /simple plans/i },
  { path: "/about", heading: /people doing the work/i },
  { path: "/security", heading: /handle your data/i },
  { path: "/privacy", heading: /privacy policy/i },
  { path: "/terms", heading: /terms of service/i },
  { path: "/contact", heading: /write to us/i },
  { path: "/sign-in", heading: /welcome back/i },
  { path: "/sign-up", heading: /create your workspace/i },
  { path: "/onboarding?restart=1", heading: /Who is applying/i },
  { path: "/onboarding?type=nonprofit", heading: /organization's website/i },
  { path: "/onboarding/ein", heading: /know your ein/i },
  { path: "/onboarding/gaps", heading: /did not say|one question before/i },
  { path: "/onboarding/profile", heading: /look right/i },
  { path: "/onboarding/matches", heading: /places to start|nothing strong|looking for grants/i },
  { path: "/inbox", heading: /waiting on you/i },
  { path: "/opportunities", heading: /^opportunities$/i },
  { path: "/opportunities/opp_meridian_2027", heading: /youth development grants 2027/i },
  { path: "/applications/app_meridian", heading: /youth development grants 2027/i },
  { path: "/applications/app_larkspur", heading: /education equity letter of inquiry/i },
  { path: "/pipeline", heading: /^pipeline$/i },
  { path: "/calendar", heading: /^calendar$/i },
  { path: "/profile", heading: /profile and knowledge/i },
  { path: "/activity", heading: /^activity$/i },
  { path: "/settings", heading: /^settings$/i },
  { path: "/outreach", heading: /^outreach$/i },
  { path: "/connections", heading: /^connections$/i },
  { path: "/social", heading: /^social$/i },
  { path: "/settings/integrations", heading: /^integrations$/i },
  { path: "/design", heading: /tokens and components/i },
];

for (const r of routes) {
  test(`renders ${r.path}`, async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem("inbox_tour_seen", "1"));
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (m) => {
      if (m.type() === "error") errors.push(m.text());
    });
    const res = await page.goto(r.path);
    expect(res?.ok()).toBeTruthy();
    await expect(page.getByRole("heading", { level: 1, name: r.heading })).toBeVisible();
    expect(errors, `console errors on ${r.path}`).toEqual([]);
  });
}

test("inbox approve opens a flower, files the item, and offers undo", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("inbox_tour_seen", "1"));
  await page.goto("/inbox");
  const card = page.getByRole("article").filter({ has: page.getByRole("button", { name: /^(approve|save|update|add to)/i }) }).first();
  await expect(card).toBeVisible();
  const title = await card.getByRole("heading", { level: 3 }).innerText();
  const approved = page.getByRole("article", { name: title });
  await card.getByRole("button", { name: /^(approve|save|update|add to)/i }).first().click();
  await expect(approved.getByText(/^(approved|saved|scheduled|answered|updated)$/i)).toBeVisible();
  await expect(approved.getByText("Just now")).toBeVisible();
  await expect(page.getByRole("button", { name: /^undo$/i })).toBeVisible();
  await expect(page.getByRole("article", { name: title })).toBeHidden({ timeout: 5000 });
  await page.getByRole("button", { name: /^undo$/i }).click();
  await expect(page.getByRole("article", { name: title })).toBeVisible();
});

test("inbox previews read their numbers from the data", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("inbox_tour_seen", "1"));
  await page.goto("/inbox");
  // Meridian has seven sections and only Sustainability is empty.
  const draft = page.getByRole("article", { name: /meridian family foundation/i });
  await expect(draft.getByText("6 of 7 sections drafted")).toBeVisible();
  await expect(draft.getByText("86%")).toBeVisible();
  // The attendance update cites the passage the outcomes summary actually contains.
  await page.getByRole("button", { name: /^open update a fact: average attendance$/i }).click();
  const fact = page.getByRole("article", { name: /average attendance/i });
  await fact.getByRole("button", { name: /program outcomes summary/i }).click();
  await expect(page.getByText("Average attendance across all sites, 2025-26: 89%")).toBeVisible();
});

test("marking a grant won fills the screen with a meadow", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/pipeline");
  await page.getByRole("button", { name: /^actions for /i }).first().click();
  await page.getByRole("menuitem", { name: /^won$/i }).click();
  await page.getByRole("button", { name: /^save outcome$/i }).click();
  const dialog = page.getByRole("dialog", { name: /funded/i });
  await expect(dialog).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
});
