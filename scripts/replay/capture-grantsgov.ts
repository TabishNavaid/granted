/**
 * Records the Grants.gov half of a sample organization's run: the exact
 * searches its recorded plan makes and the full notices its recorded triage
 * keeps. Writes src/lib/replay/recordings/<id>.grantsgov.json.
 *
 *   npx tsx --tsconfig tsconfig.json scripts/replay/capture-grantsgov.ts youth
 *
 * Re-run when refreshing a recording; then check that every noticeQuote in
 * the recording's score_fit response still appears in the notice text
 * (scripts/replay/check-recordings.ts does this).
 */
import { writeFileSync } from "node:fs";
import * as gg from "@/lib/grantsgov";

export const PLANS: Record<string, { searches: { keyword: string; fundingCategories: string[] }[]; keep: string[] }> = {
  youth: { searches: [{ keyword: "mentoring", fundingCategories: [] }, { keyword: "youth employment", fundingCategories: [] }, { keyword: "afterschool", fundingCategories: ["ED"] }], keep: ["364058", "363353", "363902", "363911", "361206", "363055"] },
  foodbank: { searches: [{ keyword: "hunger", fundingCategories: ["FN"] }, { keyword: "food security", fundingCategories: [] }, { keyword: "nutrition", fundingCategories: [] }], keep: ["363696", "363392", "361876", "363482"] },
  clinic: { searches: [{ keyword: "rural health", fundingCategories: ["HL"] }, { keyword: "telehealth", fundingCategories: [] }, { keyword: "diabetes", fundingCategories: ["HL"] }], keep: ["363581", "363697", "363686", "363580", "363277", "364055", "363423"] },
};

(async () => {
  const id = process.argv[2];
  const plan = PLANS[id];
  if (!plan) throw new Error(`no plan for ${id}`);
  const searches: Record<string, gg.SearchResponse> = {};
  for (const s of plan.searches) {
    const { result } = await gg.search({ keyword: s.keyword, oppStatuses: "forecasted|posted", eligibilities: gg.ELIGIBILITY.nonprofit501c3, fundingCategories: s.fundingCategories.join("|"), rows: 50 });
    searches[`${s.keyword}|${s.fundingCategories.join("|")}`] = result;
  }
  const details: Record<string, gg.OpportunityDetail> = {};
  for (const k of plan.keep) {
    const { detail } = await gg.fetchOpportunity(k);
    details[k] = detail;
    console.log(`\n===== ${k} =====\n${gg.opportunityText(detail, 2_600)}`);
  }
  writeFileSync(`src/lib/replay/recordings/${id}.grantsgov.json`, JSON.stringify({ recordedAt: new Date().toISOString(), searches, details }));
})();
