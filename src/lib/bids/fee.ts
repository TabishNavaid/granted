import type { FeeLine, FeeProposal, FirmProfile, Solicitation } from "@/lib/types";

/**
 * The fee proposal stays with the firm. This builds the structure (phases,
 * the roles that usually work in each, expenses, what the solicitation asks
 * for) and does arithmetic on numbers the firm enters. It never fills in an
 * hour, a rate, or a price.
 */

const PHASES: { key: string; name: string; roles: string[] }[] = [
  { key: "sd", name: "Schematic design", roles: ["Principal in charge", "Project manager", "Architect"] },
  { key: "dd", name: "Design development", roles: ["Project manager", "Architect", "Structural engineer", "Mechanical engineer", "Electrical engineer"] },
  { key: "cd", name: "Construction documents", roles: ["Project manager", "Architect", "Structural engineer", "Mechanical engineer", "Electrical engineer", "Specifications writer"] },
  { key: "bid", name: "Bidding and negotiation", roles: ["Project manager", "Architect"] },
  { key: "ca", name: "Construction administration", roles: ["Project manager", "Architect", "Structural engineer", "Mechanical engineer"] },
];

const CONSTRUCTION_PHASES: { key: string; name: string; roles: string[] }[] = [
  { key: "gc", name: "General conditions", roles: ["Project manager", "Superintendent", "Safety manager"] },
  { key: "work", name: "Cost of the work", roles: [] },
  { key: "fee", name: "Overhead and profit", roles: [] },
];

let seq = 0;
const line = (label: string, role: string | null): FeeLine => ({ id: `fl_${Date.now().toString(36)}_${(seq++).toString(36)}`, label, role, hours: null, rate: null, amount: null });

export function feeStructure(input: { solicitation: Solicitation; text: string; profile: FirmProfile | null; applicationId: string; now?: string }): FeeProposal {
  const construction = input.solicitation.type === "IFB" || /\b(general contractor|construction services|sealed bids?|bid schedule|lump sum bid)\b/i.test(input.text);
  const phases = (construction ? CONSTRUCTION_PHASES : PHASES).map((p) => ({ key: p.key, name: p.name, lines: p.roles.length ? p.roles.map((r) => line(r, r)) : [line(p.name, null)] }));
  // Rates the firm already uses fill the rate column only; hours stay empty.
  const rates = new Map((input.profile?.rates ?? []).map((r) => [r.role.toLowerCase(), r.rate]));
  for (const p of phases) for (const l of p.lines) if (l.role && rates.has(l.role.toLowerCase())) l.rate = rates.get(l.role.toLowerCase())!;
  const instructions = input.text
    .split(/(?<=[.;])\s+/)
    .filter((s) => /\b(fee|price|pricing|cost proposal|hourly rates?|bid schedule|unit prices?|lump sum|not-?to-?exceed|compensation)\b/i.test(s) && s.length < 400)
    .slice(0, 6)
    .map((s) => s.replace(/\s+/g, " ").trim());
  if (input.solicitation.type === "SF330") instructions.unshift("This is a qualifications-based selection under the Brooks Act: no price is submitted now. The agency negotiates a fee with the most qualified firm after selection. Prepare this for that negotiation.");
  return {
    id: `fee_${input.applicationId}`,
    applicationId: input.applicationId,
    basis: construction ? "lump_sum" : /hourly|not-?to-?exceed|NTE/i.test(input.text) ? "hourly_not_to_exceed" : "lump_sum",
    phases,
    expenses: [line("Reimbursable expenses (travel, printing)", null)],
    notes: "",
    instructions,
    updatedAt: input.now ?? new Date().toISOString(),
  };
}

export const lineTotal = (l: FeeLine): number | null => (l.amount != null ? l.amount : l.hours != null && l.rate != null ? l.hours * l.rate : null);

/** Totals from the firm's own numbers. A phase with any blank line reports what is priced and how many lines are blank. */
export function feeTotals(fee: FeeProposal): { phases: { key: string; total: number; blank: number }[]; expenses: number; total: number; blank: number } {
  const phases = fee.phases.map((p) => ({ key: p.key, total: p.lines.reduce((n, l) => n + (lineTotal(l) ?? 0), 0), blank: p.lines.filter((l) => lineTotal(l) == null).length }));
  const expenses = fee.expenses.reduce((n, l) => n + (lineTotal(l) ?? 0), 0);
  const blank = phases.reduce((n, p) => n + p.blank, 0) + fee.expenses.filter((l) => lineTotal(l) == null).length;
  return { phases, expenses, total: phases.reduce((n, p) => n + p.total, 0) + expenses, blank };
}
