import { stat } from "node:fs/promises";
import path from "node:path";
import { parse } from "csv-parse";
import yauzl from "yauzl";
import { SET_ASIDES, stateCode } from "../vocab";
import { getJson, HttpError, sleep } from "../ingest/http";
import type { AwardStatInput, Connector, IngestContext, SourceDefinition } from "../types";

/**
 * USAspending.gov: past federal contract and grant awards, kept ONLY as aggregates in catalog_award_stats.
 * Recipient names never leave the download: we request award files limited to the columns we aggregate
 * (no recipient fields at all), stream them, and keep counts, totals, and percentiles.
 *
 * Why downloads and not the search endpoints: the category and geography endpoints return sums but no
 * counts, and nothing returns medians. The Advanced Search download (POST /api/v2/download/awards/)
 * accepts the full filter set (NAICS, award types, amounts, "new awards only") and a `columns` list, so
 * one small request per fiscal year and slice gives award-level amounts. Downloads are generated
 * asynchronously; we run them one at a time and poll the status endpoint.
 *
 * What a row means: awards whose base action (the original award date) falls in the federal fiscal year,
 * with amount = total obligated on the award to date, counting only awards with a positive amount.
 * Construction and A/E contracts (NAICS sector 23 and the design and engineering codes below) and all
 * grants are pulled for every award, so their medians and quartiles are exact. Contracts in every other
 * NAICS code are pulled only for awards of $250,000 or more (the simplified acquisition threshold; there
 * are about 5 million smaller awards a year, mostly micro-purchases and small orders); those rows carry
 * program "Contracts of $250,000 or more" and their counts and percentiles describe that population only.
 */
export const source: SourceDefinition = {
  id: "usaspending",
  name: "USAspending.gov",
  covers: "Past federal contract and grant awards as yearly totals: how many awards, how much, and typical award sizes by NAICS code, Assistance Listing, agency, and state.",
  homepage: "https://www.usaspending.gov",
  docsUrl: "https://api.usaspending.gov/docs/endpoints",
  termsUrl: "https://www.usaspending.gov/about",
  license: "Public domain (U.S. government data; free to copy, adapt, and redistribute, per usaspending.gov/about)",
  attribution: "Source: USAspending.gov, U.S. Department of the Treasury",
  kinds: ["contract", "grant"],
  region: "us",
  cadence: "Weekly",
  schedule: "0 6 * * 0",
  enabled: true,
  priority: 60,
  notes: "Aggregates only. Rows count new awards by fiscal year of the original award date, with amounts obligated to date. Contracts outside construction and A/E count awards of $250,000 or more.",
};

const API = "https://api.usaspending.gov/api/v2";
const SEARCH_URL = "https://www.usaspending.gov/search";

/** Architecture, engineering, and related design and environmental services, besides all of sector 23. */
export const AE_NAICS = ["541310", "541320", "541330", "541340", "541350", "541370", "541380", "541410", "541420", "541490", "541611", "541618", "541620", "541690", "541990", "562910"];
export const AEC_FILTER = ["23", ...AE_NAICS];
/**
 * Contracts outside construction and A/E are counted from this size up: the simplified acquisition threshold,
 * above which agencies must compete awards formally. There are about 5 million smaller awards a year, and the
 * service refuses to build files that large.
 */
export const OTHER_MIN = 250_000;
export const OTHER_PROGRAM = "Contracts of $250,000 or more";

export function isAec(naics: string): boolean {
  return naics.startsWith("23") || AE_NAICS.includes(naics);
}

