import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import {
  addContract,
  addGrant,
  Aggregator,
  fiscalYear,
  fiscalYears,
  isAec,
  jobsFor,
  OTHER_PROGRAM,
  parseListing,
  percentile,
  readAwards,
  setAsideLabel,
  summarize,
  usaspending,
} from "@/lib/catalog/connectors/usaspending";
import { fixture, fixtureFetch, fixturePath, runOffline } from "./helpers";

const SRC = "usaspending";
const ENV = { USASPENDING_POLL_MS: "0", USASPENDING_CACHE_HOURS: "0" };

function zip(name: string) {
  return new Response(readFileSync(fixturePath(SRC, name)), { status: 200, headers: { "content-type": "application/zip" } });
}

/** Recorded responses: a download request answers with its start record, the status says finished, and the file is the recorded zip. */
function routes(opts: { failGrants?: boolean } = {}): Parameters<typeof fixtureFetch>[1] {
  return [
    [
      "/download/awards/",
      (_url, init) => {
        const body = JSON.parse(String(init?.body ?? "{}"));
        return fixture(SRC, body.filters.award_type_codes.includes("02") ? "start-grants.json" : "start-contracts.json");
      },
    ],
    [
      "/download/status/",
      (url) => {
        const grants = url.includes(encodeURIComponent(JSON.parse(fixture(SRC, "start-grants.json")).file_name));
        if (grants && opts.failGrants) return JSON.stringify({ status: "failed", message: "An error occurred.", file_name: "x.zip" });
        return fixture(SRC, grants ? "status-grants.json" : "status-contracts.json");
      },
    ],
    [/generated_downloads\/.*\.zip$/, (url) => zip(url.includes(JSON.parse(fixture(SRC, "start-grants.json")).file_name) ? "grants-vt-fy2025.zip" : "contracts-vt-fy2025.zip")],
  ];
}

test.describe("USAspending requests", () => {
  test("fiscal years: three completed plus the current one; incremental refreshes the current year", () => {
    expect(fiscalYear(new Date("2026-10-22T00:00:00Z"))).toBe(2027);
    expect(fiscalYear(new Date("2026-09-30T00:00:00Z"))).toBe(2026);
    expect(fiscalYears("backfill", new Date("2026-10-22T00:00:00Z"))).toEqual([2024, 2025, 2026, 2027]);
    expect(fiscalYears("incremental", new Date("2026-10-22T00:00:00Z"))).toEqual([2026, 2027]);
    expect(fiscalYears("incremental", new Date("2027-03-01T00:00:00Z"))).toEqual([2027]);
  });

  test("downloads ask for new awards only, the aggregate columns only, and never recipient fields", () => {
    const jobs = jobsFor(2025);
    expect(jobs.map((j) => j.key)).toEqual(["contracts-aec-fy2025", "grants-fy2025", "contracts-other-fy2025"]);
    for (const j of jobs) {
      const body = j.body as { filters: { time_period: { start_date: string; end_date: string; date_type: string }[] }; columns: string[] };
      expect(body.filters.time_period).toEqual([{ start_date: "2024-10-01", end_date: "2025-09-30", date_type: "new_awards_only" }]);
      expect(body.columns.some((c) => /recipient|officer|address/i.test(c))).toBe(false);
    }
    const aec = jobs[0].body as { filters: { naics_codes: { require: string[] } } };
    expect(aec.filters.naics_codes.require).toContain("23");
    expect(aec.filters.naics_codes.require).toContain("541330");
    const other = jobs[2].body as { filters: { naics_codes: { exclude: string[] }; award_amounts: { lower_bound: number }[] } };
    expect(other.filters.naics_codes.exclude).toContain("23");
    expect(other.filters.award_amounts[0].lower_bound).toBe(250_000);
    expect(isAec("236220")).toBe(true);
    expect(isAec("541330")).toBe(true);
    expect(isAec("541511")).toBe(false);
  });
});

