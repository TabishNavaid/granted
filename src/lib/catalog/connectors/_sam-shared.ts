import { createReadStream } from "node:fs";
import { parse } from "csv-parse";
import type { FunderInput, IngestContext } from "../types";

/**
 * Helpers shared by the SAM.gov connectors (sam.ts): reading the public Data Services CSV extracts, which mix
 * Windows-1252 and UTF-8 text, and building agency funders from SAM's federal hierarchy names.
 */

// ---------- Text ----------

/** Windows-1252 bytes 0x80 to 0x9F. Node's TextDecoder treats this label as Latin-1, so we map them ourselves. */
const CP1252: Record<number, string> = {
  0x80: "€", 0x82: "‚", 0x83: "ƒ", 0x84: "„", 0x85: "…", 0x86: "†", 0x87: "‡", 0x88: "ˆ", 0x89: "‰", 0x8a: "Š", 0x8b: "‹", 0x8c: "Œ", 0x8e: "Ž",
  0x91: "'", 0x92: "'", 0x93: '"', 0x94: '"', 0x95: "-", 0x96: "-", 0x97: "-", 0x98: "~", 0x99: "(TM)", 0x9a: "š", 0x9b: "›", 0x9c: "œ", 0x9e: "ž", 0x9f: "Ÿ",
};

const utf8 = new TextDecoder("utf-8", { fatal: true });

/** One CSV field to text: UTF-8 when it is valid UTF-8, else Windows-1252 (the extracts carry both). */
export function decodeField(buf: Buffer): string {
  let ascii = true;
  for (let i = 0; i < buf.length; i++) {
    if (buf[i] > 0x7f) {
      ascii = false;
      break;
    }
  }
  if (ascii) return buf.toString("latin1");
  try {
    return utf8.decode(buf);
  } catch {
    // Mixed: keep each well-formed UTF-8 sequence, read every other byte as Windows-1252.
    let out = "";
    for (let i = 0; i < buf.length; i++) {
      const b = buf[i];
      const len = b >= 0xc2 && b <= 0xdf ? 2 : b >= 0xe0 && b <= 0xef ? 3 : b >= 0xf0 && b <= 0xf4 ? 4 : 0;
      if (len && i + len <= buf.length) {
        let ok = true;
        for (let j = 1; j < len; j++) if ((buf[i + j] & 0xc0) !== 0x80) ok = false;
        if (ok) {
          try {
            out += utf8.decode(buf.subarray(i, i + len));
            i += len - 1;
            continue;
          } catch {
            // not a valid sequence after all
          }
        }
      }
      out += b >= 0x80 && b <= 0x9f ? (CP1252[b] ?? " ") : String.fromCharCode(b);
    }
    return out;
  }
}

/**
 * Stream rows of a CSV file as objects keyed by the header row. Memory stays flat on the 200 MB extract;
 * `for await` gives back pressure, and breaking out of the loop closes the file.
 */
export async function* csvRows(file: string): AsyncGenerator<Record<string, string>> {
  const parser = createReadStream(file).pipe(
    parse({ encoding: null, relax_quotes: true, relax_column_count: true, bom: true, skip_empty_lines: true }),
  );
  let header: string[] | null = null;
  for await (const rec of parser as AsyncIterable<Buffer[]>) {
    if (!header) {
      header = rec.map((b) => decodeField(b).replace(/^﻿/, "").trim());
      continue;
    }
    const row: Record<string, string> = {};
    for (let i = 0; i < header.length; i++) row[header[i]] = rec[i] ? decodeField(rec[i]) : "";
    yield row;
  }
}

/** "AGRICULTURE, DEPARTMENT OF" to "agriculture-department-of". */
export function slug(s: string): string {
  return s
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
}

const SMALL_WORDS = new Set(["of", "the", "and", "for", "on", "in", "to", "at", "a", "an", "by"]);
const ACRONYMS = new Set(["usda", "nasa", "gsa", "usace", "dod", "hhs", "doe", "epa", "noaa", "fbi", "dhs", "va", "nih", "cdc", "fda", "dla", "disa", "darpa", "usaid", "faa", "fema", "hud", "nps", "blm", "usgs", "nsf", "nist", "ihs", "cms", "ssa", "sba", "opm", "ost", "us", "u.s.", "ii", "iii", "iv", "afrl", "navsea", "navfac", "navair", "navsup", "usmc", "socom", "tsa", "cbp", "ice", "uscg", "usps", "dot", "doj", "dol", "doi", "ed", "aphis", "nifa", "ars", "nrcs", "fsa", "fs", "hrsa", "samhsa", "acf", "ahrq", "osha", "bia", "usfws", "omb", "fhwa", "fta", "nhtsa", "pmhs"]);