const CONTRACT_COLUMNS = [
  "contract_award_unique_key",
  "total_obligated_amount",
  "award_base_action_date_fiscal_year",
  "awarding_agency_code",
  "awarding_agency_name",
  "awarding_sub_agency_code",
  "awarding_sub_agency_name",
  "primary_place_of_performance_state_code",
  "naics_code",
  "type_of_set_aside_code",
];
const GRANT_COLUMNS = [
  "assistance_award_unique_key",
  "total_obligated_amount",
  "award_base_action_date_fiscal_year",
  "awarding_agency_code",
  "awarding_agency_name",
  "awarding_sub_agency_code",
  "awarding_sub_agency_name",
  "primary_place_of_performance_state_name",
  "cfda_numbers_and_titles",
  "assistance_type_code",
];

/** Block grants, formula grants, project grants, and cooperative agreements. */
export const GRANT_TYPES = ["02", "03", "04", "05"];
const CONTRACT_TYPES = ["A", "B", "C", "D"];

/** Federal fiscal year of a date: October starts the next year. */
export function fiscalYear(d: Date): number {
  return d.getUTCMonth() >= 9 ? d.getUTCFullYear() + 1 : d.getUTCFullYear();
}

/** Backfill: the last three completed fiscal years and the current one. Incremental: the current year, plus the last one until the end of December (late reporting, and the 90-day delay on Defense contracts). */
export function fiscalYears(mode: "backfill" | "incremental", now = new Date()): number[] {
  const cur = fiscalYear(now);
  if (mode === "backfill") return [cur - 3, cur - 2, cur - 1, cur];
  return now.getUTCMonth() >= 9 ? [cur - 1, cur] : [cur];
}

export type Slice = "aec" | "other" | "grant";

export interface Job {
  key: string;
  slice: Slice;
  fy: number;
  label: string;
  body: Record<string, unknown>;
}

function period(fy: number) {
  return [{ start_date: `${fy - 1}-10-01`, end_date: `${fy}-09-30`, date_type: "new_awards_only" }];
}

/** The downloads for one fiscal year. */
export function jobsFor(fy: number, slices: Slice[] = ["aec", "grant", "other"]): Job[] {
  const out: Job[] = [];
  if (slices.includes("aec"))
    out.push({
      key: `contracts-aec-fy${fy}`,
      slice: "aec",
      fy,
      label: `construction and A/E contracts, FY${fy}`,
      body: { filters: { time_period: period(fy), award_type_codes: CONTRACT_TYPES, naics_codes: { require: AEC_FILTER } }, columns: CONTRACT_COLUMNS, file_format: "csv", limit: 500_000 },
    });
  if (slices.includes("grant"))
    out.push({
      key: `grants-fy${fy}`,
      slice: "grant",
      fy,
      label: `grants, FY${fy}`,
      body: { filters: { time_period: period(fy), award_type_codes: GRANT_TYPES }, columns: GRANT_COLUMNS, file_format: "csv", limit: 500_000 },
    });
  if (slices.includes("other"))
    out.push({
      key: `contracts-other-fy${fy}`,
      slice: "other",
      fy,
      label: `other contracts of $250,000 or more, FY${fy}`,
      body: {
        filters: { time_period: period(fy), award_type_codes: CONTRACT_TYPES, award_amounts: [{ lower_bound: OTHER_MIN }], naics_codes: { exclude: AEC_FILTER } },
        columns: CONTRACT_COLUMNS,
        file_format: "csv",
        limit: 500_000,
      },
    });
  return out;
}

// ---------- Statistics ----------

