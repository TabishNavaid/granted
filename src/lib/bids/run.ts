import { sha1Hex } from "@/lib/hash";
import { AiError, aiErrorMessage } from "@/lib/ai";
import { hasAi } from "@/lib/env";
import { replayActive } from "@/lib/replay/active";
import { recordRun } from "@/lib/loop/runs";
import { advanceJob, finishJob, logJob, startJob } from "@/lib/loop/progress";
import { renderSectionText } from "@/lib/loop/proposal";
import type { LetterGap, RenderOptions } from "@/lib/loop/letter";
import { planMilestones } from "@/lib/loop/milestones";
import { sourceLabelFor } from "@/lib/crawl";
import type { Addendum, Fact, Funder, GoNoGo, Opportunity, Requirement, Section } from "@/lib/types";
import { KINDS } from "@/lib/segments";
import { recordFacts } from "@/lib/firm/facts";
import { readRfp, type ParsedRequirement, type RfpPage, type SectionKey } from "./rfp";
import { scoreGoNoGo, stateOf } from "./gonogo";
import { feeStructure } from "./fee";
import { recomputeMatrix, SECTION_TITLES } from "./matrix";
import { readAddendum } from "./addenda";
import { approachOutline, coverLetterFallback, personnelSection, projectsSection, qualificationsFallback, qualitySafetySection, referencesSection, scheduleSection, type CodeSection, type DraftGap } from "./sections";
import { draftBidSections, refineRequirements } from "./model";
import type { BidStore } from "./store";

/**
 * The bid workflow, over a store, so the demo and Supabase run the same
 * code. Every step works with no model key: the rules reader builds the
 * compliance matrix, go/no-go and project selection are code, and the
 * records write most of the proposal. A model key (or the recorded demo run)
 * adds a tidier matrix and a written cover letter, qualifications, and
 * approach.
 */
export type BidResult<T> = { ok: true; data: T } | { ok: false; code: "not_found" | "no_text" | "failed" | "no_ai"; error: string };

const factLabel = (f: Fact) => f.sourceLabel ?? (f.sourceUrl ? sourceLabelFor(f.sourceUrl) : "Source");
const modelAvailable = () => hasAi() || replayActive();

function fail(err: unknown): BidResult<never> {
  if (err instanceof AiError) return { ok: false, code: "failed", error: aiErrorMessage(err).message };
  return { ok: false, code: "failed", error: "Something went wrong on our side. Try again, and if it keeps happening, tell us." };
}

async function allFacts(store: BidStore): Promise<Fact[]> {
  const [org, records, facts] = await Promise.all([store.getOrg(), store.firmRecords(), store.listFacts()]);
  return [...facts.filter((f) => f.status === "confirmed"), ...recordFacts({ org, ...records })];
}

/** A plain sector label for win analytics, from the words a solicitation uses. */
export function sectorOf(text: string, federal: boolean): string {
  const t = text.toLowerCase();
  const rules: [RegExp, string][] = [
    [/\b(hospital|clinic|medical|health ?care|veterans affairs|behavioral health)\b/, "Healthcare"],
    [/\b(fire station|police|public safety|emergency services|911)\b/, "Public safety"],
    [/\b(school|classroom|k-12|isd|education)\b/, "K-12 education"],
    [/\b(university|college|campus)\b/, "Higher education"],
    [/\b(courthouse|jail|detention|justice)\b/, "Justice"],
    [/\b(airport|transit|port authority|highway|bridge|transportation)\b/, "Transportation"],
    [/\b(water|wastewater|utility|treatment plant)\b/, "Water and utilities"],
    [/\b(historic|preservation)\b/, "Historic preservation"],
  ];
  return rules.find(([re]) => re.test(t))?.[1] ?? (federal ? "Federal" : "Other");
}

export const RFP_STEPS = ["Reading the solicitation", "Building the compliance matrix", "Scoring go or no-go", "Planning the deadlines"];

export interface AddRfpInput {
  pages: RfpPage[];
  /** Where it came from: a link the firm pasted, an uploaded file, or a SAM.gov notice. */
  sourceUrl: string | null;
  documentId: string | null;
  fileName: string | null;
  source: Opportunity["solicitation"] extends infer S ? (S extends { source: infer X } ? X : never) : never;
  known?: Parameters<typeof readRfp>[1];
  issuer?: string | null;
  /** SAM.gov notice id or other stable id, so adding the same notice twice opens the same bid. */
  externalId?: string | null;
  jobId?: string;
}

