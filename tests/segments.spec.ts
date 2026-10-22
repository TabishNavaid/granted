import { expect, test } from "@playwright/test";
import { recordFacts, projectLine } from "@/lib/firm/facts";
import { firmBoilerplates, firmCertifications, firmOrg, firmPersonnel, firmProfile, firmProjects } from "@/lib/mock/firm";
import { readRfp, datesIn } from "@/lib/bids/rfp";
import { scoreGoNoGo, stateOf } from "@/lib/bids/gonogo";
import { assignPeople, holdsSetAside, pickProjects, rolesIn, solicitationProfile } from "@/lib/bids/select";
import { recomputeMatrix, matrixSummary } from "@/lib/bids/matrix";
import { feeStructure, feeTotals } from "@/lib/bids/fee";
import { readAddendum } from "@/lib/bids/addenda";
import { buildSf330, SF330_LIMITS } from "@/lib/bids/sf330";
import { sf330Docx } from "@/lib/bids/sf330-docx";
import { SAMPLE_RFP } from "@/lib/replay/recordings/firm-rfp";
import { parseResume, personFacts } from "@/lib/person";
import { SAMPLE_RESUME } from "@/lib/replay/recordings/student-resume";
import { loadFoundations, matchScholarships } from "@/lib/foundations";
import { aiPolicyFor } from "@/lib/research/policies";
import { stagesFor, stageLabel, ORG_TYPES } from "@/lib/segments";
import { planMilestones } from "@/lib/loop/milestones";
import type { Requirement, Section } from "@/lib/types";

/**
 * The firm, research, and individual paths as plain code: no browser and no
 * server. The sample solicitation is a real VA notice, so these tests run the
 * rules on a real document.
 */

const known = { title: SAMPLE_RFP.title, number: SAMPLE_RFP.number, naics: [...SAMPLE_RFP.naics], setAside: SAMPLE_RFP.setAside, placeOfPerformance: SAMPLE_RFP.placeOfPerformance, dueDate: SAMPLE_RFP.dueDate, type: "SF330" as const };
const parsed = () => readRfp([{ page: 1, text: SAMPLE_RFP.text }], known);

test.describe("firm profile", () => {
  test("every record becomes a citable fact with a stable id, and nothing else is invented", () => {
    const facts = recordFacts({ org: firmOrg, profile: firmProfile, projects: firmProjects, personnel: firmPersonnel, certifications: firmCertifications, boilerplates: firmBoilerplates });
    for (const p of firmProjects) expect(facts.find((f) => f.id === `rec_${p.id}`)?.value).toContain(p.client);
    for (const p of firmPersonnel) expect(facts.some((f) => f.id === `rec_${p.id}`)).toBe(true);
    expect(facts.find((f) => f.id === "rec_safety")?.value).toContain("EMR 0.78");
    expect(facts.find((f) => f.id === "rec_staff")?.value).toContain("12 employees");
    expect(facts.find((f) => f.id === "rec_uei")?.value).toContain(firmProfile.uei!);
    // Bonding is not on file for this design firm, so there is no bonding fact to cite.
    expect(facts.some((f) => f.id === "rec_bonding")).toBe(false);
    expect(new Set(facts.map((f) => f.id)).size).toBe(facts.length);
    for (const f of facts) expect(f.status).toBe("confirmed");
  });

  test("a project line carries the numbers a draft may use", () => {
    const line = projectLine(firmProjects.find((p) => p.id === "proj_calaveras")!);
    for (const n of ["18,400", "$5,900,000", "$612,000", "2025", "prime consultant"]) expect(line).toContain(n);
  });
});

