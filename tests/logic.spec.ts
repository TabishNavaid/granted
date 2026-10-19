import { expect, test } from "@playwright/test";
import { fillPlaceholders, type Recording } from "@/lib/replay";
import { recording as youth } from "@/lib/replay/recordings/youth";
import { recording as foodbank } from "@/lib/replay/recordings/foodbank";
import { recording as clinic } from "@/lib/replay/recordings/clinic";

const RECORDINGS: Record<"youth" | "foodbank" | "clinic", Recording> = { youth, foodbank, clinic };
import { validateFacts, type ExtractedFact } from "@/lib/loop/profile";
import * as gg from "@/lib/grantsgov";
import { contains } from "@/lib/loop/text";
import { allFoundations, irsPageUrl, matchFoundations, matchScholarships, nextDeadline, recommendAsk } from "@/lib/foundations";
import { displayName } from "@/lib/foundations/names";
import { computeWinAnalytics } from "@/lib/features/analytics";
import { answerByRules } from "@/lib/features";
import { shiftDateWords, shiftSeedDates } from "@/lib/mock/dates";
import type { Fact, Organization } from "@/lib/types";

/**
 * Plain-code checks that need no browser: the recorded runs line up with the
 * live validators, foundation matching only offers what a filing supports,
 * and the analytics never claim more than the data.
 */

