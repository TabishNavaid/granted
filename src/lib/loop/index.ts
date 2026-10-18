import { createHash } from "node:crypto";
import { aiErrorMessage, AiError } from "@/lib/ai";
import { cached, HOURS } from "@/lib/cache";
import { crawlSite, CrawlError, sourceLabelFor, type CrawlResult } from "@/lib/crawl";
import { GrantsGovError } from "@/lib/grantsgov";
import type { Fact, Match, Organization } from "@/lib/types";
import { runDiscovery, type DiscoveryResult } from "./discovery";
import { draftLetter, factIdsIn, gapIdsIn, htmlToMarkedText, redraftParagraph, renderLetter, renderParagraph, PARAGRAPH_KEYS, type LetterInput, type ParagraphKey, type RenderedCheck } from "./letter";
import { extractProfile, type ProfileExtraction } from "./profile";
import { recordRun } from "./runs";
import type { LoopStore, NewFact } from "./store";
import { wordCount } from "./text";

/**
 * The thin, real, end-to-end loop:
 *   website -> facts -> confirmed facts -> Grants.gov matches -> letter of inquiry.
 * Each step is a function over a LoopStore so the same code runs against the
 * in-memory demo state or Supabase.
 */
export type LoopErrorCode = "bad_url" | "unreachable" | "no_ai" | "rate_limited" | "no_facts" | "grants_gov" | "not_found" | "failed";
export type LoopResult<T> = { ok: true; data: T } | { ok: false; code: LoopErrorCode; error: string };

function fail(err: unknown): LoopResult<never> {
  if (err instanceof CrawlError) {
    return { ok: false, code: err.code, error: err.code === "bad_url" ? err.message : `${err.message} Check the address, or try again in a minute.` };
  }
  if (err instanceof AiError) {
    const m = aiErrorMessage(err);
    return { ok: false, code: m.code, error: m.message };
  }
  if (err instanceof GrantsGovError) return { ok: false, code: "grants_gov", error: "We could not reach Grants.gov just now. It happens. Try again in a few minutes." };
  return { ok: false, code: "failed", error: "Something went wrong on our side. Try again, and if it keeps happening, tell us." };
}

const factLabel = (f: Fact) => f.sourceLabel ?? (f.sourceUrl ? sourceLabelFor(f.sourceUrl) : "Source");

function parseMoney(s: string): number | null {
  const m = s.replace(/,/g, "").match(/\$?\s*(\d+(?:\.\d+)?)\s*(million|m|k|thousand)?/i);
  if (!m) return null;
  let n = parseFloat(m[1]);
  const unit = m[2]?.toLowerCase();
  if (unit === "million" || unit === "m") n *= 1_000_000;
  if (unit === "k" || unit === "thousand") n *= 1_000;
  return Number.isFinite(n) && n > 0 ? Math.round(n) : null;
}
function parseInt4(s: string): number | null {
  const m = s.match(/\b(1[89]\d\d|20\d\d)\b/);
  return m ? Number(m[1]) : null;
}
function parseCount(s: string): number | null {
  const m = s.replace(/,/g, "").match(/\d+/);
  return m ? Number(m[0]) : null;
}

// ---------- 1. Profile ----------

export interface BuildProfileOutput {
  pageCount: number;
  factCount: number;
  droppedCount: number;
  runId: string;
  fromCache: boolean;
}

