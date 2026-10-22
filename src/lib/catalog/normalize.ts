import { createHash } from "node:crypto";
import type { OpportunityInput } from "./types";

/** Summaries are trimmed so the database stays small; the full notice is one click away at the source. */
export const SUMMARY_MAX = 1_600;

export function sha1(s: string): string {
  return createHash("sha1").update(s).digest("hex");
}

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", ndash: "-", mdash: "-", rsquo: "'", lsquo: "'", rdquo: '"', ldquo: '"', hellip: "...", bull: "-", middot: "-" };

/** HTML or messy text to one clean paragraph of plain text. */
export function plainText(input: string | null | undefined): string {
  if (!input) return "";
  return input
    .replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|h[1-6]|tr)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&([a-z]+);/gi, (m, n) => ENTITIES[n.toLowerCase()] ?? m)
    .replace(/[–—]/g, "-")
    .replace(/[ \t\f\v ]+/g, " ")
    .replace(/\s*\n\s*/g, "\n")
    .replace(/\n{2,}/g, "\n")
    .trim();
}

/** Trim to a sentence boundary under `max` characters. */
export function trimSummary(text: string | null | undefined, max = SUMMARY_MAX): string | null {
  const t = plainText(text).replace(/\n/g, " ");
  if (!t) return null;
  if (t.length <= max) return t;
  const cut = t.slice(0, max);
  const stop = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf("? "), cut.lastIndexOf("! "));
  return (stop > max * 0.6 ? cut.slice(0, stop + 1) : cut.replace(/\s+\S*$/, "")) + (stop > max * 0.6 ? "" : "...");
}

/** Numbers like "$1,250,000", "1250000.00", "N/A" to a number or null. Zero is null: sources use it for "not stated". */
export function money(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") return Number.isFinite(value) && value > 0 ? value : null;
  const s = String(value).replace(/[$,\s]/g, "");
  if (!/^\d+(\.\d+)?$/.test(s)) return null;
  const n = Number(s);
  return n > 0 ? n : null;
}

export function int(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = typeof value === "number" ? value : Number(String(value).replace(/[,\s]/g, ""));
  return Number.isFinite(n) && n > 0 ? Math.round(n) : null;
}

const MONTHS: Record<string, number> = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12 };

/**
 * Many date shapes to YYYY-MM-DD: "2026-10-22", "2026-10-22T17:00:00-04:00", "10222026" (Grants.gov extract),
 * "10/22/2026", "Oct 22, 2026", "22 October 2026". Returns null when unsure.
 */
export function isoDate(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const s = String(value).trim();
  if (!s) return null;
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return valid(+m[1], +m[2], +m[3]);
  m = s.match(/^(\d{2})(\d{2})(\d{4})$/);
  if (m) return valid(+m[3], +m[1], +m[2]);
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (m) return valid(+m[3], +m[1], +m[2]);
  m = s.match(/^([A-Za-z]{3,9})\.? (\d{1,2}),? (\d{4})/);
  if (m && MONTHS[m[1].slice(0, 3).toLowerCase()]) return valid(+m[3], MONTHS[m[1].slice(0, 3).toLowerCase()], +m[2]);
  m = s.match(/^(\d{1,2}) ([A-Za-z]{3,9})\.? (\d{4})/);
  if (m && MONTHS[m[2].slice(0, 3).toLowerCase()]) return valid(+m[3], MONTHS[m[2].slice(0, 3).toLowerCase()], +m[1]);
  return null;
}

function valid(y: number, mo: number, d: number): string | null {
  if (y < 1990 || y > 2100 || mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  const dt = new Date(Date.UTC(y, mo - 1, d));
  if (dt.getUTCMonth() !== mo - 1) return null;
  return `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/**
 * A deadline as an ISO timestamp. Full timestamps are kept; a bare date means the end of that day in US Eastern
 * time (23:59 at UTC-5), which is when most federal portals close. Unparseable input gives null.
 */
export function deadline(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const s = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(s)) {
    const d = new Date(s);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  }
  const day = isoDate(s);
  return day ? `${day}T23:59:00-05:00` : null;
}

/**
 * Opportunity numbers to one comparable form: upper case, no spaces, one kind of dash.
 * "NSF 24-578" and "nsf24-578" become "NSF24-578"; "PAR-25-123" stays.
 */
export function normalizeNumber(n: string | null | undefined): string | null {
  if (!n) return null;
  const v = n.toUpperCase().replace(/[‐-―]/g, "-").replace(/\s+/g, "").replace(/^(NOFO|FOA|NOTICE)[:#-]?/, "");
  return v.length >= 4 ? v : null;
}

/** Numbers too generic to identify an opportunity across sources ("2026-1", "001"). */
function distinctive(n: string): boolean {
  return n.length >= 6 && /[A-Z]/.test(n) && /\d/.test(n);
}

function normTitle(t: string): string {
  return t.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, " ").replace(/\b(fy|fiscal year)\s?20\d\d\b/g, " ").replace(/\s+/g, " ").trim();
}

/**
 * The dedupe key. Two rows with the same key are the same opportunity. A distinctive opportunity number wins;
 * otherwise the title, funder, and closing day together.
 */
export function canonicalKey(o: Pick<OpportunityInput, "opportunityNumber" | "title" | "funderName" | "closeAt" | "canonicalKey">): string {
  if (o.canonicalKey) return o.canonicalKey;
  const n = normalizeNumber(o.opportunityNumber);
  if (n && distinctive(n)) return `num:${n}`;
  return `t:${sha1(`${normTitle(o.title)}|${normTitle(o.funderName ?? "")}|${(o.closeAt ?? "").slice(0, 10)}`).slice(0, 24)}`;
}

/** A stable hash of everything a person would see, so unchanged rows are skipped on update. */
export function contentHash(o: OpportunityInput): string {
  return sha1(stableStringify(o));
}

/** JSON with object keys sorted at every level, and undefined dropped, so equal content hashes equally. */
export function stableStringify(v: unknown): string {
  if (v === null || typeof v !== "object") return JSON.stringify(v) ?? "null";
  if (Array.isArray(v)) return `[${v.map(stableStringify).join(",")}]`;
  const o = v as Record<string, unknown>;
  return `{${Object.keys(o)
    .filter((k) => o[k] !== undefined)
    .sort()
    .map((k) => `${JSON.stringify(k)}:${stableStringify(o[k])}`)
    .join(",")}}`;
}

/** Absolute https URL or null. */
export function httpUrl(value: unknown, base?: string): string | null {
  if (!value) return null;
  try {
    const u = new URL(String(value).trim(), base);
    if (u.protocol !== "https:" && u.protocol !== "http:") return null;
    return u.toString();
  } catch {
    return null;
  }
}

/** Status from dates when a source gives none: before open is forecasted, after close is closed. */
export function statusFromDates(open: string | null | undefined, close: string | null | undefined, now = new Date()): "forecasted" | "open" | "closed" {
  if (close && new Date(close).getTime() < now.getTime()) return "closed";
  if (open && new Date(`${open.slice(0, 10)}T00:00:00Z`).getTime() > now.getTime()) return "forecasted";
  return "open";
}
