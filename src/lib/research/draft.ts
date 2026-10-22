import { AiError, aiErrorMessage, getAi, type JsonSchema } from "@/lib/ai";
import { UsageLimitError } from "@/lib/usage/limits";
import { hasAi } from "@/lib/env";
import { replayActive } from "@/lib/replay/active";
import { recordRun } from "@/lib/loop/runs";
import { advanceJob, finishJob, logJob, startJob } from "@/lib/loop/progress";
import { renderSectionText } from "@/lib/loop/proposal";
import type { LetterGap, RenderOptions } from "@/lib/loop/letter";
import { sourceLabelFor } from "@/lib/crawl";
import type { Fact, ResearchProfile } from "@/lib/types";
import type { LoopStore } from "@/lib/loop/store";
import type { LoopResult } from "@/lib/services/contracts";
import { KINDS } from "@/lib/segments";
import { aiPolicyFor } from "./policies";

/**
 * Research proposals in the standard sections (project summary, aims, plan,
 * broader impacts, biosketches, budget justification, data management plan,
 * facilities). Biosketches and facilities are built from the team's records;
 * the rest is written from confirmed facts (recorded in the demo). Every
 * draft carries the funder's own rule on AI, because they differ: NIH does
 * not treat a substantially AI-written application as original.
 */

/** The team's records as citable facts, with ids that follow the record. */
export function researchFacts(p: ResearchProfile): Fact[] {
  const f = (id: string, label: string, value: string, category: Fact["category"]): Fact => ({ id: `rec_${id}`, orgId: p.orgId, label, value, category, sourceDocumentId: null, sourceUrl: null, sourceLabel: "Team records", sourceExcerpt: `${label}: ${value}`, sourcePage: null, confidence: 1, status: "confirmed", lastConfirmedAt: p.updatedAt });
  return [
    ...p.investigators.map((i) => f(i.id, `Investigator: ${i.name}`, `${i.title}; ${i.role === "pi" ? "principal investigator" : i.role === "co_pi" ? "co-investigator" : i.role}; expertise: ${i.expertise.join(", ")}`, "people")),
    ...p.publications.map((x) => f(x.id, `Publication: ${x.title}`, `${x.authors}. ${x.title}. ${x.venue}, ${x.year}.`, "outcomes")),
    ...p.priorAwards.map((a) => f(a.id, `Prior award: ${a.title}`, [a.funder, a.amount ? `$${a.amount.toLocaleString("en-US")}` : null, [a.startYear, a.endYear].filter(Boolean).join(" to ") || null, a.role].filter(Boolean).join("; "), "finance")),
    ...p.facilities.map((x) => f(x.id, `Facility: ${x.name}`, x.description, "organization")),
  ];
}

const schema: JsonSchema = {
  type: "object",
  properties: {
    sections: { type: "array", items: { type: "object", properties: { key: { type: "string" }, text: { type: "string" } }, required: ["key", "text"] } },
    gaps: { type: "array", maxItems: 12, items: { type: "object", properties: { key: { type: "string" }, question: { type: "string" }, whyItMatters: { type: "string" }, suggestedLabel: { type: "string" } }, required: ["key", "question", "whyItMatters", "suggestedLabel"] } },
  },
  required: ["sections", "gaps"],
};

export const RESEARCH_STEPS = ["Reading the notice, the team's records, and the funder's AI rules", "Writing the sections", "Building biosketches and facilities from your records", "Checking every citation and number"];

