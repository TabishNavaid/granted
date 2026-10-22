import { createReadStream } from "node:fs";
import { displayName } from "@/lib/foundations/names";
import { deadline } from "../normalize";
import { connect, databaseUrl } from "../ingest/store";
import { stateCode, uniq, type CauseCode } from "../vocab";
import type { Connector, FunderInput, IngestContext, OpportunityInput, PoliteFetch, SourceDefinition } from "../types";
import { grantStats, parse990PF, sentenceCase, titleCase, normalizeWebsite, type ApplicationInfo, type GrantStats } from "./_irs-990pf-parse";
import {
  downloadBmf, efileIndexUrl, efileZipUrl, EFILE_DOCS, ein9, eachCsvRow, eachCsvRowFromStream, IRS_ATTRIBUTION, IRS_LICENSE, irsPageUrl,
  openFirstZipMember, soiPfUrl, SOI_PF_DOCS, yearOf, type CsvRow,
} from "./_irs-shared";
import { RemoteZips } from "./_irs-zip";

/**
 * Private foundations nationwide, from public IRS data, in two tiers.
 *
 * Tier 1 (every run, every state): each private non-operating foundation (EO BMF foundation code 04) that paid
 * grants in its newest return in the SOI annual 990-PF extract becomes a funder row with its giving, assets, and
 * tax year. About 80,000 foundations.
 *
 * Tier 2 (resumable): foundations above IRS_990PF_MIN_GIVING (default $25,000), largest first and at most
 * IRS_990PF_MAX_XML (default 2,000) a run, get their newest 990-PF e-file read out of the IRS batch zips with
 * HTTP Range requests: application info, the preselected-only flag, grant statistics, top grantees (organizations
 * only), grantee states, focus labels, and a count of grants to individuals (never their names). A foundation is
 * skipped when its stored filing (extra.objectId) is the newest one. Each foundation that accepts applications
 * becomes one open grant opportunity, and one scholarship opportunity when it makes grants to individuals and
 * publishes application info. Opportunities of foundations read in earlier runs are rebuilt from the stored
 * funder row each run, so filed deadlines roll forward to their next date.
 */
export const source: SourceDefinition = {
  id: "irs_990pf",
  name: "IRS Form 990-PF (private foundations)",
  covers: "Private grantmaking foundations in every state from IRS filings, with how to apply, deadlines, typical grant sizes, and past grantees for the larger ones.",
  homepage: "https://www.irs.gov/charities-non-profits/private-foundations",
  docsUrl: EFILE_DOCS,
  termsUrl: "https://www.irs.gov/about-irs/use-of-content-from-irsgov",
  license: IRS_LICENSE,
  attribution: IRS_ATTRIBUTION,
  kinds: ["grant", "scholarship"],
  region: "us",
  cadence: "Daily (detail for up to 2,000 foundations a run)",
  schedule: "40 6 * * *",
  enabled: true,
  priority: 30,
};

const CURRENT_YEAR = () => new Date().getUTCFullYear();

// ---------- Tier 1: BMF and the SOI extract ----------

export interface BmfFoundation {
  ein: string;
  filedName: string;
  city: string | null;
  state: string | null;
  ntee: string | null;
}

export interface SoiYear {
  taxPeriod: string;
  taxYear: number | null;
  grantsPaid: number | null;
  assets: number | null;
  grantsToIndividuals: boolean | null;
  sourceUrl: string;
}

/** Private non-operating foundations (FOUNDATION 04) from one BMF file. */
export async function readBmfFoundations(file: string, into = new Map<string, BmfFoundation>()): Promise<Map<string, BmfFoundation>> {
  await eachCsvRow(file, (r) => {
    if (r.FOUNDATION !== "04") return;
    const ein = ein9(r.EIN);
    if (!ein || !r.NAME?.trim()) return;
    into.set(ein, { ein, filedName: r.NAME.trim(), city: r.CITY?.trim() || null, state: stateCode(r.STATE), ntee: r.NTEE_CD?.trim() || null });
  });
  return into;
}

const num = (v: string | undefined): number | null => {
  if (v === undefined || v === null || String(v).trim() === "") return null;
  const n = Number(String(v).trim());
  return Number.isFinite(n) ? n : null;
};

