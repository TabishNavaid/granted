import type { AwardStatInput } from "../types";

/**
 * Award amounts grouped in memory and reduced to counts, totals, and quartiles.
 * Used by the research award connectors (NIH RePORTER, NSF awards, SBIR awards),
 * which read project-level records but store only these aggregates.
 */

/** State-level award groups with fewer awards than this are not stored (national rows still count them). */
export const MIN_STATE_GROUP = 3;

/** Linear-interpolated percentile of a sorted list (p in 0..1). */
export function percentile(sorted: number[], p: number): number | null {
  if (!sorted.length) return null;
  if (sorted.length === 1) return sorted[0];
  const idx = (sorted.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  const v = sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
  return Math.round(v * 100) / 100;
}

export type GroupKey = Omit<AwardStatInput, "awardCount" | "totalAmount" | "medianAmount" | "p25Amount" | "p75Amount" | "minAmount" | "maxAmount">;

export class AwardAggregator {
  private groups = new Map<string, { key: GroupKey; amounts: number[] }>();

  add(key: GroupKey, amount: number) {
    if (!Number.isFinite(amount) || amount <= 0) return;
    const k = JSON.stringify([key.awardType, key.agency, key.subAgency ?? null, key.naics ?? null, key.psc ?? null, key.assistanceListing ?? null, key.activityCode ?? null, key.program ?? null, key.placeState ?? null, key.setAside ?? null, key.fiscalYear]);
    let g = this.groups.get(k);
    if (!g) {
      g = { key, amounts: [] };
      this.groups.set(k, g);
    }
    g.amounts.push(amount);
  }

  get size(): number {
    return this.groups.size;
  }

  /**
   * Every group as an award stat row. Groups smaller than minCount are dropped; state-level groups need minStateCount
   * (one or two awards in a state say little about typical size, and they are half of all state rows).
   */
  rows(minCount = 1, minStateCount = minCount): AwardStatInput[] {
    const out: AwardStatInput[] = [];
    for (const { key, amounts } of this.groups.values()) {
      if (amounts.length < (key.placeState ? minStateCount : minCount)) continue;
      const sorted = [...amounts].sort((a, b) => a - b);
      const total = sorted.reduce((s, x) => s + x, 0);
      out.push({
        ...key,
        awardCount: sorted.length,
        totalAmount: Math.round(total * 100) / 100,
        medianAmount: percentile(sorted, 0.5),
        p25Amount: percentile(sorted, 0.25),
        p75Amount: percentile(sorted, 0.75),
        minAmount: sorted[0],
        maxAmount: sorted[sorted.length - 1],
      });
    }
    return out;
  }
}

/** US federal fiscal year of a date (October starts the next fiscal year). */
export function fiscalYearOf(isoDay: string): number | null {
  const m = isoDay.match(/^(\d{4})-(\d{2})/);
  if (!m) return null;
  const y = Number(m[1]);
  return Number(m[2]) >= 10 ? y + 1 : y;
}

/** The last `n` completed federal fiscal years, newest first. */
export function completedFiscalYears(n: number, now = new Date()): number[] {
  const current = now.getUTCMonth() >= 9 ? now.getUTCFullYear() + 1 : now.getUTCFullYear();
  return Array.from({ length: n }, (_, i) => current - 1 - i);
}
