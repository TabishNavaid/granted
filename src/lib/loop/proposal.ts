import { getAi, type JsonSchema, type TokenUsage } from "@/lib/ai";
import type { Fact, Organization, Requirement } from "@/lib/types";
import { renderParagraph, type LetterGap, type RenderOptions, type RenderedParagraph } from "./letter";
import { truncate } from "./text";

/**
 * Full proposal mode. The funder's guidelines (or the notice when there are
 * none) become a requirements checklist; each narrative requirement becomes a
 * section drafted with the same [[fact:ID]] and [[gap:KEY]] marks the letter
 * uses, so the same code validates every claim and number.
 */
export interface ParsedRequirement extends Pick<Requirement, "title" | "kind" | "detail" | "wordLimit" | "required"> {
  /** What the funder wants to read in this section, in one or two sentences. */
  prompt: string;
}

const reqSchema: JsonSchema = {
  type: "object",
  properties: {
    requirements: {
      type: "array",
      maxItems: 16,
      items: {
        type: "object",
        properties: {
          title: { type: "string" },
          kind: { type: "string", enum: ["section", "attachment", "format", "eligibility"] },
          detail: { type: "string", description: "What the funder asks for, in the funder's words where possible." },
          wordLimit: { type: "integer", nullable: true, description: "Word limit if the guidelines state one, else null. Convert a page limit at 450 words a page and say so in detail." },
          required: { type: "boolean" },
          prompt: { type: "string", description: "For sections: what this section must cover, one or two sentences. Empty for other kinds." },
        },
        required: ["title", "kind", "detail", "wordLimit", "required", "prompt"],
      },
    },
  },
  required: ["requirements"],
};

export async function parseGuidelines(input: { guidelinesText: string; noticeText: string }): Promise<{ requirements: ParsedRequirement[]; usage: TokenUsage; costUsd: number; model: string }> {
  const ai = getAi();
  const res = await ai.generateJson<{ requirements: ParsedRequirement[] }>({
    tier: "lite",
    label: "parse_requirements",
    system: `You turn a funder's application guidelines into a checklist for a small nonprofit. List every narrative section they ask for (kind "section"), every attachment ("attachment"), every formatting rule such as page or word limits and fonts ("format"), and every eligibility condition ("eligibility"). Use the funder's own section names. If the guidelines are thin, fall back to the standard federal narrative: Organization background, Statement of need, Project description, Goals and objectives, Evaluation, Budget narrative, Sustainability. Never invent a limit; use null.`,
    prompt: `Guidelines:\n${input.guidelinesText || "(none fetched)"}\n\nNotice:\n${input.noticeText}`,
    schema: reqSchema,
    maxOutputTokens: 4096,
  });
  const requirements = (res.data.requirements ?? [])
    .map((r) => ({ title: truncate((r.title ?? "").trim(), 90), kind: r.kind, detail: (r.detail ?? "").trim() || null, wordLimit: r.wordLimit && r.wordLimit > 0 ? Math.round(r.wordLimit) : null, required: r.required !== false, prompt: (r.prompt ?? "").trim() }))
    .filter((r) => r.title);
  return { requirements, usage: res.usage, costUsd: res.costUsd, model: res.model };
}

export interface ProposalDraftInput {
  org: Organization;
  facts: Fact[];
  userName: string;
  funderName: string;
  opportunityTitle: string;
  noticeText: string;
  guidelinesText: string;
  sections: { key: string; title: string; prompt: string; wordLimit: number | null }[];
  boilerplate: { title: string; body: string }[];
  askAmount: number | null;
}

const draftSchema: JsonSchema = {
  type: "object",
  properties: {
    sections: {
      type: "array",
      items: {
        type: "object",
        properties: {
          key: { type: "string" },
          text: { type: "string", description: "Paragraphs separated by a blank line. [[fact:ID]] after each claim about the organization; [[gap:KEY]] in place of any fact you do not have. Lists may use lines starting with '- '." },
        },
        required: ["key", "text"],
      },
    },
    gaps: {
      type: "array",
      maxItems: 12,
      items: {
        type: "object",
        properties: { key: { type: "string" }, sectionKey: { type: "string" }, question: { type: "string" }, whyItMatters: { type: "string" }, suggestedLabel: { type: "string" } },
        required: ["key", "sectionKey", "question", "whyItMatters", "suggestedLabel"],
      },
    },
  },
  required: ["sections", "gaps"],
};

