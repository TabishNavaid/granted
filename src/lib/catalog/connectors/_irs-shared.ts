import { createReadStream } from "node:fs";
import { parse } from "csv-parse";
import yauzl from "yauzl";
import type { IngestContext } from "../types";

/** Shared by the IRS connectors (irs-990pf, irs-registry). Public U.S. government data, no key. */

export const IRS_LICENSE = "Public domain (U.S. government work)";
export const IRS_ATTRIBUTION = "Source: Internal Revenue Service";

export const BMF_REGIONS = ["eo1", "eo2", "eo3", "eo4"] as const;
export const bmfUrl = (region: string) => `https://www.irs.gov/pub/irs-soi/${region}.csv`;
export const BMF_DOCS = "https://www.irs.gov/charities-non-profits/exempt-organizations-business-master-file-extract-eo-bmf";
export const SOI_PF_DOCS = "https://www.irs.gov/statistics/soi-tax-stats-annual-extract-of-tax-exempt-organization-financial-data";
export const soiPfUrl = (yy: string) => `https://www.irs.gov/pub/irs-soi/${yy}eoextract990pf.zip`;
export const EFILE_DOCS = "https://www.irs.gov/charities-non-profits/form-990-series-downloads";
export const efileIndexUrl = (year: string | number) => `https://apps.irs.gov/pub/epostcard/990/xml/${year}/index_${year}.csv`;
export const efileZipUrl = (year: string | number, batch: string) => `https://apps.irs.gov/pub/epostcard/990/xml/${year}/${batch}.zip`;
export const PUB78_URL = "https://apps.irs.gov/pub/epostcard/data-download-pub78.zip";
export const PUB78_DOCS = "https://www.irs.gov/charities-non-profits/tax-exempt-organization-search-bulk-data-downloads";

/** Nine digits, zero padded; null when the input is not an EIN. */
export function ein9(value: string | number | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  const d = String(value).replace(/\D/g, "");
  if (!d || d.length > 9) return null;
  const e = d.padStart(9, "0");
  return /^0{9}$/.test(e) ? null : e;
}

/**
 * The IRS Tax Exempt Organization Search page for an organization, where its filed returns and determination
 * letters can be opened. Same form as irsPageUrl in src/lib/foundations (the name and place as filed, upper case).
 */
export function irsPageUrl(ein: string, filedName: string, city: string | null, state: string | null): string {
  const q = new URLSearchParams({ ein, name: filedName.toUpperCase(), city: (city ?? "").toUpperCase(), state: state ?? "", countryAbbr: "US", dba: "", type: "CHARITIES", orgTags: "CHARITIES" });
  return `https://apps.irs.gov/app/eos/details/?${q.toString()}`;
}

export type CsvRow = Record<string, string>;

/** Stream a CSV file row by row as objects keyed by the header (latin-1, as the IRS publishes). */
export async function eachCsvRow(file: string, onRow: (r: CsvRow) => void | Promise<void>, opts: { delimiter?: string; columns?: string[] | true; encoding?: BufferEncoding } = {}): Promise<number> {
  return eachCsvRowFromStream(createReadStream(file, { encoding: opts.encoding ?? "latin1" }), onRow, opts);
}

export async function eachCsvRowFromStream(input: NodeJS.ReadableStream, onRow: (r: CsvRow) => void | Promise<void>, opts: { delimiter?: string; columns?: string[] | true } = {}): Promise<number> {
  const parser = input.pipe(
    parse({
      columns: opts.columns ?? ((h: string[]) => h.map((x) => x.replace(/^﻿/, "").trim())),
      delimiter: opts.delimiter ?? ",",
      relax_column_count: true,
      relax_quotes: true,
      skip_empty_lines: true,
      bom: true,
      quote: opts.delimiter === "|" ? false : '"',
    }),
  );
  let n = 0;
  for await (const r of parser as AsyncIterable<CsvRow>) {
    n++;
    const out = onRow(r);
    if (out) await out;
  }
  return n;
}

/** The first member of a local zip as a stream (the IRS bulk zips hold one file). */
export function openFirstZipMember(file: string, match: RegExp = /./): Promise<NodeJS.ReadableStream> {
  return new Promise((resolve, reject) => {
    yauzl.open(file, { lazyEntries: true }, (err, zip) => {
      if (err || !zip) return reject(err ?? new Error("Could not open zip"));
      zip.readEntry();
      zip.on("entry", (entry: yauzl.Entry) => {
        if (/\/$/.test(entry.fileName) || !match.test(entry.fileName)) return zip.readEntry();
        zip.openReadStream(entry, (e, stream) => (e || !stream ? reject(e) : resolve(stream)));
      });
      zip.on("end", () => reject(new Error(`No matching file in ${file}`)));
      zip.on("error", reject);
    });
  });
}

/** Download the four regional BMF files (about 340 MB together), reusing a copy younger than `maxAgeHours`. */
export async function downloadBmf(ctx: IngestContext, maxAgeHours = 72): Promise<string[]> {
  if (ctx.env.IRS_BMF_DIR) return BMF_REGIONS.map((r) => `${ctx.env.IRS_BMF_DIR}/${r}.csv`);
  const out: string[] = [];
  for (const r of BMF_REGIONS) out.push(await ctx.download(bmfUrl(r), `${r}.csv`, { maxAgeHours }));
  return out;
}

/** "202407" or "2024" to a number, else null. */
export function yearOf(v: string | null | undefined): number | null {
  const m = (v ?? "").match(/^(\d{4})/);
  return m ? Number(m[1]) : null;
}
