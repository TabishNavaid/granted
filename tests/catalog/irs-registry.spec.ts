import { createReadStream } from "node:fs";
import { gunzipSync } from "node:zlib";
import { expect, test } from "@playwright/test";
import { bmfRow, buildShards, irsRegistry, MANIFEST_PATH, shardBody, shardPath, type Manifest } from "@/lib/catalog/connectors/irs-registry";
import { clearRegistryCache, lookupEin, parseShard, verdict, verifyNonprofit } from "@/lib/catalog/registry";
import type { PoliteFetch } from "@/lib/catalog/types";
import { fixturePath, runOffline } from "./helpers";

const SRC = "irs_registry";
const fx = (f: string) => fixturePath(SRC, f);
const BMF = ["eo1", "eo2", "eo3", "eo4"].map((r) => fx(`bmf/${r}.csv`));
const pub78 = () => {
  const s = createReadStream(fx("pub78-sample.txt"));
  s.setEncoding("latin1");
  return s;
};

/** A fake Storage API that keeps uploaded objects in memory. */
function storageFetch(objects = new Map<string, Buffer>(), puts: string[] = []): PoliteFetch {
  return (async (url: string, init?: RequestInit) => {
    const m = url.match(/^http:\/\/storage\.test\/storage\/v1\/object\/registry\/(.+)$/);
    if (!m) throw new Error(`No recorded response for ${url}`);
    const h = (init?.headers ?? {}) as Record<string, string>;
    if (h.authorization !== "Bearer service-role-test") return new Response("{}", { status: 403 });
    if ((init?.method ?? "GET") === "POST") {
      expect(h["x-upsert"]).toBe("true");
      objects.set(m[1], Buffer.from(init!.body as Uint8Array));
      puts.push(m[1]);
      return new Response("{}", { status: 200 });
    }
    const b = objects.get(m[1]);
    return b ? new Response(new Uint8Array(b), { status: 200 }) : new Response(JSON.stringify({ error: "not_found" }), { status: 400 });
  }) as PoliteFetch;
}

const ENV = { NEXT_PUBLIC_SUPABASE_URL: "http://storage.test", SUPABASE_SERVICE_ROLE_KEY: "service-role-test", IRS_BMF_DIR: fx("bmf"), IRS_PUB78_FILE: fx("pub78-sample.txt") };

test.describe("IRS registry: shards", () => {
  test("joins the BMF with Publication 78 and keeps Pub 78 only organizations", async () => {
    const built = await buildShards(BMF, pub78());
    expect(built.bmfRecords).toBe(5);
    expect(built.pub78Records).toBe(5);
    expect(built.pub78Only).toBe(1);
    expect([...built.shards.keys()]).toEqual(["000", "352", "560", "562"]);
    const rows = built.shards.get("560")!.map((r) => JSON.parse(r));
    expect(rows.map((r) => r[0])).toEqual(["560099250", "560173276", "560529987"]);
    const civitan = rows.find((r) => r[0] === "560173276");
    expect(civitan).toEqual(["560173276", "CIVITAN INTERNATIONAL", "GRANITE QRY", "NC", "04", "00", "1", 2006, "T40", null]);
    const onlyPub78 = rows.find((r) => r[0] === "560529987");
    expect(onlyPub78).toEqual(["560529987", "Patterson School", "Lenoir", "NC", null, null, null, null, null, "PC"]);
    const pf = JSON.parse(built.shards.get("562")![0]);
    expect(pf[9]).toBe("PF");
    expect(pf[5]).toBe("04");
  });

  test("malformed BMF rows are skipped", () => {
    expect(bmfRow({ EIN: "x", NAME: "No EIN" }, null)).toBeNull();
    expect(bmfRow({ EIN: "123456789", NAME: "" }, null)).toBeNull();
    expect(bmfRow({ EIN: "12345678", NAME: "Short EIN", RULING: "000000" }, null)).toEqual(["012345678", "Short EIN", null, null, null, null, null, null, null, null]);
  });

  test("the connector uploads one gzip shard per prefix and a manifest, then only what changed", async () => {
    const objects = new Map<string, Buffer>();
    const puts: string[] = [];
    const { result } = await runOffline(irsRegistry, storageFetch(objects, puts), { env: ENV });
    expect(result.status).toBe("succeeded");
    expect(result.stats.seen).toBe(0);
    expect(puts.sort()).toEqual([MANIFEST_PATH, shardPath("000"), shardPath("352"), shardPath("560"), shardPath("562")].sort());
    const manifest = JSON.parse(objects.get(MANIFEST_PATH)!.toString("utf8")) as Manifest;
    expect(manifest.records).toBe(6);
    expect(Object.keys(manifest.shards)).toHaveLength(4);
    const shard = JSON.parse(gunzipSync(objects.get(shardPath("562"))!).toString("utf8"));
    expect(shard.fields).toEqual(["ein", "name", "city", "state", "subsection", "foundation", "deductibility", "rulingYear", "ntee", "pub78"]);

    puts.length = 0;
    await runOffline(irsRegistry, storageFetch(objects, puts), { env: ENV });
    expect(puts).toEqual([MANIFEST_PATH]);
  });

  test("without Storage credentials the run is skipped", async () => {
    const { result } = await runOffline(irsRegistry, storageFetch(), { env: { IRS_BMF_DIR: fx("bmf") } });
    expect(result.status).toBe("skipped");
  });
});