/** One SOI extract (zip or csv) into ein to its returns, for the EINs we keep. */
export async function readSoiExtract(file: string, sourceUrl: string, keep: (ein: string) => boolean, into = new Map<string, SoiYear[]>()): Promise<Map<string, SoiYear[]>> {
  const stream = /\.zip$/i.test(file) ? await openFirstZipMember(file, /\.csv$/i) : createReadStream(file);
  stream.setEncoding?.("latin1");
  await eachCsvRowFromStream(stream, (r: CsvRow) => {
    const ein = ein9(r.EIN);
    if (!ein || !keep(ein) || !/^\d{6}$/.test(r.TAX_PRD ?? "")) return;
    const list = into.get(ein) ?? [];
    if (list.some((x) => x.taxPeriod === r.TAX_PRD)) return;
    list.push({
      taxPeriod: r.TAX_PRD,
      taxYear: num(r.TAX_YR) ?? null,
      grantsPaid: num(r.CONTRPDPBKS),
      assets: num(r.FAIRMRKTVALEOY) ?? num(r.FAIRMRKTVALAMT),
      grantsToIndividuals: r.GRNTINDIVCD === "Y" ? true : r.GRNTINDIVCD === "N" ? false : null,
      sourceUrl,
    });
    into.set(ein, list);
  });
  return into;
}

/** The two newest SOI 990-PF extracts published (the IRS posts one a year, about 18 months after the filing year). */
async function soiFiles(ctx: IngestContext): Promise<{ file: string; url: string }[]> {
  if (ctx.env.IRS_SOI_PF_FILES) return ctx.env.IRS_SOI_PF_FILES.split(",").map((f) => ({ file: f.trim(), url: SOI_PF_DOCS }));
  const out: { file: string; url: string }[] = [];
  for (let y = CURRENT_YEAR() - 1; y >= CURRENT_YEAR() - 5 && out.length < 2; y--) {
    const yy = String(y).slice(2);
    const head = await ctx.fetch(soiPfUrl(yy), { method: "HEAD", retries: 1 });
    if (!head.ok) continue;
    out.push({ url: soiPfUrl(yy), file: await ctx.download(soiPfUrl(yy), `${yy}eoextract990pf.zip`, { maxAgeHours: 24 * 7 }) });
  }
  if (!out.length) throw new Error("No SOI 990-PF extract found");
  return out;
}

/**
 * Name as people write it: masked account numbers and trust account codes the IRS keeps on the name line are
 * dropped, then title case, then displayName (src/lib/foundations/names.ts) puts trust names in order.
 */
export function foundationName(filed: string): string {
  const s = filed
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\bFOUNDATIONINC\b/i, "FOUNDATION INC")
    .replace(/\s+X{3,}[\dX-]*$/i, "")
    .replace(/\s+(?=[A-Z]*\d)[A-Z0-9]{6,}$/i, "");
  return displayName(titleCase(s) ?? s);
}

export interface Tier1Row {
  funder: FunderInput;
  bmf: BmfFoundation;
  newest: SoiYear;
}

/** A Tier 1 funder from the BMF and the foundation's SOI returns, or null when its newest return shows no grants paid. */
export function tier1Funder(b: BmfFoundation, years: SoiYear[], minGiving = 1): Tier1Row | null {
  const sorted = [...years].sort((a, x) => x.taxPeriod.localeCompare(a.taxPeriod));
  const newest = sorted[0];
  if (!newest || !newest.grantsPaid || newest.grantsPaid < minGiving) return null;
  const name = foundationName(b.filedName);
  const sourceUrl = irsPageUrl(b.ein, b.filedName, b.city, b.state);
  return {
    bmf: b,
    newest,
    funder: {
      key: `ein:${b.ein}`,
      name,
      kind: "private_foundation",
      ein: b.ein,
      city: titleCase(b.city),
      state: b.state,
      country: "US",
      totalGiving: Math.round(newest.grantsPaid),
      assets: newest.assets !== null ? Math.round(newest.assets) : null,
      taxYear: newest.taxYear,
      grantsToIndividuals: newest.grantsToIndividuals === true ? true : null,
      sourceUrl,
      extra: { filedName: b.filedName },
    },
  };
}

// ---------- Tier 2: the e-file index and XML ----------

export interface IndexEntry {
  ein: string;
  taxPeriod: string;
  objectId: string;
  batch: string;
  year: string;
}

/** Newest 990-PF per EIN from an e-file index CSV. */
export async function readEfileIndex(file: string, year: string, keep: (ein: string) => boolean, into = new Map<string, IndexEntry>()): Promise<Map<string, IndexEntry>> {
  await eachCsvRow(file, (r) => {
    if (r.RETURN_TYPE !== "990PF") return;
    const ein = ein9(r.EIN);
    if (!ein || !keep(ein) || !/^\d+$/.test(r.OBJECT_ID ?? "") || !/^[A-Za-z0-9_]+$/.test(r.XML_BATCH_ID ?? "")) return;
    const e: IndexEntry = { ein, taxPeriod: r.TAX_PERIOD ?? "", objectId: r.OBJECT_ID, batch: r.XML_BATCH_ID.toUpperCase(), year };
    const cur = into.get(ein);
    if (!cur || `${e.taxPeriod}|${e.objectId}` > `${cur.taxPeriod}|${cur.objectId}`) into.set(ein, e);
  });
  return into;
}