/** "VETERANS AFFAIRS, DEPARTMENT OF" reads "Department of Veterans Affairs"; "DEPT OF THE ARMY" reads "Department of the Army". */
export function agencyName(raw: string): string {
  const s = raw.replace(/\s+/g, " ").trim();
  const flipped = s
    .replace(/^(.+?),\s*(DEPARTMENT|DEPT\.?) OF( THE)?$/i, (_m, name: string, _d, the?: string) => `Department of${the ? " the" : ""} ${name}`)
    .replace(/^DEPT\.? OF\b/i, "Department of");
  return flipped
    .split(" ")
    .map((w, i) => {
      const lower = w.toLowerCase();
      if (ACRONYMS.has(lower.replace(/[(),]/g, ""))) return w.toUpperCase();
      if (i > 0 && SMALL_WORDS.has(lower)) return lower;
      return lower.replace(/(^|[-/(])([a-z])/g, (_m, p: string, c: string) => p + c.toUpperCase());
    })
    .join(" ");
}

export interface AgencyPath {
  department: string | null;
  subTier: string | null;
  departmentCode?: string | null;
  subTierCode?: string | null;
}

/** Funder keys for a department and sub-tier, shared by both SAM.gov connectors so one agency is one funder. */
export function agencyKeys(p: AgencyPath): { departmentKey: string | null; funderKey: string | null; funderName: string | null } {
  const dept = p.department?.trim() || null;
  const sub = p.subTier?.trim() || null;
  if (!dept) return { departmentKey: null, funderKey: null, funderName: null };
  const departmentKey = `agency:sam:${slug(dept)}`;
  if (!sub || slug(sub) === slug(dept)) return { departmentKey, funderKey: departmentKey, funderName: agencyName(dept) };
  return { departmentKey, funderKey: `${departmentKey}/${slug(sub)}`, funderName: agencyName(sub) };
}

/** The department and sub-tier funders for one record, department first so the parent exists. */
export function agencyFunders(p: AgencyPath, sourceUrl: string): FunderInput[] {
  const { departmentKey, funderKey } = agencyKeys(p);
  if (!departmentKey) return [];
  const out: FunderInput[] = [
    {
      key: departmentKey,
      name: agencyName(p.department!),
      kind: "federal_agency",
      country: "US",
      sourceUrl,
      extra: p.departmentCode ? { cgac: p.departmentCode } : undefined,
    },
  ];
  if (funderKey && funderKey !== departmentKey) {
    out.push({
      key: funderKey,
      name: agencyName(p.subTier!),
      kind: "federal_agency",
      parentKey: departmentKey,
      country: "US",
      sourceUrl,
      extra: p.subTierCode ? { subTierCode: p.subTierCode } : undefined,
    });
  }
  return out;
}

/** Emits each funder once per run. */
export function funderEmitter(ctx: IngestContext) {
  const seen = new Set<string>();
  return async (rows: FunderInput[]) => {
    const fresh = rows.filter((f) => !seen.has(f.key));
    for (const f of fresh) seen.add(f.key);
    if (fresh.length) await ctx.funders(fresh);
  };
}

/**
 * Last-Modified of a public Data Services file, from its S3 object (the sam.gov download link redirects to a
 * signed URL that answers GET only). Null when unknown.
 */
export async function extractModified(ctx: IngestContext, s3Url: string): Promise<Date | null> {
  try {
    const res = await ctx.fetch(s3Url, { method: "HEAD", retries: 1 });
    const lm = res.headers.get("last-modified");
    await res.body?.cancel().catch(() => undefined);
    if (!res.ok || !lm) return null;
    const d = new Date(lm);
    return Number.isNaN(d.getTime()) ? null : d;
  } catch {
    return null;
  }
}
