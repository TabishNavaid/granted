import { sha1Hex } from "@/lib/hash";
import { stateCode as stateCodeOf } from "@/lib/catalog/vocab";
import { UsageLimitError } from "@/lib/usage/limits";
import { aiErrorMessage, AiError } from "@/lib/ai";
import { cached, HOURS } from "@/lib/cache";
import { crawlSite, CrawlError, sourceLabelFor, type CrawlResult } from "@/lib/crawl";
import { GrantsGovError } from "@/lib/grantsgov";
import type { Fact, Match, Organization } from "@/lib/types";
import { runDiscovery, type DiscoveryResult } from "./discovery";
import { draftLetter, factIdsIn, gapIdsIn, htmlToMarkedText, redraftParagraph, renderLetter, renderParagraph, PARAGRAPH_KEYS, type LetterInput, type ParagraphKey, type RenderedCheck } from "./letter";
import { extractProfile, type ProfileExtraction } from "./profile";
import { recordRun } from "./runs";
import { advanceJob, finishJob, logJob, noteJob, startJob } from "./progress";
import { replayActive } from "@/lib/replay/active";
import { loadFoundations, rememberFoundations, matchFoundations, noticeTextFor as foundationNotice, toFunder as toFoundationFunder, toOpportunity as toFoundationOpportunity } from "@/lib/foundations";
import type { LoopStore, NewFact } from "./store";
import { wordCount } from "./text";

/**
 * The thin, real, end-to-end loop:
 *   website -> facts -> confirmed facts -> Grants.gov matches -> letter of inquiry.
 * Each step is a function over a LoopStore so the same code runs against the
 * in-memory demo state or Supabase.
 */
export type LoopErrorCode = "bad_url" | "unreachable" | "no_ai" | "rate_limited" | "no_facts" | "grants_gov" | "not_found" | "usage_limit" | "failed";
export type LoopResult<T> = { ok: true; data: T } | { ok: false; code: LoopErrorCode; error: string };

function fail(err: unknown): LoopResult<never> {
  if (err instanceof UsageLimitError) return { ok: false, code: "usage_limit", error: err.message };
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

export const PROFILE_STEPS = ["Reading your homepage", "Reading your other pages", "Writing down the facts", "Checking every fact against its page"];

/** Extra steps an organization type adds after its site is read (a firm's projects, a lab's publications). */
export interface ProfileHooks {
  afterRead?: (pages: CrawlResult["pages"], rec: import("./runs").Recorder, jobId?: string) => Promise<{ kept: number; dropped: number }>;
}

export async function buildProfile(store: LoopStore, input: { websiteUrl: string; ein: string | null; jobId?: string }, hooks: ProfileHooks = {}): Promise<LoopResult<BuildProfileOutput>> {
  const job = input.jobId;
  if (job) startJob(job, PROFILE_STEPS);
  const r = await buildProfileInner(store, input, hooks);
  if (job) finishJob(job, r.ok ? "done" : "failed");
  return r;
}

async function buildProfileInner(store: LoopStore, input: { websiteUrl: string; ein: string | null; jobId?: string }, hooks: ProfileHooks): Promise<LoopResult<BuildProfileOutput>> {
  const job = input.jobId;
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
        const crawl = await rec.step(
          "fetch_url",
          () =>
            crawlSite(input.websiteUrl, {
              onPage: (p, i) => {
                if (!job) return;
                if (i === 0) advanceJob(job, `Found ${p.title || host}`);
                else noteJob(job, `Read ${p.title || p.url}`);
                logJob(job, { kind: "page", text: p.title || sourceLabelFor(p.url), detail: `${sourceLabelFor(p.url)}, ${wordCount(p.text).toLocaleString("en-US")} words${p.kind === "pdf" ? ", PDF" : ""}`, url: p.url });
              },
            }),
          (r) => `${r.pages.length} page${r.pages.length === 1 ? "" : "s"} read${r.skipped.length ? `, ${r.skipped.length} skipped` : ""}`,
        );
        if (job) advanceJob(job, `${crawl.pages.length} page${crawl.pages.length === 1 ? "" : "s"} read`);
        const extraction = await rec.step("extract_profile", () => extractProfile(crawl.pages), (r) => `${r.facts.length} facts kept, ${r.dropped.length} dropped for failing the source check`);
        if (job) advanceJob(job, `${extraction.facts.length + extraction.dropped.length} candidate facts`);
        return { crawl, extraction };
      }, { bypass: replayActive() });
      if (job && !fromCache) {
        for (const f of value.extraction.facts) logJob(job, { kind: "fact", text: `${f.label}: ${f.value}`, detail: f.excerpt, url: f.sourceUrl });
        for (const d of value.extraction.dropped) logJob(job, { kind: "dropped", text: `${d.fact.label}: ${d.fact.value}`, detail: `Set aside: ${d.reason}.` });
      }
      if (fromCache) {
        rec.tool("cache", `Used the reading of ${host} from earlier today`, 0);
        if (job) {
          advanceJob(job, "Read earlier today");
          advanceJob(job, `${value.crawl.pages.length} pages`);
          advanceJob(job, `${value.extraction.facts.length} facts`);
        }
      } else rec.tally(value.extraction);
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
      const extra = hooks.afterRead ? await hooks.afterRead(value.crawl.pages, rec, job) : { kept: 0, dropped: 0 };
      await store.updateOrg({ onboardingStep: "profile" });
      const programCount = newFacts.length - facts.length;
      if (job) advanceJob(job, `${facts.length} facts kept${programCount ? ` and ${programCount} program${programCount === 1 ? "" : "s"} noted` : ""}${extra.kept ? `, ${extra.kept} records` : ""}, ${dropped.length + extra.dropped} set aside`);
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