export async function addRfp(store: BidStore, input: AddRfpInput): Promise<BidResult<{ applicationId: string; requirementCount: number; score: number; suggestion: GoNoGo["suggestion"] }>> {
  const job = input.jobId;
  if (job) startJob(job, RFP_STEPS);
  try {
    const words = input.pages.reduce((n, p) => n + p.text.split(/\s+/).length, 0);
    if (words < 80) {
      if (job) finishJob(job, "failed");
      return { ok: false, code: "no_text", error: "We could not find enough text in that solicitation to read. If it is a scanned PDF, it needs a text layer first." };
    }
    const { output } = await recordRun(store, { agent: "proposal", title: "Read a solicitation into a compliance matrix", trigger: "user" }, async (rec) => {
      const text = input.pages.map((p) => p.text).join("\n");
      const parsed = await rec.step("read_rules", async () => readRfp(input.pages, input.known ?? {}), (r) => `${r.requirements.length} requirements, ${r.solicitation.dates.length} dates, ${r.solicitation.evaluation.length} evaluation factors, from ${r.pageCount} page${r.pageCount === 1 ? "" : "s"}`);
      if (job) advanceJob(job, `${parsed.pageCount} page${parsed.pageCount === 1 ? "" : "s"}, ${parsed.wordCount.toLocaleString("en-US")} words`);
      for (const d of parsed.solicitation.dates) logJob(job, { kind: "note", text: `${d.label}: ${d.date.replace("T", " at ")}`, detail: d.ref ?? undefined });
      let reqs: ParsedRequirement[] = parsed.requirements;
      let readBy: string = "rules";
      if (modelAvailable()) {
        try {
          const refined = await rec.step("read_rfp", () => refineRequirements({ title: parsed.title, text, requirements: reqs }), (r) => `${r.titles.size} titles tidied, ${r.added.length} requirements added with exact quotes`);
          rec.tally(refined);
          reqs = [...reqs.map((r) => ({ ...r, title: refined.titles.get(r.key) ?? r.title })), ...refined.added];
          readBy = "rules and model";
        } catch (err) {
          // A model problem never loses the rules reading.
          if (!(err instanceof AiError)) throw err;
        }
      }
      for (const r of reqs.slice(0, 40)) logJob(job, { kind: "fact", text: r.title, detail: `${r.ref}: ${r.excerpt.length > 160 ? `${r.excerpt.slice(0, 158)}…` : r.excerpt}` });
      if (job) advanceJob(job, `${reqs.length} requirements, ${reqs.filter((r) => r.mandatory).length} of them mandatory`);

      const issuer = input.issuer ?? input.known?.issuer ?? parsed.issuer ?? "Owner";
      const federal = input.source === "samgov" || /\b(department of|U\.S\.|federal|FAR\b|VA\b|corps of engineers|GSA)\b/.test(`${issuer} ${text.slice(0, 4000)}`);
      const idBase = input.externalId ?? sha1Hex(`${parsed.title}|${parsed.solicitation.number ?? ""}|${issuer}`).slice(0, 12);
      const funder: Funder = { id: `own_${sha1Hex(issuer.toLowerCase()).slice(0, 10)}`, name: issuer, ein: null, type: federal ? "federal" : /\b(school|university|college|district)\b/i.test(issuer) ? "university" : /\b(city|county|town|village|authority|state)\b/i.test(issuer) ? "local_government" : "private_owner", description: federal ? "Federal agency" : "Project owner", focusAreas: [], geography: parsed.solicitation.placeOfPerformance ?? "", givingMin: null, givingMax: null, websiteUrl: input.sourceUrl ?? "", sourceUrl: input.sourceUrl ?? "", aiPolicy: null, lastVerifiedAt: new Date().toISOString(), recentGrantees: [] };
      const summary = text.replace(/\s+/g, " ").match(/(?:purpose of this (?:announcement|solicitation|request)[^.]*\.|seeks?[^.]{20,}\.|requests? (?:proposals|qualifications)[^.]{10,}\.)/i)?.[0] ?? text.replace(/\s+/g, " ").slice(0, 280);
      const opportunity: Opportunity = {
        id: `bid_${idBase}`,
        kind: "contract",
        funderId: funder.id,
        title: parsed.title,
        summary: summary.length > 400 ? `${summary.slice(0, 398)}…` : summary,
        deadline: parsed.dueDate ? parsed.dueDate.slice(0, 10) : null,
        deadlineType: "fixed",
        amountMin: parsed.solicitation.estimatedValue?.min ?? null,
        amountMax: parsed.solicitation.estimatedValue?.max ?? null,
        eligibility: [...(parsed.solicitation.setAside ? [{ label: parsed.solicitation.setAside, required: true }] : []), ...parsed.solicitation.requiredCredentials.slice(0, 3).map((c) => ({ label: c.length > 160 ? `${c.slice(0, 158)}…` : c, required: true }))],
        guidelinesUrl: input.sourceUrl ?? "",
        sourceUrl: input.sourceUrl ?? "",
        lastVerifiedAt: new Date().toISOString(),
        effort: "high",
        forecasted: false,
        sourceNote: input.fileName ? `Read from ${input.fileName}` : input.source === "samgov" ? "SAM.gov notice" : undefined,
        solicitation: { ...parsed.solicitation, source: input.source, documentId: input.documentId },
        sector: sectorOf(`${parsed.title}\n${text.slice(0, 6000)}`, federal),
      };
      const mode = parsed.solicitation.type === "SF330" ? "sf330" : "bid";
      const created = await store.createBid({ funder, opportunity, mode, noticeText: text });
      const appId = created.application.id;
      await store.saveRfpPages(created.opportunity.id, input.pages);
      await store.replaceRequirements(
        appId,
        reqs.map((r, i) => ({ title: r.title, kind: r.kind, detail: r.excerpt, wordLimit: null, required: r.mandatory, order: i + 1, satisfied: false, ref: r.ref, excerpt: r.excerpt, sectionKey: r.sectionKey, answeredInSectionId: null, matrixStatus: "open" })),
      );
      if (job) advanceJob(job, "Matrix built");
      rec.source(parsed.title, input.sourceUrl, input.source === "samgov" ? "database" : input.documentId ? "document" : "web");

      const g = await scoreAndSave(store, appId);
      logJob(job, { kind: "note", text: `Go/no-go: ${g.score}, ${g.suggestion === "go" ? "worth pursuing" : g.suggestion === "review" ? "a judgment call" : "not worth pursuing"}`, detail: g.stoppers[0] ?? g.factors[0]?.detail });
      if (job) advanceJob(job, `Score ${g.score}`);

      const deadline = created.opportunity.deadline;
      if (deadline) {
        const planned = planMilestones(deadline, { mode, bidDates: created.opportunity.solicitation?.dates ?? [] });
        await store.replaceMilestones(appId, planned);
        if (job) advanceJob(job, `${planned.length} dates on the calendar`);
      } else if (job) advanceJob(job, "No due date found; add one on the bid");
      await store.saveBidMeta({ ...(await store.getBidMeta(appId))!, readBy });
      await store.addInboxItem({ agent: "proposal", type: "go_no_go", title: `Go or no-go: ${parsed.title}`, summary: `Scored ${g.score} (${g.suggestion === "go" ? "go" : g.suggestion === "review" ? "review" : "no-go"}). ${g.stoppers[0] ?? g.factors.find((f) => f.score < 0.5)?.detail ?? g.factors[0]?.detail ?? ""}`.trim(), payload: { type: "proposal_draft", applicationId: appId, sectionCount: 0, openQuestions: 0 }, priority: "high", sourceCount: 1, agentRunId: null });
      return { output: { applicationId: appId, requirementCount: reqs.length, score: g.score, suggestion: g.suggestion }, summary: `Read ${parsed.pageCount} page${parsed.pageCount === 1 ? "" : "s"} into ${reqs.length} requirements (${readBy}). Go/no-go scored ${g.score}.` };
    });
    if (job) finishJob(job, "done");
    return { ok: true, data: output };
  } catch (err) {
    if (job) finishJob(job, "failed");
    return fail(err);
  }
}

