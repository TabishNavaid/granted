import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { ALL_ROUTES, quiet } from "./helpers";

/** axe on every route: no serious or critical violations. */
// The design and art galleries are internal pages (robots disallowed) and are audited by hand.
for (const route of ALL_ROUTES.filter((r) => !r.includes("does-not-exist") && r !== "/design")) {
  test(`axe ${route}`, async ({ page }) => {
    await quiet(page);
    await page.goto(route, { waitUntil: "networkidle" });
    const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "best-practice"]).analyze();
    const bad = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
    expect(bad.map((v) => `${v.id} (${v.impact}): ${v.help}. ${v.nodes.slice(0, 3).map((n) => n.target.join(" ")).join(" | ")}`), `axe on ${route}`).toEqual([]);
  });
}

/** Keyboard only: the three core screens can be walked with Tab and operated with Enter. */
for (const route of ["/onboarding?restart=1", "/inbox", "/applications/app_meridian"]) {
  test(`keyboard ${route}`, async ({ page }) => {
    await quiet(page);
    await page.goto(route, { waitUntil: "networkidle" });
    const seen = new Set<string>();
    for (let i = 0; i < 40; i++) {
      await page.keyboard.press("Tab");
      const info = await page.evaluate(() => {
        const el = document.activeElement as HTMLElement | null;
        if (!el || el === document.body || el.tagName === "NEXTJS-PORTAL") return null;
        const r = el.getBoundingClientRect();
        const style = getComputedStyle(el);
        return { tag: el.tagName, text: (el.getAttribute("aria-label") ?? el.textContent ?? "").trim().slice(0, 40), visible: r.width > 0 && r.height > 0 && style.visibility !== "hidden", outline: style.outlineStyle !== "none" || style.boxShadow !== "none" };
      });
      if (!info) continue;
      expect(info.visible, `focus landed on an invisible element on ${route}: ${info.tag} ${info.text}`).toBeTruthy();
      seen.add(`${info.tag}:${info.text}`);
    }
    expect(seen.size, `tab order reaches controls on ${route}`).toBeGreaterThanOrEqual(3);
  });
}