async function indexFiles(ctx: IngestContext): Promise<{ year: string; file: string }[]> {
  if (ctx.env.IRS_EFILE_INDEX_FILES) {
    return ctx.env.IRS_EFILE_INDEX_FILES.split(",").map((s) => {
      const [year, file] = s.split("=");
      return { year: year.trim(), file: file.trim() };
    });
  }
  const years = (ctx.env.IRS_990PF_INDEX_YEARS ?? `${CURRENT_YEAR()},${CURRENT_YEAR() - 1}`).split(",").map((y) => y.trim()).filter((y) => /^\d{4}$/.test(y));
  const out: { year: string; file: string }[] = [];
  for (const year of years) {
    const current = Number(year) >= CURRENT_YEAR();
    try {
      out.push({ year, file: await ctx.download(efileIndexUrl(year), `index_${year}.csv`, { maxAgeHours: current ? 20 : 24 * 30 }) });
    } catch (err) {
      ctx.warn(`No e-file index for ${year}`, err);
    }
  }
  return out;
}

/** The XML of one return, trying the batch the index names, then its sibling parts (05A, 05B, ...). */
export class EfileReader {
  zips: RemoteZips;
  private missing = new Set<string>();
  constructor(fetch: PoliteFetch, cacheDir: string) {
    this.zips = new RemoteZips(fetch, cacheDir);
  }
  async xml(e: IndexEntry): Promise<Buffer | null> {
    const name = `${e.objectId}_public.xml`;
    const m = e.batch.match(/^(.*_)(\d{2})([A-Z])$/);
    const batches = uniq([e.batch, ...(m ? "ABCDEFGH".split("").map((l) => `${m[1]}${m[2]}${l}`) : [])]);
    for (const b of batches) {
      const url = efileZipUrl(e.year, b);
      if (this.missing.has(url)) continue;
      try {
        const data = await this.zips.member(url, name);
        if (data) return data;
      } catch (err) {
        if (/HTTP 404|not honored \(HTTP 404/.test(String(err instanceof Error ? err.message : err))) {
          this.missing.add(url);
          // Parts are lettered in order; a missing part means no later ones.
          if (b !== e.batch) break;
          continue;
        }
        throw err;
      }
    }
    return null;
  }
}

/** The JSON the IRS Tax Exempt Organization Search page reads to list an organization's filed returns. */
export const teosReturnsUrl = (ein: string) => `https://apps.irs.gov/teos/details/returnsSearch/${ein}`;

/**
 * The public PDF copy of a 990-PF on irs.gov for one tax period, as listed by Tax Exempt Organization Search, or null
 * when the IRS has not published it yet. The search page itself has no deep link per organization, so this PDF is
 * the most direct public IRS link to the filing we read.
 */
export async function filingPdfUrl(fetch: PoliteFetch, ein: string, taxPeriod: string): Promise<string | null> {
  const res = await fetch(teosReturnsUrl(ein), { retries: 2, timeoutMs: 30_000 });
  if (!res.ok) {
    await res.body?.cancel().catch(() => undefined);
    return null;
  }
  const data = (await res.json()) as { items?: { TAX_PERIOD?: string; RETURN_TYPE?: string; STATICFILEPATH?: string }[] };
  const hit = (data.items ?? []).find((i) => i.RETURN_TYPE === "990PF" && i.TAX_PERIOD === taxPeriod && /^\/pub\/epostcard\/cor\/[\w.-]+\.pdf$/.test(i.STATICFILEPATH ?? ""));
  return hit ? `https://apps.irs.gov${hit.STATICFILEPATH}` : null;
}

/** Everything about a foundation the opportunities need; built from a filing or from a stored funder row. */
export interface FoundationDetail {
  ein: string;
  name: string;
  filedName: string;
  city: string | null;
  state: string | null;
  taxYear: number | null;
  objectId: string;
  sourceUrl: string;
  totalGiving: number | null;
  grantCount: number;
  /** Typical range: 10th to 90th percentile of grants to organizations. */
  grantLow: number | null;
  grantMedian: number | null;
  grantHigh: number | null;
  focus: string[];
  granteeStates: { state: string; count: number }[];
  onlyPreselected: boolean;
  accepts: boolean | null;
  application: ApplicationInfo | null;
  individual: GrantStats["individual"];
}

/** A Tier 2 funder row and its detail, from a parsed filing. */
export function tier2FromXml(
  xml: Buffer | string,
  entry: IndexEntry,
  fallback: { filedName: string; city: string | null; state: string | null } | null,
  filingUrl: string | null = null,
): { funder: FunderInput; detail: FoundationDetail } | null {
  const p = parse990PF(xml);
  if (!p) return null;
  const s = grantStats(p);
  // The BMF name is the registered one; the e-file name line often carries trustees and account codes.
  const filedName = fallback?.filedName || p.name || "";
  if (!filedName) return null;
  const city = p.city ?? fallback?.city ?? null;
  const state = stateCode(p.state) ?? fallback?.state ?? null;
  const name = foundationName(filedName);
  const sourceUrl = filingUrl ?? irsPageUrl(entry.ein, fallback?.filedName ?? filedName, fallback?.city ?? city, fallback?.state ?? state);
  const taxYear = p.taxYear ?? yearOf(entry.taxPeriod);
  const geography = s.granteeStates.filter((g) => g.count / Math.max(1, s.grantCount) >= 0.1).slice(0, 6).map((g) => g.state);
  const detail: FoundationDetail = {
    ein: entry.ein,
    name,
    filedName: fallback?.filedName ?? filedName,
    city: titleCase(city),
    state,
    taxYear,
    objectId: entry.objectId,
    sourceUrl,
    totalGiving: s.totalGiving,
    grantCount: s.grantCount,
    grantLow: s.grantP10,
    grantMedian: s.grantMedian,
    grantHigh: s.grantP90,
    focus: s.focus,
    granteeStates: s.granteeStates,
    onlyPreselected: p.onlyPreselected,
    accepts: p.accepts,
    application: p.application,
    individual: s.individual,
  };
  const funder: FunderInput = {
    key: `ein:${entry.ein}`,
    name,
    kind: "private_foundation",
    ein: entry.ein,
    website: normalizeWebsite(p.website),
    city: detail.city,
    state,
    country: "US",
    focus: s.focus,
    geography: geography.length ? geography : state ? [state] : [],
    acceptsApplications: p.accepts,
    grantsToIndividuals: s.individual.count > 0,
    typicalGrantMin: s.grantP10,
    typicalGrantMedian: s.grantMedian,
    typicalGrantMax: s.grantP90,
    totalGiving: s.totalGiving,
    assets: p.assets !== null ? Math.round(p.assets) : null,
    taxYear,
    sourceUrl,
    extra: {
      filedName: detail.filedName,
      objectId: entry.objectId,
      batchId: entry.batch,
      taxPeriod: entry.taxPeriod,
      onlyPreselected: p.onlyPreselected,
      application: p.application,
      grantCount: s.grantCount,
      grantMin: s.grantMin,
      grantMax: s.grantMax,
      // Compact on purpose (about 60,000 foundations): [state, grants] pairs and [name, city, state, amount, purpose] rows.
      granteeStates: s.granteeStates.slice(0, 10).map((g) => [g.state, g.count]),
      grantees: s.grantees.map((g) => [g.name, g.city, g.state, g.amount, g.purpose ? sentenceCase(g.purpose, 80) : null]),
      individualGrants: s.individual,
    },
    giving: taxYear
      ? [{ year: taxYear, totalGiving: s.totalGiving, grantCount: s.grantCount || null, grantMedian: s.grantMedian, grantMin: s.grantMin, grantMax: s.grantMax, assets: p.assets !== null ? Math.round(p.assets) : null, sourceUrl }]
      : [],
  };
  return { funder, detail };
}

// ---------- Opportunities ----------

const FOCUS_CAUSES: Record<string, CauseCode[]> = {
  "Youth development": ["youth"],
  Education: ["education"],
  "Food security": ["food"],
  Health: ["health"],
  "Rural health": ["health"],
  "Human services": ["human_services"],
  Housing: ["housing"],
  "Arts and culture": ["arts"],
  Environment: ["environment"],
  "Community development": ["community"],
  Religion: ["religion"],
  Animals: ["animals"],
  Scholarships: ["education"],
};

export function causesFromFocus(focus: string[]): CauseCode[] {
  return uniq(focus.flatMap((f) => FOCUS_CAUSES[f] ?? []));
}

const MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];

