import { getAi, type JsonSchema, type TokenUsage } from "@/lib/ai";
import type { Fact, Organization } from "@/lib/types";
import { truncate } from "@/lib/loop/text";
import type { ParsedRequirement, SectionKey } from "./rfp";
import type { DraftGap } from "./sections";

/**
 * The two model calls in the bid workflow. Both are optional: the rules
 * reader and the code-written sections stand on their own. In the demo they
 * replay a recorded run for the sample solicitation.
 *
 *  read_rfp   tidies requirement titles and adds requirements the rules
 *             missed; every addition must quote the solicitation exactly.
 *  draft_bid  writes the cover letter, firm qualifications, and approach
 *             from the firm's records, citing each claim.
 */

const readSchema: JsonSchema = {
  type: "object",
  properties: {
    titles: { type: "array", items: { type: "object", properties: { key: { type: "string" }, title: { type: "string" } }, required: ["key", "title"] } },
    added: {
      type: "array",
      maxItems: 20,
      items: {
        type: "object",
        properties: {
          title: { type: "string" },
          quote: { type: "string", description: "The exact sentence from the solicitation, copied character for character." },
          kind: { type: "string", enum: ["section", "attachment", "format", "eligibility", "evaluation", "submission", "form"] },
          sectionKey: { type: "string", enum: ["cover_letter", "qualifications", "projects", "personnel", "approach", "schedule", "quality_safety", "references", "forms", "pricing", "submission"] },
          mandatory: { type: "boolean" },
        },
        required: ["title", "quote", "kind", "sectionKey", "mandatory"],
      },
    },
  },
  required: ["titles", "added"],
};

export async function refineRequirements(input: { title: string; text: string; requirements: ParsedRequirement[] }): Promise<{ titles: Map<string, string>; added: ParsedRequirement[]; usage: TokenUsage; costUsd: number; model: string }> {
  const ai = getAi();
  const res = await ai.generateJson<{ titles: { key: string; title: string }[]; added: { title: string; quote: string; kind: ParsedRequirement["kind"]; sectionKey: SectionKey; mandatory: boolean }[] }>({
    tier: "lite",
    label: "read_rfp",
    system: "You check a compliance matrix an AEC firm built from a solicitation with rules. Give each listed requirement a short title (at most 8 words) in the solicitation's own terms. Then add any requirement the list missed: something the firm must submit, include, sign, meet, or follow. Copy each added requirement's sentence exactly from the solicitation; do not paraphrase it. Do not add the buyer's own obligations. No em dashes.",
    prompt: [`Solicitation: ${input.title}`, "", "Requirements found by rules:", ...input.requirements.map((r) => `- ${r.key} [${r.kind}] ${r.excerpt}`), "", "Solicitation text:", truncate(input.text, 40_000)].join("\n"),
    schema: readSchema,
    maxOutputTokens: 6000,
  });
  const titles = new Map((res.data.titles ?? []).filter((t) => t.key && t.title).map((t) => [t.key, truncate(t.title.trim(), 90)]));
  const flat = input.text.replace(/\s+/g, " ");
  const known = new Set(input.requirements.map((r) => r.excerpt.replace(/\s+/g, " ").toLowerCase()));
  const added: ParsedRequirement[] = [];
  for (const a of res.data.added ?? []) {
    const q = (a.quote ?? "").replace(/\s+/g, " ").trim();
    // An addition the solicitation does not contain word for word is dropped.
    if (q.length < 20 || !flat.includes(q) || known.has(q.toLowerCase())) continue;
    added.push({ key: `m${added.length + 1}`, title: truncate((a.title ?? "").trim() || q.slice(0, 60), 90), kind: a.kind, ref: "Found by the model; search the solicitation for the quote", excerpt: q, mandatory: Boolean(a.mandatory), sectionKey: a.sectionKey });
  }
  return { titles, added, usage: res.usage, costUsd: res.costUsd, model: res.model };
}

const draftSchema: JsonSchema = {
  type: "object",
  properties: {
    sections: { type: "array", items: { type: "object", properties: { key: { type: "string" }, text: { type: "string" } }, required: ["key", "text"] } },
    gaps: { type: "array", maxItems: 12, items: { type: "object", properties: { key: { type: "string" }, sectionKey: { type: "string" }, question: { type: "string" }, whyItMatters: { type: "string" }, suggestedLabel: { type: "string" } }, required: ["key", "sectionKey", "question", "whyItMatters", "suggestedLabel"] } },
  },
  required: ["sections", "gaps"],
};

const SYSTEM = `You write proposals for an architecture, engineering, and construction firm. The proposal must be true. You may use only: the firm's records and confirmed facts listed (cite each by id), and the solicitation (quote or paraphrase it, no citation needed).

Rules:
- After every claim about the firm, its people, or its projects, add [[fact:ID]]. Never write a number about the firm that is not in a cited fact. Where you need something the records do not say, write [[gap:KEY]] and list the gap with a question for the firm.
- Never state a price, fee, rate, or hours. Pricing stays with the firm.
- Answer what each section must do, tied to the solicitation's own requirements and evaluation factors. Plain, specific, confident, no marketing filler. No em dashes, no exclamation marks. Digits for numbers.`;

export async function draftBidSections(input: {
  org: Organization;
  facts: Fact[];
  signer: string;
  title: string;
  issuer: string;
  solicitationSummary: string;
  sections: { key: string; title: string; prompt: string; wordLimit: number | null; requirements: string[] }[];
  evaluation: string[];
  addenda: string[];
}): Promise<{ sections: { key: string; text: string }[]; gaps: DraftGap[]; usage: TokenUsage; costUsd: number; model: string }> {
  const ai = getAi();
  const prompt = [
    `Firm: ${input.org.name}`,
    input.org.city || input.org.state ? `Office: ${[input.org.city, input.org.state].filter(Boolean).join(", ")}` : "",
    `Signed by: ${input.signer}`,
    "",
    "Records and confirmed facts:",
    input.facts.map((f) => `- [${f.id}] ${f.label}: ${f.value}`).join("\n") || "- (none)",
    "",
    `Owner: ${input.issuer}`,
    `Solicitation: ${input.title}`,
    input.solicitationSummary,
    input.evaluation.length ? `Evaluation factors: ${input.evaluation.join("; ")}` : "",
    input.addenda.length ? `Addenda to acknowledge: ${input.addenda.join(", ")}` : "",
    "",
    "Sections to write, in order:",
    input.sections.map((s) => `- key=${s.key} | ${s.title}${s.wordLimit ? ` (at most ${s.wordLimit} words)` : ""}: ${s.prompt}${s.requirements.length ? `\n  The solicitation asks this section to cover:\n${s.requirements.map((r) => `  * ${r}`).join("\n")}` : ""}`).join("\n"),
  ]
    .filter((l) => l !== "")
    .join("\n");
  const res = await ai.generateJson<{ sections: { key: string; text: string }[]; gaps: DraftGap[] }>({ tier: "standard", label: "draft_bid", system: SYSTEM, prompt, schema: draftSchema, maxOutputTokens: 12000 });
  const sections = input.sections.map((s) => ({ key: s.key, text: (res.data.sections ?? []).find((x) => x.key === s.key)?.text?.trim() ?? "" }));
  const gaps = (res.data.gaps ?? []).filter((g) => g.key).map((g) => ({ ...g, key: g.key.trim().replace(/[^\w-]+/g, "_"), suggestedLabel: g.suggestedLabel?.trim() || "Missing fact" }));
  return { sections, gaps, usage: res.usage, costUsd: res.costUsd, model: res.model };
}
