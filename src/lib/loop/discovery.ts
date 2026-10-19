import { getAi, type JsonSchema, type TokenUsage } from "@/lib/ai";
import * as gg from "@/lib/grantsgov";
import type { EligibilityCheck, Fact, Funder, Opportunity, Organization, SourceUsed, ToolCall } from "@/lib/types";
import { contains, truncate } from "./text";
import type { JobEvent } from "./progress";

/**
 * Discovery against Grants.gov.
 *
 *  1. plan     (lite)      A few focused keyword searches and funding categories from the confirmed profile.
 *  2. search   (Grants.gov) Posted and forecasted notices that 501(c)(3) nonprofits may apply for.
 *  3. triage   (lite)      From the titles alone, pick the handful worth reading in full.
 *  4. details  (Grants.gov) Fetch each candidate, drop closed and ineligible ones in code.
 *  5. score    (standard)  Fit 0 to 100 with reasons tied to a fact ID and a line of the notice.
 *
 * Code checks every reason: the fact ID must be a confirmed fact and the quoted
 * line must appear in the notice. Reasons that fail are dropped; a match with no
 * surviving reason is dropped too.
 */
export interface Dismissal {
  title: string;
  reason: string;
}

export interface DiscoveryInput {
  org: Organization;
  facts: Fact[];
  /** Notices the user set aside before, with their reasons, so similar ones score lower. */
  dismissed?: Dismissal[];
  /** Fetch this many full notices at most. Each one costs a second of throttle. */
  maxDetails?: number;
  /** Called as each stage finishes, with a short note for the progress screen. */
  onStage?: (stage: "plan" | "search" | "read" | "score", detail: string) => void;
  /** Called for each search, notice, and score, for the live feed. */
  onEvent?: (event: Omit<JobEvent, "id">) => void;
}

export interface ScoredMatch {
  opportunity: Opportunity;
  funder: Funder;
  fitScore: number;
  reasons: string[];
  cautions: string[];
  eligibilityChecks: EligibilityCheck[];
  /** The notice text the score was based on, for the letter writer. */
  noticeText: string;
}

export interface DiscoveryResult {
  matches: ScoredMatch[];
  searches: { keyword: string; fundingCategories: string[]; hits: number; fromCache: boolean }[];
  screened: number;
  read: number;
  droppedIneligible: number;
  droppedUnsupported: number;
  tools: ToolCall[];
  sources: SourceUsed[];
  usage: TokenUsage;
  costUsd: number;
  models: string[];
  durationMs: number;
}

const planSchema: JsonSchema = {
  type: "object",
  properties: {
    searches: {
      type: "array",
      minItems: 2,
      maxItems: 4,
      items: {
        type: "object",
        properties: {
          keyword: { type: "string", description: "One to three words naming a program type or population, e.g. 'youth mentoring', 'food bank', 'rural health clinic'. No boolean operators." },
          fundingCategories: { type: "array", items: { type: "string", enum: Object.keys(gg.FUNDING_CATEGORIES) }, description: "Zero to two Grants.gov funding category codes that fit this search." },
        },
        required: ["keyword", "fundingCategories"],
      },
    },
  },
  required: ["searches"],
};

const triageSchema: JsonSchema = {
  type: "object",
  properties: {
    keep: {
      type: "array",
      maxItems: 14,
      items: { type: "object", properties: { id: { type: "string" }, why: { type: "string" } }, required: ["id", "why"] },
      description: "Notices worth reading in full, best first.",
    },
  },
  required: ["keep"],
};

const scoreSchema: JsonSchema = {
  type: "object",
  properties: {
    scores: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: "string", description: "The notice id exactly as given." },
          eligible: { type: "boolean", description: "False if the notice clearly excludes an organization like this one (wrong applicant type, wrong geography, requires a hospital or university, and so on)." },
          ineligibleReason: { type: "string", description: "One sentence if eligible is false, quoting the notice. Empty otherwise." },
          fitScore: { type: "integer", minimum: 0, maximum: 100 },
          reasons: {
            type: "array",
            minItems: 0,
            maxItems: 3,
            items: {
              type: "object",
              properties: {
                text: { type: "string", description: "One plain sentence a nonprofit director would understand, naming the fact and the line of the notice it matches." },
                factId: { type: "string", description: "The id of the profile fact this reason relies on." },
                noticeQuote: { type: "string", description: "A short phrase, at most 120 characters, copied verbatim from the notice text." },
              },
              required: ["text", "factId", "noticeQuote"],
            },
          },
          cautions: { type: "array", maxItems: 3, items: { type: "string" }, description: "Things worth knowing before applying: match requirements, scale, competition, forecast status." },
        },
        required: ["id", "eligible", "ineligibleReason", "fitScore", "reasons", "cautions"],
      },
    },
  },
  required: ["scores"],
};

