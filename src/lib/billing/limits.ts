/**
 * Plan limits. Pure functions, no I/O: callers count usage for the month and
 * ask here whether one more is allowed. `null` means unlimited.
 */
export type PlanTier = "free" | "starter" | "growth";

export interface PlanLimits {
  proposalsPerMonth: number | null;
  matchesPerMonth: number | null;
  seats: number;
}

export const PLAN_LIMITS: Record<PlanTier, PlanLimits> = {
  free: { proposalsPerMonth: 1, matchesPerMonth: 5, seats: 1 },
  starter: { proposalsPerMonth: 3, matchesPerMonth: null, seats: 1 },
  growth: { proposalsPerMonth: null, matchesPerMonth: null, seats: 3 },
};

export type UsageKind = "proposal" | "match";

const PLAN_NAMES: Record<PlanTier, string> = { free: "Free", starter: "Starter", growth: "Growth" };

const NOUNS: Record<UsageKind, { one: string; many: string }> = {
  proposal: { one: "drafted proposal", many: "drafted proposals" },
  match: { one: "grant match", many: "grant matches" },
};

function limitFor(plan: PlanTier, what: UsageKind): number | null {
  return what === "proposal" ? PLAN_LIMITS[plan].proposalsPerMonth : PLAN_LIMITS[plan].matchesPerMonth;
}

function count(n: number, what: UsageKind): string {
  return `${n} ${n === 1 ? NOUNS[what].one : NOUNS[what].many}`;
}

/** The next plan up that raises this limit, if any. */
function upgradeHint(plan: PlanTier, what: UsageKind): string {
  const order: PlanTier[] = ["free", "starter", "growth"];
  for (const next of order.slice(order.indexOf(plan) + 1)) {
    const limit = limitFor(next, what);
    if (limit === null) return `Upgrade to ${PLAN_NAMES[next]} for unlimited ${NOUNS[what].many}, or wait until the 1st.`;
    if (limit > (limitFor(plan, what) ?? 0)) return `Upgrade to ${PLAN_NAMES[next]} for ${limit}, or wait until the 1st.`;
  }
  return "Wait until the 1st for a fresh month.";
}

export function canUse(plan: PlanTier, what: UsageKind, usedThisMonth: number): { ok: boolean; message: string | null } {
  const limit = limitFor(plan, what);
  if (limit === null || usedThisMonth < limit) return { ok: true, message: null };
  return { ok: false, message: `The ${PLAN_NAMES[plan]} plan includes ${count(limit, what)} a month. ${upgradeHint(plan, what)}` };
}
