/**
 * Records Grants.gov searches for the firm (grants and incentives a for-profit
 * firm can get) and the research lab (research categories). Writes
 * src/lib/replay/recordings/<id>.grantsgov.json in the same shape as the
 * nonprofit samples, keyed by `${keyword}|${categories}`.
 *
 *   npx tsx --tsconfig tsconfig.json scripts/replay/capture-segments.ts firm
 */
import { writeFileSync } from "node:fs";
import * as gg from "@/lib/grantsgov";
import { SEGMENT_SEARCHES } from "@/lib/segments/searches";

(async () => {
  const id = process.argv[2] as keyof typeof SEGMENT_SEARCHES;
  const plan = SEGMENT_SEARCHES[id];
  if (!plan) throw new Error(`no plan for ${id}`);
  const searches: Record<string, gg.SearchResponse> = {};
  const ids = new Set<string>();
  for (const s of plan.searches) {
    const { result } = await gg.search({ keyword: s.keyword, oppStatuses: "forecasted|posted", eligibilities: plan.eligibilities, fundingCategories: s.fundingCategories.join("|"), rows: 25 });
    searches[`${s.keyword}|${s.fundingCategories.join("|")}`] = result;
    for (const h of result.oppHits.slice(0, plan.detailsPerSearch)) ids.add(String(h.id));
    console.log(`${s.keyword}: ${result.hitCount} hits`);
    await new Promise((r) => setTimeout(r, 800));
  }
  const details: Record<string, gg.OpportunityDetail> = {};
  for (const k of ids) {
    const { detail } = await gg.fetchOpportunity(k);
    details[k] = detail;
    console.log(`  ${k} ${detail.opportunityTitle}`);
    await new Promise((r) => setTimeout(r, 600));
  }
  writeFileSync(`src/lib/replay/recordings/${id}.grantsgov.json`, JSON.stringify({ recordedAt: new Date().toISOString(), searches, details }));
})();