/** Linear interpolation between closest ranks (the common "type 7" definition). `sorted` must be ascending. */
export function percentile(sorted: number[], p: number): number | null {
  if (!sorted.length) return null;
  const h = (sorted.length - 1) * p;
  const lo = Math.floor(h);
  const hi = Math.ceil(h);
  return round2(sorted[lo] + (sorted[hi] - sorted[lo]) * (h - lo));
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

export function summarize(amounts: number[]) {
  const sorted = [...amounts].sort((a, b) => a - b);
  const total = sorted.reduce((s, x) => s + x, 0);
  return {
    awardCount: sorted.length,
    totalAmount: round2(total),
    medianAmount: percentile(sorted, 0.5),
    p25Amount: percentile(sorted, 0.25),
    p75Amount: percentile(sorted, 0.75),
    minAmount: sorted.length ? round2(sorted[0]) : null,
    maxAmount: sorted.length ? round2(sorted[sorted.length - 1]) : null,
  };
}

type Dims = Omit<AwardStatInput, "fiscalYear" | "awardCount" | "totalAmount" | "medianAmount" | "p25Amount" | "p75Amount" | "minAmount" | "maxAmount" | "sourceUrl">;

/** Groups amounts by dimensions; one output row per group. */
export class Aggregator {
  private groups = new Map<string, { dims: Dims; amounts: number[] }>();
  constructor(private fy: number) {}

  add(dims: Dims, amount: number) {
    const key = [dims.awardType, dims.agency, dims.subAgency, dims.naics, dims.assistanceListing, dims.program, dims.placeState, dims.setAside].join("|");
    let g = this.groups.get(key);
    if (!g) this.groups.set(key, (g = { dims, amounts: [] }));
    g.amounts.push(amount);
  }

  get size() {
    return this.groups.size;
  }

  rows(): AwardStatInput[] {
    return [...this.groups.values()].map((g) => ({ ...g.dims, fiscalYear: this.fy, ...summarize(g.amounts), sourceUrl: SEARCH_URL }));
  }
}

const STATE_NAMES: Record<string, string> = { "VIRGIN ISLANDS": "VI", "U.S. VIRGIN ISLANDS": "VI", "NORTHERN MARIANA ISLANDS": "MP", "DISTRICT OF COLUMBIA": "DC" };

function stateFromName(name: string): string | null {
  const v = name.trim().toUpperCase();
  return STATE_NAMES[v] ?? stateCode(name);
}

/** Set-aside code as USAspending writes it to the label we show. Empty means not reported on the award (task and delivery orders inherit it from their vehicle). */
export function setAsideLabel(code: string): string | null {
  const c = code.trim().toUpperCase();
  if (!c) return null;
  if (c === "NONE") return "No set-aside";
  if (c === "BI") return SET_ASIDES.BICiv;
  const hit = Object.entries(SET_ASIDES).find(([k]) => k.toUpperCase() === c);
  return hit ? hit[1] : c;
}

function clean(s: string | undefined): string {
  return (s ?? "").replace(/\s+/g, " ").trim();
}

/** One contract award into the aggregators. Recipient fields are not in the file; nothing per award is kept. */
export function addContract(rec: Record<string, string>, slice: "aec" | "other", base: Aggregator, setAsides: Aggregator | null): boolean {
  const amount = Number(rec.total_obligated_amount);
  const naics = clean(rec.naics_code);
  const agency = clean(rec.awarding_agency_name);
  if (!Number.isFinite(amount) || amount <= 0 || !/^\d{6}$/.test(naics) || !agency) return false;
  const placeState = stateCode(clean(rec.primary_place_of_performance_state_code));
  const program = slice === "other" ? OTHER_PROGRAM : null;
  base.add({ awardType: "contract", agency, subAgency: clean(rec.awarding_sub_agency_name) || null, naics, placeState, program }, amount);
  const sa = setAsideLabel(rec.type_of_set_aside_code ?? "");
  if (setAsides && sa) setAsides.add({ awardType: "contract", agency, subAgency: null, naics, placeState, program, setAside: sa }, amount);
  return true;
}

/** "47.076: STEM EDUCATION (FORMERLY ...); 47.049: ..." to the first listing and its title. */
export function parseListing(v: string): { number: string; title: string | null } | null {
  const m = clean(v).match(/^(\d{2}\.\d{3})\s*:?\s*([^;]*)/);
  if (!m) return null;
  const title = m[2].trim();
  return { number: m[1], title: title ? titleCase(title).slice(0, 160) : null };
}

function titleCase(s: string): string {
  if (s !== s.toUpperCase()) return s;
  const small = new Set(["and", "or", "of", "the", "for", "to", "in", "on", "a", "an", "with", "by"]);
  return s
    .toLowerCase()
    .split(" ")
    .map((w, i) => (i > 0 && small.has(w) ? w : w.replace(/^[a-z(]/, (c) => c.toUpperCase())))
    .join(" ")
    .replace(/\b(Us|U\.s\.|Stem|Hiv|Aids|Covid-19)\b/g, (w) => w.toUpperCase());
}

export function addGrant(rec: Record<string, string>, agg: Aggregator): boolean {
  const amount = Number(rec.total_obligated_amount);
  const agency = clean(rec.awarding_agency_name);
  const listing = parseListing(rec.cfda_numbers_and_titles ?? "");
  if (!Number.isFinite(amount) || amount <= 0 || !agency || !listing) return false;
  agg.add(
    {
      awardType: "grant",
      agency,
      subAgency: clean(rec.awarding_sub_agency_name) || null,
      assistanceListing: listing.number,
      program: listing.title,
      placeState: stateFromName(rec.primary_place_of_performance_state_name ?? ""),
    },
    amount,
  );
  return true;
}

// ---------- Downloads ----------

interface DownloadStart {
  file_name: string;
  file_url: string;
  status_url?: string;
}
interface DownloadStatus {
  status: string;
  message?: string | null;
  file_url?: string;
  total_rows?: number | null;
  seconds_elapsed?: string | null;
}

async function fresh(file: string, hours: number): Promise<boolean> {
  try {
    const s = await stat(file);
    return s.size > 0 && Date.now() - s.mtimeMs < hours * 3_600_000;
  } catch {
    return false;
  }
}

/** Ask USAspending to build one download, wait for it, and fetch the zip into the cache. */
export async function generate(ctx: IngestContext, job: Job): Promise<string> {
  const name = `${job.key}.zip`;
  const cacheHours = Number(ctx.env.USASPENDING_CACHE_HOURS ?? 20);
  if (cacheHours > 0 && (await fresh(path.join(ctx.cacheDir, name), cacheHours))) return path.join(ctx.cacheDir, name);
  const pollMs = Number(ctx.env.USASPENDING_POLL_MS ?? 15_000);
  const maxWaitMs = Number(ctx.env.USASPENDING_MAX_WAIT_MS ?? 75 * 60_000);
  const res = await ctx.fetch(`${API}/download/awards/`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(job.body), timeoutMs: 180_000 });
  if (!res.ok) throw new HttpError(res.status, `${API}/download/awards/`, await res.text().catch(() => ""));
  const start = (await res.json()) as DownloadStart;
  if (!start.file_name) throw new Error(`USAspending did not start the download for ${job.label}`);
  const began = Date.now();
  for (;;) {
    if (pollMs > 0) await sleep(pollMs);
    const s = await getJson<DownloadStatus>(ctx.fetch, `${API}/download/status/?file_name=${encodeURIComponent(start.file_name)}`);
    if (s.status === "finished") {
      ctx.log(`${job.label}: ${s.total_rows ?? "?"} awards, built in ${Math.round(Number(s.seconds_elapsed ?? 0))}s`);
      return ctx.download(s.file_url || start.file_url, name, { maxAgeHours: cacheHours });
    }
    if (s.status === "failed") throw new Error(`USAspending could not build ${job.label}: ${s.message ?? "no reason given"}`);
    if (Date.now() - began > maxWaitMs) throw new Error(`USAspending took too long to build ${job.label}`);
  }
}

/** Stream every prime award summary CSV in a download zip. Subaward files in the same zip are skipped. */
export function readAwards(file: string, onRecord: (r: Record<string, string>) => void): Promise<number> {
  return new Promise((resolve, reject) => {
    yauzl.open(file, { lazyEntries: true }, (err, zip) => {
      if (err || !zip) return reject(err ?? new Error("Could not open zip"));
      let count = 0;
      zip.on("entry", (entry: yauzl.Entry) => {
        if (!/PrimeAwardSummaries.*\.csv$/i.test(entry.fileName)) return zip.readEntry();
        zip.openReadStream(entry, (e, stream) => {
          if (e || !stream) return reject(e ?? new Error("Could not read zip entry"));
          const parser = parse({ columns: true, bom: true, relax_column_count: true, skip_empty_lines: true });
          parser.on("readable", () => {
            let r: Record<string, string> | null;
            while ((r = parser.read()) !== null) {
              count++;
              onRecord(r);
            }
          });
          parser.on("error", reject);
          parser.on("end", () => zip.readEntry());
          stream.pipe(parser);
        });
      });
      zip.on("end", () => resolve(count));
      zip.on("error", reject);
      zip.readEntry();
    });
  });
}

// ---------- Run ----------

async function emit(ctx: IngestContext, rows: AwardStatInput[], budget: { left: number | null }) {
  const take = budget.left === null ? rows : rows.slice(0, Math.max(0, budget.left));
  if (budget.left !== null) budget.left -= take.length;
  for (let i = 0; i < take.length; i += 2_000) await ctx.awards(take.slice(i, i + 2_000));
}

export const usaspending: Connector = {
  source,
  async run(ctx) {
    const now = new Date();
    // With --limit (dev runs): the latest completed year of construction and A/E contracts only, capped at `limit` rows.
    const limited = ctx.limit !== null;
    const years = limited ? [fiscalYear(now) - 1] : fiscalYears(ctx.mode, now);
    const slices: Slice[] = limited ? ["aec"] : ((ctx.env.USASPENDING_SLICES?.split(",").filter(Boolean) as Slice[] | undefined) ?? ["aec", "grant"]);
    const budget = { left: limited ? ctx.limit : null };
    for (const fy of years) {
      const jobs = jobsFor(fy, slices);
      const other = new Aggregator(fy);
      let otherJobs = 0;
      for (const job of jobs) {
        if (budget.left !== null && budget.left <= 0) return;
        let file: string;
        try {
          file = await generate(ctx, job);
        } catch (err) {
          ctx.warn(`Skipped ${job.label}`, err);
          continue;
        }
        let skipped = 0;
        if (job.slice === "grant") {
          const agg = new Aggregator(fy);
          const n = await readAwards(file, (r) => {
            if (!addGrant(r, agg)) skipped++;
          });
          ctx.log(`${job.label}: ${n} awards read, ${skipped} without a positive amount or listing, ${agg.size} rows`);
          await emit(ctx, agg.rows(), budget);
        } else if (job.slice === "aec") {
          const base = new Aggregator(fy);
          const sa = new Aggregator(fy);
          const n = await readAwards(file, (r) => {
            if (!addContract(r, "aec", base, sa)) skipped++;
          });
          ctx.log(`${job.label}: ${n} awards read, ${skipped} skipped, ${base.size} rows and ${sa.size} set-aside rows`);
          await emit(ctx, [...base.rows(), ...sa.rows()], budget);
        } else {
          const n = await readAwards(file, (r) => {
            if (!addContract(r, "other", other, null)) skipped++;
          });
          otherJobs++;
          ctx.log(`${job.label}: ${n} awards read, ${skipped} skipped`);
        }
      }
      if (otherJobs) {
        // Both parts of the "other contracts" pull feed one set of groups; emit once both are read.
        if (otherJobs < jobs.filter((j) => j.slice === "other").length) ctx.warn(`Other contracts for FY${fy} are incomplete; their rows were not written`);
        else {
          ctx.log(`other contracts FY${fy}: ${other.size} rows`);
          await emit(ctx, other.rows(), budget);
        }
      }
    }
  },
};

export const connectors: Connector[] = [usaspending];