/** Score go/no-go from the records as they are now and save it, with the projects and people it picked. */
export async function scoreAndSave(store: BidStore, applicationId: string): Promise<GoNoGo> {
  const ctx = await store.getApplication(applicationId);
  if (!ctx) throw new Error("application not found");
  const [org, records, pages, active, meta] = await Promise.all([store.getOrg(), store.firmRecords(), store.rfpPages(ctx.opportunity.id), store.activeBidCount(applicationId), store.getBidMeta(applicationId)]);
  const sol = ctx.opportunity.solicitation;
  const text = (pages ?? []).map((p) => p.text).join("\n") || (await store.noticeTextFor(ctx.opportunity.id)) || ctx.opportunity.summary;
  const r = scoreGoNoGo({ title: ctx.opportunity.title, text, solicitation: sol ?? emptySolicitation(), dueDate: ctx.opportunity.deadline, firmState: org.state || null, profile: records.profile, projects: records.projects, personnel: records.personnel, certifications: records.certifications, activeBids: active });
  const saved = await store.saveGoNoGo({ applicationId, score: r.score, suggestion: r.suggestion, factors: r.factors, stoppers: r.stoppers, decision: null, decidedBy: null, decidedAt: null, note: null });
  await store.saveBidMeta({ applicationId, projectIds: meta?.projectIds.length ? meta.projectIds : r.projectIds, assignments: meta?.assignments.length ? meta.assignments : r.assignments, sectionKeys: meta?.sectionKeys ?? {}, teamFirms: meta?.teamFirms ?? [], additionalInformation: meta?.additionalInformation ?? "", readBy: meta?.readBy ?? "rules" });
  return saved;
}

