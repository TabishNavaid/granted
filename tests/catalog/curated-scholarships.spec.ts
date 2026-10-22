import { expect, test } from "@playwright/test";
import { curatedScholarships, NOT_POSTED, run, source, statusOf, toOpportunity } from "@/lib/catalog/connectors/curated-scholarships";
import { pagesOf, SCHOLARSHIPS, type CuratedScholarship } from "@/lib/catalog/curated/scholarships";
import { deadline } from "@/lib/catalog/normalize";
import type { Connector } from "@/lib/catalog/types";
import { checkAll, judge, type PageResult } from "../../scripts/check-scholarships";
import { fixture, fixtureFetch, runOffline } from "./helpers";

const NOW = new Date("2026-10-22T12:00:00Z");
const atNow = (entries: CuratedScholarship[] = SCHOLARSHIPS): Connector => ({ source, fullSnapshot: true, run: (ctx) => run(ctx, entries, NOW) });
const bySlug = (slug: string) => SCHOLARSHIPS.find((s) => s.slug === slug)!;

/** List sites and news outlets: never the official page for a program. */
const NOT_OFFICIAL = /(fastweb|scholarships\.com|bold\.org|niche\.com|scholarshipowl|unigo|cappex|goingmerry|petersons|collegeboard|wikipedia|forbes|nytimes|usnews|medium\.com|linkedin|facebook|instagram|twitter|x\.com|reddit|google\.com\/search)/i;

