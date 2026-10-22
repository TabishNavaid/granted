import { AiError, aiErrorMessage } from "@/lib/ai";
import { UsageLimitError } from "@/lib/usage/limits";
import { cached, HOURS } from "@/lib/cache";
import { fetchPageText } from "@/lib/crawl";
import { factLabel } from "@/lib/crawl/label";
import type { Budget, EmailDraft, EmailKind, ReviewerCheck, SocialCampaign } from "@/lib/types";
import { writeJustification } from "./budget";
import { extractFromDocument } from "./documents";
import { factIdsIn, gapIdsIn, type RenderOptions } from "./letter";
import { PARAGRAPH_KEYS } from "./letter";
import { draftEmail } from "./outreach";
import { draftProposalSections, parseGuidelines, renderSectionText } from "./proposal";
import { advanceJob, finishJob, startJob } from "./progress";
import { reviewDraft } from "./reviewer";
import { reviseHtml, type ReviseAction, type ReviseTone } from "./revise";
import { recordRun } from "./runs";
import { runCustomSearch, scoreChosen } from "./search";
import { generateCampaign } from "./social";
import type { LoopStore, NewFact } from "./store";
import type { LoopResult } from "./index";
import { wordCount } from "@/lib/format";

/** Feature orchestration over a LoopStore, used by both the mock and the Supabase services. */

function fail(err: unknown): LoopResult<never> {
  if (err instanceof UsageLimitError) return { ok: false, code: "usage_limit", error: err.message };
  if (err instanceof AiError) {
    const m = aiErrorMessage(err);
    return { ok: false, code: m.code, error: m.message };
  }
  return { ok: false, code: "failed", error: err instanceof Error && /Grants\.gov/i.test(err.message) ? "We could not reach Grants.gov just now. Try again in a few minutes." : "Something went wrong on our side. Try again, and if it keeps happening, tell us." };
}


async function guidelinesText(url: string, noticeText: string): Promise<string> {
  if (!url || /grants\.gov\/search-results-detail/.test(url)) return "";
  const { value } = await cached<{ text: string }>(`guidelines:${url}`, 24 * HOURS, async () => {
    const page = await fetchPageText(url, 30_000).catch(() => null);
    return { text: page?.text ?? "" };
  });
  return value.text || noticeText;
}

async function appContext(store: LoopStore, applicationId: string) {
  const ctx = await store.getApplication(applicationId);
  if (!ctx) return null;
  const [org, facts, user] = await Promise.all([store.getOrg(), store.listFacts(), store.currentUser()]);
  const confirmed = facts.filter((f) => f.status === "confirmed");
  const noticeText = (await store.noticeTextFor(ctx.opportunity.id)) ?? [`Title: ${ctx.opportunity.title}`, `Agency: ${ctx.funder.name}`, ctx.opportunity.deadline ? `Application due date: ${ctx.opportunity.deadline}` : "", `Description: ${ctx.opportunity.summary}`].filter(Boolean).join("\n");
  return { ...ctx, org, facts: confirmed, user, noticeText };
}

// ---------- Full proposal ----------

export const PROPOSAL_STEPS = ["Reading the funder's guidelines", "Building the requirements checklist", "Drafting every section from your facts", "Checking every citation and number"];