export function emptySolicitation(): NonNullable<Opportunity["solicitation"]> {
  return { type: "RFP", number: null, naics: [], setAside: null, placeOfPerformance: null, estimatedValue: null, dates: [], source: "upload", documentId: null, bonding: null, requiredCredentials: [], forms: [], pageLimits: [], evaluation: [], competitionSignals: [], contact: null };
}

export async function decide(store: BidStore, applicationId: string, decision: "go" | "no_go", note: string | null): Promise<GoNoGo | null> {
  const g = await store.latestGoNoGo(applicationId);
  if (!g) return null;
  const user = await store.currentUser();
  const saved = await store.updateGoNoGo(g.id, { decision, note, decidedBy: user.fullName || user.email, decidedAt: new Date().toISOString() });
  await store.updateApplication(applicationId, { stage: decision === "go" ? "drafting" : "lost" });
  return saved;
}

// ---------- Drafting ----------

export const BID_STEPS = ["Choosing projects and people from your records", "Writing the sections", "Checking every citation and number", "Updating the compliance matrix"];

const MODEL_KEYS = ["cover_letter", "qualifications", "approach"] as const;

export async function draftBid(store: BidStore, applicationId: string, jobId?: string): Promise<BidResult<{ sectionCount: number; openQuestions: number; issues: number; wordCount: number; met: number; total: number }>> {
  if (jobId) startJob(jobId, BID_STEPS);
  try {
    const ctx = await store.getApplication(applicationId);
    if (!ctx) {
      if (jobId) finishJob(jobId, "failed");
      return { ok: false, code: "not_found", error: "We could not find that bid." };
    }
    const { output } = await recordRun(store, { agent: "proposal", title: `Draft the proposal for ${ctx.opportunity.title}`, trigger: "user" }, async (rec) => {
      const [org, records, user, reqs, addenda, pages] = await Promise.all([store.getOrg(), store.firmRecords(), store.currentUser(), store.listRequirements(applicationId), store.listAddenda(applicationId), store.rfpPages(ctx.opportunity.id)]);
      let meta = await store.getBidMeta(applicationId);
      if (!meta) {
        await scoreAndSave(store, applicationId);
        meta = (await store.getBidMeta(applicationId))!;
      }
      const facts = await allFacts(store);
      const sol = ctx.opportunity.solicitation ?? emptySolicitation();
      const text = (pages ?? []).map((p) => p.text).join("\n") || (await store.noticeTextFor(ctx.opportunity.id)) || "";
      const picks = meta.projectIds.map((id) => records.projects.find((p) => p.id === id)).filter((p): p is NonNullable<typeof p> => Boolean(p));
      for (const p of picks) logJob(jobId, { kind: "fact", text: `Project: ${p.name}`, detail: `${p.client}, ${[p.city, p.state].filter(Boolean).join(", ")}` });
      for (const a of meta.assignments) logJob(jobId, { kind: "fact", text: `${a.role}`, detail: a.why });
      if (jobId) advanceJob(jobId, `${picks.length} projects, ${meta.assignments.filter((a) => a.personnelId).length} people`);

      const parsedReqs: ParsedRequirement[] = reqs.map((r) => ({ key: r.id, title: r.title, kind: r.kind, ref: r.ref ?? "", excerpt: r.excerpt ?? r.detail ?? r.title, mandatory: r.required, sectionKey: (r.sectionKey ?? "approach") as SectionKey }));
      const addendaNames = addenda.map((a) => `Addendum ${a.number}`);
      const code: Record<string, CodeSection> = {
        projects: projectsSection(picks),
        personnel: personnelSection(meta.assignments, records.personnel, records.projects),
        schedule: scheduleSection(sol.dates, ctx.opportunity.deadline),
        quality_safety: qualitySafetySection(records.boilerplates, facts.some((f) => f.id === "rec_safety")),
        references: referencesSection(picks),
      };
      let written: Record<string, CodeSection> = {};
      let modelGaps: DraftGap[] = [];
      let writtenBy = "records";
      if (modelAvailable()) {
        const defs = KINDS.contract.sections.filter((s) => (MODEL_KEYS as readonly string[]).includes(s.key));
        try {
          const d = await rec.step(
            "draft_bid",
            () =>
              draftBidSections({
                org,
                facts,
                signer: user.fullName || user.email,
                title: ctx.opportunity.title,
                issuer: ctx.funder.name,
                solicitationSummary: [sol.number ? `Number: ${sol.number}` : "", sol.type ? `Type: ${sol.type}` : "", sol.setAside ? `Set-aside: ${sol.setAside}` : "", sol.placeOfPerformance ? `Place of performance: ${sol.placeOfPerformance}` : "", `Summary: ${ctx.opportunity.summary}`].filter(Boolean).join("\n"),
                sections: defs.map((s) => ({ key: s.key, title: s.title, prompt: s.prompt, wordLimit: s.wordLimit, requirements: parsedReqs.filter((r) => r.sectionKey === s.key).map((r) => `${r.excerpt} (${r.ref})`) })),
                evaluation: sol.evaluation.map((e) => `${e.factor}${e.weight ? ` (${e.weight})` : ""}`),
                addenda: addendaNames,
              }),
            (r) => `${r.sections.filter((s) => s.text).length} sections written, ${r.gaps.length} questions raised`,
          );
          rec.tally(d);
          for (const s of d.sections) if (s.text) written[s.key] = { key: s.key, text: s.text, gaps: [] };
          modelGaps = d.gaps;
          writtenBy = "records and model";
        } catch (err) {
          if (!(err instanceof AiError)) throw err;
          written = {};
        }
      }
      const fallback: Record<string, CodeSection> = {
        cover_letter: coverLetterFallback({ org, title: ctx.opportunity.title, number: sol.number, issuer: ctx.funder.name, contactName: sol.contact?.name ?? null, signer: user.fullName || user.email, projects: picks, hasStaffFact: facts.some((f) => f.id === "rec_staff"), addenda: addendaNames }),
        qualifications: qualificationsFallback({ org, history: records.boilerplates.find((b) => b.type === "history") ?? null, hasStaffFact: facts.some((f) => f.id === "rec_staff"), hasNaics: facts.some((f) => f.id === "rec_naics"), credentialFactIds: facts.filter((f) => f.category === "credentials" && f.id.startsWith("rec_") && !/safety|ins_/.test(f.id)).map((f) => f.id).slice(0, 6) }),
        approach: approachOutline(parsedReqs),
      };
      const order = KINDS.contract.sections.map((s) => s.key);
      const parts = order.map((key) => written[key] ?? code[key] ?? fallback[key]).filter(Boolean);
      if (jobId) advanceJob(jobId, `${parts.length} sections, written by ${writtenBy}`);

      const declared: LetterGap[] = [...parts.flatMap((p) => p.gaps), ...modelGaps].map((g) => ({ key: g.key, paragraphKey: "plan", question: g.question, whyItMatters: g.whyItMatters, suggestedLabel: g.suggestedLabel }));
      const gapIds = new Map<string, string>();
      const fmt = (iso: string) => new Date(`${iso.slice(0, 10)}T12:00:00Z`).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });
      const validationText = [text, ctx.opportunity.deadline ? `Due ${fmt(ctx.opportunity.deadline)}` : "", ...sol.dates.map((x) => `${x.label} ${fmt(x.date)} ${x.date.slice(11, 16)}`), ...addenda.map((a) => `Addendum ${a.number} ${a.summary}`)].join("\n");
      // Acknowledge every addendum the firm has added, in the firm's own cover letter.
      const cover = parts.find((p) => p.key === "cover_letter");
      if (cover && addendaNames.length && !/acknowledge/i.test(cover.text)) cover.text = `${cover.text}\n\nWe acknowledge receipt of ${addendaNames.join(", ")}.`;
      const opts: RenderOptions = { facts, noticeText: validationText, factLabel, gapId: (key) => gapIds.get(key) ?? (gapIds.set(key, store.newId("gap")), gapIds.get(key)!) };
      const defs = new Map(KINDS.contract.sections.map((s) => [s.key, s]));
      const sectionIds = parts.map(() => store.newId("sec"));
      const rendered = parts.map((p, i) => ({ key: p.key, id: sectionIds[i], def: defs.get(p.key)!, out: renderSectionText(p.text, defs.get(p.key)?.title ?? p.key, declared, opts) }));
      const issues = rendered.reduce((n, r) => n + r.out.issues.length, 0);
      const wordsTotal = rendered.reduce((n, r) => n + r.out.words, 0);
      for (const r of rendered) logJob(jobId, { kind: "section", text: r.def.title, detail: `${r.out.words} words, ${r.out.citedFactIds.length} citation${r.out.citedFactIds.length === 1 ? "" : "s"}${r.out.gaps.length ? `, ${r.out.gaps.length} question${r.out.gaps.length === 1 ? "" : "s"}` : ""}` });
      const missing = rendered.flatMap((r) => r.out.gaps.map((g) => ({ id: g.id, sectionId: r.id, question: g.question, whyItMatters: g.whyItMatters, suggestedLabel: g.suggestedLabel, status: "open" as const, answer: null, gapKey: g.key })));
      const unverified = rendered.reduce((n, r) => n + r.out.issues.filter((x) => x.kind === "unknown_fact").length, 0);
      const unsupported = rendered.reduce((n, r) => n + r.out.issues.filter((x) => x.kind === "unsupported_number").length, 0);
      rec.tool("validate_sections", `${issues ? `${issues} problem${issues === 1 ? "" : "s"} turned into questions` : "Every citation and number checked out"}; ${wordsTotal} words`, 0);
      if (jobId) advanceJob(jobId, issues ? `${issues} turned into questions` : "Every citation checked");
      await store.replaceDraft(applicationId, {
        sections: rendered.map((r, i) => ({ id: r.id, title: r.def.title, bodyHtml: r.out.html, wordLimit: r.def.wordLimit, status: r.out.gaps.length ? "needs_facts" : "drafted", order: i + 1 })),
        missingFacts: missing,
        checks: bidChecks({ unverified, unsupported, open: missing.length, pageLimits: sol.pageLimits, rendered: rendered.map((r) => ({ title: r.def.title, words: r.out.words, limit: r.def.wordLimit })) }).map((c) => ({ ...c, sectionId: null })),
      });
      await store.saveBidMeta({ ...meta, sectionKeys: Object.fromEntries(rendered.map((r) => [r.id, r.key])) });
      const matrix = await refreshMatrix(store, applicationId);
      if (jobId) advanceJob(jobId, `${matrix.met} of ${matrix.total} requirements met`);
      await store.updateApplication(applicationId, { stage: ctx.application.stage === "discovered" || ctx.application.stage === "go_no_go" ? "drafting" : ctx.application.stage });
      // The fee proposal structure comes with the first draft; the numbers stay with the firm.
      if (!(await store.getFee(applicationId))) await store.saveFee(feeStructure({ solicitation: sol, text, profile: records.profile, applicationId }));
      await store.addInboxItem({ agent: "proposal", type: "proposal_draft", title: `Proposal drafted: ${ctx.opportunity.title}`, summary: `${wordsTotal} words in ${rendered.length} sections, every claim cited to your records. ${matrix.met} of ${matrix.total} requirements met.${missing.length ? ` ${missing.length} question${missing.length === 1 ? "" : "s"} for you.` : ""}`, payload: { type: "proposal_draft", applicationId, sectionCount: rendered.length, openQuestions: missing.length }, priority: "high", sourceCount: rec.sources.length, agentRunId: null });
      return { output: { sectionCount: rendered.length, openQuestions: missing.length, issues, wordCount: wordsTotal, met: matrix.met, total: matrix.total }, summary: `Drafted ${rendered.length} sections (${wordsTotal} words) from your records${writtenBy === "records and model" ? " and the model" : ""}. ${matrix.met} of ${matrix.total} requirements met.` };
    });
    if (jobId) finishJob(jobId, "done");
    return { ok: true, data: output };
  } catch (err) {
    if (jobId) finishJob(jobId, "failed");
    return fail(err);
  }
}

