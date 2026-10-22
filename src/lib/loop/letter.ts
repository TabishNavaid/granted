import { getAi, type JsonSchema, type TokenUsage } from "@/lib/ai";
import type { ComplianceCheck, Fact, Organization, Section, MissingFact } from "@/lib/types";
import { numberKey, numbersIn, wordCount } from "./text";

/**
 * A one-page letter of inquiry written only from confirmed facts and the
 * notice's own text. The model marks each claim with [[fact:ID]] and each
 * missing fact with [[gap:KEY]]. Code then renders the paragraphs to section
 * HTML and checks every citation and every number. Failures become visible
 * gaps and questions, never silent text.
 */
export const PARAGRAPH_KEYS = ["opening", "organization", "need", "plan", "fit", "closing"] as const;
export type ParagraphKey = (typeof PARAGRAPH_KEYS)[number];

export interface LetterParagraph {
  key: ParagraphKey;
  heading: string;
  /** Prose with [[fact:ID]] after each claim about the organization and [[gap:KEY]] where a fact is missing. */
  text: string;
}

export interface LetterGap {
  key: string;
  paragraphKey: ParagraphKey;
  question: string;
  whyItMatters: string;
  suggestedLabel: string;
}

export interface LetterDraft {
  paragraphs: LetterParagraph[];
  gaps: LetterGap[];
}

export interface LetterInput {
  org: Organization;
  facts: Fact[];
  userName: string;
  funderName: string;
  opportunityTitle: string;
  noticeText: string;
  deadline: string | null;
}

export interface RenderedSection extends Pick<Section, "title" | "bodyHtml" | "wordLimit" | "status" | "order"> {
  paragraphKey: ParagraphKey;
}
export interface RenderedMissingFact extends Pick<MissingFact, "question" | "whyItMatters" | "suggestedLabel"> {
  sectionOrder: number;
  gapId: string;
  gapKey: string;
}
export interface RenderedCheck extends Pick<ComplianceCheck, "rule" | "status" | "detail"> {
  sectionOrder: number | null;
}
export interface RenderedLetter {
  sections: RenderedSection[];
  missingFacts: RenderedMissingFact[];
  checks: RenderedCheck[];
  issues: { kind: "unknown_fact" | "unsupported_number" | "unlisted_gap"; paragraph: ParagraphKey; detail: string }[];
  wordCount: number;
}

const HEADINGS: Record<ParagraphKey, string> = {
  opening: "Opening and request",
  organization: "About the organization",
  need: "The need",
  plan: "What we would do",
  fit: "Why this program",
  closing: "Closing",
};

const letterSchema: JsonSchema = {
  type: "object",
  properties: {
    paragraphs: {
      type: "array",
      minItems: 6,
      maxItems: 6,
      items: {
        type: "object",
        properties: {
          key: { type: "string", enum: [...PARAGRAPH_KEYS] },
          heading: { type: "string" },
          text: { type: "string", description: "One paragraph of prose, 50 to 110 words. Marks: [[fact:ID]] right after each claim about the organization; [[gap:KEY]] in place of a fact you do not have." },
        },
        required: ["key", "heading", "text"],
      },
    },
    gaps: {
      type: "array",
      maxItems: 6,
      items: {
        type: "object",
        properties: {
          key: { type: "string", description: "Short snake_case key used in the [[gap:KEY]] mark." },
          paragraphKey: { type: "string", enum: [...PARAGRAPH_KEYS] },
          question: { type: "string", description: "The question to ask the director, in plain words." },
          whyItMatters: { type: "string", description: "One sentence on why the funder will care." },
          suggestedLabel: { type: "string", description: "A label for the fact once answered, e.g. 'Meals served in 2025'." },
        },
        required: ["key", "paragraphKey", "question", "whyItMatters", "suggestedLabel"],
      },
    },
  },
  required: ["paragraphs", "gaps"],
};

const SYSTEM = `You write letters of inquiry for small nonprofits. The letter must be true. You may use only two sources: the confirmed facts listed (cite each by id) and the funding notice text (quote or paraphrase it, no citation needed). Nothing else exists.

Rules:
- After every claim about the organization (what it does, who it serves, numbers, history, staff, results), add [[fact:ID]] using an id from the facts list. A sentence that makes no claim about the organization needs no mark.
- Never write a number about the organization that is not in a cited fact. If you need one (people served, budget, a result), write [[gap:KEY]] in its place and add the gap to the list with a clear question.
- Numbers from the notice (award ceiling, deadline, program name) may be used as written there.
- Do not name a funder contact, a dollar ask, or a program detail you were not given. Ask for a conversation or guidance on the ask amount instead, or leave a gap.
- Plain, warm, specific. No jargon, no em dashes, no exclamation marks. Write "we", signed by the person named.
- Six paragraphs in this order and with these keys: opening, organization, need, plan, fit, closing. About 350 to 450 words in total. Use digits for numbers.`;

