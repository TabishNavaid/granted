import type { Application, MatchView, MonthlyPlan, Outcome, PlanItem, WinAnalytics } from "@/lib/types";
import { foundationByFunderId, recommendAsk } from "@/lib/foundations";

/**
 * The monthly plan, in plain code: which matches to apply for this month and
 * why. It weighs fit, the deadline, the hours it takes, and what has worked
 * before (the director's own win rates by funder type and for returning
 * funders), and leaves out anything already in progress or set aside.
 */
const HOURS: Record<PlanItem["effort"], number> = { low: 2, medium: 5, high: 12 };

export interface PlanInput {
  month: string; // YYYY-MM
  today: string; // YYYY-MM-DD
  matches: MatchView[];
  applications: Application[];
  outcomes: Outcome[];
  analytics: WinAnalytics | null;
  budget: number | null;
  hoursAvailable?: number;
}

function monthEnd(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
}

function daysBetween(a: string, b: string) {
  return Math.round((Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) / 86_400_000);
}

const money = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;

export function planMonth(input: PlanInput): { items: PlanItem[]; summary: string } {
  const hours = input.hoursAvailable ?? 20;
  const started = new Set(input.applications.map((a) => a.opportunityId));
  const appliedFunders = new Map<string, { won: boolean }>();
  for (const a of input.applications) {
    const o = input.outcomes.find((x) => x.applicationId === a.id);
    const m = input.matches.find((x) => x.opportunityId === a.opportunityId);
    if (m && o) appliedFunders.set(m.funder.id, { won: o.result === "won" || appliedFunders.get(m.funder.id)?.won === true });
  }
  const typeRate = new Map((input.analytics?.byFunderType ?? []).filter((r) => r.decided >= 2).map((r) => [r.label, r.winRate ?? 0]));
  const returningRate = input.analytics?.byRelationship.find((r) => r.label.startsWith("Returning"));
  const horizon = monthEnd(input.month);
  const typeLabel = (t: string) => ({ private_foundation: "Private foundations", community_foundation: "Community foundations", corporate: "Corporate giving", federal: "Federal agencies", state: "State agencies", family_fund: "Family funds" })[t] ?? t;

  const candidates = input.matches
    .filter((m) => (m.status === "new" || m.status === "saved") && !started.has(m.opportunityId))
    .filter((m) => !m.opportunity.forecasted)
    .filter((m) => !m.opportunity.deadline || (m.opportunity.deadline >= input.today && daysBetween(input.today, m.opportunity.deadline) <= 75))
    .map((m) => {
      const effort = m.opportunity.effort;
      let score = m.fitScore;
      const notes: string[] = [];
      const tr = typeRate.get(typeLabel(m.funder.type));
      if (tr != null) {
        score += Math.round((tr - 30) / 5);
        if (tr >= 50) notes.push(`${typeLabel(m.funder.type)} have funded you before (${tr}% of your requests).`);
      }
      const prior = appliedFunders.get(m.funder.id);
      if (prior?.won) {
        score += 8;
        notes.push(returningRate?.winRate != null ? `They funded you before, and returning requests have won ${returningRate.won} of ${returningRate.decided}.` : "They funded you before.");
      }
      if (m.opportunity.deadline && m.opportunity.deadline <= horizon) score += 4;
      score -= effort === "high" ? 6 : 0;
      const f = foundationByFunderId(m.funder.id);
      const ask = recommendAsk({ median: f?.grantMedian ?? null, min: m.opportunity.amountMin, max: m.opportunity.amountMax, budget: input.budget });
      const expected = ask?.amount ?? (m.opportunity.amountMax && m.opportunity.amountMin ? (m.opportunity.amountMin + m.opportunity.amountMax) / 2 : m.opportunity.amountMax ?? m.opportunity.amountMin ?? 0);
      return { m, score, effort, notes, expected };
    })
    .sort((a, b) => b.score - a.score);

  const items: PlanItem[] = [];
  let used = 0;
  for (const c of candidates) {
    if (items.length >= 5) break;
    if (used + HOURS[c.effort] > hours && items.length >= 2) continue;
    used += HOURS[c.effort];
    const due = c.m.opportunity.deadline ? `Due ${new Date(`${c.m.opportunity.deadline}T12:00:00Z`).toLocaleDateString("en-US", { month: "long", day: "numeric" })}.` : "No fixed deadline.";
    items.push({
      opportunityId: c.m.opportunityId,
      effort: c.effort,
      expectedAward: Math.round(c.expected),
      why: [due, c.m.reasons[0] ?? "", ...c.notes].filter(Boolean).join(" "),
      decision: "keep",
    });
  }
  const total = items.reduce((n, i) => n + i.expectedAward, 0);
  const summary = items.length
    ? `${items.length} for this month, about ${used} hours of your time. Together they could bring in around ${money(total)}.${typeRate.size ? " Ranked by fit, deadline, and what has worked for you before." : " Ranked by fit and deadline."}`
    : "Nothing new fits this month. Your matches are either in progress, set aside, or due later.";
  return { items, summary };
}

export function emptyPlan(orgId: string, month: string, id: string): MonthlyPlan {
  return { id, orgId, month, summary: "", items: [], status: "proposed" };
}
