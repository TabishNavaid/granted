import { gunzipSync } from "node:zlib";
import { formatEin } from "@/lib/format";

/**
 * Nonprofit status by EIN, from the IRS exempt organization registry (EO Business Master File and Publication 78)
 * that the irs_registry ingestion job stores as compact shards in the private Storage bucket `registry`
 * (one gzip JSON file per first three EIN digits). Server only: it reads Storage with the service role key and
 * must never be imported by client components. Shards are cached in memory, so repeat lookups are free.
 */

if (typeof window !== "undefined") throw new Error("src/lib/catalog/registry.ts is server-only");

export interface RegistryRecord {
  ein: string;
  name: string;
  city: string | null;
  state: string | null;
  /** 501(c) subsection, two digits ("03" is 501(c)(3)); null when only in Publication 78. */
  subsection: string | null;
  /** BMF foundation code ("04" private non-operating foundation, "15" publicly supported charity, ...). */
  foundation: string | null;
  /** BMF deductibility code: "1" deductible, "2" not deductible, "4" deductible by treaty. */
  deductibility: string | null;
  rulingYear: number | null;
  ntee: string | null;
  /** Publication 78 deductibility codes ("PC", "PF", "POF", "SO", "EO,LODGE", ...), null when not listed. */
  pub78: string | null;
  inBmf: boolean;
}

const BUCKET = "registry";
const MAX_SHARDS = 64;
const MANIFEST_TTL_MS = 60 * 60 * 1000;

type Row = [string, string, string | null, string | null, string | null, string | null, string | null, number | null, string | null, string | null];

interface Config {
  url: string;
  key: string;
}

function config(): Config | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim().replace(/\/+$/, "");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  return url && key ? { url, key } : null;
}

