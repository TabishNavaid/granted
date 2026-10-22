import { expect, test } from "@playwright/test";
import {
  addReporterProject,
  guideApiUrl,
  nihGuide,
  nihReporter,
  parseGuideDates,
  parseGuideEligibility,
  reporterYears,
  toGuideOpportunity,
  type GuideDoc,
  type ReporterProject,
} from "@/lib/catalog/connectors/nih";
import { AwardAggregator } from "@/lib/catalog/connectors/_research-stats";
import { fixture, fixtureFetch, runOffline } from "./helpers";

const NOW = new Date("2026-10-22T12:00:00Z");

function docs(): GuideDoc[] {
  return ["guide-page1.json", "guide-page2.json"].flatMap((f) => (JSON.parse(fixture("nih_guide", f)).data.hits.hits as { _source: GuideDoc }[]).map((h) => h._source));
}
const doc = (n: string) => docs().find((d) => d.docnum === n)!;

test.describe("NIH Guide", () => {
  test("key dates: regular, AIDS, letter of intent, and expiration are told apart", () => {
    const d = parseGuideDates(doc("PA-25-305"));
    expect(d.due).toContain("2026-11-05");
    expect(d.due).toContain("2027-02-05");
    expect(d.aidsDue).toContain("2026-05-07");
    expect(d.due).not.toContain("2026-05-07");
    expect(d.expiration).toBe("2028-01-08");
    expect(d.open).toBe("2025-01-05");
  });

  test("an open parent announcement closes at its next due date and links to the Guide page", () => {
    const o = toGuideOpportunity(doc("PA-25-305"), NOW)!;
    expect(o.status).toBe("open");
    expect(o.closeAt).toBe("2026-11-05T23:59:00-05:00");
    expect(o.sourceUrl).toBe("https://grants.nih.gov/grants/guide/pa-files/PA-25-305.html");
    expect(o.opportunityNumber).toBe("PA-25-305");
    expect(o.type).toBe("research");
    expect(o.categories).toContain("R01");
    expect((o.extra as { participatingInstitutes: string[] }).participatingInstitutes).toContain("NCI");
    expect(o.keyDates?.some((k) => k.kind === "due_aids")).toBe(true);
    expect(o.funderKey).toBe("agency:HHS-NIH11");
  });

  test("notices posted only on Grants.gov link there, with the earliest submission date", () => {
    const o = toGuideOpportunity(doc("RFA-AI-28-005"), NOW)!;
    expect(o.sourceUrl).toBe("https://www.grants.gov/search-results-detail/362946");
    expect(o.openAt).toBe("2026-12-29");
    expect(o.closeAt).toBe("2027-01-29T23:59:00-05:00");
    expect(o.status).toBe("open");
  });

  test("a notice whose last due date has passed is closed even before it expires", () => {
    const o = toGuideOpportunity(doc("PAR-25-271"), NOW)!;
    expect(o.status).toBe("closed");
    expect(o.closeAt).toBe("2026-10-20T23:59:00-05:00");
    expect(o.archiveAt).toBe("2026-11-14");
  });

  test("due dates written in words go to closeText and the notice closes at expiration", () => {
    const o = toGuideOpportunity(doc("PA-26-001"), NOW)!;
    expect(o.closeText).toMatch(/Due dates may vary by awarding IC/);
    expect(o.closeAt).toBe("2028-12-01T23:59:00-05:00");
    expect(o.status).toBe("open");
  });

  test("eligibility comes from the notice's own list of organization types", () => {
    const e = parseGuideEligibility(doc("RFA-LM-28-001"));
    expect(e.codes).toEqual(expect.arrayContaining(["university", "nonprofit", "tribal"]));
    expect(e.codes).not.toContain("small_business");
    expect(e.codes).not.toContain("international");
    expect(e.text).toMatch(/Foreign organizations are not eligible/);
    expect(parseGuideEligibility(doc("PA-25-305")).codes).toContain("small_business");
  });

  test("a notice whose text is unreadable still yields a row from its structured fields", () => {
    // PAR-27-032 is indexed with raw PDF bytes as its text.
    const o = toGuideOpportunity(doc("PAR-27-032"), NOW)!;
    expect(o.keyDates?.filter((k) => k.kind === "due")).toHaveLength(0);
    expect(o.closeAt).toBe("2029-02-07T23:59:00-05:00");
    expect(o.eligibility).toEqual([]);
  });

  test("malformed and non-funding records are skipped", () => {
    expect(toGuideOpportunity({ ...doc("PA-25-305"), docnum: "" }, NOW)).toBeNull();
    expect(toGuideOpportunity({ ...doc("PA-25-305"), doctype: "NOT", docnum: "NOT-OD-26-001" }, NOW)).toBeNull();
    expect(toGuideOpportunity({ ...doc("RFA-AI-28-005"), ggid: null, filename: null }, NOW)).toBeNull();
  });

  test("the connector pages through the search, emits the funder first, and honors the limit", async () => {
    const routes: [RegExp, string][] = [
      [/[?&]from=0(&|$)/, "guide-page1.json"],
      [/[?&]from=3(&|$)/, "guide-page2.json"],
    ];
    const f = fixtureFetch("nih_guide", routes);
    const { sink, result } = await runOffline(nihGuide, f);
    expect(result.status).toBe("succeeded");
    expect(sink.opportunityRows).toHaveLength(6);
    expect(sink.funderRows[0].key).toBe("agency:HHS-NIH11");
    expect(f.calls).toHaveLength(2);
    expect(nihGuide.fullSnapshot).toBe(true);

    const g = fixtureFetch("nih_guide", routes);
    const limited = await runOffline(nihGuide, g, { limit: 2 });
    expect(limited.sink.opportunityRows).toHaveLength(2);
    expect(g.calls).toHaveLength(1);
  });

  test("the search URL asks for active notices only", () => {
    const u = new URL(guideApiUrl(50, NOW));
    expect(u.host).toBe("search.grants.nih.gov");
    expect(u.searchParams.get("type")).toBe("active");
    expect(u.searchParams.get("from")).toBe("50");
    expect(u.searchParams.get("daterange")).toBe("01021991-10222026");
  });
});