test.describe("RFP reading and the compliance matrix", () => {
  test("the real VA notice reads into requirements, criteria, limits, and dates", () => {
    const r = parsed();
    expect(r.solicitation.type).toBe("SF330");
    expect(r.solicitation.setAside).toContain("SDVOSB");
    expect(r.solicitation.forms).toContain("SF 330");
    expect(r.solicitation.pageLimits.join(" ")).toMatch(/20\)? pages/);
    expect(r.solicitation.evaluation.map((e) => e.factor)).toEqual(expect.arrayContaining(["Professional qualifications", "Specialized experience", "Capacity", "Past performance", "Location"]));
    // The notice's current response date replaces the 2023 date in the original text.
    expect(r.solicitation.dates.filter((d) => d.kind === "submission").map((d) => d.date)).toEqual(["2027-09-30"]);
    expect(r.requirements.length).toBeGreaterThanOrEqual(15);
    for (const q of r.requirements) {
      // Every requirement quotes the notice word for word and says where it is.
      expect(SAMPLE_RFP.text.replace(/\s+/g, " ")).toContain(q.excerpt.replace(/\s+/g, " ").slice(0, 60));
      expect(q.ref).toMatch(/page \d+/i);
    }
    // The buyer's own obligations are not requirements for the firm.
    expect(r.requirements.some((q) => /selection board shall review|report shall serve/i.test(q.excerpt))).toBe(false);
  });

  test("dates read in every common format, with times", () => {
    expect(datesIn("Questions due October 3, 2026 by 2:00 p.m.").map((d) => d.iso)).toEqual(["2026-10-03"]);
    expect(datesIn("09-27-2023 10:00 CENTRAL")[0].iso).toBe("2023-09-27");
    expect(datesIn("on 11/14/2026 and 2026-12-01")[1].iso).toBe("2026-12-01");
    const r = readRfp([{ page: 3, text: "SECTION 2 SCHEDULE\nA mandatory pre-proposal meeting will be held on November 2, 2026 at 10:00 a.m. at City Hall.\nQuestions must be submitted in writing no later than November 9, 2026.\nProposals are due no later than 2:00 p.m. on December 1, 2026. Late proposals will not be accepted.\nThe Consultant shall submit five (5) copies and one PDF, not to exceed 30 pages.\n".repeat(3) }]);
    const kinds = Object.fromEntries(r.solicitation.dates.map((d) => [d.kind, d]));
    expect(kinds.prebid_meeting.date).toBe("2026-11-02T10:00");
    expect(kinds.prebid_meeting.mandatory).toBe(true);
    expect(kinds.questions_due.date.slice(0, 10)).toBe("2026-11-09");
    expect(r.dueDate).toBe("2026-12-01T14:00");
    expect(r.requirements.find((q) => /30 pages/.test(q.excerpt))?.kind).toBe("format");
    expect(r.requirements[0].ref).toBe("Section 2, page 3");
  });

  test("the matrix marks a requirement met only when its section has no open gap", () => {
    const reqs: Requirement[] = parsed().requirements.map((q, i) => ({ id: `r${i}`, applicationId: "a", title: q.title, kind: q.kind, detail: q.excerpt, wordLimit: null, required: q.mandatory, order: i, satisfied: false, ref: q.ref, excerpt: q.excerpt, sectionKey: q.sectionKey, matrixStatus: "open" }));
    const sec = (id: string, html: string): Section => ({ id, applicationId: "a", requirementId: null, title: id, bodyHtml: html, wordLimit: null, status: "drafted", order: 1, updatedAt: "" });
    const sections = [sec("projects", "<p>Done.</p>"), sec("cover_letter", '<p>Text <span data-gap="g1" data-label="x"></span></p>'), sec("qualifications", "<p>Done.</p>")];
    const out = recomputeMatrix({ requirements: reqs, sections, documents: [], fee: null, eligibilityMet: true, sectionKeyOf: (s) => s.id });
    const projects = out.find((r) => r.sectionKey === "projects" && r.kind === "section")!;
    expect(projects.matrixStatus).toBe("met");
    expect(projects.answeredInSectionId).toBe("projects");
    expect(out.find((r) => r.sectionKey === "cover_letter" && r.kind === "section")?.matrixStatus).toBe("partial");
    expect(out.filter((r) => r.kind === "format").every((r) => r.matrixStatus === "firm_action")).toBe(true);
    const sum = matrixSummary(out);
    expect(sum.total).toBe(out.length);
    expect(sum.met + sum.partial + sum.open + sum.firmAction).toBe(sum.total);
  });
});

