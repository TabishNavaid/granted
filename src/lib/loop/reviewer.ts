import { getAi, type JsonSchema, type TokenUsage } from "@/lib/ai";
import type { ReviewCriterion } from "@/lib/types";

/** Score a draft the way a funder's reviewer would, against the criteria the notice and guidelines state. */
export async function reviewDraft(input: { sections: { title: string; text: string }[]; noticeText: string; guidelinesText: string; orgName: string }): Promise<{ overall: number; criteria: ReviewCriterion[]; summary: string; usage: TokenUsage; costUsd: number; model: string }> {
  const schema: JsonSchema = {
    type: "object",
    properties: {
      overall: { type: "integer", minimum: 0, maximum: 100 },
      summary: { type: "string", description: "Three sentences a director can act on." },
      criteria: {
        type: "array",
        minItems: 3,
        maxItems: 8,
        items: {
          type: "object",
          properties: {
            criterion: { type: "string", description: "The criterion in the funder's words, or the standard one if the funder states none." },
            score: { type: "integer", minimum: 1, maximum: 5 },
            evidence: { type: "string", description: "What in the draft earns the score, quoting a phrase." },
            fix: { type: "string", description: "The one change that would raise the score most. Never suggest adding a number the organization has not confirmed; suggest asking for it." },
          },
          required: ["criterion", "score", "evidence", "fix"],
        },
      },
    },
    required: ["overall", "summary", "criteria"],
  };
  const ai = getAi();
  const res = await ai.generateJson<{ overall: number; summary: string; criteria: ReviewCriterion[] }>({
    tier: "standard",
    label: "reviewer_check",
    system: "You are an experienced peer reviewer on a federal grant panel. Read the funder's stated review criteria from the notice and guidelines. Score the draft honestly against each one, 1 to 5. Where the funder states no criteria, use: need, approach, capacity, evaluation, budget reasonableness. Text marked [NEED: ...] is a known gap; treat it as missing, not as a flaw in the writing. Be specific and kind. No em dashes.",
    prompt: `Organization: ${input.orgName}\n\nNotice:\n${input.noticeText}\n\nGuidelines:\n${input.guidelinesText || "(none)"}\n\nDraft:\n${input.sections.map((s) => `## ${s.title}\n${s.text}`).join("\n\n")}`,
    schema,
    maxOutputTokens: 4096,
  });
  const criteria = (res.data.criteria ?? []).map((c) => ({ criterion: c.criterion.trim(), score: Math.max(1, Math.min(5, Math.round(c.score))), evidence: c.evidence.trim(), fix: c.fix.trim() }));
  return { overall: Math.max(0, Math.min(100, Math.round(res.data.overall))), criteria, summary: (res.data.summary ?? "").trim(), usage: res.usage, costUsd: res.costUsd, model: res.model };
}
