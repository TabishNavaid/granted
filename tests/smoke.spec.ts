import { expect, test } from "@playwright/test";

/** Every P0 route renders without a console error and shows its main heading. */
const routes: { path: string; heading: RegExp }[] = [
  { path: "/", heading: /grants for the people doing the work/i },
  { path: "/sign-in", heading: /welcome back/i },
  { path: "/sign-up", heading: /create your workspace/i },
  { path: "/onboarding", heading: /who you are/i },
  { path: "/onboarding/documents", heading: /one to three documents/i },
  { path: "/onboarding/interview", heading: /a few questions/i },
  { path: "/onboarding/profile", heading: /look right/i },
  { path: "/onboarding/matches", heading: /three places to start/i },
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
  { path: "/connections", heading: /^connections$/i },
  { path: "/social", heading: /^social$/i },
  { path: "/design", heading: /tokens and components/i },
  { path: "/drawings-review", heading: /^drawings$/i },
];

for (const r of routes) {
  test(`renders ${r.path}`, async ({ page }) => {
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

test("the old image credits page sends you to the drawings", async ({ page }) => {
  await page.goto("/art-review");
  await expect(page).toHaveURL(/\/drawings-review$/);
});

test("inbox approve grows a flower, files the item, and offers undo", async ({ page }) => {
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
  await expect(page.getByText(/so far: \d+ approved/i)).toBeVisible();
  await page.getByRole("button", { name: /^undo$/i }).click();
  await expect(page.getByRole("article", { name: title })).toBeVisible();
});

test("with reduced motion the landing hero shows its first item already approved", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  const first = page.getByRole("article").first();
  await expect(first.getByText(/^approved$/i)).toBeVisible();
  await page.getByRole("button", { name: /^approve email$/i }).click();
  await expect(page.getByRole("button", { name: /^approve email$/i })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /^undo$/i })).toBeVisible();
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
