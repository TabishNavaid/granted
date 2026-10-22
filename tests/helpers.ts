import type { Page } from "@playwright/test";

/** Every route the product serves, with a demo id where one is needed. */
export const ALL_ROUTES = [
  "/",
  "/free",
  "/about",
  "/security",
  "/privacy",
  "/terms",
  "/contact",
  "/product",
  "/product/matching",
  "/product/drafting",
  "/product/deadlines",
  "/product/outreach",
  "/product/connections",
  "/product/analytics",
  "/how-it-works",
  "/who-its-for",
  "/for/nonprofits",
  "/for/architecture-and-construction",
  "/for/research",
  "/for/students",
  "/roadmap",
  "/sign-in",
  "/sign-up",
  "/onboarding?restart=1",
  "/onboarding/ein",
  "/onboarding/reading",
  "/onboarding/profile",
  "/onboarding/gaps",
  "/onboarding/matches",
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
  "/settings?tab=usage",
  "/settings/integrations",
  "/connections",
  "/social",
  "/analytics",
  "/funders",
  "/funders/pf_310727384",
  "/funders/funder_meridian",
  "/ask",
  "/scholarships",
  "/design",
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

// Screens of the firm, the research lab, and the student, crawled inside their own sample workspace.
export const SAMPLE_ROUTES: { sample: string; route: string }[] = [
  ...["/opportunities", "/opportunities?tab=grants", "/pipeline", "/profile?tab=company", "/profile?tab=projects", "/profile?tab=people", "/profile?tab=credentials", "/analytics", "/calendar", "/inbox", "/applications/app_seed_jail", "/applications/app_seed_jail/draft"].map((route) => ({ sample: "org_cibolo_line", route })),
  ...["/profile?tab=team", "/profile?tab=funded", "/profile?tab=ai-rules", "/opportunities"].map((route) => ({ sample: "org_freshwater_lab", route })),
  ...["/profile", "/opportunities", "/pipeline"].map((route) => ({ sample: "org_jordan_reyes", route })),
];

/** Open a sample workspace before visiting one of its screens. */
export async function openSample(page: Page, sample: string | null) {
  if (sample) await page.goto(`/api/demo/open?sample=${sample}&next=/inbox`, { waitUntil: "networkidle" });
}
