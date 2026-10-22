import { AiError, aiErrorMessage, getAi, type JsonSchema } from "@/lib/ai";
import { UsageLimitError } from "@/lib/usage/limits";
import { hasAi } from "@/lib/env";
import { replayActive } from "@/lib/replay/active";
import { recordRun } from "@/lib/loop/runs";
import { advanceJob, finishJob, logJob, startJob } from "@/lib/loop/progress";
import { renderSectionText } from "@/lib/loop/proposal";
import type { LetterGap, RenderOptions } from "@/lib/loop/letter";
import type { Fact, PersonProfile, ScholarshipProfile } from "@/lib/types";
import type { LoopResult } from "@/lib/services/contracts";
import type { BidStore } from "@/lib/bids/store";
import type { SegmentBackend } from "@/lib/services/segments";

/**
 * Individuals: a résumé becomes a profile the person checks, and each
 * experience becomes a fact an essay can cite. Essays are drafted in the
 * person's own voice from their own experiences; anything the résumé does not
 * say becomes a question, never a made-up story.
 */

const HEAD = /^\s*(education|experience|work experience|professional experience|research experience|employment|leadership|activities|extracurricular activities|volunteer( experience)?|community service|awards|honors|honors and awards|skills|publications|projects|goals|summary|objective)\s*:?\s*$/i;

/** Plain rules over the text of a résumé. Good enough to start; the person checks every line. */
export function parseResume(text: string): Omit<PersonProfile, "orgId" | "updatedAt" | "resumeDocumentId"> {
  const lines = text.replace(/\r/g, "").split("\n").map((l) => l.trim());
  const first = lines.find((l) => l && !/@|\d{3}/.test(l)) ?? "";
  const email = text.match(/[\w.+-]+@[\w-]+\.[\w.]+/)?.[0] ?? null;
  const gpa = text.match(/\bGPA:?\s*([0-4]\.\d{1,2})(\s*\/\s*4\.0+)?/i)?.[1] ?? null;
  const sections: Record<string, string[]> = {};
  // Lines before the first heading are the name and contact block, not a summary.
  let cur = "header";
  for (const l of lines) {
    if (!l) continue;
    const h = l.match(HEAD);
    if (h) {
      cur = h[1].toLowerCase();
      continue;
    }
    (sections[cur] ??= []).push(l);
  }
  const pick = (...keys: string[]) => keys.flatMap((k) => Object.entries(sections).filter(([s]) => s.includes(k)).flatMap(([, v]) => v));
  const education = pick("education").filter((l) => /\b(university|college|school|academy|institute)\b/i.test(l)).slice(0, 4).map((l) => {
    const classOf = l.match(/\bclass of (\d{4})\b/i);
    const years = classOf ? `Class of ${classOf[1]}` : (l.match(/\b(19|20)\d\d\s*[-–]\s*((19|20)\d\d|present|expected[^,]*)|\b(expected )?(19|20)\d\d\b/i)?.[0] ?? "");
    const school = l.split(/[,|–]/)[0].trim();
    const degree = /high school/i.test(school) ? "High school diploma" : l.replace(classOf?.[0] ?? years, "").split(/[,|]/).slice(1).filter((x) => !/^\s*[A-Z][a-z]+\s*$|^\s*[A-Z]{2}\s*$/.test(x)).join(",").trim();
    return { school, degree, years };
  });
  const expLines = pick("experience", "employment", "leadership", "volunteer", "community", "activities", "research", "projects");
  const experiences: PersonProfile["experiences"] = [];
  for (const l of expLines) {
    const bullet = /^[•▪◦·*-]\s*/.test(l);
    if (!bullet && experiences.length < 12) {
      const years = l.match(/\b((19|20)\d\d|summer|fall|spring)\b.*$/i)?.[0] ?? "";
      const head = l.replace(years, "").replace(/[,\s|–-]+$/, "");
      const at = head.match(/^(.+?)\s*(?:,|\s+at\s+|\s+\|\s+|\s+–\s+)\s*(.+)$/);
      experiences.push({ id: `exp_${experiences.length + 1}`, title: (at?.[1] ?? head).trim(), organization: (at?.[2] ?? "").trim(), years: years.trim(), detail: "" });
    } else if (experiences.length) {
      const e = experiences[experiences.length - 1];
      e.detail = `${e.detail}${e.detail ? " " : ""}${l.replace(/^[•▪◦·*-]\s*/, "").replace(/\.?$/, ".")}`;
    }
  }
  const level: ScholarshipProfile["level"] = /\b(ph\.?d|master|graduate)\b/i.test(text) ? "graduate" : /\bhigh school\b/i.test(text) && !/\b(bachelor|b\.s\.|b\.a\.)\b/i.test(text) ? "high_school" : "undergraduate";
  const state = text.match(/,\s*([A-Z]{2})\s+\d{5}\b/)?.[1] ?? text.match(/\b([A-Z][a-z]+),\s*([A-Z]{2})\b/)?.[2] ?? "";
  const hometown = text.match(/\b([A-Z][a-z]+(?: [A-Z][a-z]+)?),\s*[A-Z]{2}\b/)?.[1] ?? "";
  const field = text.match(/\b(?:planned major|intended major|major|majoring in|bachelor of (?:science|arts) in|b\.s\. in|b\.a\. in|study of):?\s+([A-Za-z ]{3,40}?)(?=[,.;\n]|\s+(?:and|with|at)\b)/i)?.[1]?.replace(/^:\s*/, "").trim() ?? "";
  return {
    fullName: first,
    email,
    level,
    field,
    school: education[0]?.school ?? null,
    state,
    hometown,
    gpa,
    education,
    experiences,
    awards: pick("award", "honor").slice(0, 10),
    activities: pick("activities", "leadership", "volunteer").filter((l) => !/^[•▪◦·*-]/.test(l)).slice(0, 10),
    goals: pick("goals", "objective", "summary").join(" ").slice(0, 600) || null,
  };
}