test.describe("go/no-go", () => {
  const base = () => ({ title: SAMPLE_RFP.title, text: SAMPLE_RFP.text, solicitation: parsed().solicitation, dueDate: "2027-09-30", firmState: "TX", profile: firmProfile, projects: firmProjects, personnel: firmPersonnel, certifications: firmCertifications, activeBids: 1, today: "2026-10-18" });

  test("the sample firm is a go on the VA notice, with every factor explained", () => {
    const r = scoreGoNoGo(base());
    expect(r.suggestion).toBe("go");
    expect(r.score).toBeGreaterThanOrEqual(65);
    expect(r.stoppers).toEqual([]);
    for (const f of r.factors) expect(f.detail.length).toBeGreaterThan(15);
    expect(r.projectIds.length).toBeLessThanOrEqual(SF330_LIMITS.exampleProjects);
  });

  test("a set-aside the firm does not hold stops the bid whatever the score", () => {
    const r = scoreGoNoGo({ ...base(), certifications: firmCertifications.filter((c) => c.kind !== "sdvosb") });
    expect(r.suggestion).toBe("no_go");
    expect(r.stoppers.join(" ")).toMatch(/set aside/i);
  });

  test("a passed deadline and bonding above the firm's limit are stoppers", () => {
    const sol = { ...parsed().solicitation, estimatedValue: { min: null, max: 8_000_000, note: null }, bonding: { bidBondPercent: 5, performanceBondPercent: 100, paymentBondPercent: 100, note: "Performance and payment bonds of 100 percent." } };
    const r = scoreGoNoGo({ ...base(), solicitation: sol, dueDate: "2026-09-01", profile: { ...firmProfile, bonding: { singleLimit: 2_000_000, aggregateLimit: 5_000_000, surety: null, asOf: null, documentId: null } } });
    expect(r.stoppers.some((s) => /passed/.test(s))).toBe(true);
    expect(r.stoppers.some((s) => /bonding limit/.test(s))).toBe(true);
    expect(r.suggestion).toBe("no_go");
  });

  test("work far from home and outside the firm's work scores lower", () => {
    const far = { ...parsed().solicitation, setAside: null, placeOfPerformance: "Anchorage, AK" };
    const home = scoreGoNoGo(base()).score;
    const away = scoreGoNoGo({ ...base(), title: "Harbor dredging and pier repair", text: "Dredging of the harbor channel and repair of timber piers. Marine construction.", solicitation: far }).score;
    expect(away).toBeLessThan(home - 20);
    expect(stateOf("Anchorage, AK")).toBe("AK");
  });

  test("projects and people are chosen for the solicitation, with reasons", () => {
    const picks = pickProjects(firmProjects, solicitationProfile("Renovation of an occupied VA outpatient clinic with HVAC replacement in Texas", "TX"), { today: "2026-10-18" });
    expect(picks[0].project.id).toBe("proj_calaveras");
    expect(picks[0].reasons.join(" ")).toMatch(/clinic|renovation|hvac/i);
    expect(rolesIn("The team shall include a Project Manager, a Structural Engineer, and a Mechanical Engineer.")).toEqual(["Project manager", "Structural engineer", "Mechanical engineer"]);
    const team = assignPeople(firmPersonnel, ["Project manager", "Structural engineer", "Mechanical engineer"], "TX");
    expect(team.map((a) => a.personnelId)).toEqual(["per_okonkwo", "per_brightwater", "per_okonkwo"]);
    expect(team[2].why).toMatch(/also project manager/);
    expect(holdsSetAside("Total Small Business Set-Aside (FAR 19.5)", firmCertifications, firmProfile).held).toBe(true);
  });
});