test.describe("curated scholarships data", () => {
  test("has 60 to 100 entries with no duplicate slugs, names, or links", () => {
    expect(SCHOLARSHIPS.length).toBeGreaterThanOrEqual(60);
    expect(SCHOLARSHIPS.length).toBeLessThanOrEqual(100);
    const slugs = SCHOLARSHIPS.map((s) => s.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    const names = SCHOLARSHIPS.map((s) => s.name.toLowerCase());
    expect(new Set(names).size).toBe(names.length);
    // Two entries may share a page only when the page lists both (SWE lists its rounds together).
    const urls = SCHOLARSHIPS.map((s) => s.url);
    const shared = urls.filter((u, i) => urls.indexOf(u) !== i);
    expect(shared).toEqual(["https://swe.org/scholarships-overview/"]);
    for (const s of slugs) expect(s).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
  });

  test("every link is https on the program's own site, never a list site or news story", () => {
    for (const s of SCHOLARSHIPS) {
      for (const u of pagesOf(s)) {
        const url = new URL(u);
        expect(url.protocol, `${s.slug} ${u}`).toBe("https:");
        expect(NOT_OFFICIAL.test(url.host + url.pathname), `${s.slug} ${u}`).toBe(false);
        expect(url.pathname, `${s.slug} ${u}`).not.toMatch(/\/(news|press|blog)\//);
      }
      const host = new URL(s.url).host.replace(/^www\./, "");
      for (const u of s.sources ?? []) expect(new URL(u).host.replace(/^www\./, ""), `${s.slug} sources stay on the program site`).toBe(host);
      expect(new URL(s.sponsor.website).protocol).toBe("https:");
    }
  });

  test("every entry has lastChecked, a sponsor, eligibility, and well-formed dates", () => {
    for (const s of SCHOLARSHIPS) {
      expect(s.lastChecked, s.slug).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(new Date(s.lastChecked).getTime()).toBeLessThanOrEqual(NOW.getTime());
      expect(s.sponsor.slug).toMatch(/^[a-z0-9-]+$/);
      expect(["private_foundation", "other"]).toContain(s.sponsor.kind);
      expect(s.eligibility.length, s.slug).toBeGreaterThan(20);
      expect(s.citizenship.length, s.slug).toBeGreaterThan(5);
      expect(s.level.length).toBeGreaterThan(0);
      expect(s.field.length).toBeGreaterThan(0);
      if (s.deadline) expect(deadline(s.deadline), s.slug).not.toBeNull();
      if (s.opensAt) expect(s.opensAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      if (s.amount !== null) {
        expect(s.amount).toBeGreaterThan(0);
        expect(s.amountText, `${s.slug} has a number only when the page states one`).not.toBeNull();
      }
    }
  });

  test("human-readable text has no em dashes and names no list sites", () => {
    for (const s of SCHOLARSHIPS) {
      const text = [s.name, s.sponsor.name, s.amountText, s.deadlineText, s.opensText, s.nextCycleText, s.citizenship, s.eligibility].filter(Boolean).join(" ");
      expect(text, s.slug).not.toMatch(/[—–]/);
      expect(NOT_OFFICIAL.test(text), s.slug).toBe(false);
    }
  });
});

test.describe("status rules", () => {
  test("statuses follow the dates", () => {
    for (const s of SCHOLARSHIPS) {
      const status = statusOf(s, NOW);
      const close = deadline(s.deadline);
      if (close && new Date(close) < NOW) expect(status, s.slug).toBe("closed");
      else if (s.opensAt && new Date(s.opensAt) > NOW) expect(status, s.slug).toBe("forecasted");
      else if (s.pendingOpen) expect(status, s.slug).toBe("forecasted");
      else if (close) expect(status, s.slug).toBe("open");
      else if (s.rolling || s.openNow) expect(status, s.slug).toBe("open");
      else expect(status, s.slug).toBe("forecasted");
    }
  });

  test("known cases on 2026-10-22", () => {
    expect(statusOf(bySlug("critical-language-scholarship"), NOW)).toBe("open");
    expect(statusOf(bySlug("fulbright-us-student"), NOW)).toBe("closed");
    expect(statusOf(bySlug("rhodes-scholarship"), NOW)).toBe("forecasted");
    expect(statusOf(bySlug("apia-scholarship"), NOW)).toBe("forecasted"); // opens November 15
    expect(statusOf(bySlug("thiel-fellowship"), NOW)).toBe("open"); // year round
    expect(statusOf(bySlug("apia-scholarship"), new Date("2026-12-01T12:00:00Z"))).toBe("open");
    expect(statusOf(bySlug("critical-language-scholarship"), new Date("2026-11-18T12:00:00Z"))).toBe("closed");
  });

  test("forecasted rows without a deadline say it is not posted; closed rows carry the next cycle when known", () => {
    for (const s of SCHOLARSHIPS) {
      const o = toOpportunity(s, NOW);
      if (o.status === "forecasted" && !s.deadline && !s.deadlineText) expect(o.closeText, s.slug).toContain(NOT_POSTED);
      if (o.status === "closed" && s.nextCycleText) expect(o.closeText, s.slug).toContain(s.nextCycleText);
      if (o.status === "open") expect(o.closeAt !== null || o.rolling || s.openNow, s.slug).toBeTruthy();
    }
  });
});

test.describe("connector", () => {
  test("emits every entry as an individual scholarship, funders first", async () => {
    const { sink, result } = await runOffline(atNow(), (async () => {
      throw new Error("no network");
    }) as never);
    expect(result.status).toBe("succeeded");
    expect(sink.opportunityRows).toHaveLength(SCHOLARSHIPS.length);
    const keys = new Set(sink.funderRows.map((f) => f.key));
    for (const o of sink.opportunityRows) {
      expect(o.type).toBe("scholarship");
      expect(o.eligibility).toEqual(["individual"]);
      expect(o.sourceUrl).toMatch(/^https:\/\//);
      expect(o.funderKey).toMatch(/^org:[a-z0-9-]+$/);
      expect(keys.has(o.funderKey!)).toBe(true);
      expect(o.canonicalKey).toBe(`scholarship:${o.sourceId}`);
    }
    for (const f of sink.funderRows) {
      expect(["private_foundation", "other"]).toContain(f.kind);
      expect(f.grantsToIndividuals).toBe(true);
    }
    expect(new Set(sink.funderRows.map((f) => f.key)).size).toBe(sink.funderRows.length);
  });

  test("maps dates, money, and categories", () => {
    const cls = toOpportunity(bySlug("critical-language-scholarship"), NOW);
    expect(cls.closeAt).toBe(new Date("2026-11-17T20:00:00-05:00").toISOString());
    expect(cls.status).toBe("open");
    const truman = toOpportunity(bySlug("truman-scholarship"), NOW);
    expect(truman.closeAt).toBe("2027-02-02T23:59:00-05:00");
    expect(truman.amountMax).toBe(30000);
    expect(truman.categories).toContain("Public service");
    expect(truman.causes).toContain("community");
    const hertz = toOpportunity(bySlug("hertz-fellowship"), NOW);
    expect(hertz.researchAreas).toEqual([]);
    const rhodes = toOpportunity(bySlug("rhodes-scholarship"), NOW);
    expect(rhodes.closeAt).toBeNull();
    expect(rhodes.amountMax).toBeNull();
    expect(rhodes.closeText).toContain(NOT_POSTED);
    expect(rhodes.closeText).toContain("reopen in 2027");
    const runyon = toOpportunity(bySlug("damon-runyon-fellowship"), NOW);
    expect(runyon.researchAreas).toContain("biomedical");
    expect(runyon.status).toBe("closed");
  });

  test("respects the limit", async () => {
    const { sink } = await runOffline(atNow(), (async () => new Response("")) as never, { limit: 5 });
    expect(sink.opportunityRows).toHaveLength(5);
    const keys = new Set(sink.funderRows.map((f) => f.key));
    for (const o of sink.opportunityRows) expect(keys.has(o.funderKey!)).toBe(true);
  });

  test("skips a malformed entry with a warning and keeps the rest", async () => {
    const good = bySlug("truman-scholarship");
    const entries = [good, { ...good, name: "Copy" }, { ...bySlug("goldwater-scholarship"), url: "http://goldwaterscholarship.gov/" }, bySlug("hertz-fellowship")];
    const { sink, result } = await runOffline(atNow(entries), (async () => new Response("")) as never);
    expect(sink.opportunityRows.map((o) => o.sourceId)).toEqual(["truman-scholarship", "hertz-fellowship"]);
    expect(result.errors.length).toBe(2);
  });

  test("is registered with the brief's source definition", () => {
    expect(curatedScholarships.source.id).toBe("curated_scholarships");
    expect(source.license).toBe("Facts from each sponsor's official page; links only");
    expect(source.cadence).toBe("Checked by hand each month");
    expect(source.enabled).toBe(true);
    expect(source.kinds).toEqual(["scholarship"]);
  });
});

test.describe("monthly check", () => {
  const page = (url: string, text: string, status = 200): PageResult => ({ url, status, finalUrl: url, error: null, text: text.toLowerCase() });

  test("finds the watch phrase in recorded official pages", async () => {
    const f = fixtureFetch("curated_scholarships", [
      ["truman.gov/apply/applying/important-dates", "truman-dates.html"],
      ["clscholarship.org", "cls.html"],
      ["elks.org/scholars/scholarships/mvs.cfm", "elks-mvs.html"],
      [/./, () => new Response("<p>other page</p>", { status: 200 })],
    ]);
    const entries = ["truman-scholarship", "critical-language-scholarship", "elks-most-valuable-student"].map(bySlug);
    const reports = await checkAll(entries, f, NOW);
    for (const r of reports) expect(r.problems, r.slug).toEqual([]);
    expect(fixture("curated_scholarships", "cls.html")).toContain("Apply by November 17");
  });

  test("flags dead links, changed deadline text, and stale checks", () => {
    const s = bySlug("critical-language-scholarship");
    expect(judge(s, [page(s.url, "Apply by November 17, 8 PM Eastern")], NOW).problems).toEqual([]);
    expect(judge(s, [page(s.url, "Apply by December 1, 8 PM Eastern")], NOW).problems.join()).toContain("watch text not found");
    expect(judge(s, [page(s.url, "", 404)], NOW).problems.join()).toContain("HTTP 404");
    expect(judge(s, [{ url: s.url, status: null, finalUrl: null, error: "fetch failed", text: "" }], NOW).problems.join()).toContain("unreachable");
    expect(judge(s, [page(s.url, "Apply by November 17")], new Date("2027-01-15T00:00:00Z")).problems.join()).toContain("more than 45 days");
  });

  test("hosts that refuse automated requests are notes for blocked entries, problems otherwise", () => {
    const blocked = bySlug("noaa-hollings-scholarship");
    expect(judge(blocked, [page(blocked.url, "", 403)], NOW).problems).toEqual([]);
    const open = bySlug("truman-scholarship");
    expect(judge(open, [page(open.url, "", 403)], NOW).problems.join()).toContain("refuses automated requests");
  });
});