/** A person's experiences, awards, and goals as citable facts. Ids start with rec_ so they follow the record. */
export function personFacts(p: PersonProfile): Fact[] {
  const f = (id: string, label: string, value: string, category: Fact["category"]): Fact => ({ id: `rec_${id}`, orgId: p.orgId, label, value, category, sourceDocumentId: p.resumeDocumentId, sourceUrl: null, sourceLabel: "Your résumé", sourceExcerpt: `${label}: ${value}`, sourcePage: null, confidence: 1, status: "confirmed", lastConfirmedAt: p.updatedAt });
  const out: Fact[] = [];
  for (const e of p.experiences) out.push(f(e.id, `Experience: ${e.title}${e.organization ? `, ${e.organization}` : ""}`, [e.years, e.detail].filter(Boolean).join("; ") || e.title, "people"));
  for (const [i, a] of p.awards.entries()) out.push(f(`award_${i + 1}`, "Award", a, "outcomes"));
  for (const [i, e] of p.education.entries()) out.push(f(`edu_${i + 1}`, "Education", [e.school, e.degree, e.years].filter(Boolean).join(", "), "organization"));
  if (p.gpa) out.push(f("gpa", "GPA", p.gpa, "outcomes"));
  if (p.goals) out.push(f("goals", "In my own words", p.goals, "organization"));
  return out;
}

const resumeSchema: JsonSchema = {
  type: "object",
  properties: {
    experiences: { type: "array", items: { type: "object", properties: { title: { type: "string" }, organization: { type: "string" }, years: { type: "string" }, detail: { type: "string", description: "What they did, in their own résumé words." } }, required: ["title", "organization", "years", "detail"] } },
    field: { type: "string" },
    goals: { type: "string", description: "Only if the résumé states goals; else empty." },
  },
  required: ["experiences", "field", "goals"],
};

