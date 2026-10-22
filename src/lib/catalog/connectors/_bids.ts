import { canonicalKey, isoDate, plainText } from "../normalize";
import { uniq } from "../vocab";
import type { Connector, FunderInput, IngestContext, OpportunityInput, SourceDefinition } from "../types";

/**
 * Shared pieces for state and local public bids (RFPs, IFBs, RFQs). Each portal is one config entry
 * (see state-local.ts); the readers in _socrata.ts and _feeds.ts turn a config into a Connector.
 * This file holds what every bid portal needs: time zones, notice types, construction and A/E
 * detection, set-aside text, status rules, and funder (buying agency) keys.
 */

/** What a portal's mapping returns for one record. Null means "skip this record". */
export interface MappedBid {
  opportunity: OpportunityInput;
  /** The buying agency, emitted before the opportunity. Its parent (a city or state) is emitted too when given. */
  funder?: FunderInput | null;
  parentFunder?: FunderInput | null;
}

/** Fields every bid portal config shares, whatever the transport. */
export interface BidPortalBase<Row> {
  source: SourceDefinition;
  /** The source lists every live record each backfill (lets the runner close the rest). */
  fullSnapshot?: boolean;
  /** One record to our model. Throwing is fine: the reader records a warning and moves on. */
  map: (row: Row, now: Date) => MappedBid | null;
  /**
   * Records that are notices of the same solicitation (re-advertisements, extensions) share a key.
   * The reader keeps the newest per key (the last one seen, so order the query oldest first).
   */
  groupKey?: (row: Row) => string | null;
  /** Combine all records of one group into one (TxDOT lists one contract as many project rows). */
  combine?: (rows: Row[]) => Row;
}

// ---------- text ----------

/**
 * plainText plus repairs for control characters some portals leave where a curly quote or dash was
 * ("NYCHA\u001as", "OPEN-ENDED \u001a JUSTICE").
 */
export function cleanText(input: string | null | undefined): string {
  return plainText(
    (input ?? "")
      .replace(/(\w)\u001a(s\b)/g, "$1'$2")
      .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, " "),
  )
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

// ---------- time zones ----------

function offsetMinutes(utcMs: number, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(new Date(utcMs));
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour") % 24, get("minute"), get("second"));
  return Math.round((asUtc - Math.floor(utcMs / 1000) * 1000) / 60_000);
}

function fmtOffset(min: number): string {
  const sign = min < 0 ? "-" : "+";
  const a = Math.abs(min);
  return `${sign}${String(Math.floor(a / 60)).padStart(2, "0")}:${String(a % 60).padStart(2, "0")}`;
}

/**
 * A wall-clock time with no zone ("2026-11-03T13:00:00.000", the way Socrata stores floating timestamps)
 * in the portal's zone, as ISO 8601 with the offset that applied that day ("2026-11-03T13:00:00-06:00").
 * Values that already carry a zone are kept. Unparseable input gives null.
 */
export function zonedTimestamp(value: unknown, timeZone: string): string | null {
  if (value === null || value === undefined) return null;
  const s = String(value).trim();
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?(?:\.\d+)?)?(Z|[+-]\d{2}:?\d{2})?$/);
  if (!m) return null;
  const [, y, mo, d, h = "00", mi = "00", se = "00", zone] = m;
  if (!isoDate(`${y}-${mo}-${d}`)) return null;
  if (zone) {
    const t = new Date(s);
    return Number.isNaN(t.getTime()) ? null : t.toISOString();
  }
  const wall = Date.UTC(+y, +mo - 1, +d, +h, +mi, +se);
  if (timeZone === "UTC") return `${y}-${mo}-${d}T${h}:${mi}:${se}Z`;
  // Two passes settle the offset around daylight saving changes.
  let off = offsetMinutes(wall, timeZone);
  off = offsetMinutes(wall - off * 60_000, timeZone);
  return `${y}-${mo}-${d}T${h}:${mi}:${se}${fmtOffset(off)}`;
}

/** A due date given as a day only: the end of that day in the portal's zone. */
export function endOfDay(value: unknown, timeZone: string): string | null {
  const day = isoDate(value);
  return day ? zonedTimestamp(`${day}T23:59:00`, timeZone) : null;
}

/** True when a Socrata timestamp has no time of day (midnight), so only the day is known. */
export function dateOnly(value: unknown): boolean {
  return /^\d{4}-\d{2}-\d{2}(T00:00(:00(\.0+)?)?)?$/.test(String(value ?? "").trim());
}

/** Portals use far-future dates (2099-12-31, 9999-09-09) to mean "no fixed date". */
export function placeholderDate(value: unknown): boolean {
  const y = Number(String(value ?? "").slice(0, 4));
  return Number.isFinite(y) && y >= 2090;
}

// ---------- notice types ----------

export type BidNoticeType =
  | "invitation_for_bids"
  | "request_for_proposals"
  | "request_for_qualifications"
  | "request_for_quotes"
  | "request_for_information"
  | "letting"
  | "forecast"
  | "solicitation";