export async function draftResearch(store: LoopStore, profile: ResearchProfile | null, applicationId: string, jobId?: string): Promise<LoopResult<{ sectionCount: number; openQuestions: number; issues: number; wordCount: number }>> {
  if (jobId) startJob(jobId, RESEARCH_STEPS);
  try {
    const ctx = await store.getApplication(applicationId);
    if (!ctx || !profile) {
      if (jobId) finishJob(jobId, "failed");
      return { ok: false, code: "not_found", error: "Set up the team's profile first: investigators, publications, and facilities." };
    }
    const facts = [...(await store.listFacts()).filter((f) => f.status === "confirmed"), ...researchFacts(profile)];
    const notice = (await store.noticeTextFor(ctx.opportunity.id)) ?? ctx.opportunity.summary;
    const policy = aiPolicyFor(`${ctx.funder.name} ${notice.slice(0, 400)}`);
    const { output } = await recordRun(store, { agent: "proposal", title: `Draft a research proposal for ${ctx.opportunity.title}`, trigger: "user", usage: "draft" }, async (rec) => {
      if (jobId) advanceJob(jobId, policy ? `${policy.agency}: ${policy.level === "strict" ? "strict rules on AI" : policy.level === "disclose" ? "disclose AI use" : "check the notice"}` : "No funder AI policy found; check the notice");
      if (policy) logJob(jobId, { kind: "note", text: `${policy.agency} on AI`, detail: policy.summary });
      const defs = KINDS.research.sections;
      const modelDefs = defs.filter((d) => d.writtenBy === "model");
      let written: Record<string, string> = {};
      let gaps: LetterGap[] = [];
      if (hasAi() || replayActive()) {
        try {
          const res = await rec.step(
            "draft_research",
            () =>
              getAi().generateJson<{ sections: { key: string; text: string }[]; gaps: { key: string; question: string; whyItMatters: string; suggestedLabel: string }[] }>({
                tier: "standard",
                label: "draft_research",
                system: "You draft research proposal sections for a university team. Use only the team's records and confirmed facts (cite each with [[fact:ID]]) and the funding notice. Never invent results, preliminary data, citations, numbers, collaborators, or budget figures; write [[gap:KEY]] and ask. Scientific, precise, plain. No em dashes. Digits for numbers.",
                prompt: [`Team: ${profile.institution}${profile.department ? `, ${profile.department}` : ""}`, `Opportunity: ${ctx.opportunity.title}`, `Agency: ${ctx.funder.name}`, "", "Records and confirmed facts:", ...facts.map((f) => `- [${f.id}] ${f.label}: ${f.value}`), "", "Notice:", notice.slice(0, 8000), "", "Sections to write:", ...modelDefs.map((d) => `- key=${d.key} | ${d.title}${d.wordLimit ? ` (at most ${d.wordLimit} words)` : ""}: ${d.prompt}`)].join("\n"),
                schema,
                maxOutputTokens: 12000,
              }),
            (r) => `${r.data.sections.filter((s) => s.text).length} sections, ${r.data.gaps.length} questions`,
          );
          rec.tally(res);
          written = Object.fromEntries(res.data.sections.filter((s) => s.text).map((s) => [s.key, s.text]));
          gaps = res.data.gaps.map((g) => ({ ...g, paragraphKey: "plan" as const }));
        } catch (err) {
          if (!(err instanceof AiError)) throw err;
        }
      }
      if (jobId) advanceJob(jobId, Object.keys(written).length ? `${Object.keys(written).length} sections written` : "Outline from your records");
      // Without a model: each section becomes the questions it must answer.
      for (const d of modelDefs) {
        if (written[d.key]) continue;
        written[d.key] = `[[gap:${d.key}_draft]]`;
        gaps.push({ key: `${d.key}_draft`, paragraphKey: "plan", question: `${d.title}: ${d.prompt}`, whyItMatters: "Reviewers score this section, and it has to be in your own words.", suggestedLabel: d.title });
      }
      written.biosketches = profile.investigators
        .map((i) => {
          const theirs = profile.publications.filter((p) => p.authors.split(/,\s*/).some((a) => i.name.includes(a.split(" ")[0])));
          if (!theirs.length) gaps.push({ key: `bio_${i.id}`, paragraphKey: "plan", question: `Which publications or products should ${i.name}'s biosketch list?`, whyItMatters: "Biosketches list each person's most relevant products.", suggestedLabel: `${i.name}: products` });
          return `${i.name}, ${i.title}. [[fact:rec_${i.id}]]\n\n${theirs.map((p) => `- ${p.title}. ${p.venue}, ${p.year}. [[fact:rec_${p.id}]]`).join("\n") || `- [[gap:bio_${i.id}]]`}`;
        })
        .join("\n\n");
      written.facilities = profile.facilities.length ? profile.facilities.map((x) => `${x.name}: ${x.description}. [[fact:rec_${x.id}]]`).join("\n\n") : "[[gap:facilities_list]]";
      if (!profile.facilities.length) gaps.push({ key: "facilities_list", paragraphKey: "plan", question: "What labs, equipment, and field sites will the project use?", whyItMatters: "Funders ask for facilities and other resources in every proposal.", suggestedLabel: "Facilities and resources" });
      if (jobId) advanceJob(jobId, `${profile.investigators.length} biosketches, ${profile.facilities.length} facilities`);

      const gapIds = new Map<string, string>();
      const opts: RenderOptions = { facts, noticeText: notice, factLabel: (f) => f.sourceLabel ?? (f.sourceUrl ? sourceLabelFor(f.sourceUrl) : "Source"), gapId: (k) => gapIds.get(k) ?? (gapIds.set(k, store.newId("gap")), gapIds.get(k)!) };
      const ids = defs.map(() => store.newId("sec"));
      const rendered = defs.map((d, i) => ({ d, id: ids[i], out: renderSectionText(written[d.key] ?? "", d.title, gaps, opts) }));
      const issues = rendered.reduce((n, r) => n + r.out.issues.length, 0);
      const words = rendered.reduce((n, r) => n + r.out.words, 0);
      const missing = rendered.flatMap((r) => r.out.gaps.map((g) => ({ id: g.id, sectionId: r.id, question: g.question, whyItMatters: g.whyItMatters, suggestedLabel: g.suggestedLabel, status: "open" as const, answer: null, gapKey: g.key })));
      for (const r of rendered) logJob(jobId, { kind: "section", text: r.d.title, detail: `${r.out.words} words${r.out.gaps.length ? `, ${r.out.gaps.length} question${r.out.gaps.length === 1 ? "" : "s"}` : ""}` });
      const policyCheck = policy ? { rule: `${policy.agency} rules on AI`, status: policy.level === "allowed" ? ("pass" as const) : ("warn" as const), detail: `${policy.summary} What to do: ${policy.whatToDo}`, sectionId: null } : { rule: "Funder rules on AI", status: "warn" as const, detail: "We found no policy for this funder. Search the notice for an AI clause before using drafted text.", sectionId: null };
      await store.replaceLetter(applicationId, {
        requirements: [
          ...rendered.map((r, i) => ({ title: r.d.title, kind: "section" as const, detail: r.d.prompt, wordLimit: r.d.wordLimit, required: true, order: i + 1, satisfied: r.out.words > 0 && !r.out.gaps.length })),
          ...(policy && policy.level !== "allowed" ? [{ title: policy.level === "strict" ? "Rewrite every section in your own words" : "Disclose how AI was used", kind: "format" as const, detail: policy.whatToDo, wordLimit: null, required: true, order: rendered.length + 1, satisfied: false }] : []),
          { title: "Biosketches and current and pending support in the funder's format", kind: "attachment" as const, detail: "NSF and NIH each set a format; build them in SciENcv.", wordLimit: null, required: true, order: rendered.length + 2, satisfied: false },
        ],
        sections: rendered.map((r, i) => ({ id: r.id, title: r.d.title, bodyHtml: r.out.html, wordLimit: r.d.wordLimit, status: r.out.gaps.length ? "needs_facts" : "drafted", order: i + 1 })),
        missingFacts: missing,
        checks: [
          policyCheck,
          { rule: "Every claim cites the team's records", status: rendered.some((r) => r.out.issues.some((x) => x.kind === "unknown_fact")) ? "fail" : "pass", detail: "Each claim cites an investigator, publication, award, facility, or confirmed fact.", sectionId: null },
          { rule: "Every number appears in a record or the notice", status: rendered.some((r) => r.out.issues.some((x) => x.kind === "unsupported_number")) ? "fail" : "pass", detail: "Numbers without a source became questions.", sectionId: null },
          { rule: "No open questions", status: missing.length ? "warn" : "pass", detail: missing.length ? `${missing.length} questions waiting on you.` : "Nothing is waiting on you.", sectionId: null },
        ],
      });
      await store.updateApplication(applicationId, { stage: "drafting", mode: "research" });
      // The deadline and the steps before it go on the calendar.
      if (ctx.opportunity.deadline && "replaceMilestones" in store) await (store as import("@/lib/bids/store").BidStore).replaceMilestones(applicationId, (await import("@/lib/loop/milestones")).planMilestones(ctx.opportunity.deadline, { mode: "research" }));
      if (jobId) advanceJob(jobId, issues ? `${issues} turned into questions` : "Every citation checked");
      return { output: { sectionCount: rendered.length, openQuestions: missing.length, issues, wordCount: words }, summary: `Drafted ${rendered.length} research proposal sections (${words} words).${policy ? ` ${policy.agency}'s rule on AI is on the checklist.` : ""}` };
    });
    if (jobId) finishJob(jobId, "done");
    return { ok: true, data: output };
  } catch (err) {
    if (jobId) finishJob(jobId, "failed");
    return { ok: false, code: "failed", error: err instanceof UsageLimitError ? err.message : err instanceof AiError ? aiErrorMessage(err).message : "Something went wrong drafting the proposal. Try again." };
  }
}