function profileSummary(org: Organization, facts: Fact[]): string {
  const lines = [
    `Organization: ${org.name}`,
    org.mission ? `Mission: ${org.mission}` : "",
    org.causes.length ? `Causes: ${org.causes.join(", ")}` : "",
    org.populations.length ? `Populations served: ${org.populations.join(", ")}` : "",
    org.serviceArea || org.city || org.state ? `Geography: ${[org.serviceArea, org.city, org.state].filter(Boolean).join(", ")}` : "",
    org.annualBudget ? `Annual budget: $${org.annualBudget.toLocaleString("en-US")}` : "",
    org.foundedYear ? `Founded: ${org.foundedYear}` : "",
    "",
    "Confirmed facts (cite by id):",
    ...facts.map((f) => `- [${f.id}] ${f.label}: ${f.value}`),
  ];
  return lines.filter((l) => l !== "").join("\n");
}

/** Notices a small community nonprofit almost never wins: research mechanisms and embassy program statements. Demoted, not dropped. */
const TITLE_NOISE = /\b(R0[13]|R2[01]|R3[45]|U0[1-9]|U1[0-9]|U2[0-9]|U54|P[0-9]0|K[0-9]{2}|T32|F3[0-2]|SBIR|STTR)\b|clinical trial|U\.S\. (Mission|Embassy)|Annual Program Statement|Biennale|Investigator Award|Research Centers?\b|Fellowship Program/i;

/** Rank hits before the title triage so the strongest candidates are the ones the model reads. */
export function preRank(hits: gg.SearchHit[], searches: { keyword: string }[], org: Organization): gg.SearchHit[] {
  const terms = new Set<string>();
  const add = (s: string) => {
    for (const w of s.toLowerCase().split(/[^a-z0-9]+/)) if (w.length >= 4 && !STOP.has(w)) terms.add(w);
  };
  for (const s of searches) add(s.keyword);
  for (const c of org.causes) add(c);
  for (const p of org.populations) add(p);
  const score = (h: gg.SearchHit) => {
    const title = h.title.toLowerCase();
    let n = 0;
    for (const t of terms) if (title.includes(t)) n += 3;
    if (h.oppStatus === "posted") n += 2;
    if (TITLE_NOISE.test(h.title)) n -= 6;
    if (/\b(community|youth|nonprofit|local|rural|neighborhood|education|food|arts|health)\b/i.test(h.title)) n += 1;
    return n;
  };
  return [...hits].map((h) => ({ h, s: score(h) })).sort((a, b) => b.s - a.s).map((x) => x.h);
}
const STOP = new Set(["with", "from", "that", "this", "their", "program", "programs", "grant", "grants", "time", "project", "projects", "services", "service", "development", "support", "people", "families", "children", "adults"]);

function parseUsDate(s: string): string | null {
  const m = s?.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  return m ? `${m[3]}-${m[1]}-${m[2]}` : null;
}