/** The many ways portals name a solicitation type, to one stable code. Order matters: most specific first. */
export function noticeTypeFrom(...texts: (string | null | undefined)[]): BidNoticeType {
  const t = texts.filter(Boolean).join(" ").toLowerCase();
  if (!t) return "solicitation";
  if (/\brfi\b|request for information|sources sought/.test(t)) return "request_for_information";
  if (/\brfq\b.*qualif|request for qualifications?|\bsoq\b|statement of qualifications|pre-?qual|\bpql\b|\bbench\b|expression of interest|\brfei\b/.test(t)) return "request_for_qualifications";
  if (/request for (quote|quotation)s?|\brfq\b|\brfx\b/.test(t)) return "request_for_quotes";
  if (/\brfp\b|request for proposals?|sealed proposals|negotiated acquisition|\btos\b|task order/.test(t)) return "request_for_proposals";
  if (/\bifb\b|\brfb\b|\bitb\b|invitation (for|to) bids?|request for bids?|sealed bids?|seeking bids|public bid|\bbid\b/.test(t)) return "invitation_for_bids";
  return "solicitation";
}

// ---------- construction and A/E ----------

export const CONSTRUCTION = "construction";
export const ARCHITECTURE_ENGINEERING = "architecture and engineering";

const CONSTRUCTION_RE =
  /\b(construction|construct|reconstruct\w*|renovat\w*|rehabilitat\w*|demoli\w*|paving|pave|repav\w*|resurfac\w*|overlay|roofing|roof replacement|re-?roof\w*|sidewalks?|curbs?|bridge (repair|replacement|rehab\w*)|water mains?|sewer|storm ?drain|culvert|hvac (installation|replacement|upgrade)|abatement|general contractor|job order contract|design[- /]build|cm ?\/ ?gc|cmar|construction manager|trade package|site work|sitework|concrete|masonry|excavation|grading|landscap\w* (installation|improvements)|seal ?coat|hot mix|asphalt|striping|signali[sz]ation|traffic signals?|widening|interchange|facade|waterproofing|elevator modernization)\b/i;
const AE_RE =
  /\b(architect\w*|engineering services|engineering design|design services|professional engineering|civil engineering|structural engineering|geotechnical|surveying|land survey|commissioning services|environmental engineering|a\/e|a&e|construction inspection|construction management services|program management services|design consultant|on-?call engineering|traffic engineering)\b/i;

/** Categories to add when a record clearly is construction or architecture and engineering work. */
export function aecCategories(opts: { text: string; construction?: boolean; ae?: boolean }): string[] {
  const out: string[] = [];
  if (opts.construction || CONSTRUCTION_RE.test(opts.text)) out.push(CONSTRUCTION);
  if (opts.ae || AE_RE.test(opts.text)) out.push(ARCHITECTURE_ENGINEERING);
  return out;
}

/**
 * UNSPSC segment 72 is "Building and Facility Construction and Maintenance Services"; family 8110 is
 * "Professional engineering services" and 8113 is "Building and construction management". These come from
 * the published UNSPSC code set, so they are safe to read as construction and A/E. Other codes stay as codes.
 */
export function aecFromUnspsc(codes: string[]): string[] {
  const out: string[] = [];
  if (codes.some((c) => c.startsWith("72"))) out.push(CONSTRUCTION);
  if (codes.some((c) => c.startsWith("8110") || c.startsWith("8113"))) out.push(ARCHITECTURE_ENGINEERING);
  return out;
}

// ---------- set-asides ----------

const SET_ASIDE_RULES: [string, RegExp][] = [
  ["M/WBE", /\bm\/?wbes?\b|\bmbes?\b.{0,12}\bwbes?\b|minority[- ]and women[- ]owned/i],
  ["DBE", /\bdbe\b|disadvantaged business enterprise/i],
  ["SBE", /\bsbe\b|small business enterprise/i],
  ["LBE", /\b(m?lbe|local business enterprise)\b/i],
  ["SDVOB", /\bsdvob\b|service[- ]disabled veteran/i],
  ["Section 3", /\bsection 3\b/i],
];

/**
 * Sentences that state a set-aside, goal, or reserved program, so outreach boilerplate ("we welcome all
 * businesses, including M/WBEs") is not read as a set-aside.
 */
export function setAsideSentences(text: string | null | undefined): string {
  return plainText(text)
    .split(/[.!?]\s+|\n/)
    .filter((x) => /\b(goals?|only|set[- ]aside|reserved?|reserve program|participation|subcontracting|certified)\b/i.test(x) && !/\b(strives?|encourag\w*|welcome[sd]?|equal opportunity)\b/i.test(x))
    .join(" ");
}

/** Set-aside and participation programs named in a record, as short plain text ("M/WBE, DBE"), or null. */
export function setAsideFrom(text: string | null | undefined, extra: string[] = []): string | null {
  const t = text ?? "";
  // "0% M/WBE subcontracting goals" means there is no goal.
  const zeroGoal = /\b0(\.0+)?\s?%\s*m\/?wbe/i.test(t);
  const found = SET_ASIDE_RULES.filter(([label, re]) => !(label === "M/WBE" && zeroGoal && !/m\/?wbe[- ]only/i.test(t)) && re.test(t)).map(([l]) => l);
  const all = uniq([...extra, ...found]);
  return all.length ? all.join(", ") : null;
}

