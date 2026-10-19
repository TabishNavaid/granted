import type { BudgetLine } from "@/lib/types";

/** Budget labels and arithmetic with no server imports, so the budget panel can use them in the browser. */
export const BUDGET_CATEGORY_LABEL: Record<BudgetLine["category"], string> = {
  personnel: "Personnel",
  fringe: "Fringe benefits",
  travel: "Travel",
  equipment: "Equipment",
  supplies: "Supplies",
  contractual: "Contractual",
  other: "Other",
  indirect: "Indirect costs",
};

export function budgetTotal(lines: BudgetLine[]) {
  return lines.reduce((s, l) => s + (Number.isFinite(l.amount) ? l.amount : 0), 0);
}