export async function runDiscovery(input: DiscoveryInput): Promise<DiscoveryResult> {
  const ai = getAi();
  const started = Date.now();
  const tools: ToolCall[] = [];
  const sources: SourceUsed[] = [];
  const usage: TokenUsage = { inputTokens: 0, outputTokens: 0, thoughtTokens: 0 };
  const models = new Set<string>();
  let costUsd = 0;
  const today = new Date().toISOString().slice(0, 10);
  const staleBefore = new Date(Date.now() - 548 * 24 * 3600 * 1000).toISOString().slice(0, 10); // forecasts untouched for 18 months
  const summary = profileSummary(input.org, input.facts);
  const tally = (r: { usage: TokenUsage; costUsd: number; model: string }) => {
    usage.inputTokens += r.usage.inputTokens;
    usage.outputTokens += r.usage.outputTokens;
    usage.thoughtTokens += r.usage.thoughtTokens;
    costUsd += r.costUsd;
    models.add(r.model);
  };

  // 1. Plan searches.
  let t = Date.now();
  const plan = await ai.generateJson<{ searches: { keyword: string; fundingCategories: string[] }[] }>({
    tier: "lite",
    label: "plan_searches",
    system:
      "You plan keyword searches on Grants.gov for a small US nonprofit. Grants.gov matches ANY of the words you give and ranks poorly, so every word must be specific on its own: 'mentoring', 'pantry', 'hunger', 'afterschool', 'literacy', 'folklife', 'telehealth'. Never use common words like 'time', 'program', 'community', 'support', 'youth development'. One or two specific words per search. Return two to four searches that together cover the organization's programs.",
    prompt: `${summary}\n\nFunding category codes: ${Object.entries(gg.FUNDING_CATEGORIES)
      .map(([k, v]) => `${k}=${v}`)
      .join(", ")}`,
    schema: planSchema,
    maxOutputTokens: 1024,
  });
  tally(plan);
  const searches = plan.data.searches.slice(0, 4).map((s) => ({ keyword: s.keyword.trim().slice(0, 60), fundingCategories: (s.fundingCategories ?? []).filter((c) => c in gg.FUNDING_CATEGORIES).slice(0, 2) }));
  tools.push({ name: "plan_searches", summary: searches.map((s) => `"${s.keyword}"`).join(", "), durationMs: Date.now() - t });
  input.onStage?.("plan", searches.map((s) => s.keyword).join(", "));

  // 2. Search. One status filter: open or announced. One eligibility filter: 501(c)(3) nonprofits.
  t = Date.now();
  const hits = new Map<string, gg.SearchHit>();
  const searchLog: DiscoveryResult["searches"] = [];
  for (const s of searches) {
    const { result, fromCache } = await gg.search({ keyword: s.keyword, oppStatuses: "forecasted|posted", eligibilities: gg.ELIGIBILITY.nonprofit501c3, fundingCategories: s.fundingCategories.join("|"), rows: 50 });
    searchLog.push({ keyword: s.keyword, fundingCategories: s.fundingCategories, hits: result.hitCount, fromCache });
    input.onEvent?.({ kind: "search", text: `Searched Grants.gov for "${s.keyword}"${s.fundingCategories.length ? ` in ${s.fundingCategories.map((c) => gg.FUNDING_CATEGORIES[c] ?? c).join(" and ")}` : ""}`, detail: `${result.hitCount.toLocaleString("en-US")} notice${result.hitCount === 1 ? "" : "s"} open to 501(c)(3) nonprofits` });
    for (const h of result.oppHits) if (!hits.has(h.id)) hits.set(h.id, h);
  }
  const screened = hits.size;
  // Drop what code can already rule out: closed, or a forecast nobody has touched in 18 months.
  const live = [...hits.values()].filter((h) => {
    const close = parseUsDate(h.closeDate);
    if (close && close < today) return false;
    const open = parseUsDate(h.openDate);
    if (h.oppStatus === "forecasted" && open && open < staleBefore) return false;
    return true;
  });
  tools.push({ name: "search_opportunities", summary: `${screened} notices from ${searches.length} searches, ${live.length} still open`, durationMs: Date.now() - t });
  input.onStage?.("search", `${screened} notices, ${live.length} still open`);
  sources.push({ label: "Grants.gov search", url: "https://www.grants.gov/search-grants", documentId: null, kind: "database" });
  if (!live.length) {
    return { matches: [], searches: searchLog, screened, read: 0, droppedIneligible: 0, droppedUnsupported: 0, tools, sources, usage, costUsd, models: [...models], durationMs: Date.now() - started };
  }

  // 3. Triage by title.
  t = Date.now();
  const maxDetails = input.maxDetails ?? 12;
  const ranked = preRank(live, searches, input.org);
  const titleList = ranked
    .slice(0, 100)
    .map((h) => `${h.id} | ${h.oppStatus}${h.closeDate ? ` | closes ${h.closeDate}` : ""} | ${h.agency} | ${h.title}`)
    .join("\n");
  const triage = await ai.generateJson<{ keep: { id: string; why: string }[] }>({
    tier: "lite",
    label: "triage_titles",
    system: `You screen federal funding notices for a small nonprofit. From titles alone, keep the ones this organization could realistically apply for and deliver. Drop research grants meant for universities or hospitals, notices for governments or tribes only, foreign-country notices, and anything far from the organization's work. Keep at most ${maxDetails}, best first.`,
    prompt: `${summary}\n\nNotices (id | status | close | agency | title):\n${titleList}`,
    schema: triageSchema,
    maxOutputTokens: 2048,
  });
  tally(triage);
  const keepIds = triage.data.keep.map((k) => k.id).filter((id) => hits.has(id)).slice(0, maxDetails);
  input.onEvent?.({ kind: "note", text: `Kept ${keepIds.length} of ${live.length} open notices to read in full`, detail: "Research grants for universities, notices for governments only, and work far from yours were set aside by title." });
  tools.push({ name: "triage_titles", summary: `${keepIds.length} of ${live.length} worth reading in full`, durationMs: Date.now() - t });

  // 4. Fetch details, throttled, and apply the hard filters in code.
  t = Date.now();
  const candidates: { id: string; detail: gg.OpportunityDetail; text: string }[] = [];
  let droppedIneligible = 0;
  for (const id of keepIds) {
    try {
      const { detail } = await gg.fetchOpportunity(id);
      if (!gg.isStillOpen(detail, today) || !gg.nonprofitMayApply(detail)) {
        droppedIneligible++;
        input.onEvent?.({ kind: "dropped", text: detail.opportunityTitle, detail: !gg.isStillOpen(detail, today) ? "Set aside: it has closed." : "Set aside: nonprofits are not among the eligible applicants." });
        continue;
      }
      input.onEvent?.({ kind: "notice", text: detail.opportunityTitle, detail: `${gg.notice(detail)?.agencyName ?? detail.owningAgencyCode}${gg.deadlineOf(detail) ? `, due ${gg.deadlineOf(detail)}` : ""}`, url: gg.opportunityPageUrl(id) });
      candidates.push({ id, detail, text: gg.opportunityText(detail, 2_600) });
      sources.push({ label: truncate(detail.opportunityTitle, 80), url: gg.opportunityPageUrl(id), documentId: null, kind: "web" });
    } catch {
      // A single bad fetch should not sink the run.
    }
  }
  tools.push({ name: "fetch_opportunity", summary: `${candidates.length} notices read, ${droppedIneligible} closed or not open to nonprofits`, durationMs: Date.now() - t });
  input.onStage?.("read", `${candidates.length} read in full`);
  if (!candidates.length) {
    return { matches: [], searches: searchLog, screened, read: keepIds.length, droppedIneligible, droppedUnsupported: 0, tools, sources, usage, costUsd, models: [...models], durationMs: Date.now() - started };
  }

  // 5. Score.
  t = Date.now();
  const scoredOut = await scoreNotices({ candidates, org: input.org, facts: input.facts, dismissed: input.dismissed ?? [] });
  for (const m of [...scoredOut.matches].sort((a, b) => b.fitScore - a.fitScore)) input.onEvent?.({ kind: "score", text: m.opportunity.title, score: m.fitScore, detail: m.reasons[0] });
  for (const d of scoredOut.dropped) input.onEvent?.({ kind: "dropped", text: d.title, detail: `Set aside: ${d.reason}` });
  tally(scoredOut);
  const matches = scoredOut.matches;
  droppedIneligible += scoredOut.droppedIneligible;
  const droppedUnsupported = scoredOut.droppedUnsupported;
  matches.sort((a, b) => b.fitScore - a.fitScore);
  tools.push({ name: "score_fit", summary: `${candidates.length} scored, ${matches.length} kept, ${droppedUnsupported} dropped for reasons we could not verify`, durationMs: Date.now() - t });

  return { matches, searches: searchLog, screened, read: keepIds.length, droppedIneligible, droppedUnsupported, tools, sources, usage, costUsd, models: [...models], durationMs: Date.now() - started };
}