test.describe("SF 330, fee, addenda, deadlines", () => {
  const sf = () => buildSf330({ org: firmOrg, profile: firmProfile, owner: { id: "u", orgId: firmOrg.id, fullName: "Marisol Vega", email: "marisol@cibololine.com", role: "owner", status: "active" }, notice: { title: SAMPLE_RFP.title, location: "Texas", date: null, number: SAMPLE_RFP.number }, projects: firmProjects, exampleProjectIds: firmProjects.map((p) => p.id).concat(firmProjects.map((p) => p.id)), personnel: firmPersonnel, assignments: assignPeople(firmPersonnel, [], "TX"), certifications: firmCertifications, additionalInformation: "" });

  test("the SF 330 holds at most ten example projects, a résumé per role, and a true participation matrix", () => {
    const s = sf();
    expect(s.partI.f.length).toBe(SF330_LIMITS.exampleProjects);
    expect(s.partI.e.length).toBeGreaterThanOrEqual(5);
    for (const r of s.partI.e) expect(r.projects.length).toBeLessThanOrEqual(SF330_LIMITS.projectsPerResume);
    const vega = s.partI.g.people.find((p) => p.name.startsWith("Marisol"))!;
    const calaveras = s.partI.f.find((f) => f.projectId === "proj_calaveras")!;
    expect(vega.marks).toContain(calaveras.key);
    expect(s.partII.uei).toBe(firmProfile.uei);
    expect(s.partII.smallBusinessStatus).toMatch(/SDVOSB/);
    expect(s.missing.join(" ")).toMatch(/Section H/);
    expect(s.missing.join(" ")).toMatch(/Section I/);
  });

  test("the SF 330 exports as a Word file that says it is a working copy", async () => {
    const buf = await sf330Docx(sf());
    expect(buf.subarray(0, 2).toString()).toBe("PK");
    expect(buf.length).toBeGreaterThan(8000);
    const { inflateRawSync } = await import("node:zlib");
    // Find word/document.xml in the zip and check the text inside.
    const name = Buffer.from("word/document.xml");
    const at = buf.indexOf(name);
    expect(at).toBeGreaterThan(0);
    const header = buf.lastIndexOf(Buffer.from([0x50, 0x4b, 0x03, 0x04]), at);
    const compressed = buf.readUInt32LE(header + 18);
    const start = header + 30 + buf.readUInt16LE(header + 26) + buf.readUInt16LE(header + 28);
    const xml = inflateRawSync(buf.subarray(start, start + compressed)).toString("utf8");
    expect(xml).toContain("Working copy in the structure of Standard Form 330");
    expect(xml).toContain("E. Résumés of key personnel");
    expect(xml).toContain("Calaveras Lake Outpatient Clinic Renovation");
  });

  test("the fee proposal never contains a number the firm did not enter", () => {
    const fee = feeStructure({ solicitation: parsed().solicitation, text: SAMPLE_RFP.text, profile: { ...firmProfile, rates: [] }, applicationId: "a" });
    for (const l of [...fee.phases.flatMap((p) => p.lines), ...fee.expenses]) {
      expect(l.hours).toBeNull();
      expect(l.rate).toBeNull();
      expect(l.amount).toBeNull();
    }
    expect(feeTotals(fee).total).toBe(0);
    expect(fee.instructions[0]).toMatch(/Brooks Act/);
    const withRates = feeStructure({ solicitation: parsed().solicitation, text: SAMPLE_RFP.text, profile: firmProfile, applicationId: "a" });
    const pm = withRates.phases[0].lines.find((l) => l.role === "Project manager")!;
    expect(pm.rate).toBe(175);
    expect(pm.hours).toBeNull();
    pm.hours = 40;
    expect(feeTotals(withRates).total).toBe(7000);
  });

  test("the real amendments read into answers and changes, and a new due date moves the deadline", () => {
    const a1 = readAddendum(SAMPLE_RFP.addenda[0].text, { dueDate: null, dates: [] });
    expect(a1.number).toBe("A0001");
    expect(a1.changes.filter((c) => c.kind === "answer").length).toBe(4);
    const a3 = readAddendum(SAMPLE_RFP.addenda[2].text, { dueDate: "2027-09-30", dates: [] });
    expect(a3.changes.find((c) => c.before === "35 vendors")?.after).toBe("50 vendors");
    const moved = readAddendum("Addendum No. 2\nThe proposal due date is hereby extended to December 15, 2026 at 2:00 p.m.", { dueDate: "2026-12-01", dates: [] });
    expect(moved.dates.find((d) => d.kind === "submission")?.date).toBe("2026-12-15");
    expect(moved.summary).toMatch(/moves the due date to 2026-12-15/);
  });

  test("bid deadlines plan back from the due date and decide within a week", () => {
    const plan = planMilestones("2026-12-01", { mode: "bid", today: "2026-10-18", bidDates: [{ kind: "questions_due", date: "2026-11-09", label: "Questions due", note: null, ref: null }, { kind: "prebid_meeting", date: "2026-11-02T10:00", label: "Pre-bid meeting", note: null, ref: null, mandatory: true }] });
    const kinds = plan.map((m) => m.kind);
    for (const k of ["go_no_go", "prebid_meeting", "questions_due", "draft_due", "submit", "deadline"]) expect(kinds).toContain(k);
    expect(plan.find((m) => m.kind === "go_no_go")!.dueDate <= "2026-10-26").toBe(true);
    expect(plan.find((m) => m.kind === "prebid_meeting")?.title).toMatch(/mandatory/);
    expect(plan[plan.length - 1]).toEqual({ kind: "deadline", title: "Proposals due", dueDate: "2026-12-01" });
  });
});