export async function draftProposalFor(store: LoopStore, applicationId: string, jobId?: string): Promise<LoopResult<{ sectionCount: number; requirementCount: number; openQuestions: number; issues: number; wordCount: number; runId: string }>> {
  if (jobId) startJob(jobId, PROPOSAL_STEPS);
  try {
    const c = await appContext(store, applicationId);
    if (!c) return { ok: false, code: "not_found", error: "We could not find that application." };
    if (!c.facts.length) return { ok: false, code: "no_facts", error: "Confirm a few facts about your organization first. The proposal can only say what you have confirmed." };
    const { output, run } = await recordRun(store, { agent: "proposal", title: `Draft a full proposal for ${c.opportunity.title}`, trigger: "user", usage: "draft" }, async (rec) => {
      const guidelines = await rec.step("fetch_guidelines", () => guidelinesText(c.opportunity.guidelinesUrl, c.noticeText), (t) => (t ? `${t.length.toLocaleString("en-US")} characters read` : "No separate guidelines page; using the notice"));
      if (guidelines && c.opportunity.guidelinesUrl) rec.source("Funder guidelines", c.opportunity.guidelinesUrl, "web");
      if (jobId) advanceJob(jobId, guidelines ? "Guidelines read" : "Using the notice");
      const parsed = await rec.step("parse_requirements", () => parseGuidelines({ guidelinesText: guidelines, noticeText: c.noticeText }), (r) => `${r.requirements.length} requirements: ${r.requirements.filter((x) => x.kind === "section").length} sections`);
      rec.tally(parsed);
      let reqs = parsed.requirements;
      if (!reqs.some((r) => r.kind === "section")) {
        reqs = [
          { title: "Organization background", kind: "section", detail: null, wordLimit: 400, required: true, prompt: "Who the organization is, when it started, whom it serves, and its track record." },
          { title: "Statement of need", kind: "section", detail: null, wordLimit: 500, required: true, prompt: "The problem in the community and the evidence for it." },
          { title: "Project description", kind: "section", detail: null, wordLimit: 750, required: true, prompt: "What the funds will do, for whom, and how." },
          { title: "Goals and outcomes", kind: "section", detail: null, wordLimit: 400, required: true, prompt: "Measurable goals for the grant period." },
          { title: "Evaluation", kind: "section", detail: null, wordLimit: 300, required: true, prompt: "How results will be tracked and reported." },
          { title: "Budget narrative", kind: "section", detail: null, wordLimit: 300, required: true, prompt: "What the request pays for and why." },
          { title: "Sustainability", kind: "section", detail: null, wordLimit: 200, required: true, prompt: "How the work continues after the grant." },
          ...reqs,
        ];
      }
      if (jobId) advanceJob(jobId, `${reqs.length} requirements`);
      const sectionReqs = reqs.filter((r) => r.kind === "section");
      const boilerplate = (await store.listBoilerplates()).map((b) => ({ title: b.title, body: b.body }));
      const drafted = await rec.step("draft_sections", () => draftProposalSections({ org: c.org, facts: c.facts, userName: c.user.fullName || c.user.email, funderName: c.funder.name, opportunityTitle: c.opportunity.title, noticeText: c.noticeText, guidelinesText: guidelines, sections: sectionReqs.map((r, i) => ({ key: `s${i + 1}`, title: r.title, prompt: r.prompt || r.detail || r.title, wordLimit: r.wordLimit })), boilerplate, askAmount: c.application.askAmount }), (r) => `${r.sections.filter((s) => s.text).length} sections drafted, ${r.gaps.length} questions raised`);
      rec.tally(drafted);
      rec.source(c.opportunity.title, c.opportunity.sourceUrl, "web");
      for (const f of c.facts) if (f.sourceUrl) rec.source(factLabel(f), f.sourceUrl, "web");
      if (jobId) advanceJob(jobId, `${drafted.sections.length} sections`);
      const t = Date.now();
      const gapIds = new Map<string, string>();
      const opts: RenderOptions = { facts: c.facts, noticeText: `${c.noticeText}\n${guidelines}\n${c.application.askAmount ?? ""}`, factLabel, gapId: (key) => gapIds.get(key) ?? (gapIds.set(key, store.newId("gap")), gapIds.get(key)!) };
      const sectionIds = sectionReqs.map(() => store.newId("sec"));
      const rendered = sectionReqs.map((r, i) => ({ req: r, id: sectionIds[i], out: renderSectionText(drafted.sections[i]?.text ?? "", r.title, drafted.gaps, opts) }));
      const issues = rendered.reduce((n, r) => n + r.out.issues.length, 0);
      const words = rendered.reduce((n, r) => n + r.out.words, 0);
      const missing = rendered.flatMap((r) => r.out.gaps.map((g) => ({ id: g.id, sectionId: r.id, question: g.question, whyItMatters: g.whyItMatters, suggestedLabel: g.suggestedLabel, status: "open" as const, answer: null, gapKey: g.key })));
      const unverified = rendered.reduce((n, r) => n + r.out.issues.filter((x) => x.kind === "unknown_fact").length, 0);
      const unsupported = rendered.reduce((n, r) => n + r.out.issues.filter((x) => x.kind === "unsupported_number").length, 0);
      rec.tool("validate_sections", `${issues ? `${issues} problem${issues === 1 ? "" : "s"} turned into questions` : "Every citation and number checked out"}; ${words} words`, Date.now() - t);
      const checks = [
        { rule: "Every claim about you cites a confirmed fact", status: unverified ? ("fail" as const) : ("pass" as const), detail: unverified ? `${unverified} claim${unverified === 1 ? "" : "s"} marked as a gap.` : "Every citation points to a fact you confirmed.", sectionId: null },
        { rule: "Every number appears in a cited fact or the notice", status: unsupported ? ("fail" as const) : ("pass" as const), detail: unsupported ? `${unsupported} number${unsupported === 1 ? "" : "s"} replaced with a gap.` : "Every number traces to a source.", sectionId: null },
        ...rendered.filter((r) => r.req.wordLimit).map((r) => ({ rule: `${r.req.title} within ${r.req.wordLimit} words`, status: r.out.words > (r.req.wordLimit ?? 0) ? ("fail" as const) : ("pass" as const), detail: `Currently ${r.out.words} words.`, sectionId: r.id })),
        ...rendered.map((r) => ({ rule: `${r.req.title} present`, status: r.out.words > 0 ? ("pass" as const) : ("fail" as const), detail: r.out.words > 0 ? `Currently ${r.out.words} words.` : "Section is empty. Required by guidelines.", sectionId: r.id })),
        ...reqs.filter((r) => r.kind === "attachment").map((r) => ({ rule: `${r.title} attached`, status: "warn" as const, detail: "Not uploaded yet. Required attachment.", sectionId: null })),
        { rule: "No open questions", status: missing.length ? ("warn" as const) : ("pass" as const), detail: missing.length ? `${missing.length} question${missing.length === 1 ? "" : "s"} waiting on you.` : "Nothing is waiting on you.", sectionId: null },
      ];
      await store.replaceLetter(applicationId, {
        requirements: reqs.map((r, i) => ({ title: r.title, kind: r.kind, detail: r.detail, wordLimit: r.wordLimit, required: r.required, order: i + 1, satisfied: r.kind === "section" ? (rendered.find((x) => x.req === r)?.out.words ?? 0) > 0 : false })),
        sections: rendered.map((r, i) => ({ id: r.id, title: r.req.title, bodyHtml: r.out.html, wordLimit: r.req.wordLimit, status: r.out.gaps.length ? "needs_facts" : "drafted", order: i + 1 })),
        missingFacts: missing,
        checks,
      });
      await store.updateApplication(applicationId, { stage: "drafting", mode: "proposal" });
      if (jobId) advanceJob(jobId, issues ? `${issues} questions raised` : "All clear");
      return { output: { sectionCount: rendered.length, requirementCount: reqs.length, openQuestions: missing.length, issues, wordCount: words }, summary: `Drafted ${rendered.length} sections (${words} words) against ${reqs.length} requirements from ${c.facts.length} confirmed facts.${missing.length ? ` ${missing.length} question${missing.length === 1 ? "" : "s"} for you.` : ""}` };
    });
    if (jobId) finishJob(jobId, "done");
    return { ok: true, data: { ...output, runId: run.id } };
  } catch (err) {
    if (jobId) finishJob(jobId, "failed");
    return fail(err);
  }
}