function bidChecks(i: { unverified: number; unsupported: number; open: number; pageLimits: string[]; rendered: { title: string; words: number; limit: number | null }[] }) {
  return [
    { rule: "Every claim about the firm cites a record", status: i.unverified ? ("fail" as const) : ("pass" as const), detail: i.unverified ? `${i.unverified} claim${i.unverified === 1 ? "" : "s"} marked as a gap.` : "Every citation points to a project, person, credential, or fact you confirmed." },
    { rule: "Every number appears in a record or the solicitation", status: i.unsupported ? ("fail" as const) : ("pass" as const), detail: i.unsupported ? `${i.unsupported} number${i.unsupported === 1 ? "" : "s"} replaced with a gap.` : "Every number traces to a source." },
    { rule: "No price, fee, or rate written for you", status: "pass" as const, detail: "Pricing is on the Fee tab, with numbers you enter." },
    ...i.rendered.filter((r) => r.limit).map((r) => ({ rule: `${r.title} within ${r.limit} words`, status: r.words > (r.limit ?? 0) ? ("warn" as const) : ("pass" as const), detail: `Currently ${r.words} words.` })),
    ...(i.pageLimits.length ? [{ rule: "Page limit", status: "warn" as const, detail: `Check the final package against: ${i.pageLimits[0]}` }] : []),
    { rule: "No open questions", status: i.open ? ("warn" as const) : ("pass" as const), detail: i.open ? `${i.open} question${i.open === 1 ? "" : "s"} waiting on you.` : "Nothing is waiting on you." },
  ];
}

