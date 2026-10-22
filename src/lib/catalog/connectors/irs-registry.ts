import { createHash } from "node:crypto";
import { gzipSync } from "node:zlib";
import { stateCode } from "../vocab";
import type { Connector, IngestContext, SourceDefinition } from "../types";
import { BMF_DOCS, downloadBmf, ein9, eachCsvRow, eachCsvRowFromStream, IRS_ATTRIBUTION, IRS_LICENSE, openFirstZipMember, PUB78_DOCS, PUB78_URL } from "./_irs-shared";

/**
 * The IRS exempt organization registry for checking a nonprofit's status by EIN: the EO Business Master File
 * (every organization the IRS recognizes as exempt, about 1.9 million) joined with Publication 78 (organizations
 * eligible to receive tax-deductible gifts). The registry never sits in Postgres: it is split into one gzip JSON
 * shard per first three EIN digits in the private Storage bucket `registry`, and src/lib/catalog/registry.ts
 * reads one shard per lookup. This source writes no catalog rows.
 */
export const source: SourceDefinition = {
  id: "irs_registry",
  name: "IRS exempt organization registry (EO BMF and Publication 78)",
  covers: "Every organization the IRS recognizes as tax exempt, with its 501(c) subsection and whether gifts to it are deductible, for checking an applicant's status by EIN.",
  homepage: BMF_DOCS,
  docsUrl: PUB78_DOCS,
  termsUrl: "https://www.irs.gov/about-irs/use-of-content-from-irsgov",
  license: IRS_LICENSE,
  attribution: IRS_ATTRIBUTION,
  kinds: [],
  region: "us",
  cadence: "Monthly",
  schedule: "20 7 16 * *",
  needsKey: "SUPABASE_SERVICE_ROLE_KEY",
  enabled: true,
  priority: 90,
};

export const BUCKET = "registry";
export const PREFIX_DIR = "eo";
export const SHARD_FIELDS = ["ein", "name", "city", "state", "subsection", "foundation", "deductibility", "rulingYear", "ntee", "pub78"] as const;
export type ShardRow = [string, string, string | null, string | null, string | null, string | null, string | null, number | null, string | null, string | null];

export interface Manifest {
  v: 1;
  builtAt: string;
  fields: readonly string[];
  records: number;
  bmfRecords: number;
  pub78Records: number;
  pub78Only: number;
  bytes: number;
  shards: Record<string, { sha1: string; count: number; bytes: number }>;
}

export const shardPath = (prefix: string) => `${PREFIX_DIR}/${prefix}.json.gz`;
export const MANIFEST_PATH = `${PREFIX_DIR}/manifest.json`;

const blank = (v: string | undefined) => {
  const t = (v ?? "").trim();
  return t ? t : null;
};

/** One BMF row to a shard row. Pub 78 deductibility codes (e.g. "PC", "PF", "EO,LODGE") or null when not listed. */
export function bmfRow(r: Record<string, string>, pub78: string | null): ShardRow | null {
  const ein = ein9(r.EIN);
  if (!ein || !r.NAME?.trim()) return null;
  const ruling = /^\d{4}/.test(r.RULING ?? "") && !/^0000/.test(r.RULING) ? Number(r.RULING.slice(0, 4)) : null;
  return [ein, r.NAME.trim(), blank(r.CITY), stateCode(r.STATE) ?? blank(r.STATE), blank(r.SUBSECTION), blank(r.FOUNDATION), blank(r.DEDUCTIBILITY), ruling, blank(r.NTEE_CD), pub78];
}

/** Publication 78 rows: EIN|Name|City|State|Country|Deductibility codes. */
export async function readPub78(input: NodeJS.ReadableStream, into = new Map<string, string>()): Promise<Map<string, string>> {
  await eachCsvRowFromStream(
    input,
    (r) => {
      const ein = ein9(r.ein);
      if (!ein) return;
      // Kept as one compact string: codes|name|city|state.
      into.set(ein, [(r.codes ?? "").trim(), (r.name ?? "").trim(), (r.city ?? "").trim(), (r.state ?? "").trim()].join("|"));
    },
    { delimiter: "|", columns: ["ein", "name", "city", "state", "country", "codes"] },
  );
  return into;
}

export function shardBody(rows: string[], builtAt: string): Buffer {
  const json = `{"v":1,"builtAt":${JSON.stringify(builtAt)},"fields":${JSON.stringify(SHARD_FIELDS)},"rows":[${rows.join(",")}]}`;
  return gzipSync(Buffer.from(json, "utf8"), { level: 9 });
}