/**
 * Deadline text as filed to our fields. A month and day named in the text gives the next such date. Text that
 * says there is no deadline ("None", "rolling", "any time") is rolling. Anything else stays as text only.
 */
export function deadlineFromText(text: string | null | undefined, today = new Date()): { rolling: boolean; closeAt: string | null; closeText: string | null } {
  const raw = (text ?? "").trim();
  if (!raw) return { rolling: true, closeAt: null, closeText: null };
  const dates: number[] = [];
  const start = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  const push = (mi: number, day: number) => {
    if (mi < 0 || mi > 11 || day < 1 || day > 31) return;
    let d = Date.UTC(today.getUTCFullYear(), mi, day);
    if (new Date(d).getUTCDate() !== day) return;
    if (d < start) d = Date.UTC(today.getUTCFullYear() + 1, mi, day);
    dates.push(d);
  };
  // "June 1-15" is a window: the deadline is its last day.
  const named = new RegExp(`\\b(${MONTHS.join("|")}|jan|feb|mar|apr|jun|jul|aug|sept?|oct|nov|dec)\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?(?:\\s*[-–]\\s*(\\d{1,2})(?:st|nd|rd|th)?)?\\b`, "gi");
  for (const m of raw.matchAll(named)) push(MONTHS.findIndex((x) => x.startsWith(m[1].toLowerCase().slice(0, 3))), Number(m[3] ?? m[2]));
  const dayFirst = new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+(?:of\\s+)?(${MONTHS.join("|")})\\b`, "gi");
  for (const m of raw.matchAll(dayFirst)) push(MONTHS.indexOf(m[2].toLowerCase()), Number(m[1]));
  for (const m of raw.matchAll(/\b(\d{1,2})\/(\d{1,2})(?:\/\d{2,4})?\b/g)) push(Number(m[1]) - 1, Number(m[2]));
  const closeText = raw.slice(0, 300);
  if (dates.length) {
    const next = new Date(Math.min(...dates)).toISOString().slice(0, 10);
    return { rolling: false, closeAt: deadline(next), closeText };
  }
  if (/\b(none|no (set |specific |submission )?deadlines?|not applicable|n\/a|rolling|any ?time|year[- ]round|ongoing|continuous(ly)?|at any time|open)\b/i.test(raw)) {
    return { rolling: true, closeAt: null, closeText };
  }
  return { rolling: false, closeAt: null, closeText };
}

const MIN_ORG_GRANTS = 3;

const usd = (n: number | null | undefined) => (n == null ? null : `$${Math.round(n).toLocaleString("en-US")}`);

/** The state most of its grantees are in, when it holds at least half of them; else null (gives across states). */
export function givingState(d: Pick<FoundationDetail, "granteeStates" | "grantCount" | "state">): string | null {
  const top = d.granteeStates[0];
  if (!top) return d.grantCount ? null : d.state;
  const counted = d.granteeStates.reduce((s, g) => s + g.count, 0);
  return top.count / Math.max(1, counted) >= 0.5 ? (stateCode(top.state) ?? null) : null;
}

/** One open grant row for a foundation that accepts applications, and a scholarship row when it funds individuals. */
export function opportunitiesFor(d: FoundationDetail, today = new Date()): OpportunityInput[] {
  return candidateRows(d, today)
    .filter((c) => c.qualifies)
    .map((c) => c.row);
}

/**
 * Both possible rows for a foundation with whether each qualifies. Rows that do not qualify are used only to close
 * an opportunity an earlier run opened (the foundation stopped taking applications, or its new filing changed).
 */
export function candidateRows(d: FoundationDetail, today = new Date()): { row: OpportunityInput; qualifies: boolean }[] {
  const out: { row: OpportunityInput; qualifies: boolean }[] = [];
  const app = d.application;
  const appText = [app?.howTo, app?.deadlines, app?.restrictions, app?.contact].filter(Boolean).join(" ");
  // Foreign private foundations (section 4948(b)) file a 990-PF but take no applications through it.
  const accepts = !d.onlyPreselected && d.accepts === true && !/\b4948\s*\(?b\)?/i.test(appText);
  const dl = deadlineFromText(app?.deadlines, today);
  const where = d.city && d.state ? `${d.city}, ${d.state}` : (d.state ?? "the United States");
  const contact = app && (app.contactName || app.email || app.phone) ? { name: app.contactName, email: app.email, phone: app.phone } : null;
  const placeText = d.granteeStates.length ? `Grantees mostly in ${d.granteeStates.slice(0, 4).map((g) => `${g.state} (${g.count})`).join(", ")}` : null;
  const common = {
    funderKey: `ein:${d.ein}`,
    funderName: d.name,
    status: "open" as const,
    rolling: dl.rolling,
    closeAt: dl.closeAt,
    closeText: dl.closeText,
    sourceUrl: d.sourceUrl,
    contact,
    place: { state: givingState(d), country: "US", text: placeText },
    noticeType: "foundation",
  };
  const howTo = app?.howTo ? `How to apply, as filed: ${app.howTo}` : "The filing does not describe how to apply. Contact the foundation first.";
  const restrictions = app?.restrictions ? `Restrictions, as filed: ${app.restrictions}` : null;
  const deadlines = app?.deadlines ? `Deadlines, as filed: ${app.deadlines}` : null;
  // At least three grants to organizations, as in the curated dataset: one or two is a pass-through, not a program.
  out.push({
    qualifies: accepts && d.grantCount >= MIN_ORG_GRANTS,
    row: {
      ...common,
      sourceId: `${d.ein}:grant`,
      canonicalKey: `ein:${d.ein}:grant`,
      type: "grant",
      title: `${d.name} grants`,
      summary: [
        `A private foundation in ${where}.`,
        `In tax year ${d.taxYear ?? "unknown"} it paid ${usd(d.totalGiving) ?? "an unstated amount"} in ${d.grantCount} grants to organizations${d.grantMedian !== null ? `, typically ${usd(d.grantMedian)}, most between ${usd(d.grantLow)} and ${usd(d.grantHigh)}` : ""}.`,
        d.focus.length ? `Focus, from the purposes of its grants: ${d.focus.join(", ")}.` : null,
        howTo,
        restrictions,
        deadlines,
      ]
        .filter(Boolean)
        .join(" "),
      amountMin: d.grantLow,
      amountMax: d.grantHigh,
      amountTotal: d.totalGiving,
      awardCount: d.grantCount,
      eligibility: ["nonprofit"],
      eligibilityText: app?.restrictions ?? null,
      causes: causesFromFocus(d.focus),
      categories: d.focus,
      extra: { ein: d.ein, taxYear: d.taxYear, objectId: d.objectId },
    },
  });
  // Grants to individuals become a scholarship row only when they look like a program people apply to: mostly
  // scholarships by purpose, or application info that speaks to students or scholarships.
  const scholarships = d.individual.scholarships * 2 >= d.individual.count;
  const forPeople = /scholarship|student|tuition|fellowship|financial aid|college|academic|camper|grant to individuals/i.test(appText);
  out.push({
    qualifies: accepts && d.individual.count >= 2 && !!app && (scholarships || forPeople),
    row: {
      ...common,
      sourceId: `${d.ein}:individual`,
      canonicalKey: `ein:${d.ein}:individual`,
      type: "scholarship",
      title: scholarships ? `${d.name} scholarships` : `${d.name} grants to individuals`,
      summary: [
        `A private foundation in ${where}.`,
        `In tax year ${d.taxYear ?? "unknown"} it made ${d.individual.count} grant${d.individual.count === 1 ? "" : "s"} to individuals totaling ${usd(d.individual.total)}${d.individual.median !== null ? `, typically ${usd(d.individual.median)}` : ""}.`,
        howTo,
        restrictions,
        deadlines,
      ]
        .filter(Boolean)
        .join(" "),
      amountMin: d.individual.min,
      amountMax: d.individual.max,
      amountTotal: d.individual.total || null,
      awardCount: d.individual.count,
      eligibility: ["individual"],
      eligibilityText: app?.restrictions ?? null,
      causes: scholarships ? ["education"] : causesFromFocus(d.focus),
      categories: scholarships ? ["Scholarships"] : [],
      extra: { ein: d.ein, taxYear: d.taxYear, objectId: d.objectId },
    },
  });
  return out;
}

// ---------- What earlier runs stored ----------

export interface PriorFunder {
  objectId: string | null;
  taxYear: number | null;
  detail: FoundationDetail | null;
}

interface PriorRow {
  key: string;
  name: string;
  city: string | null;
  state: string | null;
  focus: string[];
  accepts_applications: boolean | null;
  typical_grant_min: string | null;
  typical_grant_median: string | null;
  typical_grant_max: string | null;
  total_giving: string | null;
  tax_year: number | null;
  source_url: string;
  extra: Record<string, unknown>;
}

const n = (v: string | number | null | undefined) => (v === null || v === undefined ? null : Number(v));

/** A stored Tier 2 funder row back to the detail the opportunities are built from. */
export function detailFromRow(r: PriorRow): FoundationDetail | null {
  const x = r.extra ?? {};
  if (typeof x.objectId !== "string") return null;
  const ind = (x.individualGrants as GrantStats["individual"] | undefined) ?? { count: 0, total: 0, min: null, median: null, max: null, scholarships: 0 };
  return {
    ein: r.key.replace(/^ein:/, ""),
    name: r.name,
    filedName: typeof x.filedName === "string" ? x.filedName : r.name,
    city: r.city,
    state: r.state,
    taxYear: r.tax_year,
    objectId: x.objectId,
    sourceUrl: r.source_url,
    totalGiving: n(r.total_giving),
    grantCount: Number(x.grantCount ?? 0),
    grantLow: n(r.typical_grant_min),
    grantMedian: n(r.typical_grant_median),
    grantHigh: n(r.typical_grant_max),
    focus: r.focus ?? [],
    granteeStates: ((x.granteeStates as ([string, number] | { state: string; count: number })[] | undefined) ?? []).map((g) => (Array.isArray(g) ? { state: g[0], count: g[1] } : g)),
    onlyPreselected: x.onlyPreselected === true,
    accepts: r.accepts_applications,
    application: (x.application as ApplicationInfo | null | undefined) ?? null,
    individual: ind,
  };
}

/** Foundations an earlier run read in detail, from the database (none when DATABASE_URL is not set). */
async function loadPrior(ctx: IngestContext): Promise<{ funders: Map<string, PriorFunder>; open: Set<string> }> {
  const out = new Map<string, PriorFunder>();
  const open = new Set<string>();
  const url = databaseUrl(ctx.env);
  if (!url || ctx.env.IRS_990PF_IGNORE_PRIOR === "1") return { funders: out, open };
  const sql = connect(url);
  try {
    const rows = await sql<PriorRow[]>`
      select key, name, city, state, focus, accepts_applications, typical_grant_min, typical_grant_median, typical_grant_max, total_giving, tax_year, source_url,
        jsonb_build_object('objectId', extra->'objectId', 'filedName', extra->'filedName', 'grantCount', extra->'grantCount', 'granteeStates', extra->'granteeStates',
          'onlyPreselected', extra->'onlyPreselected', 'application', extra->'application', 'individualGrants', extra->'individualGrants') as extra
      from catalog_funders where source = ${source.id} and extra ? 'objectId'`;
    for (const r of rows) out.set(r.key, { objectId: (r.extra?.objectId as string) ?? null, taxYear: r.tax_year, detail: detailFromRow(r) });
    const opps = await sql<{ source_id: string }[]>`select source_id from catalog_opportunities where source = ${source.id} and status in ('open', 'forecasted')`;
    for (const o of opps) open.add(o.source_id);
  } finally {
    await sql.end({ timeout: 5 });
  }
  return { funders: out, open };
}

// ---------- The run ----------

function envNumber(v: string | undefined, d: number): number {
  const x = Number(v);
  return v !== undefined && v !== "" && Number.isFinite(x) && x >= 0 ? x : d;
}

/** Last-Modified of a URL, or null. */
async function lastModified(ctx: IngestContext, url: string): Promise<Date | null> {
  try {
    const r = await ctx.fetch(url, { method: "HEAD", retries: 1 });
    const lm = r.headers.get("last-modified");
    return lm ? new Date(lm) : null;
  } catch {
    return null;
  }
}

export const irs990pf: Connector = {
  source,
  async run(ctx) {
    const minGiving = envNumber(ctx.env.IRS_990PF_MIN_GIVING, 25_000);
    const tier1Min = envNumber(ctx.env.IRS_990PF_TIER1_MIN_GIVING, 1);
    const maxXml = envNumber(ctx.env.IRS_990PF_MAX_XML, 2_000);
    const concurrency = Math.max(1, Math.min(8, envNumber(ctx.env.IRS_990PF_CONCURRENCY, 4)));
    const today = new Date();

    // Tier 1
    const t0 = Date.now();
    const bmf = new Map<string, BmfFoundation>();
    for (const f of await downloadBmf(ctx)) await readBmfFoundations(f, bmf);
    const soi = new Map<string, SoiYear[]>();
    const soiList = await soiFiles(ctx);
    for (const s of soiList) await readSoiExtract(s.file, s.url, (e) => bmf.has(e), soi);
    ctx.log(`${bmf.size} private non-operating foundations in the BMF, ${soi.size} with an SOI 990-PF return (${Math.round((Date.now() - t0) / 1000)}s)`);

    const { funders: prior, open: priorOpen } = await loadPrior(ctx);
    if (prior.size) ctx.log(`${prior.size} foundations already read in detail by earlier runs`);

    // In an incremental run Tier 1 rows are rewritten only when the BMF or the SOI extract changed since the last run.
    let writeTier1 = true;
    if (ctx.mode === "incremental" && ctx.since && !ctx.env.IRS_BMF_DIR) {
      const stamps = await Promise.all([lastModified(ctx, "https://www.irs.gov/pub/irs-soi/eo1.csv"), ...soiList.map((s) => lastModified(ctx, s.url))]);
      writeTier1 = stamps.some((d) => !d || d > ctx.since!);
      if (!writeTier1) ctx.log("BMF and SOI extract unchanged since the last run; Tier 1 rows kept");
    }

    const tier1 = new Map<string, Tier1Row>();
    let batch: FunderInput[] = [];
    for (const b of bmf.values()) {
      const row = tier1Funder(b, soi.get(b.ein) ?? [], tier1Min);
      if (!row) continue;
      tier1.set(b.ein, row);
      if (!writeTier1) continue;
      const p = prior.get(row.funder.key);
      // Detail from a filing at least as new as the SOI figures wins; leave those fields as stored.
      const f = p?.objectId && (p.taxYear ?? 0) >= (row.funder.taxYear ?? 0) ? { ...row.funder, sourceUrl: p.detail?.sourceUrl ?? row.funder.sourceUrl, totalGiving: null, assets: null, taxYear: null } : row.funder;
      batch.push(f);
      if (batch.length >= 1_000) {
        await ctx.funders(batch);
        batch = [];
      }
    }
    if (batch.length) await ctx.funders(batch);
    ctx.log(`Tier 1: ${tier1.size} foundations paid grants${writeTier1 ? "" : " (not rewritten)"}`);

    // Tier 2
    const eligible = new Set([...tier1.values()].filter((r) => (r.funder.totalGiving ?? 0) >= minGiving).map((r) => r.bmf.ein));
    const index = new Map<string, IndexEntry>();
    for (const { year, file } of await indexFiles(ctx)) await readEfileIndex(file, year, (e) => eligible.has(e), index);
    const queue = [...index.values()]
      .filter((e) => prior.get(`ein:${e.ein}`)?.objectId !== e.objectId)
      .sort((a, b) => (tier1.get(b.ein)?.funder.totalGiving ?? 0) - (tier1.get(a.ein)?.funder.totalGiving ?? 0));
    const upToDate = [...index.values()].length - queue.length;
    ctx.log(`Tier 2: ${eligible.size} foundations gave at least $${minGiving.toLocaleString("en-US")}; ${index.size} have a 990-PF e-file; ${upToDate} already current; ${queue.length} to read, up to ${maxXml} this run`);

    const reader = new EfileReader(ctx.fetch, ctx.cacheDir);
    const work = queue.slice(0, maxXml);
    const done = new Map<string, FoundationDetail>();
    const emitted = new Set<string>();
    const emit = async (rows: OpportunityInput[]) => {
      for (const r of rows) emitted.add(r.sourceId);
      await ctx.opportunities(rows);
    };
    let read = 0;
    let failed = 0;
    let missing = 0;
    let pdfs = 0;
    let next = 0;
    const pdfLinks = ctx.env.IRS_990PF_PDF_LINKS !== "0";
    const t2 = Date.now();
    const worker = async () => {
      while (next < work.length && !ctx.done()) {
        const e = work[next++];
        try {
          const xml = await reader.xml(e);
          if (!xml) {
            missing++;
            continue;
          }
          const b = tier1.get(e.ein)!.bmf;
          const pdf = pdfLinks ? await filingPdfUrl(ctx.fetch, e.ein, e.taxPeriod).catch(() => null) : null;
          if (pdf) pdfs++;
          const out = tier2FromXml(xml, e, { filedName: b.filedName, city: b.city, state: b.state }, pdf);
          if (!out) {
            missing++;
            continue;
          }
          await ctx.funders([out.funder]);
          await emit(opportunitiesFor(out.detail, today));
          done.set(out.funder.key, out.detail);
          read++;
          if (read % 250 === 0) ctx.log(`Tier 2: ${read} read, ${failed} failed, ${missing} not found, ${Math.round((Date.now() - t2) / 1000)}s`);
        } catch (err) {
          failed++;
          ctx.warn(`Could not read the 990-PF ${e.objectId} for EIN ${e.ein}`, err);
        }
      }
    };
    await Promise.all(Array.from({ length: concurrency }, worker));
    ctx.log(`Tier 2: ${read} filings read, ${failed} failed, ${missing} not found in their batch, ${reader.zips.requests} range requests, ${pdfs} filing PDF links, ${Math.round((Date.now() - t2) / 1000)}s; ${Math.max(0, queue.length - work.length)} left for later runs`);

    // Opportunities of foundations read earlier, rebuilt so deadlines roll forward.
    let refreshed = 0;
    let rows: OpportunityInput[] = [];
    for (const [key, p] of prior) {
      if (ctx.done()) break;
      if (done.has(key) || !p.detail || !tier1.has(p.detail.ein)) continue;
      rows.push(...opportunitiesFor({ ...p.detail, name: tier1.get(p.detail.ein)!.funder.name }, today));
      if (rows.length >= 400) {
        refreshed += rows.length;
        await emit(rows);
        rows = [];
      }
    }
    if (rows.length) await emit(rows);
    refreshed += rows.length;
    if (prior.size) ctx.log(`${refreshed} opportunities of foundations read in earlier runs refreshed`);

    // Open rows from earlier runs that no longer qualify (new filing, preselected only, or the foundation left the BMF) are closed.
    if (!ctx.done()) {
      const closing: OpportunityInput[] = [];
      for (const id of priorOpen) {
        if (emitted.has(id)) continue;
        const key = `ein:${id.split(":")[0]}`;
        const d = done.get(key) ?? prior.get(key)?.detail;
        const row = d ? candidateRows(d, today).find((c) => c.row.sourceId === id)?.row : undefined;
        if (row) closing.push({ ...row, status: "closed", rolling: false });
        else ctx.warn(`Open opportunity ${id} has no stored foundation detail to close it with`);
      }
      if (closing.length) await ctx.opportunities(closing);
      if (closing.length) ctx.log(`${closing.length} opportunities closed: the foundation no longer takes applications this way`);
    }
  },
};

export const connectors: Connector[] = [irs990pf];