export interface ScoreInput {
  candidates: { id: string; detail: gg.OpportunityDetail; text: string }[];
  org: Organization;
  facts: Fact[];
  dismissed: Dismissal[];
}

/** One model call scores every candidate; code checks each reason before it can be shown. */
export async function scoreNotices(input: ScoreInput): Promise<{ matches: ScoredMatch[]; dropped: { title: string; reason: string }[]; droppedIneligible: number; droppedUnsupported: number; usage: TokenUsage; costUsd: number; model: string }> {
  const ai = getAi();
  const { candidates } = input;
  const summary = profileSummary(input.org, input.facts);
  const dismissedNote = input.dismissed.length
    ? `\n\nThe director set these aside before, with reasons. Score anything with the same problem low and say why in a caution:\n${input.dismissed.map((d) => `- "${d.title}": ${d.reason}`).join("\n")}`
    : "";
  const scored = await ai.generateJson<{ scores: { id: string; eligible: boolean; ineligibleReason: string; fitScore: number; reasons: { text: string; factId: string; noticeQuote: string }[]; cautions: string[] }[] }>({
    tier: "standard",
    label: "score_fit",
    system: `You are a careful grants researcher for a small nonprofit. Score each notice from 0 to 100 for how well this organization fits: mission and program match, population, geography, the size of award versus the organization's budget, and whether a small nonprofit can realistically win and manage it.

Rules:
- Each reason must cite one fact id from the profile and quote a short phrase from the notice text verbatim in noticeQuote. If you cannot tie a reason to both, do not give it.
- Mark eligible=false only when the notice itself rules this organization out, and quote the line.
- Be honest. 80 or more means a strong fit a director should act on. 65 to 79 is good. Under 50 means probably not worth the hours.
- Never invent deadlines, amounts, or facts. Everything comes from the profile or the notice.`,
    prompt: `${summary}${dismissedNote}\n\n${candidates.map((c) => `=== NOTICE id=${c.id} ===\n${c.text}`).join("\n\n")}`,
    schema: scoreSchema,
    maxOutputTokens: 8192,
  });
  const factIds = new Set(input.facts.map((f) => f.id));
  const checkedAt = new Date().toISOString();
  const matches: ScoredMatch[] = [];
  const dropped: { title: string; reason: string }[] = [];
  let droppedIneligible = 0;
  let droppedUnsupported = 0;
  for (const s of scored.data.scores) {
    const c = candidates.find((x) => x.id === String(s.id));
    if (!c) continue;
    if (!s.eligible) {
      droppedIneligible++;
      dropped.push({ title: c.detail.opportunityTitle, reason: s.ineligibleReason?.trim() || "the notice rules out an organization like yours." });
      continue;
    }
    const reasons = (s.reasons ?? []).filter((r) => factIds.has(r.factId) && r.noticeQuote && contains(c.text, r.noticeQuote)).map((r) => r.text.trim());
    if (!reasons.length) {
      droppedUnsupported++;
      dropped.push({ title: c.detail.opportunityTitle, reason: "no reason could be tied to one of your facts and a line of the notice." });
      continue;
    }
    const { opportunity, funder } = gg.toOpportunity(c.detail, checkedAt);
    const n = gg.notice(c.detail);
    const types = n?.applicantTypes ?? [];
    const eligibilityChecks: EligibilityCheck[] = [
      {
        label: "501(c)(3) nonprofits may apply",
        passed: types.some((x) => x.id === gg.ELIGIBILITY.nonprofit501c3),
        detail: types.some((x) => x.id === gg.ELIGIBILITY.nonprofit501c3) ? "Listed under eligible applicant types on Grants.gov." : "Not listed by name. The notice says to read its additional eligibility information.",
      },
      {
        label: opportunity.forecasted ? "Not open yet" : "Still open",
        passed: !opportunity.forecasted,
        detail: opportunity.forecasted ? `Forecasted. ${opportunity.deadline ? `Estimated due date ${opportunity.deadline}.` : "No date yet."}` : opportunity.deadline ? `Applications due ${opportunity.deadline}.` : "No deadline posted.",
      },
    ];
    if (n?.applicantEligibilityDesc) eligibilityChecks.push({ label: "Agency's own eligibility note", passed: false, detail: truncate(n.applicantEligibilityDesc.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim(), 220) });
    matches.push({ opportunity, funder, fitScore: Math.max(0, Math.min(100, Math.round(s.fitScore))), reasons: reasons.slice(0, 3), cautions: (s.cautions ?? []).map((x) => x.trim()).filter(Boolean).slice(0, 3), eligibilityChecks, noticeText: c.text });
  }
  return { matches, dropped, droppedIneligible, droppedUnsupported, usage: scored.usage, costUsd: scored.costUsd, model: scored.model };
}
