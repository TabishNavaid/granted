import * as gg from "@/lib/grantsgov";
import type { Fact, Organization, SearchCandidate } from "@/lib/types";
import { preRank, scoreNotices, type Dismissal, type ScoredMatch } from "./discovery";

/** A keyword search the user asked for, with the same code filters as discovery. Unscored. */
export async function runCustomSearch(input: { keyword: string; fundingCategories: string[]; org: Organization }): Promise<{ candidates: SearchCandidate[]; hitCount: number }> {
  const today = new Date().toISOString().slice(0, 10);
  const staleBefore = new Date(Date.now() - 548 * 864e5).toISOString().slice(0, 10);
  const us = (s: string) => {
    const m = s?.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    return m ? `${m[3]}-${m[1]}-${m[2]}` : null;
  };
  const { result } = await gg.search({ keyword: input.keyword, oppStatuses: "forecasted|posted", eligibilities: gg.ELIGIBILITY.nonprofit501c3, fundingCategories: input.fundingCategories.join("|"), rows: 50 });
  const live = result.oppHits.filter((h) => {
    const c = us(h.closeDate);
    if (c && c < today) return false;
    const o = us(h.openDate);
    if (h.oppStatus === "forecasted" && o && o < staleBefore) return false;
    return true;
  });
  const ranked = preRank(live, [{ keyword: input.keyword }], input.org);
  return {
    hitCount: result.hitCount,
    candidates: ranked.slice(0, 40).map((h) => ({ externalId: h.id, number: h.number, title: h.title, agency: h.agency.trim(), status: h.oppStatus === "forecasted" ? "forecasted" : "posted", closeDate: us(h.closeDate), url: h.url ?? gg.opportunityPageUrl(h.id) })),
  };
}

/** Read chosen notices in full and score them like discovery does. */
export async function scoreChosen(input: { externalIds: string[]; org: Organization; facts: Fact[]; dismissed: Dismissal[] }): Promise<{ matches: ScoredMatch[]; droppedIneligible: number; droppedUnsupported: number; usage: { inputTokens: number; outputTokens: number; thoughtTokens: number }; costUsd: number; model: string }> {
  const today = new Date().toISOString().slice(0, 10);
  const candidates: { id: string; detail: gg.OpportunityDetail; text: string }[] = [];
  let droppedIneligible = 0;
  for (const id of input.externalIds.slice(0, 10)) {
    const { detail } = await gg.fetchOpportunity(id);
    if (!gg.isStillOpen(detail, today) || !gg.nonprofitMayApply(detail)) {
      droppedIneligible++;
      continue;
    }
    candidates.push({ id, detail, text: gg.opportunityText(detail, 2_600) });
  }
  if (!candidates.length) return { matches: [], droppedIneligible, droppedUnsupported: 0, usage: { inputTokens: 0, outputTokens: 0, thoughtTokens: 0 }, costUsd: 0, model: "" };
  const r = await scoreNotices({ candidates, org: input.org, facts: input.facts, dismissed: input.dismissed });
  return { ...r, droppedIneligible: droppedIneligible + r.droppedIneligible };
}