export async function readResume(store: BidStore, b: SegmentBackend, input: { text?: string; documentId?: string; sample?: boolean }): Promise<LoopResult<PersonProfile>> {
  try {
    let text = input.text ?? "";
    let docId: string | null = null;
    if (input.sample) {
      const { SAMPLE_RESUME } = await import("@/lib/replay/recordings/student-resume");
      text = SAMPLE_RESUME;
    } else if (input.documentId) {
      const doc = await b.documentPages(input.documentId);
      text = doc?.pages.map((p) => p.text).join("\n") ?? "";
      docId = input.documentId;
    }
    if (text.trim().split(/\s+/).length < 30) return { ok: false, code: "no_facts", error: "Paste your résumé or upload it as a PDF or Word file. We need at least a few lines to read." };
    const { output } = await recordRun(store, { agent: "profile", title: "Read a résumé", trigger: "user" }, async (rec) => {
      const parsed = await rec.step("read_rules", async () => parseResume(text), (r) => `${r.experiences.length} experiences, ${r.education.length} schools, ${r.awards.length} awards`);
      if (hasAi() || replayActive()) {
        try {
          const ai = getAi();
          const res = await rec.step("read_resume", () => ai.generateJson<{ experiences: { title: string; organization: string; years: string; detail: string }[]; field: string; goals: string }>({ tier: "lite", label: "read_resume", system: "You read a student's résumé into structured experiences. Use only what the résumé says, in its words. No em dashes.", prompt: text.slice(0, 20_000), schema: resumeSchema, maxOutputTokens: 4000 }), (r) => `${r.data.experiences.length} experiences read`);
          rec.tally(res);
          // Keep only experiences whose title appears in the résumé, so nothing is invented.
          const flat = text.toLowerCase();
          const kept = res.data.experiences.filter((e) => e.title && flat.includes(e.title.toLowerCase().slice(0, 18)));
          if (kept.length) parsed.experiences = kept.map((e, i) => ({ id: `exp_${i + 1}`, ...e }));
          if (res.data.field && !parsed.field) parsed.field = res.data.field;
          if (res.data.goals && !parsed.goals && flat.includes(res.data.goals.toLowerCase().slice(0, 20))) parsed.goals = res.data.goals;
        } catch (err) {
          if (!(err instanceof AiError)) throw err;
        }
      }
      const cur = await b.person.get();
      const saved = await b.person.save({ ...(cur ?? {}), ...parsed, fullName: parsed.fullName || cur?.fullName || "", orgId: store.orgId, resumeDocumentId: docId, updatedAt: b.now() } as PersonProfile);
      await store.updateOrg({ name: saved.fullName || (await store.getOrg()).name, onboardingStep: "profile" });
      return { output: saved, summary: `Read the résumé into ${saved.experiences.length} experiences for you to check.` };
    });
    return { ok: true, data: output };
  } catch (err) {
    return { ok: false, code: "failed", error: err instanceof UsageLimitError ? err.message : err instanceof AiError ? aiErrorMessage(err).message : "Something went wrong reading the résumé. Try again." };
  }
}

const essaySchema: JsonSchema = {
  type: "object",
  properties: {
    text: { type: "string", description: "The essay in paragraphs separated by blank lines, first person. [[fact:ID]] after each claim about the writer; [[gap:KEY]] where you need a detail they have not given." },
    gaps: { type: "array", maxItems: 6, items: { type: "object", properties: { key: { type: "string" }, question: { type: "string" }, whyItMatters: { type: "string" }, suggestedLabel: { type: "string" } }, required: ["key", "question", "whyItMatters", "suggestedLabel"] } },
  },
  required: ["text", "gaps"],
};

export const ESSAY_STEPS = ["Reading the prompt and your experiences", "Writing in your voice", "Checking every detail against your résumé"];