const SYSTEM = `You write grant proposals for small nonprofits. The proposal must be true. You may use only: the confirmed facts listed (cite each by id), the organization's own boilerplate paragraphs (treat their claims as needing a fact citation too, and if no fact covers a claim, leave a gap), and the funder's notice and guidelines (quote or paraphrase, no citation needed).

Rules:
- After every claim about the organization, add [[fact:ID]]. Never write a number about the organization that is not in a cited fact; write [[gap:KEY]] instead and list the gap.
- Numbers from the notice (award ceiling, deadline) may be used as written. The ask amount, if given, may be used as written.
- Answer what each section's prompt asks, within its word limit when there is one. Plain, specific, active. No em dashes, no exclamation marks. Use digits for numbers.`;

export async function draftProposalSections(input: ProposalDraftInput): Promise<{ sections: { key: string; text: string }[]; gaps: LetterGap[]; usage: TokenUsage; costUsd: number; model: string }> {
  const ai = getAi();
  const org = input.org;
  const prompt = [
    `Organization: ${org.name}`,
    org.mission ? `Mission: ${org.mission}` : "",
    org.serviceArea || org.city || org.state ? `Geography: ${[org.serviceArea, org.city, org.state].filter(Boolean).join(", ")}` : "",
    input.askAmount ? `Ask amount: $${input.askAmount.toLocaleString("en-US")}` : "Ask amount: not decided; leave a gap where it is needed.",
    `Signed by: ${input.userName}`,
    "",
    "Confirmed facts:",
    input.facts.map((f) => `- [${f.id}] ${f.label}: ${f.value}  (source says: "${f.sourceExcerpt}")`).join("\n") || "- (none)",
    "",
    input.boilerplate.length ? `Boilerplate the organization wrote (claims still need a fact citation):\n${input.boilerplate.map((b) => `## ${b.title}\n${b.body}`).join("\n\n")}` : "",
    "",
    `Funder: ${input.funderName}`,
    `Opportunity: ${input.opportunityTitle}`,
    "Notice text:",
    input.noticeText,
    "",
    input.guidelinesText ? `Guidelines:\n${truncate(input.guidelinesText, 12_000)}` : "",
    "",
    "Sections to write, in order:",
    input.sections.map((s) => `- key=${s.key} | ${s.title}${s.wordLimit ? ` (at most ${s.wordLimit} words)` : ""}: ${s.prompt}`).join("\n"),
  ]
    .filter((l) => l !== "")
    .join("\n");
  const res = await ai.generateJson<{ sections: { key: string; text: string }[]; gaps: (LetterGap & { sectionKey: string })[] }>({ tier: "standard", label: "draft_proposal", system: SYSTEM, prompt, schema: draftSchema, maxOutputTokens: 16384 });
  const sections = input.sections.map((s) => ({ key: s.key, text: (res.data.sections ?? []).find((x) => x.key === s.key)?.text?.trim() ?? "" }));
  const gaps: LetterGap[] = (res.data.gaps ?? [])
    .filter((g) => g.key)
    .map((g) => ({ key: g.key.trim().replace(/[^\w-]+/g, "_"), paragraphKey: "plan", question: (g.question ?? "").trim(), whyItMatters: (g.whyItMatters ?? "").trim(), suggestedLabel: (g.suggestedLabel ?? "").trim() || "Missing fact" }));
  return { sections, gaps, usage: res.usage, costUsd: res.costUsd, model: res.model };
}

/** Multi-paragraph section text to HTML with the same checks as the letter. Lines starting with "- " become a list. */
export function renderSectionText(text: string, heading: string, declaredGaps: LetterGap[], opts: RenderOptions): RenderedParagraph {
  const blocks = text.split(/\n\s*\n/).map((b) => b.trim()).filter(Boolean);
  const out: RenderedParagraph = { html: "", words: 0, citedFactIds: [], gaps: [], issues: [] };
  for (const block of blocks) {
    const lines = block.split("\n");
    const isList = lines.every((l) => /^[-*]\s+/.test(l));
    if (isList) {
      const items = lines.map((l) => renderParagraph({ key: "plan", heading, text: l.replace(/^[-*]\s+/, "") }, declaredGaps, opts));
      out.html += `<ul>${items.map((i) => `<li>${i.html.replace(/^<p>|<\/p>$/g, "")}</li>`).join("")}</ul>`;
      for (const i of items) merge(out, i);
    } else {
      const r = renderParagraph({ key: "plan", heading, text: block.replace(/\n/g, " ") }, declaredGaps, opts);
      out.html += r.html;
      merge(out, r);
    }
  }
  return out;
}

function merge(out: RenderedParagraph, r: RenderedParagraph) {
  out.words += r.words;
  for (const id of r.citedFactIds) if (!out.citedFactIds.includes(id)) out.citedFactIds.push(id);
  for (const g of r.gaps) if (!out.gaps.some((x) => x.id === g.id)) out.gaps.push(g);
  out.issues.push(...r.issues);
}