// ---------- Inline revise ----------

export async function reviseSection(store: LoopStore, input: { sectionId: string; html: string; action: ReviseAction; tone?: ReviseTone; wordLimit?: number | null }): Promise<LoopResult<{ html: string; note: string }>> {
  try {
    const user = await store.currentUser();
    const { output } = await recordRun(store, { agent: "proposal", title: `${input.action === "tone" ? `Change the tone to ${input.tone ?? "plain"}` : input.action === "shorten" ? "Shorten a section" : input.action === "expand" ? "Expand a section" : "Rewrite a section"}`, trigger: "user" }, async (rec) => {
      await store.saveVersion(input.sectionId, input.html, `Before ${input.action}`, user.fullName || user.email);
      const r = await rec.step(`revise_${input.action}`, () => reviseHtml(input), (x) => x.note);
      rec.tally(r);
      return { output: { html: r.html, note: r.note }, summary: r.note };
    });
    return { ok: true, data: output };
  } catch (err) {
    return fail(err);
  }
}

// ---------- Reviewer check ----------

export async function runReviewer(store: LoopStore, applicationId: string): Promise<LoopResult<ReviewerCheck>> {
  try {
    const c = await appContext(store, applicationId);
    if (!c) return { ok: false, code: "not_found", error: "We could not find that application." };
    const sections = await store.listSections(applicationId);
    const missing = await store.listMissingFacts(applicationId);
    const text = (html: string) =>
      html
        .replace(/<span data-citation[^>]*><\/span>/g, "")
        .replace(/<span data-gap="([^"]+)"[^>]*><\/span>/g, (_m, id) => `[NEED: ${missing.find((q) => q.id === id)?.suggestedLabel ?? "fact"}]`)
        .replace(/<\/(p|li|h3)>/g, "\n")
        .replace(/<[^>]+>/g, "")
        .replace(/&amp;/g, "&")
        .trim();
    if (!sections.some((s) => text(s.bodyHtml))) return { ok: false, code: "failed", error: "There is nothing to review yet. Write the first draft, then run the check." };
    const { output } = await recordRun(store, { agent: "proposal", title: `Reviewer check for ${c.opportunity.title}`, trigger: "user" }, async (rec) => {
      const guidelines = await guidelinesText(c.opportunity.guidelinesUrl, "");
      const r = await rec.step("reviewer_check", () => reviewDraft({ sections: sections.map((s) => ({ title: s.title, text: text(s.bodyHtml) })), noticeText: c.noticeText, guidelinesText: guidelines, orgName: c.org.name }), (x) => `${x.overall} of 100 across ${x.criteria.length} criteria`);
      rec.tally(r);
      rec.source(c.opportunity.title, c.opportunity.sourceUrl, "web");
      const saved = await store.saveReviewerCheck({ applicationId, overall: r.overall, criteria: r.criteria, summary: r.summary });
      return { output: saved, summary: `Scored the draft ${r.overall} of 100. ${r.summary}` };
    });
    return { ok: true, data: output };
  } catch (err) {
    return fail(err);
  }
}

