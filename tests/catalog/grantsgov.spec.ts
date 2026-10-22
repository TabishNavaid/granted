import { createReadStream } from "node:fs";
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
});