function factsList(facts: Fact[]): string {
  return facts.map((f) => `- [${f.id}] ${f.label}: ${f.value}  (source says: "${f.sourceExcerpt}")`).join("\n");
}

function letterPrompt(input: LetterInput): string {
  const org = input.org;
  return [
    `Organization: ${org.name}`,
    org.mission ? `Mission: ${org.mission}` : "",
    org.serviceArea || org.city || org.state ? `Geography: ${[org.serviceArea, org.city, org.state].filter(Boolean).join(", ")}` : "",
    `Signed by: ${input.userName}`,
    "",
    "Confirmed facts:",
    factsList(input.facts) || "- (none yet; every organizational claim must be a gap)",
    "",
    `Funder: ${input.funderName}`,
    `Opportunity: ${input.opportunityTitle}`,
    input.deadline ? `Deadline: ${input.deadline}` : "",
    "",
    "Notice text:",
    input.noticeText,
  ]
    .filter((l) => l !== "")
    .join("\n");
}

export async function draftLetter(input: LetterInput): Promise<{ draft: LetterDraft; usage: TokenUsage; costUsd: number; model: string; durationMs: number }> {
  const ai = getAi();
  const res = await ai.generateJson<LetterDraft>({ tier: "standard", label: "draft_letter", system: SYSTEM, prompt: letterPrompt(input), schema: letterSchema, maxOutputTokens: 8192 });
  const draft = normalizeDraft(res.data);
  return { draft, usage: res.usage, costUsd: res.costUsd, model: res.model, durationMs: res.durationMs };
}

/** Rewrite one paragraph after the director answered a question. Same rules, same marks. */
export async function redraftParagraph(input: LetterInput & { paragraph: LetterParagraph; answered: { gapKey: string; factId: string; label: string; value: string }[] }): Promise<{ paragraph: LetterParagraph; gaps: LetterGap[]; usage: TokenUsage; costUsd: number; model: string; durationMs: number }> {
  const ai = getAi();
  const schema: JsonSchema = {
    type: "object",
    properties: {
      text: { type: "string", description: "The rewritten paragraph with [[fact:ID]] and [[gap:KEY]] marks." },
      gaps: letterSchema.properties!.gaps,
    },
    required: ["text", "gaps"],
  };
  const res = await ai.generateJson<{ text: string; gaps: LetterGap[] }>({
    tier: "standard",
    label: "redraft_paragraph",
    system: SYSTEM,
    prompt: `${letterPrompt(input)}\n\nRewrite only the "${input.paragraph.heading}" paragraph (key: ${input.paragraph.key}). Its current text is:\n${input.paragraph.text}\n\nThe director answered these questions, so each [[gap:KEY]] below now has a confirmed fact to cite instead:\n${input.answered
      .map((a) => `- [[gap:${a.gapKey}]] -> [[fact:${a.factId}]] ${a.label}: ${a.value}`)
      .join("\n")}\n\nKeep the paragraph's meaning and length. Keep every other citation. Leave any gap that was not answered.`,
    schema,
    maxOutputTokens: 2048,
  });
  const paragraph: LetterParagraph = { ...input.paragraph, text: (res.data.text ?? "").trim() };
  return { paragraph, gaps: normalizeDraft({ paragraphs: [paragraph], gaps: res.data.gaps ?? [] }).gaps, usage: res.usage, costUsd: res.costUsd, model: res.model, durationMs: res.durationMs };
}

function normalizeDraft(d: LetterDraft): LetterDraft {
  const byKey = new Map<string, LetterParagraph>();
  for (const p of d.paragraphs ?? []) if (PARAGRAPH_KEYS.includes(p.key)) byKey.set(p.key, { key: p.key, heading: (p.heading ?? "").trim() || HEADINGS[p.key], text: (p.text ?? "").trim() });
  const paragraphs = PARAGRAPH_KEYS.filter((k) => byKey.has(k)).map((k) => byKey.get(k)!);
  const gaps = (d.gaps ?? [])
    .filter((g) => g.key && PARAGRAPH_KEYS.includes(g.paragraphKey))
    .map((g) => ({ key: g.key.trim().replace(/[^\w-]+/g, "_"), paragraphKey: g.paragraphKey, question: (g.question ?? "").trim(), whyItMatters: (g.whyItMatters ?? "").trim(), suggestedLabel: (g.suggestedLabel ?? "").trim() || "Missing fact" }));
  return { paragraphs, gaps };
}

