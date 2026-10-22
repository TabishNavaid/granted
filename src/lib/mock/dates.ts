/**
 * The sample history was written on SEED_DAY. So that deadlines in the demo
 * stay in the future for as long as people look at it, every date in the
 * seed moves forward by the days that have passed since then, in whole weeks
 * so weekdays stay the same. Text in the seed avoids naming months for the
 * same reason.
 */
export const SEED_DAY = "2026-10-18";

const DAY = 24 * 60 * 60 * 1000;

export function seedOffsetDays(today = new Date()): number {
  const days = Math.floor((Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()) - Date.parse(`${SEED_DAY}T00:00:00Z`)) / DAY);
  return days > 0 ? Math.floor(days / 7) * 7 : 0;
}

function shiftString(s: string, days: number): string {
  if (/^\d{4}-\d{2}-\d{2}T/.test(s)) {
    const t = Date.parse(s);
    return Number.isNaN(t) ? s : new Date(t + days * DAY).toISOString().replace(/\.000Z$/, s.endsWith(".000Z") ? ".000Z" : "Z");
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return new Date(Date.parse(`${s}T12:00:00Z`) + days * DAY).toISOString().slice(0, 10);
  if (/^\d{4}-\d{2}$/.test(s)) return new Date(Date.parse(`${s}-15T12:00:00Z`) + days * DAY).toISOString().slice(0, 7);
  return s;
}

function walk<T>(v: T, days: number): T {
  if (typeof v === "string") return shiftString(v, days) as T;
  if (Array.isArray(v)) return v.map((x) => walk(x, days)) as T;
  if (v && typeof v === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, x] of Object.entries(v as Record<string, unknown>)) out[k] = walk(x, days);
    return out as T;
  }
  return v;
}

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/** "November 6" and "December 15, 2026" move with the dates; a bare "October" moves as if it were the 15th. */
export function shiftDateWords(s: string, days: number): string {
  if (!days) return s;
  const re = new RegExp(`\\b(${MONTHS.join("|")})(?: (\\d{1,2})(?:, (\\d{4}))?)?\\b`, "g");
  return s.replace(re, (_whole, month: string, day?: string, year?: string) => {
    const m = MONTHS.indexOf(month);
    const y = year ? Number(year) : 2026 + (m < 6 ? 1 : 0);
    const d = new Date(Date.UTC(y, m, day ? Number(day) : 15) + days * DAY);
    const name = MONTHS[d.getUTCMonth()];
    if (!day) return name;
    return `${name} ${d.getUTCDate()}${year ? `, ${d.getUTCFullYear()}` : ""}`;
  });
}

function walkText<T>(v: T, days: number): T {
  if (typeof v === "string") return shiftDateWords(v, days) as T;
  if (Array.isArray(v)) return v.map((x) => walkText(x, days)) as T;
  if (v && typeof v === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, x] of Object.entries(v as Record<string, unknown>)) out[k] = /^(id|.*Id|month|dueDate|deadline|createdAt|.*At|date)$/.test(k) ? x : walkText(x, days);
    return out as T;
  }
  return v;
}

/** Parts of the seed whose words describe dates. Facts, quoted sources, and drafts are left as written. */
const TEXT_KEYS = ["inbox", "plans", "matches", "milestones", "emailDrafts", "runs"];

export function shiftSeedDates<T>(state: T, today = new Date()): T {
  const days = seedOffsetDays(today);
  if (!days) return state;
  const shifted = walk(state, days) as Record<string, unknown>;
  for (const k of TEXT_KEYS) if (k in shifted) shifted[k] = walkText(shifted[k], days);
  return shifted as T;
}

