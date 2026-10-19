/**
 * Runs each sample's whole recorded setup through the live code, drafts every
 * recorded letter, and answers every question, printing what the validators
 * made of it. Every letter should come out with no unverified claims and no
 * unsourced numbers, and every answer should be rewritten into its paragraph.
 *
 *   REPLAY_SPEED=200 npx tsx --tsconfig tsconfig.json scripts/replay/check-letters.ts
 */
import { runInSession } from "@/lib/services/demo-session";
import { mockServices } from "@/lib/services/mock";

const ANSWERS: Record<string, string> = { ask: "$20,000", frl: "about 90%", use: "lead tutor stipends and bus passes", stops: "4 stops", cost: "$38,500", project: "a shared weekly progress note between teachers and tutors", partners: "the Leslie County Health Department and Clay Family Clinic", veterans: "about 210", counties: "rural, both of them" };
const answerFor = (key: string) => ANSWERS[Object.keys(ANSWERS).find((k) => key.endsWith(k)) ?? "use"];

(async () => {
  let problems = 0;
  for (const [sid, sample, host] of [["s_letters_youth", "org_riverbend", "riverbendyouth.org"], ["s_letters_food", "org_second_furrow", "secondfurrow.org"], ["s_letters_clinic", "org_pine_hollow", "pinehollowhealth.org"]]) {
    await runInSession(sid, async () => {
      await mockServices.demo.startSetup(sample);
      await mockServices.loop.buildProfile({ websiteUrl: `https://${host}`, ein: null });
      const facts = await mockServices.knowledge.listFacts();
      await mockServices.loop.confirmProfile({ keptFactIds: facts.filter((f) => f.status === "needs_review").map((f) => f.id), factEdits: {}, org: {} });
      await mockServices.loop.findMatches();
      const top = (await mockServices.opportunities.listMatches()).filter((m) => m.status === "new").sort((a, b) => b.fitScore - a.fitScore).slice(0, 3);
      console.log(`\n# ${sample}`);
      for (const m of top) {
        const app = await mockServices.opportunities.startApplication(m.opportunity.id, "letter");
        const r = await mockServices.loop.draftLetter(app.id);
        if (!r.ok) {
          problems++;
          console.log(`  ${m.opportunity.title}: NO LETTER (${r.error})`);
          continue;
        }
        if (r.data.issues) problems++;
        console.log(`  ${m.opportunity.title}: ${r.data.wordCount} words, ${r.data.openQuestions} questions, ${r.data.issues} issues`);
        const ws = await mockServices.applications.getWorkspace(app.id);
        for (const c of ws!.complianceChecks) if (c.status === "fail") console.log(`    FAIL ${c.rule}: ${c.detail}`);
        for (const q of ws!.missingFacts.filter((x) => x.status === "open")) {
          await mockServices.applications.answerMissingFact(q.id, answerFor(q.gapKey ?? ""));
          const after = await mockServices.applications.getWorkspace(app.id);
          const sec = after!.sections.find((s) => s.id === q.sectionId)!;
          const ok = sec.bodyHtml.includes(answerFor(q.gapKey ?? "").replace(/&/g, "&amp;")) && !sec.bodyHtml.includes(`data-gap="${q.id}"`);
          if (!ok) problems++;
          console.log(`    ${q.gapKey}: ${ok ? "answered and cited" : "NOT REWRITTEN"}`);
        }
        const final = await mockServices.applications.getWorkspace(app.id);
        const bad = final!.complianceChecks.filter((c) => c.status === "fail");
        if (bad.length) { problems++; console.log(`    after answers: ${bad.map((b) => b.detail).join("; ")}`); }
      }
    });
  }
  console.log(problems ? `\n${problems} problem(s)` : "\nEvery recorded letter and rewrite passes the live checks.");
  process.exit(problems ? 1 : 0);
})();