function escapeHtml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export function citeSpan(factId: string, label: string) {
  return `<span data-citation="${escapeHtml(factId)}" data-label="${escapeHtml(label)}"></span>`;
}
export function gapSpan(gapId: string, label: string) {
  return `<span data-gap="${escapeHtml(gapId)}" data-label="${escapeHtml(label)}"></span>`;
}

export interface RenderOptions {
  facts: Fact[];
  /** Text numbers may also come from: the notice. */
  noticeText: string;
  /** Turn a gap key into the id the UI and the store will use. */
  gapId: (key: string) => string;
  factLabel: (f: Fact) => string;
}

export interface RenderedParagraph {
  html: string;
  words: number;
  citedFactIds: string[];
  gaps: { id: string; key: string; label: string; question: string; whyItMatters: string; suggestedLabel: string }[];
  issues: RenderedLetter["issues"];
}

/**
 * Turn one paragraph's marked text into section HTML. Pure code:
 *  - [[fact:ID]] with a confirmed id becomes a citation chip.
 *  - [[fact:ID]] with an unknown id becomes a gap chip and a question.
 *  - [[gap:KEY]] becomes a gap chip; an unlisted key still gets a generic question.
 *  - Any number not found in a cited fact or in the notice is replaced by a gap chip and a question.
 */
export function renderParagraph(p: LetterParagraph, declaredGaps: LetterGap[], opts: RenderOptions): RenderedParagraph {
  const factById = new Map(opts.facts.map((f) => [f.id, f]));
  const issues: RenderedLetter["issues"] = [];
  const gaps: RenderedParagraph["gaps"] = [];
  const cited: string[] = [];
  const addGap = (key: string, label: string, question: string, whyItMatters: string, suggestedLabel: string) => {
    const id = opts.gapId(key);
    if (!gaps.some((g) => g.id === id)) gaps.push({ id, key, label, question, whyItMatters, suggestedLabel });
    return gapSpan(id, label);
  };

  // Split into text and marks so numbers are only checked in prose.
  const parts = p.text.split(/(\[\[(?:fact|gap):[^\]]+\]\])/g);
  // Which facts does this paragraph cite? Numbers may come from any of them.
  for (const part of parts) {
    const m = part.match(/^\[\[fact:([^\]]+)\]\]$/);
    if (m && factById.has(m[1].trim())) cited.push(m[1].trim());
  }
  const allowedNumbers = new Set<string>();
  for (const id of cited) {
    const f = factById.get(id)!;
    for (const n of numbersIn(`${f.value} ${f.sourceExcerpt}`)) allowedNumbers.add(numberKey(n));
  }
  for (const n of numbersIn(opts.noticeText)) allowedNumbers.add(numberKey(n));

  let html = "";
  for (const part of parts) {
    const fact = part.match(/^\[\[fact:([^\]]+)\]\]$/);
    const gap = part.match(/^\[\[gap:([^\]]+)\]\]$/);
    if (fact) {
      const id = fact[1].trim();
      const f = factById.get(id);
      if (f) {
        html += citeSpan(f.id, opts.factLabel(f));
      } else {
        issues.push({ kind: "unknown_fact", paragraph: p.key, detail: `Cited fact "${id}" is not a confirmed fact.` });
        html += addGap(`unverified_${id}`, "Unverified claim", `The draft made a claim here that we could not tie to one of your confirmed facts. What is the right fact to cite, or should we cut the sentence?`, "A reviewer may check it, and we never send a claim without a source.", "Fact to confirm");
      }
      continue;
    }
    if (gap) {
      const key = gap[1].trim();
      const g = declaredGaps.find((x) => x.key === key);
      if (g) html += addGap(key, g.suggestedLabel, g.question, g.whyItMatters, g.suggestedLabel);
      else {
        issues.push({ kind: "unlisted_gap", paragraph: p.key, detail: `Gap "${key}" was marked but not explained.` });
        html += addGap(key, key.replace(/_/g, " "), `The draft needs a fact here: ${key.replace(/_/g, " ")}. What is it?`, "The paragraph cannot be finished without it.", key.replace(/_/g, " "));
      }
      continue;
    }
    // Prose. Check each number.
    let prose = "";
    let last = 0;
    for (const m of part.matchAll(/\$?\d[\d,]*(?:\.\d+)?%?/g)) {
      const tok = m[0].replace(/,$/, "");
      const key = numberKey(tok);
      prose += escapeHtml(part.slice(last, m.index));
      last = (m.index ?? 0) + tok.length;
      if (allowedNumbers.has(key) || !key) {
        prose += escapeHtml(tok);
      } else {
        issues.push({ kind: "unsupported_number", paragraph: p.key, detail: `The number ${tok} is not in any cited fact or in the notice.` });
        prose += addGap(`number_${key}`, `Confirm ${tok}`, `The draft used the number ${tok} in "${p.heading}", but none of your confirmed facts contains it. What is the right figure?`, "Every number in a letter has to trace back to a source you confirmed.", `Figure to confirm (${tok})`);
      }
    }
    prose += escapeHtml(part.slice(last));
    html += prose;
  }
  const words = wordCount(p.text.replace(/\[\[[^\]]+\]\]/g, " "));
  return { html: `<p>${html.trim()}</p>`, words, citedFactIds: [...new Set(cited)], gaps, issues };
}