test.describe("NIH RePORTER", () => {
  const nlm = () => JSON.parse(fixture("nih_reporter", "nlm-fy2026.json")).results as ReporterProject[];

  test("projects roll up by institute, activity code, and state; supplements and placeholder amounts are left out", () => {
    const agg = new AwardAggregator();
    const rows = nlm();
    let counted = 0;
    for (const p of rows) if (addReporterProject(agg, p)) counted++;
    const expected = rows.filter((p) => !String(p.award_type).startsWith("3") && (p.award_amount ?? 0) >= 1000).length;
    expect(counted).toBe(expected);
    expect(counted).toBeLessThan(rows.length); // the sample holds a $1 placeholder award
    const out = agg.rows();
    const icTotal = out.find((r) => r.subAgency === "NLM" && !r.activityCode && !r.placeState)!;
    expect(icTotal.awardCount).toBe(counted);
    expect(icTotal.agency).toBe("HHS-NIH");
    const r01 = out.find((r) => r.subAgency === "NLM" && r.activityCode === "R01" && !r.placeState)!;
    expect(r01.medianAmount).toBeGreaterThan(0);
    expect(r01.p25Amount!).toBeLessThanOrEqual(r01.medianAmount!);
    expect(r01.p75Amount!).toBeGreaterThanOrEqual(r01.medianAmount!);
    expect(out.some((r) => r.placeState === "NY" && r.activityCode === "R01")).toBe(true);
    // Stored rows drop state groups of one or two awards; national rows keep counting them.
    const stored = agg.rows(1, 3);
    expect(stored.every((r) => !r.placeState || r.awardCount >= 3)).toBe(true);
    expect(stored.find((r) => r.subAgency === "NLM" && !r.activityCode && !r.placeState)!.awardCount).toBe(counted);
    expect(addReporterProject(agg, { ...rows[0], organization: { org_state: "ON", org_country: "CANADA" } })).toBe(true);
  });

  test("backfill reads three completed fiscal years, incremental one, and the env can pin them", () => {
    expect(reporterYears({ mode: "backfill", env: {} }, NOW)).toEqual([2026, 2025, 2024]);
    expect(reporterYears({ mode: "incremental", env: {} }, NOW)).toEqual([2026]);
    expect(reporterYears({ mode: "backfill", env: { NIH_REPORTER_YEARS: "2025" } }, NOW)).toEqual([2025]);
  });

  test("the connector pages each institute and writes only aggregates", async () => {
    const f = fixtureFetch("nih_reporter", [
      [
        "api.reporter.nih.gov/v2/projects/search",
        (_url, init) => {
          const body = JSON.parse(String(init?.body));
          const ag = body.criteria.agencies?.[0];
          const file = ag === "NIH" ? "total-fy2026.json" : ag === "NLM" ? "nlm-fy2026.json" : ag === "FIC" ? "fic-fy2026.json" : "empty.json";
          return new Response(fixture("nih_reporter", file), { status: 200, headers: { "content-type": "application/json" } });
        },
      ],
    ]);
    const { sink, result } = await runOffline(nihReporter, f, { env: { NIH_REPORTER_YEARS: "2026" }, limit: 30 });
    expect(sink.opportunityRows).toHaveLength(0);
    expect(sink.funderRows.map((x) => x.key)).toEqual(["agency:HHS-NIH11"]);
    expect(sink.awardRows.length).toBeGreaterThan(20);
    expect(new Set(sink.awardRows.map((r) => r.subAgency).filter(Boolean))).toEqual(new Set(["NLM", "FIC"]));
    expect(JSON.stringify(sink.awardRows)).not.toMatch(/org_name|UNIVERSITY/i);
    // The two sampled institutes do not add up to the NIH total, which the run reports.
    expect(result.status).toBe("partial");
    expect(result.errors[0].message).toMatch(/institutes listed add up/);
  });
});