// ---------- Budget ----------

export async function budgetJustification(store: LoopStore, applicationId: string): Promise<LoopResult<Budget>> {
  try {
    const c = await appContext(store, applicationId);
    if (!c) return { ok: false, code: "not_found", error: "We could not find that application." };
    const budget = await store.getBudget(applicationId);
    if (!budget || !budget.lines.length) return { ok: false, code: "failed", error: "Add at least one budget line first." };
    const { output } = await recordRun(store, { agent: "proposal", title: `Budget justification for ${c.opportunity.title}`, trigger: "user" }, async (rec) => {
      const r = await rec.step("budget_justification", () => writeJustification({ org: c.org, facts: c.facts, lines: budget.lines, opportunityTitle: c.opportunity.title, noticeText: c.noticeText }), (x) => `${wordCount(x.text)} words`);
      rec.tally(r);
      const saved = await store.saveBudget(applicationId, budget.lines, r.text);
      return { output: saved, summary: `Wrote a ${wordCount(r.text)}-word justification for ${budget.lines.length} budget lines.` };
    });
    return { ok: true, data: output };
  } catch (err) {
    return fail(err);
  }
}

// ---------- Outreach ----------

export async function draftOutreach(store: LoopStore, input: { kind: EmailKind; applicationId: string | null; funderId: string | null; contactId: string | null; to: string | null; toName: string | null; notes: string }): Promise<LoopResult<EmailDraft>> {
  try {
    const [org, facts, user] = await Promise.all([store.getOrg(), store.listFacts(), store.currentUser()]);
    const confirmed = facts.filter((f) => f.status === "confirmed");
    const app = input.applicationId ? await store.getApplication(input.applicationId) : null;
    const noticeText = app ? await store.noticeTextFor(app.opportunity.id) : null;
    const { output } = await recordRun(store, { agent: "outreach", title: `Draft a ${input.kind.replace("_", " ")} email${app ? ` for ${app.opportunity.title}` : ""}`, trigger: "user" }, async (rec) => {
      const r = await rec.step("draft_email", () => draftEmail({ kind: input.kind, org, facts: confirmed, userName: user.fullName || user.email, userEmail: user.email, funderName: app?.funder.name ?? null, opportunityTitle: app?.opportunity.title ?? null, noticeText, deadline: app?.opportunity.deadline ?? null, toName: input.toName, viaContact: null, notes: input.notes }), (x) => `${wordCount(x.body)} words${x.flagged.length ? `, ${x.flagged.length} number${x.flagged.length === 1 ? "" : "s"} to confirm` : ""}`);
      rec.tally(r);
      const saved = await store.addEmailDraft({ applicationId: input.applicationId, funderId: input.funderId ?? app?.funder.id ?? "", contactId: input.contactId, kind: input.kind, subject: r.subject, body: r.body, to: input.to, toName: input.toName, status: "draft", sentAt: null, sentVia: null, followUpAt: null });
      return { output: saved, summary: `Drafted "${r.subject}" for you to read and send.` };
    });
    return { ok: true, data: output };
  } catch (err) {
    return fail(err);
  }
}

