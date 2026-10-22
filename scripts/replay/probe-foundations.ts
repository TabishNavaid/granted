/**
 * Prints each sample's foundation matches with the evidence behind each score,
 * and the top new matches overall (the ones with recorded letters).
 *
 *   REPLAY_SPEED=500 npx tsx --tsconfig tsconfig.json scripts/replay/probe-foundations.ts
 */
import { runInSession } from "@/lib/services/demo-session";
import { mockServices } from "@/lib/services/mock";
import { loadFoundations, matchFoundations } from "@/lib/foundations";

(async () => {
  for (const [sid, sample, host] of [["s_probe_youth", "org_riverbend", "riverbendyouth.org"], ["s_probe_food", "org_second_furrow", "secondfurrow.org"], ["s_probe_clinic", "org_pine_hollow", "pinehollowhealth.org"]]) {
    await runInSession(sid, async () => {
      await mockServices.demo.startSetup(sample);
      await mockServices.loop.buildProfile({ websiteUrl: `https://${host}`, ein: null });
      const facts = await mockServices.knowledge.listFacts();
      await mockServices.loop.confirmProfile({ keptFactIds: facts.filter((f) => f.status === "needs_review").map((f) => f.id), factEdits: {}, org: {} });
      const org = await mockServices.org.get();
      console.log(`\n# ${sample}: causes ${JSON.stringify(org.causes)}`);
      await loadFoundations();
      const screen = matchFoundations({ org, facts: await mockServices.knowledge.listFacts(), limit: 10 });
      for (const m of screen.matches) console.log(`  ${m.fitScore} ${m.foundation.name} [${m.foundation.focus.join(", ")}] ${m.reasons[0]}`);
      await mockServices.loop.findMatches();
      const top = (await mockServices.opportunities.listMatches()).filter((m) => m.status === "new").sort((a, b) => b.fitScore - a.fitScore).slice(0, 3);
      console.log(`  top new: ${top.map((m) => `${m.fitScore} ${m.opportunity.title}`).join(" | ")}`);
    });
  }
  process.exit(0);
})();