/** Recompute every matrix row from the current draft, documents, and fee. Call after any edit. */
export async function refreshMatrix(store: BidStore, applicationId: string): Promise<{ met: number; total: number; requirements: Requirement[] }> {
  const ctx = await store.getApplication(applicationId);
  const [reqs, sections, documents, fee, meta, gng, records, addenda] = await Promise.all([store.listRequirements(applicationId), store.listSections(applicationId), store.listDocuments(), store.getFee(applicationId), store.getBidMeta(applicationId), store.latestGoNoGo(applicationId), store.firmRecords(), store.listAddenda(applicationId)]);
  const keyOf = (s: Section) => meta?.sectionKeys[s.id] ?? null;
  const sol = ctx?.opportunity.solicitation ?? null;
  const eligibilityMet = gng ? !gng.stoppers.some((s) => /set aside|license/i.test(s)) && (gng.factors.find((f) => f.key === "credentials")?.score ?? 1) >= 0.5 : null;
  void sol;
  void records;
  let updated = recomputeMatrix({ requirements: reqs, sections, documents, fee, eligibilityMet, sectionKeyOf: keyOf });
  // An addendum acknowledgement is met when the cover letter names it.
  const all = sections.map((s) => s.bodyHtml).join(" ");
  updated = updated.map((r) => {
    const m = r.title.match(/^Acknowledge (?:addendum|amendment) (\S+)/i);
    if (!m) return r;
    const named = new RegExp(`(addendum|amendment)\\s*(no\\.?\\s*)?${m[1].replace(/[^\w]/g, "")}\\b|\\b${m[1].replace(/[^\w]/g, "")}\\b`, "i").test(all.replace(/<[^>]+>/g, " "));
    const ack = addenda.find((a) => a.number === m[1])?.acknowledged ?? false;
    return { ...r, matrixStatus: named || ack ? "met" : "open", satisfied: named || ack };
  });
  const saved = await store.replaceRequirements(applicationId, updated.map((r) => ({ title: r.title, kind: r.kind, detail: r.detail, wordLimit: r.wordLimit, required: r.required, order: r.order, satisfied: r.satisfied, ref: r.ref ?? null, excerpt: r.excerpt ?? null, sectionKey: r.sectionKey ?? null, answeredInSectionId: r.answeredInSectionId ?? null, matrixStatus: r.matrixStatus ?? "open" })));
  const met = saved.filter((r) => r.matrixStatus === "met" || r.matrixStatus === "not_applicable").length;
  return { met, total: saved.length, requirements: saved };
}

