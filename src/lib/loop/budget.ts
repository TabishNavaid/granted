import { getAi, type TokenUsage } from "@/lib/ai";
import type { BudgetLine, Fact, Organization } from "@/lib/types";
import { numberKey, numbersIn } from "./text";

export { BUDGET_CATEGORY_LABEL, budgetTotal } from "@/lib/budget";
import { BUDGET_CATEGORY_LABEL, budgetTotal } from "@/lib/budget";

/** A budget justification whose only numbers are the line amounts, their total, and confirmed facts. */
export async function writeJustification(input: { org: Organization; facts: Fact[]; lines: BudgetLine[]; opportunityTitle: string; noticeText: string }): Promise<{ text: string; usage: TokenUsage; costUsd: number; model: string }> {
  const ai = getAi();
  const total = budgetTotal(input.lines);
  const res = await ai.generateJson<{ text: string }>({
    tier: "standard",
    label: "budget_justification",
    system: "You write budget justifications for small nonprofit grant proposals. One short paragraph per budget category used, then one closing sentence with the total. Explain what each line buys and why it is needed for the project, using only the line items, their notes, and the confirmed facts. Never add a number that is not a line amount, the total, or a confirmed fact. No em dashes.",
    prompt: `Organization: ${input.org.name}\nOpportunity: ${input.opportunityTitle}\n\nConfirmed facts:\n${input.facts.map((f) => `- ${f.label}: ${f.value}`).join("\n") || "- (none)"}\n\nBudget lines:\n${input.lines.map((l) => `- ${BUDGET_CATEGORY_LABEL[l.category]}: ${l.item}, $${l.amount.toLocaleString("en-US")}${l.note ? ` (${l.note})` : ""}`).join("\n")}\nTotal: $${total.toLocaleString("en-US")}\n\nNotice:\n${input.noticeText.slice(0, 2000)}`,
    schema: { type: "object", properties: { text: { type: "string" } }, required: ["text"] },
    maxOutputTokens: 2000,
  });
  const allowed = new Set<string>([numberKey(String(total))]);
  for (const l of input.lines) {
    allowed.add(numberKey(String(l.amount)));
    for (const n of numbersIn(l.note)) allowed.add(numberKey(n));
  }
  for (const f of input.facts) for (const n of numbersIn(`${f.value} ${f.sourceExcerpt}`)) allowed.add(numberKey(n));
  const text = (res.data.text ?? "").replace(/\$?\d[\d,]*(?:\.\d+)?%?/g, (tok) => (allowed.has(numberKey(tok)) || !numberKey(tok) ? tok : `[confirm: ${tok}]`)).trim();
  return { text, usage: res.usage, costUsd: res.costUsd, model: res.model };
}