// ---------- 2b. Gap questions ----------

export interface GapAnswers {
  budgetRange?: string;
  peopleServed?: string;
  location?: string;
  /** One result, ideally with a number. */
  result?: string;
  /** Staff and volunteers, in their words. */
  staff?: string;
  /** Programs, comma separated. */
  programs?: string;
  /** Who the organization serves. */
  populations?: string;
  /** Anything a funder should know that the website does not say. */
  note?: string;
}

/** Short answers from the director become facts stated by them; nothing is inferred from a range. */
export async function answerGaps(store: LoopStore, answers: GapAnswers): Promise<LoopResult<{ added: number }>> {
  try {
    const user = await store.currentUser();
    const by = `Answered by ${user.fullName || user.email} during setup.`;
    let added = 0;
    const add = async (label: string, value: string, category: Fact["category"]) => {
      await store.addFact({ label, value, category, sourceUrl: null, sourceLabel: "You", sourceExcerpt: by, confidence: 1, status: "confirmed" });
      added++;
    };
    const orgPatch: Partial<Organization> = { onboardingStep: "gaps" };
    if (answers.budgetRange?.trim()) {
      await add("Annual budget range", answers.budgetRange.trim(), "finance");
    }
    if (answers.peopleServed?.trim()) await add("People served last year", answers.peopleServed.trim(), "reach");
    if (answers.location?.trim()) {
      const loc = answers.location.trim();
      await add("Location", loc, "geography");
      const m = loc.match(/^(.+?),\s*([A-Za-z]{2})$/);
      if (m) {
        orgPatch.city = m[1].trim();
        orgPatch.state = m[2].toUpperCase();
      }
      if (!(await store.getOrg()).serviceArea) orgPatch.serviceArea = loc;
    }
    if (answers.result?.trim()) await add("A result we are proud of", answers.result.trim(), "outcomes");
    if (answers.staff?.trim()) await add("Staff and volunteers", answers.staff.trim(), "people");
    if (answers.programs?.trim()) for (const p of answers.programs.split(/[,;\n]/).map((x) => x.trim()).filter(Boolean).slice(0, 6)) await add("Program", p, "organization");
    if (answers.populations?.trim()) {
      await add("People we serve", answers.populations.trim(), "reach");
      const org = await store.getOrg();
      if (!org.populations.length) orgPatch.populations = answers.populations.split(/[,;]/).map((x) => x.trim()).filter(Boolean).slice(0, 6);
    }
    if (answers.note?.trim()) await add("From the director", answers.note.trim(), "organization");
    await store.updateOrg(orgPatch);
    return { ok: true, data: { added } };
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

export const MATCH_STEPS = ["Planning the searches", "Searching Grants.gov", "Reading the strongest notices in full", "Scoring each one against your facts", "Checking private foundations' IRS filings"];

/** How a firm, research team, or person finds matches instead of the nonprofit search. */
export type SegmentMatcher = (rec: import("./runs").Recorder, jobId?: string) => Promise<{ matchCount: number; screened: number; read: number; summary: string }>;

export const SEGMENT_MATCH_STEPS: Record<"firm" | "research" | "individual", string[]> = {
  firm: ["Searching Grants.gov for programs open to firms", "Reading the notices in full", "Checking eligibility and fit"],
  research: ["Finding funded projects like yours at NSF and NIH", "Searching Grants.gov research notices", "Checking eligibility, fit, and each funder's AI rules"],
  individual: ["Reading foundations' IRS filings for scholarship funds", "Checking your state, level, and field", "Ranking what fits"],
};

export async function findMatches(store: LoopStore, jobId?: string, segment?: SegmentMatcher): Promise<LoopResult<FindMatchesOutput>> {
  const orgType = (await store.getOrg()).orgType ?? "nonprofit";
  if (orgType !== "nonprofit" && segment) {
    if (jobId) startJob(jobId, SEGMENT_MATCH_STEPS[orgType]);
    try {
      const { output, run } = await recordRun(store, { agent: "discovery", title: orgType === "firm" ? "Search for grants and incentives open to firms" : orgType === "research" ? "Search for research funding" : "Search for scholarships", trigger: "user" }, async (rec) => {
        if (jobId) advanceJob(jobId);
        const r = await segment(rec, jobId);
        if (jobId) advanceJob(jobId, `${r.read} read`);
        if (jobId) advanceJob(jobId, `${r.matchCount} kept`);
        await store.updateOrg({ onboardingStep: "matches" });
        return { output: { matchCount: r.matchCount, screened: r.screened, read: r.read, fromCache: false }, summary: r.summary };
      });
      if (jobId) finishJob(jobId, "done");
      return { ok: true, data: { ...output, runId: run.id } };
    } catch (err) {
      if (jobId) finishJob(jobId, "failed");
      return fail(err);
    }
  }
  if (jobId) startJob(jobId, MATCH_STEPS);
  const r = await findMatchesInner(store, jobId);
  if (jobId) finishJob(jobId, r.ok ? "done" : "failed");
  return r;
}

async function findMatchesInner(store: LoopStore, jobId?: string): Promise<LoopResult<FindMatchesOutput>> {
  try {
    const org = await store.getOrg();
    const facts = (await store.listFacts()).filter((f) => f.status === "confirmed");
    if (!facts.length) return { ok: false, code: "no_facts", error: "Confirm at least one fact about your organization first, so we have something to match against." };
    const { output, run } = await recordRun(store, { agent: "discovery", title: "Search Grants.gov for open opportunities", trigger: "user" }, async (rec) => {
      // Same profile, same day: reuse the scoring rather than paying for it again.
      const fingerprint = sha1Hex(JSON.stringify({ org: [org.name, org.mission, org.causes, org.populations, org.serviceArea], facts: facts.map((f) => [f.id, f.label, f.value]), day: new Date().toISOString().slice(0, 10) }));
      const { value: result, fromCache } = await cached<DiscoveryResult>(
        `discovery:${store.orgId}:${fingerprint}`,
        6 * HOURS,
        () =>
          runDiscovery({
            org,
            facts,
            onStage: (stage, detail) => {
              if (jobId) advanceJob(jobId, detail);
              void stage;
            },
            onEvent: (e) => logJob(jobId, e),
          }),
        { bypass: replayActive() },
      );
      if (fromCache) rec.tool("cache", "Used this morning's search; nothing about your profile changed", 0);
      else {
        for (const t of result.tools) rec.tool(t.name, t.summary, t.durationMs);
        rec.tally({ usage: result.usage, costUsd: result.costUsd, models: result.models });
      }
      for (const s of result.sources) rec.source(s.label, s.url, s.kind);
      const matches: Omit<Match, "id" | "orgId" | "createdAt" | "isNew">[] = [];
      for (const m of result.matches) {
        const stored = await store.upsertOpportunity(m.opportunity, m.funder, m.noticeText);
        matches.push({ opportunityId: stored.opportunity.id, fitScore: m.fitScore, reasons: m.reasons, cautions: m.cautions, eligibilityChecks: m.eligibilityChecks, status: "new", dismissReason: null });
      }
      if (jobId) advanceJob(jobId, `${result.matches.length} federal notice${result.matches.length === 1 ? "" : "s"} kept`);

      // Private foundations from IRS 990-PF filings: plain code over public data, the same with or without keys.
      const t = Date.now();
      // The real product screens every foundation in the database that gives in the organization's state.
      const db = await (await import("@/lib/grantsgov")).catalogBackend();
      const pool = db ? await db.foundationPool(stateCodeOf(org.state)).catch(() => undefined) : undefined;
      if (pool) rememberFoundations(pool);
      else await loadFoundations();
      const fs = matchFoundations({ org, facts, pool });
      for (const m of fs.matches) {
        const stored = await store.upsertOpportunity(toFoundationOpportunity(m.foundation), toFoundationFunder(m.foundation), foundationNotice(m.foundation));
        matches.push({ opportunityId: stored.opportunity.id, fitScore: m.fitScore, reasons: m.reasons, cautions: m.cautions, eligibilityChecks: m.eligibilityChecks, status: "new", dismissReason: null });
        logJob(jobId, { kind: "foundation", text: m.foundation.name, score: m.fitScore, detail: m.reasons[0] });
      }
      if (fs.closedToRequests) logJob(jobId, { kind: "note", text: `Set aside ${fs.closedToRequests} foundation${fs.closedToRequests === 1 ? "" : "s"} that fund this kind of work but give only to organizations they choose`, detail: "They still show up on funder pages and in peer research." });
      rec.tool("match_foundations", `${fs.inState} of ${fs.screened} foundations give in your state; ${fs.matches.length} kept, ${fs.closedToRequests} take no unsolicited requests`, Date.now() - t);
      rec.source("IRS Form 990-PF filings", "https://www.irs.gov/charities-non-profits/form-990-series-downloads", "database");
      if (jobId) advanceJob(jobId, `${fs.matches.length} foundation${fs.matches.length === 1 ? "" : "s"} from ${fs.inState} that give in your state`);
      const stored = await store.replaceMatches(matches);
      await store.updateOrg({ onboardingStep: "matches" });
      const fresh = stored.filter((m) => m.isNew);
      if (fresh.length) await store.addInboxItem({ agent: "discovery", type: "new_matches", title: `${fresh.length} new match${fresh.length === 1 ? "" : "es"}`, summary: `The strongest scored ${Math.max(...fresh.map((m) => m.fitScore))}. Each one says why it fits, with the line it relies on.`, payload: { type: "new_matches", matchIds: fresh.map((m) => m.id) }, priority: "normal", sourceCount: result.sources.length, agentRunId: null });
      const summary = matches.length
        ? `Screened ${result.screened} federal notices and read ${result.read} in full; kept ${result.matches.length}, and set aside ${result.droppedIneligible} you are not eligible for and ${result.droppedUnsupported} we could not justify. Added ${fs.matches.length} private foundations from their IRS filings.`
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

export const LETTER_STEPS = ["Reading the notice and your confirmed facts", "Writing the letter", "Checking every citation and number"];

export async function draftLetterFor(store: LoopStore, applicationId: string, jobId?: string): Promise<LoopResult<DraftLetterOutput>> {
  if (jobId) startJob(jobId, LETTER_STEPS);
  const r = await draftLetterInner(store, applicationId, jobId);
  if (jobId) finishJob(jobId, r.ok ? "done" : "failed");
  return r;
}

async function draftLetterInner(store: LoopStore, applicationId: string, jobId?: string): Promise<LoopResult<DraftLetterOutput>> {
  try {
    const li = await letterInput(store, applicationId);
    if (!li) return { ok: false, code: "not_found", error: "We could not find that application." };
    if (!li.facts.length) return { ok: false, code: "no_facts", error: "Confirm a few facts about your organization first. The letter can only say what you have confirmed." };
    const { output, run } = await recordRun(store, { agent: "proposal", title: `Draft a letter of inquiry for ${li.ctx.opportunity.title}`, trigger: "user", usage: "draft" }, async (rec) => {
      if (jobId) advanceJob(jobId, `${li.facts.length} confirmed facts, ${li.ctx.funder.name}`);
      const d = await rec.step("draft_letter", () => draftLetter(li.input), (r) => `${r.draft.paragraphs.length} paragraphs, ${r.draft.gaps.length} question${r.draft.gaps.length === 1 ? "" : "s"} raised by the writer`);
      if (jobId) advanceJob(jobId, `${d.draft.paragraphs.length} paragraphs`);
      rec.tally(d);
      rec.source(li.ctx.opportunity.title, li.ctx.opportunity.sourceUrl, "web");
      for (const f of li.facts) if (f.sourceUrl) rec.source(factLabel(f), f.sourceUrl, "web");
      const t = Date.now();
      const gapIds = new Map<string, string>();
      const rendered = renderLetter(d.draft, { facts: li.facts, noticeText: li.input.noticeText, factLabel, gapId: (key) => gapIds.get(key) ?? (gapIds.set(key, store.newId("gap")), gapIds.get(key)!) });
      if (jobId) {
        for (const s of rendered.sections) {
          const plain = s.bodyHtml.replace(/<span data-gap="[^"]*" data-label="([^"]*)"><\/span>/g, "[$1]").replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&quot;/g, '"').trim();
          logJob(jobId, { kind: "section", text: s.title, detail: plain.length > 220 ? `${plain.slice(0, 218).trimEnd()}…` : plain });
        }
        for (const m of rendered.missingFacts) logJob(jobId, { kind: "question", text: m.question, detail: m.whyItMatters });
      }
      rec.tool("validate_letter", `${rendered.issues.length === 0 ? "Every citation and number checked out" : `${rendered.issues.length} problem${rendered.issues.length === 1 ? "" : "s"} turned into questions`}; ${rendered.wordCount} words`, Date.now() - t);
      const sectionIds = rendered.sections.map(() => store.newId("sec"));
      await store.replaceLetter(applicationId, {
        requirements: [
          { title: "Letter of inquiry, about one page", kind: "section", detail: "Six short paragraphs: the request, who you are, the need, the plan, the fit, and a close.", wordLimit: 500, required: true, order: 1, satisfied: true },
          { title: "Every claim cites a confirmed fact", kind: "format", detail: "Citations are checked in code after drafting.", wordLimit: null, required: true, order: 2, satisfied: rendered.issues.length === 0 },
          { title: li.ctx.funder.type === "federal" ? "Read the full notice before applying" : "Read the funder's own guidelines before applying", kind: "eligibility", detail: li.ctx.funder.type === "federal" ? `The letter is based on the Grants.gov notice. Read the agency's own guidelines at ${li.ctx.opportunity.guidelinesUrl}` : `The letter is based on what this foundation filed with the IRS. Check its current guidelines at ${li.ctx.opportunity.guidelinesUrl}`, wordLimit: null, required: true, order: 3, satisfied: false },
        ],
        sections: rendered.sections.map((s, i) => ({ id: sectionIds[i], title: s.title, bodyHtml: s.bodyHtml, wordLimit: s.wordLimit, status: s.status, order: s.order })),
        missingFacts: rendered.missingFacts.map((m) => ({ id: m.gapId, sectionId: sectionIds[m.sectionOrder - 1], question: m.question, whyItMatters: m.whyItMatters, suggestedLabel: m.suggestedLabel, status: "open", answer: null, gapKey: m.gapKey })),
        checks: rendered.checks.map((c) => ({ rule: c.rule, status: c.status, detail: c.detail, sectionId: c.sectionOrder ? sectionIds[c.sectionOrder - 1] : null })),
      });
      await store.updateApplication(applicationId, { stage: "drafting" });
      const open = rendered.missingFacts.length;
      await store.addInboxItem({ agent: "proposal", type: "proposal_draft", title: `Letter of inquiry for ${li.ctx.funder.name}`, summary: `${rendered.wordCount} words in ${rendered.sections.length} paragraphs, every claim cited.${open ? ` ${open} question${open === 1 ? "" : "s"} for you.` : ""}`, payload: { type: "proposal_draft", applicationId, sectionCount: rendered.sections.length, openQuestions: open }, priority: "high", sourceCount: rec.sources.length, agentRunId: null });
      if (open) await store.addInboxItem({ agent: "proposal", type: "missing_facts", title: `${open} question${open === 1 ? "" : "s"} before the ${li.ctx.funder.name} letter is done`, summary: rendered.missingFacts.map((m) => m.question).slice(0, 2).join(" "), payload: { type: "missing_facts", applicationId, missingFactIds: rendered.missingFacts.map((m) => m.gapId) }, priority: "normal", sourceCount: 0, agentRunId: null });
      return { output: { sectionCount: rendered.sections.length, openQuestions: open, issues: rendered.issues.length, wordCount: rendered.wordCount }, summary: `Drafted a ${rendered.wordCount}-word letter in ${rendered.sections.length} paragraphs from ${li.facts.length} confirmed facts.${open ? ` ${open} question${open === 1 ? "" : "s"} for you before it is complete.` : " Nothing is waiting on you."}` };
    });
    return { ok: true, data: { ...output, runId: run.id } };
  } catch (err) {
    return fail(err);
  }
}

// ---------- 5. Answer a question and redraft its paragraph ----------

function recomputeChecks(sectionsHtml: string[], openQuestions: number, letter = true): RenderedCheck[] {
  const all = sectionsHtml.join("\n");
  const unverified = (all.match(/data-label="Unverified claim"/g) ?? []).length;
  const unsupported = (all.match(/data-label="Confirm /g) ?? []).length;
  const words = sectionsHtml.reduce((n, h) => n + wordCount(h.replace(/<[^>]+>/g, " ")), 0);
  return [
    { rule: "Every claim about you cites a confirmed fact", status: unverified ? "fail" : "pass", detail: unverified ? `${unverified} claim${unverified === 1 ? "" : "s"} still marked as unverified.` : "Every citation points to a fact you confirmed.", sectionOrder: null },
    { rule: "Every number appears in a cited fact or the notice", status: unsupported ? "fail" : "pass", detail: unsupported ? `${unsupported} number${unsupported === 1 ? "" : "s"} still waiting on a source.` : "Every number traces to a source.", sectionOrder: null },
    ...(letter ? [{ rule: "About one page", status: (words <= 500 ? "pass" : "warn") as RenderedCheck["status"], detail: `Currently ${words} words. One page is about 450.`, sectionOrder: null }] : []),
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
    const appCtx = await store.getApplication(mf.applicationId);
    const mode = appCtx?.application.mode ?? "letter";
    const isLetter = mode === "letter";
    // Bids, research proposals, and essays put the answer in place and cite it; their checks and matrix are recomputed, not the letter's.
    if (mode === "bid" || mode === "sf330" || mode === "research" || mode === "essay") {
      if (section) {
        const html = section.bodyHtml.replace(new RegExp(`<span data-gap="${mf.id}"[^>]*></span>`), `${answer.trim().replace(/&/g, "&amp;").replace(/</g, "&lt;")}<span data-citation="${fact.id}" data-label="You"></span>`);
        await store.updateSection(section.id, { bodyHtml: html, status: gapIdsIn(html).length ? "needs_facts" : "drafted" });
      }
      if (mode === "bid" || mode === "sf330") {
        const [{ refreshMatrix }, { memoryBidStore }] = await Promise.all([import("@/lib/bids/run"), import("@/lib/bids/memory-store")]);
        const bidStore = "firmRecords" in store ? (store as unknown as import("@/lib/bids/store").BidStore) : store.orgId === memoryBidStore.orgId ? memoryBidStore : null;
        if (bidStore) await refreshMatrix(bidStore, mf.applicationId);
      }
      return { ok: true, data: { factId: fact.id, redrafted: false, note: "Saved, placed in the draft, and cited to you." } };
    }
    if (!section) {
      await store.replaceChecks(mf.applicationId, recomputeChecks(sections.map((s) => s.bodyHtml), open, isLetter).map((c) => ({ rule: c.rule, status: c.status, detail: c.detail, sectionId: null })));
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
