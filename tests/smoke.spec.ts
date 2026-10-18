import { expect, test } from "@playwright/test";

/** Every P0 route renders without a console error and shows its main heading. */
const routes: { path: string; heading: RegExp }[] = [
  { path: "/", heading: /matched grants arrive/i },
  { path: "/sign-in", heading: /welcome back/i },
  { path: "/sign-up", heading: /create your workspace/i },
  { path: "/onboarding", heading: /read up on you/i },
  { path: "/onboarding/documents", heading: /one to three documents/i },
  { path: "/onboarding/interview", heading: /a few questions/i },
  { path: "/onboarding/profile", heading: /look right/i },
  { path: "/onboarding/matches", heading: /three places to start/i },
  { path: "/inbox", heading: /good (morning|afternoon|evening)/i },
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

test("inbox approve removes the item and offers undo", async ({ page }) => {
  await page.goto("/inbox");
  const card = page.getByRole("article", { name: /email to tomas reyes/i });
  await expect(card).toBeVisible();
  await card.getByRole("button", { name: /approve email/i }).click();
  await expect(page.getByText("Email approved")).toBeVisible();
  await expect(card).toBeHidden();
  await page.getByRole("button", { name: /^undo$/i }).click();
  await expect(page.getByRole("article", { name: /email to tomas reyes/i })).toBeVisible();
});
