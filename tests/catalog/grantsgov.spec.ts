import { createReadStream, mkdtempSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { expect, test } from "@playwright/test";
import { grantsgov, parseExtract, toOpportunity, type GgRecord } from "@/lib/catalog/connectors/grantsgov";
import { fixturePath, runOffline } from "./helpers";

const NOW = new Date("2026-10-22T12:00:00Z");

async function records(): Promise<GgRecord[]> {
  const out: GgRecord[] = [];
  await parseExtract(createReadStream(fixturePath("grantsgov", "extract-sample.xml")), (r) => {
    out.push(r);
  });
  return out;
}

test.describe("Grants.gov extract", () => {
  test("streams every synopsis and forecast with repeated fields kept as lists", async () => {
    const rs = await records();
    expect(rs).toHaveLength(6);
    expect(rs.filter((r) => r._kind === "forecast")).toHaveLength(1);
    const open = rs.find((r) => r.OpportunityID === "328902")!;
    expect(Array.isArray(open.EligibleApplicants)).toBe(true);
  });

  test("open, forecasted, closed, and old notices get the right status, and old history is skipped", async () => {
    const rs = await records();
    const by = (id: string) => toOpportunity(rs.find((r) => r.OpportunityID === id)!, NOW);
    expect(by("328902")?.status).toBe("open");
    expect(by("359142")?.status).toBe("forecasted");
    expect(by("275168")?.status).toBe("closed");
    expect(by("262148")).toBeNull();
  });

  test("normalizes dates, money, eligibility, links, and the funder", async () => {
    const rs = await records();
    const o = toOpportunity(rs.find((r) => r.OpportunityID === "328902")!, NOW)!;
    expect(o.sourceUrl).toBe("https://www.grants.gov/search-results-detail/328902");
    expect(o.closeAt).toBe("2027-09-07T23:59:00-05:00");
    expect(o.postedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(o.eligibility).toContain("nonprofit");
    expect(o.funderKey).toBe("agency:DOT-FAA-FAA ARG");
    expect(o.summary).not.toMatch(/<[a-z]/i);
  });

  test("NIH notices are research funding", async () => {
    const rs = await records();
    const o = toOpportunity(rs.find((r) => r.OpportunityID === "351124")!, NOW)!;
    expect(o.type).toBe("research");
  });

  test("the connector reads a local extract file and emits funders before opportunities", async () => {
    const { sink, result } = await runOffline(grantsgov, (async () => new Response("", { status: 404 })) as never, { env: { GRANTSGOV_EXTRACT_FILE: fixturePath("grantsgov", "extract-sample.xml") } });
    expect(result.status).toBe("succeeded");
    expect(sink.opportunityRows.length).toBeGreaterThanOrEqual(4);
    const keys = new Set(sink.funderRows.map((f) => f.key));
    for (const o of sink.opportunityRows) expect(keys.has(o.funderKey!)).toBe(true);
  });

  test("a forecast with no archive date whose estimated close has passed is stale, so it closes and stays closed", () => {
    const base = { _kind: "forecast", OpportunityID: "1", OpportunityTitle: "Stale forecast", AgencyCode: "HHS", PostDate: "06012025" } as unknown as GgRecord;
    expect(toOpportunity({ ...base, EstimatedSynopsisCloseDate: "06162025" } as GgRecord, NOW)?.status).toBe("closed");
    expect(toOpportunity({ ...base, EstimatedSynopsisCloseDate: "06162026", ArchiveDate: "12312026" } as GgRecord, NOW)?.status).toBe("forecasted");
    expect(toOpportunity({ ...base, EstimatedSynopsisCloseDate: "06162027" } as GgRecord, NOW)?.status).toBe("forecasted");
  });

  test("an opportunity listed as both a forecast and a synopsis is written once, as the synopsis", async () => {
    const one = (tag: string, extra: string) => `<${tag}><OpportunityID>777</OpportunityID><OpportunityTitle>Both kinds</OpportunityTitle><AgencyCode>HHS</AgencyCode><AgencyName>Health</AgencyName><PostDate>01052026</PostDate>${extra}</${tag}>`;
    const xml = `<?xml version="1.0" encoding="UTF-8"?><Grants>${one("OpportunitySynopsisDetail_1_0", "<CloseDate>01052027</CloseDate>")}${one("OpportunityForecastDetail_1_0", "<EstimatedSynopsisCloseDate>01052027</EstimatedSynopsisCloseDate>")}</Grants>`;
    const file = path.join(mkdtempSync(path.join(os.tmpdir(), "gg-")), "both.xml");
    writeFileSync(file, xml);
    const { sink } = await runOffline(grantsgov, (async () => new Response("", { status: 404 })) as never, { env: { GRANTSGOV_EXTRACT_FILE: file } });
    const rows = sink.opportunityRows.filter((o) => o.sourceId === "777");
    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe("open");
  });
});