export async function draftIntro(store: LoopStore, contactId: string, applicationId: string | null): Promise<LoopResult<EmailDraft>> {
  try {
    const contact = await store.getOrgContact(contactId);
    if (!contact) return { ok: false, code: "not_found", error: "We could not find that contact." };
    const [org, facts, user] = await Promise.all([store.getOrg(), store.listFacts(), store.currentUser()]);
    const app = applicationId ? await store.getApplication(applicationId) : null;
    const noticeText = app ? await store.noticeTextFor(app.opportunity.id) : null;
    const { output } = await recordRun(store, { agent: "outreach", title: `Draft an introduction request for ${contact.name}`, trigger: "user" }, async (rec) => {
      const r = await rec.step("draft_email", () => draftEmail({ kind: "intro_request", org, facts: facts.filter((f) => f.status === "confirmed"), userName: user.fullName || user.email, userEmail: user.email, funderName: app?.funder.name ?? contact.organization, opportunityTitle: app?.opportunity.title ?? null, noticeText, deadline: app?.opportunity.deadline ?? null, toName: null, viaContact: { name: contact.name, relationship: contact.relationship }, notes: `${contact.name} is ${contact.role}${contact.organization ? ` at ${contact.organization}` : ""}. They will send this to their contact at the funder.` }), (x) => `${wordCount(x.body)} words`);
      rec.tally(r);
      const saved = await store.addEmailDraft({ applicationId, funderId: app?.funder.id ?? contact.funderId ?? "", contactId, kind: "intro", subject: r.subject, body: r.body, to: contact.email, toName: contact.name, status: "draft", sentAt: null, sentVia: null, followUpAt: null });
      return { output: saved, summary: `Drafted an introduction request for ${contact.name} to send.` };
    });
    return { ok: true, data: output };
  } catch (err) {
    return fail(err);
  }
}

// ---------- Social ----------

export async function generateMonth(store: LoopStore, month: string): Promise<LoopResult<SocialCampaign>> {
  try {
    const [org, facts, apps] = await Promise.all([store.getOrg(), store.listFacts(), store.listApplications()]);
    const confirmed = facts.filter((f) => f.status === "confirmed");
    const programs = confirmed.filter((f) => f.label === "Program").map((f) => f.value);
    const inFlight = apps.filter((a) => !["won", "lost", "submitted"].includes(a.application.stage)).map((a) => ({ id: a.application.id, title: a.opportunity.title, funder: a.funder.name, deadline: a.opportunity.deadline }));
    const wins = apps.filter((a) => a.application.stage === "won").map((a) => ({ id: a.application.id, title: a.opportunity.title, funder: a.funder.name, amount: a.awardAmount }));
    const { output } = await recordRun(store, { agent: "outreach", title: `Plan social posts for ${month}`, trigger: "user" }, async (rec) => {
      const r = await rec.step("social_campaign", () => generateCampaign({ month, org, facts: confirmed, programs, applications: inFlight, wins }), (x) => `${x.posts.length} posts drafted`);
      rec.tally(r);
      const saved = await store.saveCampaign({ month, theme: r.theme, posts: r.posts, status: "draft" });
      return { output: saved, summary: `Drafted ${r.posts.length} posts for ${month}. Nothing is posted until you copy it yourself.` };
    });
    return { ok: true, data: output };
  } catch (err) {
    return fail(err);
  }
}

