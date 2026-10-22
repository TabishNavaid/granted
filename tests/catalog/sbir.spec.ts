import { expect, test } from "@playwright/test";
import {
  addSbirAward,
  agencyCodeFromName,
  aggregateAwardFile,
  parseTopicList,
  parseTopicPage,
  sbirAwardYears,
  sbirAwards,
  sbirTopics,
  toSolicitations,
  topicsListUrl,
} from "@/lib/catalog/connectors/sbir";
import { AwardAggregator } from "@/lib/catalog/connectors/_research-stats";
import { fixture, fixtureFetch, fixturePath, runOffline } from "./helpers";

const NOW = new Date("2026-10-22T12:00:00Z");
const IDS = ["13018", "13022", "13023", "13025", "13026", "13028", "13031", "13035", "13036", "13052"];
const topics = () => IDS.map((id) => parseTopicPage(fixture("sbir_topics", `topic-${id}.html`), id));

test.describe("SBIR.gov solicitations", () => {
  test("the topic search page lists topic ids and the total", () => {
    const list = parseTopicList(fixture("sbir_topics", "list0.html"));
    expect([...list.ids].sort()).toEqual(IDS);
    expect(list.total).toBe(306);
    expect(parseTopicList(fixture("sbir_topics", "list99.html")).ids).toEqual([]);
    expect(topicsListUrl(3)).toBe("https://www.sbir.gov/topics?keywords=&status=Open&page=3");
  });

  test("a topic page gives agency, numbers, dates, and the official link", () => {
    const t = parseTopicPage(fixture("sbir_topics", "topic-13018.html"), "13018");
    expect(t.title).toBe("Cleaner for the Time Domain Reflectometer Tank Level Indicator");
    expect(t.agency).toBe("DOW");
    expect(t.branch).toBe("NAVY");
    expect(t.topicNumber).toBe("DON27BZ01-NV001");
    expect(t.solicitationNumber).toBe("27.BZ");
    expect(t.releaseDate).toBe("2026-10-07");
    expect(t.openDate).toBe("2026-10-28");
    expect(t.dueDates).toEqual(["2026-11-25"]);
    expect(t.closeDate).toBe("2026-11-25");
    expect(t.tags).toContain("SBIR");
    expect(t.officialUrl).toMatch(/^https:\/\//);
    expect(t.description).toMatch(/TDR/);
  });

  test("topics group into one solicitation each, for small businesses, forecasted until they open", () => {
    const { funders, rows } = toSolicitations(topics(), NOW);
    const bz = rows.find((r) => r.opportunityNumber === "27.BZ")!;
    const inBz = topics().filter((t) => t.solicitationNumber === "27.BZ").length;
    expect((bz.extra as { topicCount: number }).topicCount).toBe(inBz);
    expect(bz.attachments).toHaveLength(inBz);
    expect(bz.status).toBe("forecasted");
    expect(bz.openAt).toBe("2026-10-28");
    expect(bz.closeAt).toBe("2026-11-25T23:59:00-05:00");
    expect(bz.eligibility).toEqual(["small_business"]);
    expect(bz.title).toMatch(/^Department of War .*solicitation 27\.BZ$/);
    expect(bz.researchAreas).toEqual(["defense"]);
    const tz = rows.find((r) => r.opportunityNumber === "27.TZ")!;
    expect(tz.title).toMatch(/STTR/);
    expect(tz.eligibilityText).toMatch(/research institution/);
    expect(funders).toEqual([expect.objectContaining({ key: "agency:DOD", name: "Department of Defense" })]);
    const open = toSolicitations(topics(), new Date("2026-11-01T00:00:00Z")).rows.find((r) => r.opportunityNumber === "27.BZ")!;
    expect(open.status).toBe("open");
  });

  test("a page that is not a topic is skipped", () => {
    const blank = parseTopicPage("<html><body><h2>Page not found</h2></body></html>", "1");
    expect(blank.agency).toBeNull();
    expect(toSolicitations([blank], NOW).rows).toHaveLength(0);
  });

  test("the connector reads the list, then each topic, and emits funders first", async () => {
    const f = fixtureFetch("sbir_topics", [
      [/\/topics\?.*page=0$/, "list0.html"],
      [/\/topics\?.*page=\d+$/, "list99.html"],
      [/\/topics\/(\d+)$/, (url) => fixture("sbir_topics", `topic-${url.split("/").pop()}.html`)],
    ]);
    const { sink, result } = await runOffline(sbirTopics, f);
    // The recorded list has 10 of the 306 topics it reports, so the run says it saw only part of the list.
    expect(result.status).toBe("partial");
    expect(result.errors[0].message).toMatch(/Listed 10 of 306/);
    expect(sink.funderRows.map((x) => x.key)).toEqual(["agency:DOD"]);
    expect(sink.opportunityRows.length).toBeGreaterThanOrEqual(2);
    expect(f.calls.filter((u) => /\/topics\/\d+$/.test(u))).toHaveLength(10);
    expect(sbirTopics.fullSnapshot).toBe(true);
  });
});

test.describe("SBIR.gov awards", () => {
  test("agency names map to agency codes", () => {
    expect(agencyCodeFromName("Department of Defense")).toBe("DOD");
    expect(agencyCodeFromName("National Science Foundation")).toBe("NSF");
    expect(agencyCodeFromName("Department of Health and Human Services")).toBe("HHS");
    expect(agencyCodeFromName("Somewhere Else")).toBeNull();
  });

  test("the award file rolls up by agency, branch, phase, program, state, and year without company data", async () => {
    const agg = new AwardAggregator();
    const years = new Set([2024, 2025, 2026]);
    const { read, counted } = await aggregateAwardFile(fixturePath("sbir_awards", "award-sample.csv"), agg, years);
    expect(read).toBe(44);
    expect(counted).toBeGreaterThan(20);
    expect(counted).toBeLessThanOrEqual(read);
    const rows = agg.rows();
    expect(rows.every((r) => years.has(r.fiscalYear))).toBe(true);
    expect(rows.some((r) => r.agency === "NSF" && r.activityCode === "Phase II" && r.program === "SBIR" && r.placeState === "CA")).toBe(true);
    expect(rows.some((r) => r.agency === "DOD" && r.subAgency && !r.placeState)).toBe(true);
    expect(addSbirAward(agg, { Agency: "National Science Foundation", "Award Year": "2025", "Award Amount": "N/A" }, years)).toBe(false);
    expect(addSbirAward(agg, { Agency: "National Science Foundation", "Award Year": "2019", "Award Amount": "150000" }, years)).toBe(false);
  });

  test("the connector aggregates a local award file and writes no opportunities", async () => {
    const { sink, result } = await runOffline(sbirAwards, (async () => new Response("", { status: 404 })) as never, {
      env: { SBIR_AWARDS_FILE: fixturePath("sbir_awards", "award-sample.csv"), SBIR_AWARD_YEARS: "2025,2026" },
    });
    expect(result.status).toBe("succeeded");
    expect(sink.opportunityRows).toHaveLength(0);
    expect(sink.awardRows.length).toBeGreaterThan(5);
    expect(sink.awardRows.every((r) => r.fiscalYear === 2025 || r.fiscalYear === 2026)).toBe(true);
    expect(sbirAwardYears({}, NOW)).toEqual([2026, 2025, 2024, 2023, 2022]);
  });
});