test.describe("segments, research, and individuals", () => {
  test.beforeAll(() => loadFoundations());
  test("each kind of opportunity has its own stages, and bids use the bid board", () => {
    expect(stagesFor("contract").map((s) => s.label)).toEqual(["Found", "Go/no-go", "Preparing", "Submitted", "Shortlisted", "Interview", "Won", "Lost"]);
    expect(stageLabel("drafting", "contract")).toBe("Preparing");
    expect(stageLabel("drafting", "scholarship")).toBe("Writing");
    expect(ORG_TYPES.firm.kinds[0]).toBe("contract");
    expect(ORG_TYPES.individual.steps.map((s) => s.href)).not.toContain("/onboarding/ein");
  });

  test("funders' AI rules are found by agency, with sources", () => {
    expect(aiPolicyFor("National Institutes of Health")?.level).toBe("strict");
    expect(aiPolicyFor("U.S. National Science Foundation")?.level).toBe("disclose");
    expect(aiPolicyFor("Department of Education")?.level).toBe("allowed");
    for (const k of ["nih", "nsf", "doe", "nasa"]) expect(aiPolicyFor(k === "nih" ? "NIH" : k === "nsf" ? "NSF" : k === "doe" ? "DOE" : "NASA")?.sources.length).toBeGreaterThan(0);
  });

  test("a résumé reads into experiences in the person's words, and they become citable facts", () => {
    const p = parseResume(SAMPLE_RESUME);
    expect(p.fullName).toBe("Jordan Reyes");
    expect(p.level).toBe("high_school");
    expect(p.field).toBe("civil engineering");
    expect(p.experiences.map((e) => e.organization)).toEqual(["Belmont Ridge Robotics Team", "Hollis Hardware", "Mad River Cleanup Crew", "Riverbend Youth Collective After-School Studio"]);
    expect(p.goals).toMatch(/^I want to study civil engineering/);
    const facts = personFacts({ ...p, orgId: "o", resumeDocumentId: null, updatedAt: "" });
    expect(facts.find((f) => f.id === "rec_exp_3")?.value).toContain("2 tons");
    for (const f of facts) expect(SAMPLE_RESUME).toContain(f.value.split(";").pop()!.trim().slice(0, 25));
  });

  test("scholarship matches skip funds for another county, loans, and foundations that fund organizations", () => {
    const m = matchScholarships({ state: "OH", level: "high_school", field: "civil engineering", hometown: "Dayton", limit: 12 });
    expect(m[0].name).toBe("Bernard-Wentz Scholarship Fund");
    expect(m.some((x) => /Kettering Family Foundation/.test(x.name))).toBe(false);
    const paulding = m.find((x) => /Paulding/.test(x.name));
    if (paulding) expect(paulding.cautions[0]).toMatch(/Paulding County/);
    const loan = m.find((x) => /Loan/.test(x.name));
    if (loan) expect(loan.cautions.join(" ")).toMatch(/loans/);
  });
});
