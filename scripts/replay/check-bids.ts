/**
 * Runs the sample firm's bid through the live code: reads the sample
 * solicitation into a compliance matrix, scores go/no-go, drafts the
 * proposal, adds the three amendments, and builds the SF 330. Prints what
 * the validators made of it.
 *
 *   REPLAY_SPEED=500 npx tsx --tsconfig tsconfig.json scripts/replay/check-bids.ts
 */
import { runInSession } from "@/lib/services/demo-session";
import { mockServices } from "@/lib/services/mock";

(async () => {
  let problems = 0;
  await runInSession("s_check_bids", async () => {
    await mockServices.org.switchWorkspace("org_cibolo_line");
    const added = await mockServices.bids.addRfp({ sample: true });
    if (!added.ok) throw new Error(added.error);
    console.log(`Added: ${added.data.requirementCount} requirements, go/no-go ${added.data.score}`);
    const id = added.data.applicationId;
    let bid = (await mockServices.bids.get(id))!;
    console.log(`  read by ${bid.readBy}; suggestion ${bid.goNoGo?.suggestion}; stoppers: ${bid.goNoGo?.stoppers.join("; ") || "none"}`);
    for (const f of bid.goNoGo!.factors) console.log(`  ${f.label}: ${Math.round(f.score * 100)} ${f.detail}`);
    console.log(`  projects: ${bid.meta?.projectIds.join(", ")}`);
    console.log(`  people: ${bid.meta?.assignments.map((a) => `${a.role}=${a.personnelId}`).join(", ")}`);
    const d = await mockServices.bids.draft(id);
    if (!d.ok) throw new Error(d.error);
    console.log(`Drafted: ${d.data.sectionCount} sections, ${d.data.wordCount} words, ${d.data.openQuestions} questions, ${d.data.issues} issues; matrix ${d.data.met}/${d.data.total}`);
    if (d.data.issues) problems++;
    const ws = (await mockServices.applications.getWorkspace(id))!;
    for (const c of ws.complianceChecks) console.log(`  ${c.status.toUpperCase()} ${c.rule}: ${c.detail}`);
    for (const m of ws.missingFacts) console.log(`  ? ${m.question}`);
    for (const s of ws.sections) if (/data-label="(Unverified claim|Confirm )/.test(s.bodyHtml)) {
      problems++;
      console.log(`  PROBLEM in ${s.title}: ${s.bodyHtml.match(/data-label="[^"]*"/g)?.join(" ")}`);
    }
    for (let i = 0; i < 3; i++) {
      const a = await mockServices.bids.addAddendum(id, { sample: true });
      console.log(a.ok ? `Addendum ${a.data.number}: ${a.data.summary}` : `Addendum failed: ${a.error}`);
    }
    bid = (await mockServices.bids.get(id))!;
    console.log(`Matrix after addenda: ${JSON.stringify(bid.matrix)}`);
    for (const r of bid.requirements) console.log(`  [${r.matrixStatus}] ${r.title} (${r.ref})`);
    const sf = (await mockServices.bids.sf330(id))!;
    console.log(`SF 330: ${sf.partI.e.length} resumes, ${sf.partI.f.length} example projects; missing: ${sf.missing.length}`);
    for (const m of sf.missing) console.log(`  - ${m}`);
    const fee = bid.fee!;
    console.log(`Fee: ${fee.basis}, ${fee.phases.length} phases; first instruction: ${fee.instructions[0]}`);
    const ms = await mockServices.calendar.listMilestones(id);
    for (const m of ms) console.log(`  ${m.dueDate} ${m.kind} ${m.title}`);
    const sam = await mockServices.bids.searchSam();
    console.log(`SAM: ${sam.status}, ${sam.notices.length} notices; top: ${sam.notices.slice(0, 3).map((n) => `${n.fit?.score} ${n.title.slice(0, 50)}`).join(" | ")}`);
  });
  console.log(problems ? `\n${problems} problem(s)` : "\nThe sample bid passes the live checks.");
  process.exit(problems ? 1 : 0);
})();
