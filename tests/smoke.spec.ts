import { expect, test } from "@playwright/test";

/** Every P0 route renders without a console error and shows its main heading. */
const routes: { path: string; heading: RegExp }[] = [
  { path: "/", heading: /grants for the people doing the work/i },
  { path: "/pricing", heading: /simple plans/i },
  { path: "/about", heading: /people doing the work/i },
  { path: "/security", heading: /handle your data/i },
  { path: "/privacy", heading: /privacy policy/i },
  { path: "/terms", heading: /terms of service/i },
  { path: "/contact", heading: /write to us/i },
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
  { path: "/art-review", heading: /images for/i },
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

test("inbox approve stamps the item, files it, and offers undo", async ({ page }) => {
  await page.goto("/inbox");
  const card = page.getByRole("article").filter({ has: page.getByRole("button", { name: /^(approve|save|update|add to)/i }) }).first();
  await expect(card).toBeVisible();
  const title = await card.getByRole("heading", { level: 3 }).innerText();
  await card.getByRole("button", { name: /^(approve|save|update|add to)/i }).first().click();
  await expect(card.getByRole("img", { name: /^(approved|saved|scheduled|answered|updated)/i })).toBeVisible();
  await expect(page.getByRole("button", { name: /^undo$/i })).toBeVisible();
  await expect(page.getByRole("article", { name: title })).toBeHidden({ timeout: 5000 });
  await page.getByRole("button", { name: /^undo$/i }).click();
  await expect(page.getByRole("article", { name: title })).toBeVisible();
});
