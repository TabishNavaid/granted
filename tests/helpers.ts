import type { Page } from "@playwright/test";

/** Every route the product serves, with a demo id where one is needed. */
export const ALL_ROUTES = [
  "/",
  "/pricing",
  "/about",
  "/security",
  "/privacy",
  "/terms",
  "/contact",
  "/sign-in",
  "/sign-up",
  "/onboarding?restart=1",
  "/onboarding/ein",
  "/onboarding/reading",
  "/onboarding/profile",
  "/onboarding/gaps",
  "/onboarding/matches",
  "/onboarding/documents",
  "/onboarding/interview",
  "/inbox",
  "/opportunities",
  "/opportunities/opp_meridian_2027",
  "/applications/app_meridian",
  "/applications/app_larkspur",
  "/pipeline",
  "/calendar",
  "/outreach",
  "/profile",
  "/profile?tab=facts",
  "/profile?tab=documents",
  "/activity",
  "/settings",
  "/settings?tab=team",
  "/settings?tab=billing",
  "/settings/integrations",
  "/connections",
  "/social",
  "/design",
  "/art-review",
  "/this-page-does-not-exist",
];

/** Collect console errors, page errors, and failed same-origin responses. Hydration noise from dev tooling is ignored. */
export function watch(page: Page) {
  const problems: string[] = [];
  const ignore = /Download the React DevTools|was preloaded using link preload|favicon|third-party cookie|Lighthouse/i;
  page.on("pageerror", (e) => problems.push(`pageerror: ${e.message}`));
  page.on("console", (m) => {
    if (m.type() === "error" && !ignore.test(m.text())) problems.push(`console: ${m.text().slice(0, 300)}`);
  });
  page.on("response", (r) => {
    const url = r.url();
    const status = r.status();
    if (url.startsWith(page.url().split("/").slice(0, 3).join("/")) || url.includes("localhost")) {
      if (status >= 500 || (status === 404 && !/this-page-does-not-exist|_next\/|\.map$|favicon/.test(url))) problems.push(`${status}: ${url}`);
    }
  });
  return problems;
}

export async function quiet(page: Page) {
  try {
    await page.addInitScript(() => {
      localStorage.setItem("inbox_tour_seen", "1");
    });
  } catch {
    // ignore
  }
}
