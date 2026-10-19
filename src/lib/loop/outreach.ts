import { getAi, type JsonSchema, type TokenUsage } from "@/lib/ai";
import type { EmailKind, Fact, Organization } from "@/lib/types";
import { numberKey, numbersIn } from "./text";

export interface EmailDraftInput {
  kind: EmailKind | "intro_request";
  org: Organization;
  facts: Fact[];
  userName: string;
  userEmail: string;
  funderName: string | null;
  opportunityTitle: string | null;
  noticeText: string | null;
  deadline: string | null;
  toName: string | null;
  /** For an intro request: the board member or partner who will send it, and what they know the funder through. */
  viaContact: { name: string; relationship: string } | null;
  notes: string;
}

const KIND_ASK: Record<EmailDraftInput["kind"], string> = {
  intro: "A short first email introducing the organization to a funder's program officer and asking whether a conversation before applying would be welcome.",
  question: "A short email to a program officer asking one or two specific eligibility or fit questions before applying. The questions must come from the notes or be obvious from the notice.",
  loi_cover: "A brief cover note to accompany a letter of inquiry, two paragraphs at most.",
  thank_you: "A sincere thank-you after an award or a meeting, four to six sentences.",
  follow_up: "A polite follow-up on an earlier email or application, three to five sentences, with one clear question.",
  feedback_request: "A gracious note after a declined application thanking the funder for its review and asking, in one sentence, whether it can share any feedback that would strengthen a future request. Four to six sentences. No complaint, no argument with the decision.",
  intro_request: "An email the organization's board member or partner can send to someone they know at the funder, introducing the organization and asking for a brief conversation. Write it in the board member's voice, first person, mentioning how they know the organization.",
};

const schema: JsonSchema = { type: "object", properties: { subject: { type: "string" }, body: { type: "string", description: "Plain text, paragraphs separated by blank lines, ending with a sign-off and the sender's name." } }, required: ["subject", "body"] };

/**
 * Drafts an email from confirmed facts and the notice. Any number not found in
 * a fact, the notice, or the notes is bracketed as [confirm: X] so it cannot go
 * out unseen. Nothing here sends.
 */
export async function draftEmail(input: EmailDraftInput): Promise<{ subject: string; body: string; flagged: string[]; usage: TokenUsage; costUsd: number; model: string }> {
  const ai = getAi();
  const org = input.org;
  const facts = input.facts.map((f) => `- ${f.label}: ${f.value}`).join("\n");
  const sender = input.kind === "intro_request" && input.viaContact ? `${input.viaContact.name} (who ${input.viaContact.relationship ? `knows the organization: ${input.viaContact.relationship}` : "is on the organization's board"})` : `${input.userName}, ${org.name}`;
  const res = await ai.generateJson<{ subject: string; body: string }>({
    tier: "standard",
    label: `email_${input.kind}`,
    system: `You write short, warm, specific emails for a small nonprofit's director. Use only the facts listed and the notice. Never invent a person's name, a dollar amount, a date, or a result. If something needed is missing, write [confirm: what is missing] in its place. No em dashes, no exclamation marks, no flattery. Under 180 words. Sign with the sender's name only.`,
    prompt: [
      `Email type: ${KIND_ASK[input.kind]}`,
      `Sender: ${sender}`,
      input.toName ? `Recipient: ${input.toName}` : "Recipient: unnamed (use 'Hello,' not a made-up name)",
      `Organization: ${org.name}${org.mission ? `. Mission: ${org.mission}` : ""}`,
      `Confirmed facts:\n${facts || "- (none)"}`,
      input.funderName ? `Funder: ${input.funderName}` : "",
      input.opportunityTitle ? `Opportunity: ${input.opportunityTitle}${input.deadline ? ` (due ${input.deadline})` : ""}` : "",
      input.noticeText ? `Notice text:\n${input.noticeText.slice(0, 2500)}` : "",
      input.notes ? `Notes from the director:\n${input.notes}` : "",
    ]
      .filter(Boolean)
      .join("\n\n"),
    schema,
    maxOutputTokens: 1500,
  });
  const allowed = new Set<string>();
  for (const src of [...input.facts.map((f) => `${f.value} ${f.sourceExcerpt}`), input.noticeText ?? "", input.notes, input.deadline ?? ""]) for (const n of numbersIn(src)) allowed.add(numberKey(n));
  const flagged: string[] = [];
  const body = (res.data.body ?? "").replace(/\$?\d[\d,]*(?:\.\d+)?%?/g, (tok) => {
    const k = numberKey(tok);
    if (!k || allowed.has(k)) return tok;
    flagged.push(tok);
    return `[confirm: ${tok}]`;
  });
  return { subject: (res.data.subject ?? "").trim(), body: body.trim(), flagged, usage: res.usage, costUsd: res.costUsd, model: res.model };
}