/** Build every shard: prefix to its JSON rows (sorted by EIN), plus counts. */
export async function buildShards(bmfFiles: string[], pub78Stream: NodeJS.ReadableStream): Promise<{ shards: Map<string, string[]>; bmfRecords: number; pub78Records: number; pub78Only: number }> {
  const pub78 = await readPub78(pub78Stream);
  const pub78Records = pub78.size;
  const byPrefix = new Map<string, Map<string, string>>();
  const put = (row: ShardRow) => {
    const p = row[0].slice(0, 3);
    let m = byPrefix.get(p);
    if (!m) byPrefix.set(p, (m = new Map()));
    m.set(row[0], JSON.stringify(row));
  };
  let bmfRecords = 0;
  const inBmf = new Set<string>();
  for (const f of bmfFiles) {
    await eachCsvRow(f, (r) => {
      const ein = ein9(r.EIN);
      const p78 = ein ? pub78.get(ein) : undefined;
      const row = bmfRow(r, p78 ? p78.split("|")[0] || null : null);
      if (!row) return;
      if (p78 !== undefined) inBmf.add(row[0]);
      bmfRecords++;
      put(row);
    });
  }
  // Listed in Pub 78 but not in the BMF (for example organizations covered by a group exemption).
  let pub78Only = 0;
  for (const [ein, v] of pub78) {
    const [codes, name, city, state] = v.split("|");
    if (!name || inBmf.has(ein)) continue;
    pub78Only++;
    put([ein, name, city || null, stateCode(state) ?? (state || null), null, null, null, null, null, codes || null]);
  }
  const shards = new Map<string, string[]>();
  for (const p of [...byPrefix.keys()].sort()) {
    const m = byPrefix.get(p)!;
    shards.set(
      p,
      [...m.keys()].sort().map((e) => m.get(e)!),
    );
  }
  return { shards, bmfRecords, pub78Records, pub78Only };
}

// ---------- Supabase Storage over REST, with the service role ----------

function storage(ctx: IngestContext) {
  const base = ctx.env.NEXT_PUBLIC_SUPABASE_URL?.trim().replace(/\/+$/, "");
  const key = ctx.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!base || !key) return null;
  const headers = { authorization: `Bearer ${key}`, apikey: key };
  const objectUrl = (path: string) => `${base}/storage/v1/object/${BUCKET}/${path}`;
  return {
    async get(path: string): Promise<Buffer | null> {
      const res = await ctx.fetch(objectUrl(path), { headers, retries: 2 });
      if (!res.ok) {
        await res.body?.cancel().catch(() => undefined);
        return null;
      }
      return Buffer.from(await res.arrayBuffer());
    },
    async put(path: string, body: Buffer, contentType: string): Promise<void> {
      const res = await ctx.fetch(objectUrl(path), { method: "POST", headers: { ...headers, "content-type": contentType, "x-upsert": "true", "cache-control": "3600" }, body: new Uint8Array(body) });
      if (!res.ok) throw new Error(`Storage upload of ${path} failed: HTTP ${res.status} ${(await res.text().catch(() => "")).slice(0, 200)}`);
      await res.body?.cancel().catch(() => undefined);
    },
  };
}

export const irsRegistry: Connector = {
  source,
  async run(ctx) {
    const store = storage(ctx);
    if (!store) throw new Error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to upload the registry");
    const t0 = Date.now();
    const bmfFiles = await downloadBmf(ctx, 24 * 7);
    const pub78File = ctx.env.IRS_PUB78_FILE ?? (await ctx.download(PUB78_URL, "data-download-pub78.zip", { maxAgeHours: 24 * 7 }));
    const pub78Stream = /\.zip$/i.test(pub78File) ? await openFirstZipMember(pub78File, /\.txt$/i) : (await import("node:fs")).createReadStream(pub78File);
    pub78Stream.setEncoding?.("latin1");
    const built = await buildShards(bmfFiles, pub78Stream);
    ctx.log(`registry: ${built.bmfRecords} BMF records, ${built.pub78Records} Pub 78 records (${built.pub78Only} only in Pub 78), ${built.shards.size} shards, built in ${Math.round((Date.now() - t0) / 1000)}s`);

    const previous = await store
      .get(MANIFEST_PATH)
      .then((b) => (b ? (JSON.parse(b.toString("utf8")) as Manifest) : null))
      .catch(() => null);
    const builtAt = new Date().toISOString();
    const manifest: Manifest = { v: 1, builtAt, fields: SHARD_FIELDS, records: 0, bmfRecords: built.bmfRecords, pub78Records: built.pub78Records, pub78Only: built.pub78Only, bytes: 0, shards: {} };
    let uploaded = 0;
    let unchanged = 0;
    for (const [prefix, rows] of built.shards) {
      // The hash covers the rows only, so an unchanged shard is not uploaded again.
      const sha1 = createHash("sha1").update(rows.join("\n")).digest("hex");
      const prev = previous?.shards?.[prefix];
      let bytes = prev?.bytes ?? 0;
      if (!prev || prev.sha1 !== sha1) {
        const body = shardBody(rows, builtAt);
        bytes = body.length;
        await store.put(shardPath(prefix), body, "application/gzip");
        uploaded++;
        if (uploaded % 100 === 0) ctx.log(`registry: ${uploaded} shards uploaded`);
      } else unchanged++;
      manifest.shards[prefix] = { sha1, count: rows.length, bytes };
      manifest.records += rows.length;
      manifest.bytes += bytes;
    }
    await store.put(MANIFEST_PATH, Buffer.from(JSON.stringify(manifest)), "application/json");
    ctx.log(`registry: ${manifest.records} records in ${built.shards.size} shards, ${(manifest.bytes / 1e6).toFixed(1)} MB gzip; ${uploaded} uploaded, ${unchanged} unchanged; ${Math.round((Date.now() - t0) / 1000)}s`);
  },
};

export const connectors: Connector[] = [irsRegistry];
