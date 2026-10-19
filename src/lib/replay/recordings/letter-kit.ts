import type { RecordedCall } from "../types";

/**
 * Shorthand for writing recorded letters the way the model returns them:
 * [[fact:ID]] after a claim and [[gap:KEY]] where a fact is missing. Fact ids
 * are filled in from the prompt at replay time (see ../types.ts).
 */
export const F = (label: string) => `[[fact:{{fact:${label}}}]]`;
export const P = (program: string) => `[[fact:{{fact:Program=${program}}}]]`;
export const G = (key: string) => `[[gap:${key}]]`;
/** The director's answer to a question, cited to the fact it became. */
export const A = (key: string) => `{{value:${key}}} [[fact:{{answer:${key}}}]]`;

type Key = "opening" | "organization" | "need" | "plan" | "fit" | "closing";
const HEADINGS: Record<Key, string> = { opening: "Opening and request", organization: "About the organization", need: "The need", plan: "What we would do", fit: "Why this program", closing: "Closing" };

export interface Gap {
  key: string;
  paragraphKey: Key;
  question: string;
  whyItMatters: string;
  suggestedLabel: string;
}

/** A recorded letter for one opportunity, matched on the title the prompt names. */
export function letter(opportunityTitle: string, paragraphs: Record<Key, string>, gaps: Gap[], durationMs = 11_800): RecordedCall {
  return {
    label: "draft_letter",
    match: `Opportunity: ${opportunityTitle}\n`,
    durationMs,
    data: { paragraphs: (Object.keys(HEADINGS) as Key[]).map((key) => ({ key, heading: HEADINGS[key], text: paragraphs[key] })), gaps },
  };
}

/** The paragraph rewritten after the director answers the question with this key. */
export function redraft(gapKey: string, text: string): RecordedCall {
  return { label: "redraft_paragraph", match: `[[gap:${gapKey}]] ->`, durationMs: 4_300, data: { text, gaps: [] } };
}