// ---------- Addenda ----------

export async function addAddendum(store: BidStore, applicationId: string, text: string, documentId: string | null): Promise<BidResult<Addendum>> {
  try {
    const ctx = await store.getApplication(applicationId);
    if (!ctx) return { ok: false, code: "not_found", error: "We could not find that bid." };
    if (text.trim().split(/\s+/).length < 8) return { ok: false, code: "no_text", error: "Paste the addendum's text, or upload it, so we can see what it changed." };
    const sol = ctx.opportunity.solicitation ?? emptySolicitation();
    const read = readAddendum(text, { dueDate: ctx.opportunity.deadline, dates: sol.dates });
    const saved = await store.addAddendum({ applicationId, number: read.number, issuedOn: read.issuedOn, summary: read.summary, changes: read.changes, acknowledged: false, documentId });
    // Dates the addendum sets replace the old ones of the same kind; a new due date moves the deadline.
    if (read.dates.length) {
      const dates = [...sol.dates.filter((d) => !read.dates.some((n) => n.kind === d.kind)), ...read.dates].sort((a, b) => a.date.localeCompare(b.date));
      const due = read.dates.find((d) => d.kind === "submission");
      const solicitation = { ...sol, dates };
      await store.updateOpportunity(ctx.opportunity.id, { solicitation, ...(due ? { deadline: due.date.slice(0, 10) } : {}) });
      const deadline = due?.date.slice(0, 10) ?? ctx.opportunity.deadline;
      if (deadline) await store.replaceMilestones(applicationId, planMilestones(deadline, { mode: ctx.application.mode, bidDates: dates }));
    }
    const reqs = await store.listRequirements(applicationId);
    await store.replaceRequirements(applicationId, [
      ...reqs.map((r) => ({ title: r.title, kind: r.kind, detail: r.detail, wordLimit: r.wordLimit, required: r.required, order: r.order, satisfied: r.satisfied, ref: r.ref ?? null, excerpt: r.excerpt ?? null, sectionKey: r.sectionKey ?? null, answeredInSectionId: r.answeredInSectionId ?? null, matrixStatus: r.matrixStatus ?? "open" })),
      { title: `Acknowledge addendum ${read.number}`, kind: "form", detail: read.summary, wordLimit: null, required: true, order: reqs.length + 1, satisfied: false, ref: `Addendum ${read.number}`, excerpt: "Acknowledge receipt of each addendum in the cover letter or on the form the owner provides.", sectionKey: "cover_letter", answeredInSectionId: null, matrixStatus: "open" },
    ]);
    await refreshMatrix(store, applicationId);
    await store.addInboxItem({ agent: "calendar", type: "addendum", title: `Addendum ${read.number} to ${ctx.opportunity.title}`, summary: read.summary, payload: { type: "proposal_draft", applicationId, sectionCount: 0, openQuestions: 0 }, priority: read.dates.some((d) => d.kind === "submission") ? "high" : "normal", sourceCount: 1, agentRunId: null });
    return { ok: true, data: saved };
  } catch (err) {
    return fail(err);
  }
}

export { SECTION_TITLES, stateOf };