test.describe("USAspending aggregation", () => {
  test("percentiles interpolate between ranks", () => {
    expect(percentile([1, 2, 3, 4], 0.5)).toBe(2.5);
    expect(percentile([10], 0.25)).toBe(10);
    expect(percentile([], 0.5)).toBeNull();
    expect(summarize([5, 1, 3])).toEqual({ awardCount: 3, totalAmount: 9, medianAmount: 3, p25Amount: 2, p75Amount: 4, minAmount: 1, maxAmount: 5 });
  });

  test("set-aside codes and listing titles", () => {
    expect(setAsideLabel("SBA")).toBe("Total small business");
    expect(setAsideLabel("sdvosbc")).toBe("Service-disabled veteran-owned small business");
    expect(setAsideLabel("NONE")).toBe("No set-aside");
    expect(setAsideLabel("")).toBeNull();
    expect(parseListing("47.041: ENGINEERING; 47.070: COMPUTER AND INFORMATION SCIENCE AND ENGINEERING")).toEqual({ number: "47.041", title: "Engineering" });
    expect(parseListing("not a listing")).toBeNull();
  });

  test("recorded construction and A/E awards aggregate by NAICS, agency, sub-agency, and state, with exact medians", async () => {
    const base = new Aggregator(2025);
    const sa = new Aggregator(2025);
    const n = await readAwards(fixturePath(SRC, "contracts-vt-fy2025.zip"), (r) => addContract(r, "aec", base, sa));
    expect(n).toBe(60);
    const rows = base.rows();
    expect(rows).toHaveLength(29);
    const fs = rows.find((r) => r.naics === "237310" && r.subAgency === "Forest Service")!;
    expect(fs).toMatchObject({ awardType: "contract", agency: "Department of Agriculture", placeState: "VT", fiscalYear: 2025, awardCount: 8, totalAmount: 940273.7, medianAmount: 52737.75, p25Amount: 32382.5, p75Amount: 99734.75, minAmount: 16147.5, maxAmount: 494561.7 });
    expect(fs.program).toBeNull();
    const setAsides = sa.rows();
    expect(setAsides).toHaveLength(26);
    const sba = setAsides.find((r) => r.naics === "237310" && r.setAside === "Total small business")!;
    expect(sba).toMatchObject({ awardCount: 8, subAgency: null, totalAmount: 940273.7 });
    expect(JSON.stringify(rows)).not.toMatch(/recipient/i);
  });

  test("recorded grants aggregate by Assistance Listing with the program title", async () => {
    const agg = new Aggregator(2025);
    let skipped = 0;
    await readAwards(fixturePath(SRC, "grants-vt-fy2025.zip"), (r) => {
      if (!addGrant(r, agg)) skipped++;
    });
    expect(skipped).toBe(1);
    const rows = agg.rows();
    expect(rows).toHaveLength(24);
    const ojp = rows.find((r) => r.assistanceListing === "16.738")!;
    expect(ojp).toMatchObject({ awardType: "grant", subAgency: "Office of Justice Programs", placeState: "VT", awardCount: 8, totalAmount: 586463, medianAmount: 13797 });
    expect(ojp.program).toMatch(/^Edward Byrne/);
  });

  test("malformed awards are skipped, and other contracts carry their population label", () => {
    const base = new Aggregator(2025);
    expect(addContract({ total_obligated_amount: "abc", naics_code: "236220", awarding_agency_name: "X" }, "aec", base, null)).toBe(false);
    expect(addContract({ total_obligated_amount: "0.00", naics_code: "236220", awarding_agency_name: "X" }, "aec", base, null)).toBe(false);
    expect(addContract({ total_obligated_amount: "100", naics_code: "23", awarding_agency_name: "X" }, "aec", base, null)).toBe(false);
    expect(addContract({ total_obligated_amount: "50000", naics_code: "541511", awarding_agency_name: "Department of X", primary_place_of_performance_state_code: "ZZ" }, "other", base, null)).toBe(true);
    const [row] = base.rows();
    expect(row.program).toBe(OTHER_PROGRAM);
    expect(row.placeState).toBeNull();
    expect(addGrant({ total_obligated_amount: "10", awarding_agency_name: "X", cfda_numbers_and_titles: "", primary_place_of_performance_state_name: "VIRGIN ISLANDS" }, base)).toBe(false);
  });
});

test.describe("USAspending connector", () => {
  test("runs offline: requests, polls, downloads, and writes aggregate rows only", async () => {
    const f = fixtureFetch(SRC, routes());
    const { sink, result } = await runOffline(usaspending, f, { mode: "incremental", env: { ...ENV, USASPENDING_SLICES: "aec,grant" } });
    expect(result.status).toBe("succeeded");
    expect(sink.opportunityRows).toHaveLength(0);
    const years = new Set(sink.awardRows.map((r) => r.fiscalYear));
    expect([...years].sort()).toEqual(fiscalYears("incremental").sort());
    // Per year: 29 contract rows, 26 set-aside rows, 24 grant rows.
    expect(sink.awardRows).toHaveLength(years.size * (29 + 26 + 24));
    expect(sink.awardRows.every((r) => r.awardCount > 0 && r.totalAmount > 0 && r.sourceUrl)).toBe(true);
    expect(f.calls.filter((u) => u.includes("/download/awards/")).length).toBe(years.size * 2);
  });

  test("a failed download is a warning, and the rest still lands", async () => {
    const f = fixtureFetch(SRC, routes({ failGrants: true }));
    const { sink, result } = await runOffline(usaspending, f, { mode: "incremental", env: { ...ENV, USASPENDING_SLICES: "aec,grant" } });
    expect(result.status).toBe("partial");
    expect(result.errors[0].message).toMatch(/Skipped grants/);
    expect(sink.awardRows.some((r) => r.awardType === "contract")).toBe(true);
    expect(sink.awardRows.some((r) => r.awardType === "grant")).toBe(false);
  });

  test("with a limit, one year of construction and A/E contracts and no more rows than the limit", async () => {
    const f = fixtureFetch(SRC, routes());
    const { sink } = await runOffline(usaspending, f, { mode: "backfill", env: ENV, limit: 10 });
    expect(sink.awardRows).toHaveLength(10);
    expect(f.calls.filter((u) => u.includes("/download/awards/"))).toHaveLength(1);
  });
});