export async function draftEssay(store: BidStore, b: SegmentBackend, applicationId: string, prompt: string, jobId?: string): Promise<LoopResult<{ sectionId: string; words: number; openQuestions: number }>> {
  if (jobId) startJob(jobId, ESSAY_STEPS);
  try {
    const ctx = await store.getApplication(applicationId);
    const profile = await b.person.get();
    if (!ctx || !profile) {
      if (jobId) finishJob(jobId, "failed");
      return { ok: false, code: "not_found", error: "Set up your profile first, from your résumé." };
    }
    const facts = personFacts(profile);
    const { output } = await recordRun(store, { agent: "proposal", title: `Draft an essay for ${ctx.opportunity.title}`, trigger: "user", usage: "draft" }, async (rec) => {
      if (jobId) advanceJob(jobId, `${profile.experiences.length} experiences`);
      let text = "";
      let gaps: LetterGap[] = [];
      if (hasAi() || replayActive()) {
        try {
          const ai = getAi();
          const res = await rec.step(
            "draft_essay",
            () =>
              ai.generateJson<{ text: string; gaps: { key: string; question: string; whyItMatters: string; suggestedLabel: string }[] }>({
                tier: "standard",
                label: "draft_essay",
                system: "You help a student draft a scholarship essay in their own voice. Use only their experiences and words listed (cite each with [[fact:ID]]). Never invent a story, a feeling, a number, or a person. Where the essay needs a detail they have not given, write [[gap:KEY]] and ask for it. Plain, specific, first person, the way a thoughtful student writes. No em dashes, no exclamation marks, no cliches.",
                prompt: [`Scholarship: ${ctx.opportunity.title} (${ctx.funder.name})`, `Essay prompt: ${prompt}`, `Word limit: 650`, "", "The student's own words and experiences:", ...facts.map((f) => `- [${f.id}] ${f.label}: ${f.value}`)].join("\n"),
                schema: essaySchema,
                maxOutputTokens: 4000,
              }),
            (r) => `${r.data.text.split(/\s+/).length} words, ${r.data.gaps.length} questions`,
          );
          rec.tally(res);
          text = res.data.text;
          gaps = res.data.gaps.map((g) => ({ ...g, paragraphKey: "plan" as const }));
        } catch (err) {
          if (!(err instanceof AiError)) throw err;
        }
      }
      if (!text) {
        // Without a model: an outline from the person's own experiences, with the questions a good essay answers.
        const best = profile.experiences.slice(0, 3);
        text = [`[[gap:essay_opening]]`, ...best.map((e, i) => `- ${e.title}${e.organization ? ` at ${e.organization}` : ""}: [[gap:essay_story_${i + 1}]] [[fact:rec_${e.id}]]`), `[[gap:essay_close]]`].join("\n\n");
        gaps = [
          { key: "essay_opening", paragraphKey: "plan", question: `In two or three sentences, what is your answer to the prompt: "${prompt}"?`, whyItMatters: "The opening is your answer in your own words.", suggestedLabel: "Essay opening" },
          ...best.map((e, i) => ({ key: `essay_story_${i + 1}`, paragraphKey: "plan" as const, question: `What happened at ${e.title}${e.organization ? ` at ${e.organization}` : ""} that shows your answer? One moment, with what you did.`, whyItMatters: "A specific moment is what readers remember.", suggestedLabel: `Story: ${e.title}` })),
          { key: "essay_close", paragraphKey: "plan", question: "What will the scholarship let you do next?", whyItMatters: "Sponsors want to see where their money goes.", suggestedLabel: "What comes next" },
        ];
      }
      if (jobId) advanceJob(jobId, `${text.split(/\s+/).length} words`);
      const gapIds = new Map<string, string>();
      const opts: RenderOptions = { facts, noticeText: `${prompt}\n${ctx.opportunity.summary}`, factLabel: (f) => f.sourceLabel ?? "Your résumé", gapId: (k) => gapIds.get(k) ?? (gapIds.set(k, store.newId("gap")), gapIds.get(k)!) };
      const out = renderSectionText(text, "Essay", gaps, opts);
      const sectionId = store.newId("sec");
      await store.replaceLetter(applicationId, {
        requirements: [
          { title: "Answer the sponsor's prompt", kind: "section", detail: prompt, wordLimit: 650, required: true, order: 1, satisfied: out.words > 0 && !out.gaps.length },
          { title: "Read the essay aloud and make it sound like you", kind: "format", detail: "A draft is a start. Change any sentence you would not say.", wordLimit: null, required: true, order: 2, satisfied: false },
          { title: "Check the sponsor's eligibility and other materials", kind: "attachment", detail: "Many funds also ask for a transcript, a recommendation, or proof of enrollment. Confirm on the fund's application.", wordLimit: null, required: true, order: 3, satisfied: false },
        ],
        sections: [{ id: sectionId, title: "Personal statement", bodyHtml: out.html, wordLimit: 650, status: out.gaps.length ? "needs_facts" : "drafted", order: 1 }],
        missingFacts: out.gaps.map((g) => ({ id: g.id, sectionId, question: g.question, whyItMatters: g.whyItMatters, suggestedLabel: g.suggestedLabel, status: "open" as const, answer: null, gapKey: g.key })),
        checks: [
          { rule: "Every detail comes from you", status: out.issues.some((i) => i.kind === "unknown_fact") ? "fail" : "pass", detail: "Each claim cites your résumé or an answer you gave.", sectionId: null },
          { rule: "Within 650 words", status: out.words > 650 ? "warn" : "pass", detail: `Currently ${out.words} words.`, sectionId: null },
        ],
      });
      for (const g of out.gaps) logJob(jobId, { kind: "question", text: g.question });
      if (jobId) advanceJob(jobId, out.gaps.length ? `${out.gaps.length} questions for you` : "Every detail checked");
      await store.updateApplication(applicationId, { stage: "drafting", mode: "essay" });
      // The deadline and the steps before it go on the calendar.
      if (ctx.opportunity.deadline && "replaceMilestones" in store) await (store as import("@/lib/bids/store").BidStore).replaceMilestones(applicationId, (await import("@/lib/loop/milestones")).planMilestones(ctx.opportunity.deadline, { mode: "essay" }));
      return { output: { sectionId, words: out.words, openQuestions: out.gaps.length }, summary: `Drafted a ${out.words}-word essay from your own experiences.` };
    });
    if (jobId) finishJob(jobId, "done");
    return { ok: true, data: output };
  } catch (err) {
    if (jobId) finishJob(jobId, "failed");
    return { ok: false, code: "failed", error: err instanceof UsageLimitError ? err.message : err instanceof AiError ? aiErrorMessage(err).message : "Something went wrong drafting the essay. Try again." };
  }
}