// ---------- Documents ----------

export async function extractDocumentFacts(store: LoopStore, documentId: string): Promise<LoopResult<{ factCount: number; droppedCount: number }>> {
  try {
    const doc = await store.getDocumentText(documentId);
    if (!doc) return { ok: false, code: "not_found", error: "We could not find that document." };
    if (!doc.text.trim()) return { ok: false, code: "failed", error: "We could not read any text in that file." };
    const { output } = await recordRun(store, { agent: "profile", title: `Extract facts from ${doc.document.title}`, trigger: "event" }, async (rec) => {
      const r = await rec.step("extract_document_text", () => extractFromDocument({ id: documentId, title: doc.document.title, text: doc.text }), (x) => `${x.facts.length} facts kept, ${x.dropped} dropped for failing the source check`);
      rec.tally(r);
      rec.source(doc.document.title, null, "document");
      const facts: NewFact[] = r.facts.map((f) => ({ label: f.label, value: f.value, category: f.category, sourceUrl: null, sourceLabel: doc.document.title, sourceExcerpt: f.excerpt, confidence: 0.9, status: "needs_review" }));
      await store.replaceDocumentFacts(documentId, facts);
      return { output: { factCount: facts.length, droppedCount: r.dropped }, summary: `Found ${facts.length} fact${facts.length === 1 ? "" : "s"} in ${doc.document.title} for you to check.` };
    });
    return { ok: true, data: output };
  } catch (err) {
    return fail(err);
  }
}

// ---------- Custom search ----------

export async function customSearch(store: LoopStore, input: { keyword: string; fundingCategories: string[] }) {
  try {
    const org = await store.getOrg();
    const r = await runCustomSearch({ ...input, org });
    return { ok: true as const, data: r };
  } catch (err) {
    return fail(err);
  }
}

export async function scoreSelected(store: LoopStore, externalIds: string[]): Promise<LoopResult<{ added: number; dropped: number }>> {
  try {
    const [org, facts, dismissed] = await Promise.all([store.getOrg(), store.listFacts(), store.listDismissals()]);
    const confirmed = facts.filter((f) => f.status === "confirmed");
    if (!confirmed.length) return { ok: false, code: "no_facts", error: "Confirm a few facts first so we have something to score against." };
    const { output } = await recordRun(store, { agent: "discovery", title: `Score ${externalIds.length} chosen notice${externalIds.length === 1 ? "" : "s"}`, trigger: "user" }, async (rec) => {
      const r = await rec.step("score_fit", () => scoreChosen({ externalIds, org, facts: confirmed, dismissed }), (x) => `${x.matches.length} kept, ${x.droppedIneligible} ineligible, ${x.droppedUnsupported} unsupported`);
      rec.tally(r);
      let added = 0;
      for (const m of r.matches) {
        const stored = await store.upsertOpportunity(m.opportunity, m.funder, m.noticeText);
        rec.source(m.opportunity.title, m.opportunity.sourceUrl, "web");
        await store.upsertMatch({ opportunityId: stored.opportunity.id, fitScore: m.fitScore, reasons: m.reasons, cautions: m.cautions, eligibilityChecks: m.eligibilityChecks, status: "new", dismissReason: null });
        added++;
      }
      return { output: { added, dropped: r.droppedIneligible + r.droppedUnsupported }, summary: `${added} added to your matches.` };
    });
    return { ok: true, data: output };
  } catch (err) {
    return fail(err);
  }
}

export { PARAGRAPH_KEYS, factIdsIn, gapIdsIn };