test.describe("recorded runs", () => {
  for (const id of ["youth", "foodbank", "clinic"] as const) {
    test(`${id}: facts and reasons survive the live checks`, async () => {
      const rec = RECORDINGS[id];
      const ex = rec.calls.find((c) => c.label === "extract_profile")!.data as { facts: ExtractedFact[] };
      const v = validateFacts(ex.facts, rec.site.pages);
      // Each recording includes at least one fact the source check must set aside, the way a live model sometimes errs.
      expect(v.dropped.length).toBeGreaterThan(0);
      expect(v.facts.length).toBeGreaterThan(15);
      // Programs become facts too (buildProfile adds one per named program found on a page).
      const kept = new Set([...v.facts.map((f) => f.label.toLowerCase()), "program"]);
      const score = rec.calls.find((c) => c.label === "score_fit")!.data as { scores: { id: string; reasons: { factId: string; noticeQuote: string }[] }[] };
      for (const s of score.scores) {
        const text = gg.opportunityText(rec.grantsgov.details[s.id], 2_600);
        for (const r of s.reasons) {
          expect(contains(text, r.noticeQuote), `${s.id} quote`).toBe(true);
          expect(kept.has(r.factId.match(/\{\{fact:([^}=]+)/)![1].toLowerCase()), `${s.id} cites a kept fact`).toBe(true);
        }
      }
      // Every recorded letter cites only facts that survive.
      for (const c of rec.calls.filter((x) => x.label === "draft_letter" || x.label === "redraft_paragraph")) {
        for (const m of JSON.stringify(c.data).matchAll(/\{\{fact:([^}=]+)/g)) expect(kept.has(m[1].toLowerCase()), `${c.match}: ${m[1]}`).toBe(true);
      }
    });
  }

  test("placeholders resolve against the ids in the prompt, and a removed fact stays unresolved", () => {
    const prompt = "Confirmed facts:\n- [fact_1] Year founded: 2016  (source says: \"Founded in 2016\")\n- [fact_2] Program: Summer Launch\n- [fact_3] Program: After-School Studio\n- [[gap:ask]] -> [[fact:fact_9]] Ask: $20,000";
    const out = fillPlaceholders({ t: "A {{fact:Year founded}} B {{fact:Program=After-School Studio}} C {{fact:Board members}} D {{value:ask}} {{answer:ask}}" }, prompt) as { t: string };
    expect(out.t).toBe("A fact_1 B fact_3 C missing:Board members D $20,000 fact_9");
  });
});

const org = (o: Partial<Organization>): Organization => ({ id: "o", orgType: "nonprofit", name: "Test", ein: "", websiteUrl: "", mission: "", annualBudget: 342000, fiscalYearEnd: "", foundedYear: null, city: "Dayton", state: "OH", serviceArea: "East Dayton", causes: ["Youth development", "Education"], populations: [], staffCount: null, volunteerCount: null, onboardingStep: "done", calendarToken: "", createdAt: "", ...o });
const facts: Fact[] = [
  { id: "f1", orgId: "o", label: "Service area ZIP codes", value: "45403", category: "geography", sourceDocumentId: null, sourceUrl: null, sourceLabel: "x", sourceExcerpt: "x", sourcePage: null, confidence: 1, status: "confirmed", lastConfirmedAt: "" },
  { id: "f2", orgId: "o", label: "People served", value: "214", category: "reach", sourceDocumentId: null, sourceUrl: null, sourceLabel: "x", sourceExcerpt: "x", sourcePage: null, confidence: 1, status: "confirmed", lastConfirmedAt: "" },
];

test.describe("foundation matching", () => {
  test("the dataset is real IRS data for three states", () => {
    const all = allFoundations();
    expect(all.length).toBeGreaterThan(300);
    expect(new Set(all.map((f) => f.state))).toEqual(new Set(["OH", "KY", "NC"]));
    for (const f of all.slice(0, 50)) {
      expect(f.ein).toMatch(/^\d{9}$/);
      expect(f.taxYear).toBeGreaterThanOrEqual(2023);
    }
  });

  test("only foundations that give in the state, do this work, and take requests are offered", () => {
    const r = matchFoundations({ org: org({}), facts, limit: 20 });
    expect(r.matches.length).toBeGreaterThan(3);
    expect(r.closedToRequests).toBeGreaterThan(0);
    for (const m of r.matches) {
      expect(m.foundation.acceptsUnsolicited).not.toBe(false);
      expect(m.foundation.granteeStates.some((s) => s.state === "OH") || m.foundation.state === "OH").toBe(true);
      expect(m.reasons.length).toBeGreaterThan(0);
      expect(m.fitScore).toBeGreaterThanOrEqual(40);
      expect(m.fitScore).toBeLessThanOrEqual(90);
    }
    // A Dayton foundation that funds a Dayton youth club ranks first for a Dayton youth program.
    expect(r.matches[0].foundation.city).toBe("Dayton");
  });

  test("a food bank in western North Carolina gets food and local funders, not a youth funder in Ohio", () => {
    const r = matchFoundations({ org: org({ city: "Marion", state: "NC", serviceArea: "McDowell and Rutherford counties", causes: ["Food security", "Hunger relief", "Rural communities"], annualBudget: 486250 }), facts, limit: 6 });
    expect(r.matches.every((m) => m.foundation.state === "NC" || m.foundation.granteeStates.some((s) => s.state === "NC"))).toBe(true);
    expect(r.matches[0].foundation.city).toBe("Rutherfordton");
  });

  test("a rural clinic is not matched to funders whose health giving is hospital systems", () => {
    const r = matchFoundations({ org: org({ city: "Hyden", state: "KY", serviceArea: "Leslie and Clay counties, Kentucky", causes: ["Rural health", "Primary care", "Chronic disease", "Substance use recovery"], annualBudget: 2184600 }), facts, limit: 400 });
    const yung = r.matches.find((m) => m.foundation.name === "The Yung Family Foundation");
    // Its health grants all went to hospital systems' cancer, heart, and children's institutes.
    expect(yung?.fitScore ?? 0).toBeLessThan(65);
    if (yung) expect(yung.cautions[0]).toContain("None of its");
    // Every foundation offered made at least one grant for related work, and the strong fits made one for the clinic's own work.
    for (const m of r.matches.filter((x) => x.fitScore >= 65)) expect(m.reasons[0]).toMatch(/recovery|clinic|health|patients|addiction|substance/i);
    expect(r.matches.every((m) => m.fitScore >= 45)).toBe(true);
  });

  test("a focus label alone does not make a match", () => {
    const r = matchFoundations({ org: org({ city: "Marion", state: "NC", serviceArea: "McDowell and Rutherford counties", causes: ["Food security", "Hunger relief", "Rural communities"], annualBudget: 486250 }), facts, limit: 400 });
    for (const m of r.matches) expect(m.reasons[0]).toMatch(/^In \d{4} it gave \$/);
    // A university health sciences hall is not rural food work, though the university is called Appalachian State.
    expect(r.matches.find((m) => m.foundation.name === "The Leon Levine Foundation")).toBeUndefined();
  });

  test("foundation names read the way people write them, and the IRS link keeps the filed name", () => {
    expect(displayName("Black Ann D Charitable Ochr")).toBe("Ann D Black Charitable Trust");
    expect(displayName("Elsie N Hill Trust UW 2-27-87")).toBe("Elsie N Hill Trust");
    expect(displayName("John Hauck Foundation Fifth Third Bank NA")).toBe("John Hauck Foundation");
    expect(displayName("The Foundation for A Healthy High Point")).toBe("The Foundation for a Healthy High Point");
    expect(displayName("Kettering Family Foundation")).toBe("Kettering Family Foundation");
    for (const f of allFoundations()) {
      expect(f.name).not.toMatch(/\b(PFDN|Ochr|UW|TW|C\/O|Aka|XXX)\b/);
      expect(f.name).not.toMatch(/^[^a-z]*[A-Z]{4,}[^a-z]*[A-Z]{4,}/);
    }
    const hauck = allFoundations().find((f) => f.name === "John Hauck Foundation")!;
    expect(irsPageUrl(hauck)).toContain(encodeURIComponent("FIFTH THIRD").replace(/%20/g, "+"));
  });

  test("deadlines are read from the filing, never guessed", () => {
    const today = new Date(Date.UTC(2026, 9, 18));
    expect(nextDeadline("None", today)).toEqual({ date: null, type: "rolling", asFiled: "None" });
    expect(nextDeadline("Proposal deadlines are January 31 and July 31 of each year.", today).date).toBe("2027-01-31");
    expect(nextDeadline("See website for details", today)).toEqual({ date: null, type: "rolling", asFiled: "See website for details" });
  });

  test("a suggested ask stays inside the budget and explains itself", () => {
    const r = recommendAsk({ median: 200_000, min: 5_000, max: 500_000, budget: 300_000 })!;
    expect(r.amount).toBeLessThanOrEqual(75_000);
    expect(r.why.join(" ")).toMatch(/quarter of your/);
  });

  test("scholarship matches name schools and places, never people", () => {
    const list = matchScholarships({ state: "OH", level: "high_school", field: "nursing", hometown: "Dover" });
    expect(list.length).toBeGreaterThan(0);
    for (const m of list) for (const p of m.pastRecipients) expect(p.name).not.toMatch(/^individual$/i);
  });
});

test.describe("analytics and answers", () => {
  test("small samples are called small", () => {
    const a = computeWinAnalytics({ applications: [], opportunities: [], funders: [], outcomes: [], sections: [] });
    expect(a.decided).toBe(0);
    expect(a.findings[0]).toMatch(/Only 0 decided/);
  });

  test("Ask answers from records and says when it cannot", () => {
    const a = computeWinAnalytics({ applications: [], opportunities: [], funders: [], outcomes: [], sections: [] });
    const ctx = { org: org({}), facts, matches: [], applications: [], milestones: [], analytics: a, pendingInbox: [], emails: [], today: "2026-10-18" };
    expect(answerByRules("How many people served?", ctx).answer).toMatch(/214/);
    expect(answerByRules("What is the meaning of life?", ctx).answer).toMatch(/model key/);
  });
});

test.describe("sample dates", () => {
  test("dates and the words that describe them move together, in whole weeks", () => {
    const out = shiftSeedDates({ milestones: [{ dueDate: "2026-11-06", title: "Due November 6" }], facts: [{ value: "through June" }] }, new Date(Date.UTC(2026, 10, 8)));
    expect(out.milestones[0]).toEqual({ dueDate: "2026-11-27", title: "Due November 27" });
    expect(out.facts[0].value).toBe("through June");
    expect(shiftDateWords("Your October plan", 0)).toBe("Your October plan");
  });
});