export async function buildProfile(store: LoopStore, input: { websiteUrl: string; ein: string | null }): Promise<LoopResult<BuildProfileOutput>> {
  let host = input.websiteUrl;
  try {
    host = new URL(/^https?:\/\//i.test(input.websiteUrl) ? input.websiteUrl : `https://${input.websiteUrl}`).hostname.replace(/^www\./, "");
  } catch {
    // the crawler reports the bad url
  }
  try {
    const { output, run } = await recordRun(store, { agent: "profile", title: `Read ${host}`, trigger: "user" }, async (rec) => {
      // Crawl and extraction are cached together for a day: a reload must not pay for the model twice.
      const key = `profile:${input.websiteUrl.trim().toLowerCase()}`;
      const { value, fromCache } = await cached<{ crawl: CrawlResult; extraction: ProfileExtraction }>(key, 24 * HOURS, async () => {
        const crawl = await rec.step("fetch_url", () => crawlSite(input.websiteUrl), (r) => `${r.pages.length} page${r.pages.length === 1 ? "" : "s"} read${r.skipped.length ? `, ${r.skipped.length} skipped` : ""}`);
        const extraction = await rec.step("extract_profile", () => extractProfile(crawl.pages), (r) => `${r.facts.length} facts kept, ${r.dropped.length} dropped for failing the source check`);
        return { crawl, extraction };
      });
      if (fromCache) rec.tool("cache", `Used the reading of ${host} from earlier today`, 0);
      else rec.tally(value.extraction);
      for (const p of value.crawl.pages) rec.source(p.title || p.url, p.url, "web");

      const { profile, facts, dropped } = value.extraction;
      const patch: Partial<Organization> = {
        websiteUrl: value.crawl.homepage,
        ein: input.ein ?? "",
        ...(profile.name ? { name: profile.name } : {}),
        mission: profile.mission,
        causes: profile.causes,
        populations: profile.populations,
        city: profile.city,
        state: profile.state,
        serviceArea: profile.serviceArea,
        annualBudget: profile.annualBudget ? parseMoney(profile.annualBudget) : null,
        foundedYear: profile.foundedYear ? parseInt4(profile.foundedYear) : null,
        staffCount: profile.staffSize ? parseCount(profile.staffSize) : null,
        volunteerCount: null,
      };
      await store.updateOrg(patch);
      const newFacts: NewFact[] = facts.map((f) => ({
        label: f.label,
        value: f.value,
        category: f.category,
        sourceUrl: f.sourceUrl,
        sourceLabel: sourceLabelFor(f.sourceUrl),
        sourceExcerpt: f.excerpt,
        confidence: 0.9,
        status: "needs_review",
      }));
      // Programs are facts too, so the letter can cite them.
      for (const program of profile.programs.slice(0, 8)) {
        const page = value.crawl.pages.find((p) => p.text.toLowerCase().includes(program.toLowerCase()));
        if (!page) continue;
        const idx = page.text.toLowerCase().indexOf(program.toLowerCase());
        const excerpt = page.text.slice(Math.max(0, idx - 60), idx + program.length + 80).replace(/\s+/g, " ").trim();
        newFacts.push({ label: "Program", value: program, category: "organization", sourceUrl: page.url, sourceLabel: sourceLabelFor(page.url), sourceExcerpt: excerpt, confidence: 0.85, status: "needs_review" });
      }
      await store.replaceReadFacts(newFacts);
      const summary = `Read ${value.crawl.pages.length} page${value.crawl.pages.length === 1 ? "" : "s"} on ${host} and found ${newFacts.length} fact${newFacts.length === 1 ? "" : "s"} for you to check.${dropped.length ? ` Set aside ${dropped.length} that did not pass the source check.` : ""}`;
      return { output: { pageCount: value.crawl.pages.length, factCount: newFacts.length, droppedCount: dropped.length, fromCache }, summary };
    });
    return { ok: true, data: { ...output, runId: run.id } };
  } catch (err) {
    return fail(err);
  }
}

// ---------- 2. Confirm ----------

export interface ConfirmInput {
  keptFactIds: string[];
  /** Values the user changed on the confirm screen. */
  factEdits: Record<string, string>;
  org: { mission?: string; serviceArea?: string; name?: string };
}

export async function confirmProfile(store: LoopStore, input: ConfirmInput): Promise<LoopResult<{ confirmed: number; removed: number }>> {
  try {
    const facts = await store.listFacts();
    const pending = facts.filter((f) => f.status === "needs_review" && f.sourceLabel !== "You");
    const kept = new Set(input.keptFactIds);
    const toRemove = pending.filter((f) => !kept.has(f.id)).map((f) => f.id);
    await store.deleteFacts(toRemove);
    let confirmed = 0;
    for (const f of pending) {
      if (!kept.has(f.id)) continue;
      const edited = input.factEdits[f.id]?.trim();
      const patch: Partial<Fact> = { status: "confirmed", lastConfirmedAt: new Date().toISOString() };
      if (edited && edited !== f.value) {
        patch.value = edited;
        patch.sourceLabel = "You";
        patch.sourceExcerpt = `You changed this from "${f.value}" on the confirm screen.`;
        patch.sourceUrl = null;
        patch.confidence = 1;
      }
      await store.updateFact(f.id, patch);
      confirmed++;
    }
    const orgPatch: Partial<Organization> = {};
    if (input.org.mission != null) orgPatch.mission = input.org.mission.trim();
    if (input.org.serviceArea != null) orgPatch.serviceArea = input.org.serviceArea.trim();
    if (input.org.name?.trim()) orgPatch.name = input.org.name.trim();
    if (Object.keys(orgPatch).length) await store.updateOrg(orgPatch);
    return { ok: true, data: { confirmed, removed: toRemove.length } };
  } catch (err) {
    return fail(err);
  }
}

// ---------- 3. Matches ----------

export interface FindMatchesOutput {
  matchCount: number;
  screened: number;
  read: number;
  runId: string;
  fromCache: boolean;
}

export async function findMatches(store: LoopStore): Promise<LoopResult<FindMatchesOutput>> {
  try {
    const org = await store.getOrg();
    const facts = (await store.listFacts()).filter((f) => f.status === "confirmed");
    if (!facts.length) return { ok: false, code: "no_facts", error: "Confirm at least one fact about your organization first, so we have something to match against." };
    const { output, run } = await recordRun(store, { agent: "discovery", title: "Search Grants.gov for open opportunities", trigger: "user" }, async (rec) => {
      // Same profile, same day: reuse the scoring rather than paying for it again.
      const fingerprint = createHash("sha1").update(JSON.stringify({ org: [org.name, org.mission, org.causes, org.populations, org.serviceArea], facts: facts.map((f) => [f.id, f.label, f.value]), day: new Date().toISOString().slice(0, 10) })).digest("hex");
      const { value: result, fromCache } = await cached<DiscoveryResult>(`discovery:${store.orgId}:${fingerprint}`, 6 * HOURS, () => runDiscovery({ org, facts }));
      if (fromCache) rec.tool("cache", "Used this morning's search; nothing about your profile changed", 0);
      else {
        for (const t of result.tools) rec.tool(t.name, t.summary, t.durationMs);
        rec.tally({ usage: result.usage, costUsd: result.costUsd, models: result.models });
      }
      for (const s of result.sources) rec.source(s.label, s.url, s.kind);
      const matches: Omit<Match, "id" | "orgId" | "createdAt" | "isNew">[] = [];
      for (const m of result.matches) {
        const stored = await store.upsertOpportunity(m.opportunity, m.funder, m.noticeText);
        matches.push({ opportunityId: stored.opportunity.id, fitScore: m.fitScore, reasons: m.reasons, cautions: m.cautions, eligibilityChecks: m.eligibilityChecks, status: "new" });
      }
      await store.replaceMatches(matches);
      const summary = matches.length
        ? `Screened ${result.screened} notices, read ${result.read} in full, and kept ${matches.length} you can apply for. Set aside ${result.droppedIneligible} you are not eligible for and ${result.droppedUnsupported} we could not justify.`
        : `Screened ${result.screened} notices and read ${result.read} in full, but none fit well enough to show you. We will keep looking.`;
      return { output: { matchCount: matches.length, screened: result.screened, read: result.read, fromCache }, summary };
    });
    return { ok: true, data: { ...output, runId: run.id } };
  } catch (err) {
    return fail(err);
  }
}

// ---------- 4. Letter ----------

export interface DraftLetterOutput {
  sectionCount: number;
  openQuestions: number;
  issues: number;
  wordCount: number;
  runId: string;
}

async function letterInput(store: LoopStore, applicationId: string): Promise<{ input: LetterInput; facts: Fact[]; ctx: NonNullable<Awaited<ReturnType<LoopStore["getApplication"]>>> } | null> {
  const ctx = await store.getApplication(applicationId);
  if (!ctx) return null;
  const org = await store.getOrg();
  const facts = (await store.listFacts()).filter((f) => f.status === "confirmed");
  const user = await store.currentUser();
  const noticeText = (await store.noticeTextFor(ctx.opportunity.id)) ?? [`Title: ${ctx.opportunity.title}`, `Agency: ${ctx.funder.name}`, ctx.opportunity.deadline ? `Application due date: ${ctx.opportunity.deadline}` : "", ctx.opportunity.amountMax ? `Award ceiling: ${ctx.opportunity.amountMax}` : "", `Description: ${ctx.opportunity.summary}`].filter(Boolean).join("\n");
  return { input: { org, facts, userName: user.fullName || user.email, funderName: ctx.funder.name, opportunityTitle: ctx.opportunity.title, noticeText, deadline: ctx.opportunity.deadline }, facts, ctx };
}

export async function draftLetterFor(store: LoopStore, applicationId: string): Promise<LoopResult<DraftLetterOutput>> {
  try {
    const li = await letterInput(store, applicationId);
    if (!li) return { ok: false, code: "not_found", error: "We could not find that application." };
    if (!li.facts.length) return { ok: false, code: "no_facts", error: "Confirm a few facts about your organization first. The letter can only say what you have confirmed." };
    const { output, run } = await recordRun(store, { agent: "proposal", title: `Draft a letter of inquiry for ${li.ctx.opportunity.title}`, trigger: "user" }, async (rec) => {
      const d = await rec.step("draft_letter", () => draftLetter(li.input), (r) => `${r.draft.paragraphs.length} paragraphs, ${r.draft.gaps.length} question${r.draft.gaps.length === 1 ? "" : "s"} raised by the writer`);
      rec.tally(d);
      rec.source(li.ctx.opportunity.title, li.ctx.opportunity.sourceUrl, "web");
      for (const f of li.facts) if (f.sourceUrl) rec.source(factLabel(f), f.sourceUrl, "web");
      const t = Date.now();
      const gapIds = new Map<string, string>();
      const rendered = renderLetter(d.draft, { facts: li.facts, noticeText: li.input.noticeText, factLabel, gapId: (key) => gapIds.get(key) ?? (gapIds.set(key, store.newId("gap")), gapIds.get(key)!) });
      rec.tool("validate_letter", `${rendered.issues.length === 0 ? "Every citation and number checked out" : `${rendered.issues.length} problem${rendered.issues.length === 1 ? "" : "s"} turned into questions`}; ${rendered.wordCount} words`, Date.now() - t);
      const sectionIds = rendered.sections.map(() => store.newId("sec"));
      await store.replaceLetter(applicationId, {
        requirements: [
          { title: "Letter of inquiry, about one page", kind: "section", detail: "Six short paragraphs: the request, who you are, the need, the plan, the fit, and a close.", wordLimit: 500, required: true, order: 1, satisfied: true },
          { title: "Every claim cites a confirmed fact", kind: "format", detail: "Citations are checked in code after drafting.", wordLimit: null, required: true, order: 2, satisfied: rendered.issues.length === 0 },
          { title: "Read the full notice before applying", kind: "eligibility", detail: `The letter is based on the Grants.gov notice. Read the agency's own guidelines at ${li.ctx.opportunity.guidelinesUrl}`, wordLimit: null, required: true, order: 3, satisfied: false },
        ],
        sections: rendered.sections.map((s, i) => ({ id: sectionIds[i], title: s.title, bodyHtml: s.bodyHtml, wordLimit: s.wordLimit, status: s.status, order: s.order })),
        missingFacts: rendered.missingFacts.map((m) => ({ id: m.gapId, sectionId: sectionIds[m.sectionOrder - 1], question: m.question, whyItMatters: m.whyItMatters, suggestedLabel: m.suggestedLabel, status: "open", answer: null, gapKey: m.gapKey })),
        checks: rendered.checks.map((c) => ({ rule: c.rule, status: c.status, detail: c.detail, sectionId: c.sectionOrder ? sectionIds[c.sectionOrder - 1] : null })),
      });
      await store.updateApplication(applicationId, { stage: "drafting" });
      const open = rendered.missingFacts.length;
      return { output: { sectionCount: rendered.sections.length, openQuestions: open, issues: rendered.issues.length, wordCount: rendered.wordCount }, summary: `Drafted a ${rendered.wordCount}-word letter in ${rendered.sections.length} paragraphs from ${li.facts.length} confirmed facts.${open ? ` ${open} question${open === 1 ? "" : "s"} for you before it is complete.` : " Nothing is waiting on you."}` };
    });
    return { ok: true, data: { ...output, runId: run.id } };
  } catch (err) {
    return fail(err);
  }
}

// ---------- 5. Answer a question and redraft its paragraph ----------

function recomputeChecks(sectionsHtml: string[], openQuestions: number): RenderedCheck[] {
  const all = sectionsHtml.join("\n");
  const unverified = (all.match(/data-label="Unverified claim"/g) ?? []).length;
  const unsupported = (all.match(/data-label="Confirm /g) ?? []).length;
  const words = sectionsHtml.reduce((n, h) => n + wordCount(h.replace(/<[^>]+>/g, " ")), 0);
  return [
    { rule: "Every claim about you cites a confirmed fact", status: unverified ? "fail" : "pass", detail: unverified ? `${unverified} claim${unverified === 1 ? "" : "s"} still marked as unverified.` : "Every citation points to a fact you confirmed.", sectionOrder: null },
    { rule: "Every number appears in a cited fact or the notice", status: unsupported ? "fail" : "pass", detail: unsupported ? `${unsupported} number${unsupported === 1 ? "" : "s"} still waiting on a source.` : "Every number traces to a source.", sectionOrder: null },
    { rule: "About one page", status: words <= 500 ? "pass" : "warn", detail: `Currently ${words} words. One page is about 450.`, sectionOrder: null },
    { rule: "No open questions", status: openQuestions ? "warn" : "pass", detail: openQuestions ? `${openQuestions} question${openQuestions === 1 ? "" : "s"} waiting on you.` : "Nothing is waiting on you.", sectionOrder: null },
  ];
}

export async function answerAndRedraft(store: LoopStore, missingFactId: string, answer: string): Promise<LoopResult<{ factId: string; redrafted: boolean; note: string }>> {
  try {
    const mf = await store.getMissingFact(missingFactId);
    if (!mf) return { ok: false, code: "not_found", error: "We could not find that question." };
    const user = await store.currentUser();
    const fact = await store.addFact({
      label: mf.suggestedLabel || "Answer",
      value: answer.trim(),
      category: "organization",
      sourceUrl: null,
      sourceLabel: "You",
      sourceExcerpt: `Answered by ${user.fullName || user.email} in the letter workspace.`,
      confidence: 1,
      status: "confirmed",
    });
    await store.updateMissingFact(mf.id, { status: "answered", answer: answer.trim() });
    const sections = await store.listSections(mf.applicationId);
    const section = sections.find((s) => s.id === mf.sectionId);
    const allMissing = await store.listMissingFacts(mf.applicationId);
    const open = allMissing.filter((m) => m.status === "open").length;
    if (!section) {
      await store.replaceChecks(mf.applicationId, recomputeChecks(sections.map((s) => s.bodyHtml), open).map((c) => ({ rule: c.rule, status: c.status, detail: c.detail, sectionId: null })));
      return { ok: true, data: { factId: fact.id, redrafted: false, note: "Saved as a fact you stated." } };
    }
    const keyOf = (gapId: string) => allMissing.find((m) => m.id === gapId)?.gapKey ?? gapId;
    const label = (f: Fact) => factLabel(f);
    const fallback = async (note: string) => {
      // No model available: put the answer in place of the gap and cite the user.
      const html = section.bodyHtml.replace(new RegExp(`<span data-gap="${mf.id}"[^>]*></span>`), `${answer.trim().replace(/&/g, "&amp;").replace(/</g, "&lt;")}<span data-citation="${fact.id}" data-label="You"></span>`);
      const remaining = gapIdsIn(html).length;
      await store.updateSection(section.id, { bodyHtml: html, status: remaining ? "needs_facts" : "drafted" });
      const htmls = sections.map((s) => (s.id === section.id ? html : s.bodyHtml));
      await store.replaceChecks(mf.applicationId, recomputeChecks(htmls, open).map((c) => ({ rule: c.rule, status: c.status, detail: c.detail, sectionId: null })));
      return { ok: true as const, data: { factId: fact.id, redrafted: false, note } };
    };
    const li = await letterInput(store, mf.applicationId);
    if (!li) return fallback("Saved. We put your answer in the letter and cited you.");
    try {
      const paragraphKey = (PARAGRAPH_KEYS[section.order - 1] ?? "plan") as ParagraphKey;
      const current = { key: paragraphKey, heading: section.title, text: htmlToMarkedText(section.bodyHtml, keyOf) };
      const answered = allMissing.filter((m) => m.status === "answered" && m.sectionId === section.id);
      // Facts the user stated for answered gaps in this paragraph, matched by label.
      const facts = li.facts;
      const answeredMap = answered
        .map((m) => {
          const f = m.id === mf.id ? fact : facts.find((x) => x.sourceLabel === "You" && x.label === m.suggestedLabel && x.value === m.answer);
          return f ? { gapKey: m.gapKey ?? m.id, factId: f.id, label: f.label, value: f.value } : null;
        })
        .filter((x): x is NonNullable<typeof x> => Boolean(x));
      const { output } = await recordRun(store, { agent: "proposal", title: `Rewrite "${section.title}" with your answer`, trigger: "user" }, async (rec) => {
        const r = await rec.step("redraft_paragraph", () => redraftParagraph({ ...li.input, facts: [...li.facts.filter((f) => f.id !== fact.id), fact], paragraph: current, answered: answeredMap }), () => "Paragraph rewritten with the new fact");
        rec.tally(r);
        const gapIds = new Map<string, string>();
        for (const m of allMissing) if (m.gapKey) gapIds.set(m.gapKey, m.id);
        const declared = [...r.gaps, ...allMissing.filter((m) => m.status === "open" && m.gapKey).map((m) => ({ key: m.gapKey!, paragraphKey, question: m.question, whyItMatters: m.whyItMatters, suggestedLabel: m.suggestedLabel }))];
        const rendered = renderParagraph(r.paragraph, declared, { facts: [...li.facts.filter((f) => f.id !== fact.id), fact], noticeText: li.input.noticeText, factLabel: label, gapId: (key) => gapIds.get(key) ?? (gapIds.set(key, store.newId("gap")), gapIds.get(key)!) });
        // If the rewrite lost the citation to the new fact, keep the simpler fallback instead.
        if (!factIdsIn(rendered.html).includes(fact.id)) throw new AiError("The rewrite did not cite the new fact.", "bad_response");
        const known = new Set(allMissing.map((m) => m.id));
        const fresh = rendered.gaps.filter((g) => !known.has(g.id));
        if (fresh.length) await store.addMissingFacts(mf.applicationId, fresh.map((g) => ({ id: g.id, sectionId: section.id, question: g.question, whyItMatters: g.whyItMatters, suggestedLabel: g.suggestedLabel, status: "open", answer: null, gapKey: g.key })));
        const remaining = gapIdsIn(rendered.html).length;
        await store.updateSection(section.id, { bodyHtml: rendered.html, status: remaining ? "needs_facts" : "drafted" });
        const htmls = sections.map((s) => (s.id === section.id ? rendered.html : s.bodyHtml));
        await store.replaceChecks(mf.applicationId, recomputeChecks(htmls, open + fresh.length).map((c) => ({ rule: c.rule, status: c.status, detail: c.detail, sectionId: null })));
        return { output: { fresh: fresh.length }, summary: `Rewrote "${section.title}" with your answer.${fresh.length ? ` It raised ${fresh.length} new question${fresh.length === 1 ? "" : "s"}.` : ""}` };
      });
      return { ok: true, data: { factId: fact.id, redrafted: true, note: output.fresh ? "Paragraph rewritten. It raised a new question." : "Paragraph rewritten and it cites you." } };
    } catch (err) {
      const m = err instanceof AiError ? aiErrorMessage(err).message : "";
      return fallback(m ? `Saved and placed in the letter. We could not rewrite the paragraph: ${m}` : "Saved. We put your answer in the letter and cited you.");
    }
  } catch (err) {
    return fail(err);
  }
}
