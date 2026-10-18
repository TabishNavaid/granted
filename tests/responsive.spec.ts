import { expect, test } from "@playwright/test";
import { ALL_ROUTES, quiet } from "./helpers";

/** No horizontal overflow and no tiny tap targets at phone, tablet, and desktop widths. */
const widths = [375, 768, 1440];

for (const width of widths) {
  // The design and art galleries are internal dev pages and are not held to the product's layout rules.
  for (const route of ALL_ROUTES.filter((r) => !r.includes("does-not-exist") && r !== "/design")) {
    test(`${width}px ${route}`, async ({ page }) => {
      await quiet(page);
      await page.setViewportSize({ width, height: 900 });
      await page.goto(route, { waitUntil: "networkidle" });
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow, `horizontal overflow of ${overflow}px on ${route} at ${width}`).toBeLessThanOrEqual(1);
      const small = await page.evaluate(() => {
        const out: string[] = [];
        for (const el of Array.from(document.querySelectorAll("button, a[href], input, select, [role=button], [role=tab]"))) {
          const r = el.getBoundingClientRect();
          const s = getComputedStyle(el);
          if (r.width <= 1 || r.height <= 1 || s.visibility === "hidden") continue; // hidden or screen-reader-only
          // Inline targets in running text are exempt (WCAG 2.5.8): text-only links, citation and gap chips.
          const textOnly = el.tagName === "A" && el.children.length === 0;
          const chip = el.classList.contains("cite-chip") || el.classList.contains("gap-chip");
          if (!textOnly && !chip && (r.height < 24 || r.width < 24)) out.push(`${el.tagName.toLowerCase()} "${(el.getAttribute("aria-label") ?? el.textContent ?? "").trim().slice(0, 30)}" ${Math.round(r.width)}x${Math.round(r.height)}`);
        }
        return out.slice(0, 8);
      });
      expect(small, `tap targets under 24px on ${route} at ${width}`).toEqual([]);
    });
  }
}