// ---------- status ----------

/**
 * Open only when the due date is in the future, or the source says the bid is open and gives no date.
 * Cancelled wins. Records listed only as expected future solicitations are forecasted.
 */
export function bidStatus(o: { closeAt: string | null; cancelled?: boolean; forecast?: boolean; sourceSaysOpen?: boolean; sourceSaysClosed?: boolean }, now: Date): OpportunityInput["status"] {
  if (o.cancelled) return "cancelled";
  if (o.sourceSaysClosed) return "closed";
  if (o.closeAt) {
    const t = new Date(o.closeAt).getTime();
    if (Number.isFinite(t) && t < now.getTime()) return "closed";
    return o.forecast ? "forecasted" : "open";
  }
  if (o.forecast) return "forecasted";
  return o.sourceSaysOpen ? "open" : "closed";
}

// ---------- funders ----------

export function slug(s: string): string {
  return plainText(s)
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

/** `state:<ST>:<slug>` for a state agency. */
export function stateAgency(st: string, name: string, sourceUrl: string, extra: Partial<FunderInput> = {}): FunderInput {
  return {
    key: `state:${st}:${slug(name)}`,
    name,
    kind: "state_agency",
    state: st,
    country: "US",
    geography: [st],
    sourceUrl,
    ...extra,
  };
}

/** `local:<ST>:<place>` for the government itself, `local:<ST>:<place>:<slug>` for one of its departments. */
export function localGovernment(st: string, place: string, name: string, sourceUrl: string, extra: Partial<FunderInput> = {}): FunderInput {
  return {
    key: `local:${st}:${slug(place)}`,
    name,
    kind: "local_government",
    state: st,
    country: "US",
    geography: [st],
    sourceUrl,
    ...extra,
  };
}

export function localDepartment(parent: FunderInput, department: string, name: string, sourceUrl: string, extra: Partial<FunderInput> = {}): FunderInput {
  return {
    key: `${parent.key}:${slug(department)}`,
    name,
    kind: "local_government",
    parentKey: parent.key,
    city: parent.city ?? null,
    state: parent.state ?? null,
    country: "US",
    geography: parent.geography ?? [],
    sourceUrl,
    ...extra,
  };
}

// ---------- shared emit loop ----------

/** The run's "now". CATALOG_NOW pins it (tests replay recorded responses against the day they were recorded). */
export function runClock(ctx: Pick<IngestContext, "env">): Date {
  const pinned = ctx.env.CATALOG_NOW ? new Date(ctx.env.CATALOG_NOW) : null;
  return pinned && Number.isFinite(pinned.getTime()) ? pinned : new Date();
}

/** Rows to opportunities: map, group, emit funders first, honor the limit. Used by both readers. */
export async function emitBids<Row>(ctx: IngestContext, portal: BidPortalBase<Row>, rows: Row[], seenFunders: Set<string>, now: Date): Promise<number> {
  let input = rows;
  if (portal.groupKey) {
    const groups = new Map<string, Row[]>();
    let n = 0;
    for (const r of rows) {
      const k = portal.groupKey(r) ?? `row:${n++}`;
      const g = groups.get(k);
      if (g) g.push(r);
      else groups.set(k, [r]);
    }
    input = [...groups.values()].map((g) => (portal.combine ? portal.combine(g) : g[g.length - 1]));
  }
  const out: OpportunityInput[] = [];
  for (const row of input) {
    if (ctx.done()) break;
    let mapped: MappedBid | null = null;
    try {
      mapped = portal.map(row, now);
    } catch (err) {
      ctx.warn(`${portal.source.id}: could not read a record`, err);
      continue;
    }
    if (!mapped) continue;
    const o = mapped.opportunity;
    if (!o.title || !o.sourceUrl || !o.sourceId) {
      ctx.warn(`${portal.source.id}: record without a title, id, or link skipped`, o.sourceId || o.title || "");
      continue;
    }
    // Without a distinctive solicitation number the default key is title + buyer + due day, which merges
    // different jobs with generic titles ("Replace Fire Alarm System"). Each record is its own opportunity then.
    if (!o.canonicalKey && canonicalKey(o).startsWith("t:")) o.canonicalKey = `${portal.source.id}:${o.sourceId}`;
    for (const f of [mapped.parentFunder, mapped.funder]) {
      if (f && !seenFunders.has(f.key)) {
        seenFunders.add(f.key);
        await ctx.funders([f]);
      }
    }
    out.push(o);
  }
  for (let i = 0; i < out.length; i += 200) await ctx.opportunities(out.slice(i, i + 200));
  return out.length;
}

/** Common opportunity fields for a public bid. */
export function bidBase(source: SourceDefinition): Pick<OpportunityInput, "type" | "currency" | "license"> {
  return { type: "contract", currency: "USD", license: source.license };
}

export type { Connector };
