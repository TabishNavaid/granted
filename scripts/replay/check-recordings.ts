/**
 * Checks each recorded run against the live validators, so a recording never
 * relies on a check being skipped. Prints what the real code will keep and
 * drop. Run after editing a recording:
 *
 *   npx tsx --tsconfig tsconfig.json scripts/replay/check-recordings.ts
 */
import { loadRecording, type RecordingId } from "@/lib/replay";
import { validateFacts, type ExtractedFact } from "@/lib/loop/profile";
import * as gg from "@/lib/grantsgov";
import { contains } from "@/lib/loop/text";

(async () => {
  let problems = 0;
  for (const id of ["youth", "foodbank", "clinic"] as RecordingId[]) {
    const rec = await loadRecording(id);
    console.log(`\n# ${id}`);
    const ex = rec.calls.find((c) => c.label === "extract_profile")!.data as { facts: ExtractedFact[] };
    const v = validateFacts(ex.facts, rec.site.pages);
    console.log(`facts kept ${v.facts.length}, dropped ${v.dropped.length}`);
    for (const d of v.dropped) console.log(`  dropped: ${d.fact.label} (${d.reason})`);
    const labels = new Set([...v.facts.map((f) => f.label.toLowerCase()), "program"]);
    const plan = rec.calls.find((c) => c.label === "plan_searches")!.data as { searches: { keyword: string; fundingCategories: string[] }[] };
    for (const s of plan.searches) {
      const key = `${s.keyword}|${s.fundingCategories.join("|")}`;
      if (!rec.grantsgov.searches[key]) { problems++; console.log(`  MISSING search ${key}`); }
    }
    const score = rec.calls.find((c) => c.label === "score_fit")!.data as { scores: { id: string; eligible: boolean; reasons: { factId: string; noticeQuote: string }[] }[] };
    for (const s of score.scores) {
      const d = rec.grantsgov.details[s.id];
      if (!d) { problems++; console.log(`  MISSING detail ${s.id}`); continue; }
      const text = gg.opportunityText(d, 2_600);
      for (const r of s.reasons) {
        const label = r.factId.match(/\{\{fact:([^}=]+)/)?.[1]?.toLowerCase();
        const okQuote = contains(text, r.noticeQuote);
        const okFact = label ? labels.has(label) : false;
        if (!okQuote || !okFact) { problems++; console.log(`  ${s.id}: quote ${okQuote ? "ok" : "NOT IN NOTICE"}, fact ${okFact ? "ok" : `NOT KEPT (${label})`}: ${r.noticeQuote}`); }
      }
      console.log(`  ${s.id} ${gg.isStillOpen(d) ? "open" : "CLOSED"} ${d.opportunityTitle.slice(0, 70)}`);
    }
    for (const c of rec.calls.filter((c) => c.label === "draft_letter" || c.label === "redraft_paragraph")) {
      const refs = [...JSON.stringify(c.data).matchAll(/\{\{fact:([^}=]+)/g)].map((m) => m[1].toLowerCase());
      for (const r of refs) if (!labels.has(r)) { problems++; console.log(`  ${c.label} ${c.match}: cites a fact that is not kept: ${r}`); }
    }
  }
  console.log(problems ? `\n${problems} problem(s)` : "\nAll recordings line up with the validators.");
  process.exit(problems ? 1 : 0);
})();