async function getObject(c: Config, path: string): Promise<{ status: number; body: Buffer | null }> {
  const res = await fetch(`${c.url}/storage/v1/object/${BUCKET}/${path}`, {
    headers: { authorization: `Bearer ${c.key}`, apikey: c.key },
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) {
    await res.body?.cancel().catch(() => undefined);
    return { status: res.status, body: null };
  }
  return { status: res.status, body: Buffer.from(await res.arrayBuffer()) };
}

let manifest: { at: number; shards: Set<string> } | null = null;
const shards = new Map<string, Map<string, RegistryRecord>>();

/** Which shards exist, or null when the registry has not been built or Storage cannot be reached. */
async function shardList(c: Config): Promise<Set<string> | null> {
  if (manifest && Date.now() - manifest.at < MANIFEST_TTL_MS) return manifest.shards;
  const { body } = await getObject(c, "eo/manifest.json");
  if (!body) return null;
  const m = JSON.parse(body.toString("utf8")) as { shards?: Record<string, unknown> };
  manifest = { at: Date.now(), shards: new Set(Object.keys(m.shards ?? {})) };
  shards.clear();
  return manifest.shards;
}

export function parseShard(gz: Buffer): Map<string, RegistryRecord> {
  const data = JSON.parse(gunzipSync(gz).toString("utf8")) as { rows: Row[] };
  const out = new Map<string, RegistryRecord>();
  for (const r of data.rows) {
    out.set(r[0], { ein: r[0], name: r[1], city: r[2], state: r[3], subsection: r[4], foundation: r[5], deductibility: r[6], rulingYear: r[7], ntee: r[8], pub78: r[9], inBmf: r[4] !== null || r[6] !== null });
  }
  return out;
}

export function normalizeEin(ein: string | number): string | null {
  const d = String(ein).replace(/\D/g, "");
  return d.length === 9 ? d : null;
}

/** Lookup with the reason when there is no record: the registry is unavailable, or the EIN is not in it. */
export async function lookupEinDetailed(ein: string | number): Promise<{ available: boolean; record: RegistryRecord | null }> {
  const e = normalizeEin(ein);
  const c = config();
  if (!e || !c) return { available: !!c, record: null };
  try {
    const list = await shardList(c);
    if (!list) return { available: false, record: null };
    const prefix = e.slice(0, 3);
    if (!list.has(prefix)) return { available: true, record: null };
    let shard = shards.get(prefix);
    if (!shard) {
      const { body } = await getObject(c, `eo/${prefix}.json.gz`);
      if (!body) return { available: false, record: null };
      shard = parseShard(body);
      if (shards.size >= MAX_SHARDS) shards.delete(shards.keys().next().value!);
      shards.set(prefix, shard);
    }
    return { available: true, record: shard.get(e) ?? null };
  } catch {
    return { available: false, record: null };
  }
}

/** The registry record for an EIN, or null when it is not listed or the registry is not available. */
export async function lookupEin(ein: string | number): Promise<RegistryRecord | null> {
  return (await lookupEinDetailed(ein)).record;
}

export interface NonprofitVerification {
  ein: string;
  /** eligible: a 501(c)(3) that can receive deductible gifts. */
  status: "eligible" | "not_eligible" | "not_found" | "unavailable";
  is501c3: boolean | null;
  deductible: boolean | null;
  pub78Listed: boolean | null;
  privateFoundation: boolean | null;
  record: RegistryRecord | null;
  /** One or two plain sentences for people. */
  message: string;
}

const C3_PUB78 = new Set(["PC", "POF", "PF", "SO", "SONFI", "SOUNK", "UNKWN"]);
const PF_FOUNDATION_CODES = new Set(["02", "03", "04"]);

/** Plain-words verdict from a record (exported for tests). */
export function verdict(ein: string, r: RegistryRecord | null, available = true): NonprofitVerification {
  const id = `EIN ${formatEin(ein)}`;
  if (!available) return { ein, status: "unavailable", is501c3: null, deductible: null, pub78Listed: null, privateFoundation: null, record: null, message: `We could not check ${id} right now because the IRS registry is not available. Check it on the IRS Tax Exempt Organization Search.` };
  if (!r) return { ein, status: "not_found", is501c3: null, deductible: null, pub78Listed: null, privateFoundation: null, record: null, message: `${id} is not in the IRS Business Master File or Publication 78. It may be new, a church that never applied, revoked, or mistyped.` };
  const codes = (r.pub78 ?? "").split(",").filter(Boolean);
  const listed = codes.length > 0;
  const is501c3 = r.subsection ? r.subsection === "03" : codes.some((c) => C3_PUB78.has(c)) ? true : null;
  const deductible = listed || r.deductibility === "1" || r.deductibility === "4";
  const privateFoundation = r.foundation ? PF_FOUNDATION_CODES.has(r.foundation) : codes.includes("PF") || codes.includes("POF") ? true : listed ? false : null;
  const who = `${id} (${r.name}${r.city || r.state ? `, ${[r.city, r.state].filter(Boolean).join(" ")}` : ""})`;
  const kind = privateFoundation ? " It is a private foundation." : is501c3 && privateFoundation === false ? " It is a public charity or supporting organization." : "";
  let message: string;
  let status: NonprofitVerification["status"];
  if (is501c3 && listed) {
    status = "eligible";
    message = `${who} is a 501(c)(3) organization listed in IRS Publication 78, so it can receive tax-deductible gifts.${kind}`;
  } else if (is501c3 && deductible) {
    status = "eligible";
    message = `${who} is a 501(c)(3) organization and the IRS Business Master File shows gifts to it are deductible, but it is not listed in Publication 78. Confirm on the IRS Tax Exempt Organization Search.${kind}`;
  } else if (is501c3) {
    status = "not_eligible";
    message = `${who} is recognized under 501(c)(3), but the IRS records do not show it as eligible to receive deductible gifts.`;
  } else if (r.subsection) {
    status = "not_eligible";
    message = `${who} is exempt under section 501(c)(${Number(r.subsection)}), not 501(c)(3). ${deductible ? "Gifts to it are deductible per the IRS records, but most grant programs that ask for 501(c)(3) status will not accept it." : "Gifts to it are not tax deductible."}`;
  } else {
    status = listed ? "eligible" : "not_eligible";
    message = listed
      ? `${who} is listed in IRS Publication 78 (code ${codes.join(", ")}), so it can receive tax-deductible gifts, but it is not in the Business Master File, so its 501(c) subsection is not shown.`
      : `${who} is in the IRS records but not shown as a 501(c)(3) organization.`;
  }
  return { ein, status, is501c3, deductible, pub78Listed: listed, privateFoundation, record: r, message };
}

/** Whether an EIN is a 501(c)(3) eligible to receive deductible gifts, per Publication 78 and the BMF, in plain words. */
export async function verifyNonprofit(ein: string | number): Promise<NonprofitVerification> {
  const e = normalizeEin(ein);
  if (!e) return { ein: String(ein), status: "not_found", is501c3: null, deductible: null, pub78Listed: null, privateFoundation: null, record: null, message: "An EIN has nine digits, like 12-3456789." };
  const { available, record } = await lookupEinDetailed(e);
  return verdict(e, record, available);
}

/** For tests: forget cached shards and the manifest. */
export function clearRegistryCache() {
  manifest = null;
  shards.clear();
}