export function renderLetter(draft: LetterDraft, opts: RenderOptions): RenderedLetter {
  const sections: RenderedSection[] = [];
  const missingFacts: RenderedMissingFact[] = [];
  const issues: RenderedLetter["issues"] = [];
  let total = 0;
  let unverified = 0;
  let unsupported = 0;
  draft.paragraphs.forEach((p, i) => {
    const r = renderParagraph(p, draft.gaps, opts);
    total += r.words;
    issues.push(...r.issues);
    unverified += r.issues.filter((x) => x.kind === "unknown_fact").length;
    unsupported += r.issues.filter((x) => x.kind === "unsupported_number").length;
    sections.push({ paragraphKey: p.key, title: p.heading || HEADINGS[p.key], bodyHtml: r.html, wordLimit: null, status: r.gaps.length ? "needs_facts" : "drafted", order: i + 1 });
    for (const g of r.gaps) missingFacts.push({ question: g.question, whyItMatters: g.whyItMatters, suggestedLabel: g.suggestedLabel, sectionOrder: i + 1, gapId: g.id, gapKey: g.key });
  });
  const checks: RenderedCheck[] = [
    { rule: "Every claim about you cites a confirmed fact", status: unverified ? "fail" : "pass", detail: unverified ? `${unverified} claim${unverified === 1 ? "" : "s"} could not be tied to a fact and ${unverified === 1 ? "is" : "are"} marked as a gap.` : "Every citation points to a fact you confirmed.", sectionOrder: null },
    { rule: "Every number appears in a cited fact or the notice", status: unsupported ? "fail" : "pass", detail: unsupported ? `${unsupported} number${unsupported === 1 ? "" : "s"} had no source and ${unsupported === 1 ? "was" : "were"} replaced with a gap.` : "Every number traces to a source.", sectionOrder: null },
    { rule: "About one page", status: total <= 500 ? "pass" : "warn", detail: `Currently ${total} words. One page is about 450.`, sectionOrder: null },
    { rule: "No open questions", status: missingFacts.length ? "warn" : "pass", detail: missingFacts.length ? `${missingFacts.length} question${missingFacts.length === 1 ? "" : "s"} waiting on you.` : "Nothing is waiting on you.", sectionOrder: null },
  ];
  return { sections, missingFacts, checks, issues, wordCount: total };
}

/** Does the text still contain a chip for this gap? Used after a redraft to decide which questions stay open. */
export function gapIdsIn(html: string): string[] {
  return [...html.matchAll(/data-gap="([^"]+)"/g)].map((m) => m[1]);
}
export function factIdsIn(html: string): string[] {
  return [...html.matchAll(/data-citation="([^"]+)"/g)].map((m) => m[1]);
}

/** Recover the marked text form of a paragraph from stored HTML so it can be redrafted. */
export function htmlToMarkedText(html: string, gapKeyOf: (gapId: string) => string): string {
  return html
    .replace(/<span data-citation="([^"]+)"[^>]*><\/span>/g, (_m, id) => `[[fact:${id}]]`)
    .replace(/<span data-gap="([^"]+)"[^>]*><\/span>/g, (_m, id) => `[[gap:${gapKeyOf(id)}]]`)
    .replace(/<\/p>\s*<p>/g, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .trim();
}