test.describe("IRS registry: lookups and plain-words verification", () => {
  let objects: Map<string, Buffer>;
  const realFetch = globalThis.fetch;

  test.beforeAll(async () => {
    const built = await buildShards(BMF, pub78());
    objects = new Map();
    const shards: Manifest["shards"] = {};
    for (const [p, rows] of built.shards) {
      objects.set(`eo/${p}.json.gz`, shardBody(rows, "2026-10-22T00:00:00Z"));
      shards[p] = { sha1: "x", count: rows.length, bytes: 0 };
    }
    objects.set("eo/manifest.json", Buffer.from(JSON.stringify({ v: 1, shards })));
  });

  test.beforeEach(() => {
    clearRegistryCache();
    process.env.NEXT_PUBLIC_SUPABASE_URL = "http://storage.test";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-test";
    globalThis.fetch = (async (url: string, init?: RequestInit) => storageFetch(objects)(String(url), init)) as typeof fetch;
  });

  test.afterEach(() => {
    globalThis.fetch = realFetch;
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  });

  test("lookupEin reads one shard and caches it", async () => {
    let calls = 0;
    const inner = globalThis.fetch;
    globalThis.fetch = (async (url: string, init?: RequestInit) => {
      calls++;
      return inner(url, init);
    }) as typeof fetch;
    const r = await lookupEin("56-2156876");
    expect(r).toMatchObject({ ein: "562156876", subsection: "03", foundation: "04", deductibility: "1", pub78: "PF", rulingYear: 2000, inBmf: true });
    await lookupEin("562156876");
    expect(calls).toBe(2);
    expect(await lookupEin("999999999")).toBeNull();
  });

  test("verifyNonprofit says it plainly", async () => {
    const pf = await verifyNonprofit("562156876");
    expect(pf.status).toBe("eligible");
    expect(pf.privateFoundation).toBe(true);
    expect(pf.message).toMatch(/is a 501\(c\)\(3\) organization listed in IRS Publication 78/);
    const c4 = await verifyNonprofit("560173276");
    expect(c4.status).toBe("not_eligible");
    expect(c4.message).toMatch(/501\(c\)\(4\), not 501\(c\)\(3\)/);
    const onlyPub78 = await verifyNonprofit("560529987");
    expect(onlyPub78.status).toBe("eligible");
    expect(onlyPub78.is501c3).toBe(true);
    const church = await verifyNonprofit("000587764");
    expect(church).toMatchObject({ status: "eligible", privateFoundation: false });
    expect((await verifyNonprofit("123456789")).status).toBe("not_found");
    expect((await verifyNonprofit("12")).status).toBe("not_found");
    for (const v of [pf, c4, onlyPub78, church]) expect(v.message).not.toMatch(/[—–]/);
  });

  test("an unbuilt registry or missing keys is unavailable, not a verdict", async () => {
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    expect((await verifyNonprofit("562156876")).status).toBe("unavailable");
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-test";
    clearRegistryCache();
    objects.delete("eo/manifest.json");
    expect((await verifyNonprofit("562156876")).status).toBe("unavailable");
    expect(await lookupEin("562156876")).toBeNull();
  });

  test("parseShard and verdict work on a recorded row", () => {
    const shard = parseShard(shardBody(['["352607595","COUGHLIN CHARITABLE FOUNDATION","RALEIGH","NC","03","04","1",2018,"T20","PF"]'], "t"));
    const v = verdict("352607595", shard.get("352607595")!);
    expect(v).toMatchObject({ status: "eligible", is501c3: true, deductible: true, pub78Listed: true, privateFoundation: true });
  });
});
