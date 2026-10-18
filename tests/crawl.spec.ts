import { expect, test, type Page } from "@playwright/test";
import { ALL_ROUTES, quiet, watch } from "./helpers";

/**
 * Visits every route, checks every internal link resolves, clicks every
 * button it can reach, and submits every form empty and then filled. Fails on
 * console errors, unhandled rejections, 404s, 500s, or a button that changes
 * nothing. Runs on the demo server, so it is safe to click everything.
 */

const DANGEROUS = /delete workspace|remove member|sign out|log out|open next\.js dev tools|open in editor/i;

async function fillValid(page: Page, form: import("@playwright/test").Locator) {
  const inputs = form.locator("input:not([type=hidden]):not([type=checkbox]):not([type=radio]):not([type=file]):not([disabled]), textarea:not([disabled])");
  const n = await inputs.count();
  for (let i = 0; i < n; i++) {
    const el = inputs.nth(i);
    if (!(await el.isVisible())) continue;
    const type = (await el.getAttribute("type")) ?? "text";
    const name = ((await el.getAttribute("name")) ?? (await el.getAttribute("id")) ?? "").toLowerCase();
    const mode = (await el.getAttribute("inputmode")) ?? "";
    let value = "Test value";
    if (type === "email" || /email/.test(name)) value = "test@example.org";
    else if (type === "url" || mode === "url" || /website|url/.test(name)) value = "riverbendyouth.org";
    else if (type === "password") value = "password123";
    else if (type === "number" || mode === "numeric" || /amount|ein|count|people/.test(name)) value = /ein/.test(name) ? "473382911" : "5";
    else if (type === "date") value = "2026-12-01";
    else if ((await el.evaluate((e) => e.tagName)) === "TEXTAREA") value = "A short test message from the crawler.";
    await el.fill(value).catch(() => undefined);
  }
}

// The design and art galleries are static component samples, not product screens.
for (const route of ALL_ROUTES.filter((r) => r !== "/design" && r !== "/art-review")) {
  test(`crawl ${route}`, async ({ page, request, context }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]).catch(() => undefined);
    await quiet(page);
    const problems = watch(page);
    const res = await page.goto(route, { waitUntil: "networkidle" });
    if (route.includes("does-not-exist")) {
      expect(res?.status()).toBe(404);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      return;
    }
    expect(res?.ok(), `${route} should load`).toBeTruthy();
    await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();

    // Every internal link resolves.
    const hrefs = await page.locator("a[href]").evaluateAll((as) => as.map((a) => (a as HTMLAnchorElement).getAttribute("href") ?? ""));
    const internal = Array.from(new Set(hrefs.filter((h) => h.startsWith("/") && !h.startsWith("//") && !h.startsWith("/api/") && !h.endsWith(".ics"))));
    for (const h of internal) {
      const r = await request.get(h.split("#")[0] || "/", { maxRedirects: 5 });
      expect(r.status(), `link ${h} on ${route}`).toBeLessThan(400);
    }

    // Every visible button does something: the page changes, a dialog opens, a request fires, or the URL moves.
    // Submit buttons are exercised by the form pass below, where native validation is expected to hold an empty form.
    const buttons = page.locator("button:visible:not([disabled]):not([type=submit]), [role=button]:visible");
    const count = await buttons.count();
    const dead: string[] = [];
    for (let i = 0; i < Math.min(count, 60); i++) {
      if (page.url().split("?")[0] !== new URL(route, page.url()).href.split("?")[0]) break; // a click navigated away; stop here
      const b = page.locator("button:visible:not([disabled]):not([type=submit]), [role=button]:visible").nth(i);
      if (!(await b.count())) break;
      const label = ((await b.getAttribute("aria-label")) ?? (await b.innerText().catch(() => ""))).trim().replace(/\s+/g, " ").slice(0, 60);
      if (!label || DANGEROUS.test(label)) continue;
      // Formatting toggles depend on where the cursor is; the editor is covered by the workspace flow test.
      if (await b.evaluate((el) => Boolean(el.closest("[role=toolbar]")) && (el.hasAttribute("aria-pressed") || /undo|redo/i.test(el.getAttribute("aria-label") ?? "")))) continue;
      // Citation and gap chips live inside the editor and are covered by the workspace flow test.
      if (await b.evaluate((el) => el.classList.contains("cite-chip") || el.classList.contains("gap-chip"))) continue;
      // A tab that is already selected has nothing to do.
      if ((await b.getAttribute("aria-selected")) === "true" || (await b.getAttribute("data-state")) === "active" || (await b.getAttribute("aria-checked")) === "true") continue;
      const snapshot = () =>
        page.evaluate(() => {
          let h = 5381;
          const html = document.body.innerHTML;
          for (let i = 0; i < html.length; i++) h = ((h << 5) + h + html.charCodeAt(i)) | 0;
          return { html: h, url: location.href, root: document.documentElement.className, dialogs: document.querySelectorAll("[role=dialog], [role=menu], [role=listbox], [role=status]").length };
        });
      const before = await snapshot();
      let requests = 0;
      const onReq = () => requests++;
      let dialogs = 0;
      const onDialog = async (d: import("@playwright/test").Dialog) => {
        dialogs++;
        await d.dismiss();
      };
      let choosers = 0;
      const onChooser = () => choosers++;
      page.on("request", onReq);
      page.on("dialog", onDialog);
      page.on("filechooser", onChooser);
      await b.click({ timeout: 3000, trial: false }).catch(() => undefined);
      // Most buttons call a server action; give the round trip time to land.
      await page.waitForTimeout(900);
      await page.waitForLoadState("networkidle", { timeout: 3000 }).catch(() => undefined);
      page.off("request", onReq);
      page.off("dialog", onDialog);
      page.off("filechooser", onChooser);
      const after = await snapshot();
      const changed = before.html !== after.html || before.url !== after.url || before.root !== after.root || before.dialogs !== after.dialogs || requests > 0 || dialogs > 0 || choosers > 0;
      if (!changed) dead.push(label);
      await page.keyboard.press("Escape").catch(() => undefined);
    }
    expect(dead, `buttons that did nothing on ${route}`).toEqual([]);

    // Forms: submit empty, then filled. Neither may throw.
    if (page.url().includes(route.split("?")[0])) {
      const forms = page.locator("form:visible");
      const fcount = await forms.count();
      for (let i = 0; i < Math.min(fcount, 4); i++) {
        const f = page.locator("form:visible").nth(i);
        if (!(await f.count())) break;
        const submit = f.locator("button[type=submit]:visible").first();
        if (!(await submit.count())) continue;
        await submit.click({ timeout: 2000 }).catch(() => undefined);
        await page.waitForTimeout(300);
        if (!(await f.count())) continue;
        await fillValid(page, f);
        await f.locator("button[type=submit]:visible").first().click({ timeout: 2000 }).catch(() => undefined);
        await page.waitForTimeout(600);
      }
    }
    expect(problems, `problems on ${route}`).toEqual([]);
  });
}
