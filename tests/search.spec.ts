import { existsSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import postgres from "postgres";

/**
 * catalog_search and dedupe against a real Postgres (the local Supabase). Seeds a throwaway source with rows that
 * differ in one field at a time, then checks that each filter keeps exactly the rows it should. Empty arrays must
 * never hide a row: a regression here once made every search require non-empty causes and eligibility.
 */
if (existsSync(".env.localdb")) process.loadEnvFile(".env.localdb");
const URL = process.env.DATABASE_URL ?? "";
const local = /@(127\.0\.0\.1|localhost)[:/]/.test(URL);

test.describe.configure({ mode: "serial" });
let sql: postgres.Sql;
let reachable = false;
const tag = randomUUID().slice(0, 8);
const SRC = `test_${tag}`;
const future = new Date(Date.now() + 20 * 864e5).toISOString();
const past = new Date(Date.now() - 20 * 864e5).toISOString();

type Row = { id: string; title: string; type: string; status?: string; close_at?: string | null; naics?: string[]; eligibility?: string[]; place_state?: string | null; set_aside?: string | null; causes?: string[]; canonical_key?: string | null };
const rows: Row[] = [
  { id: "plain", title: `Plain grant ${tag} community garden`, type: "grant" },
  { id: "nonprofit", title: `Nonprofit grant ${tag} youth mentoring`, type: "grant", eligibility: ["nonprofit"], causes: ["youth"] },
  { id: "aec-tx", title: `Fire station design ${tag}`, type: "contract", naics: ["541310"], place_state: "TX", set_aside: "Service-disabled veteran-owned small business" },
  { id: "aec-ok", title: `Clinic renovation ${tag}`, type: "contract", naics: ["236220"], place_state: "OK" },
  { id: "closed", title: `Closed grant ${tag}`, type: "grant", status: "closed", close_at: past },
  { id: "dup-a", title: `Same notice ${tag}`, type: "grant", canonical_key: `num:TEST-${tag}` },
  { id: "dup-b", title: `Same notice ${tag} again`, type: "grant", canonical_key: `num:TEST-${tag}` },
];

test.beforeAll(async () => {
  if (!local) return;
  sql = postgres(URL, { max: 2, onnotice: () => undefined });
  try {
    await sql`select 1`;
    reachable = true;
  } catch {
    reachable = false;
    return;
  }
  await sql`insert into catalog_sources (id, name, homepage, license, kinds, cadence, priority) values (${SRC}, 'Test source', 'https://example.test', 'Test', ${["grant", "contract"]}, 'Never', 99)`;
  for (const r of rows) {
    await sql`insert into catalog_opportunities (source, source_id, source_url, type, title, status, close_at, naics, eligibility, place_state, set_aside, causes, canonical_key, content_hash)
      values (${SRC}, ${r.id}, ${`https://example.test/${r.id}`}, ${r.type}, ${r.title}, ${r.status ?? "open"}, ${r.close_at === undefined ? future : r.close_at}, ${r.naics ?? []}, ${r.eligibility ?? []}, ${r.place_state ?? null}, ${r.set_aside ?? null}, ${r.causes ?? []}, ${r.canonical_key ?? null}, 'x')`;
  }
  await sql`select catalog_dedupe()`;
});

test.afterAll(async () => {
  if (!reachable) return;
  await sql`delete from catalog_opportunities where source = ${SRC}`;
  await sql`delete from catalog_sources where id = ${SRC}`;
  await sql.end({ timeout: 5 });
});

async function ids(where: postgres.PendingQuery<postgres.Row[]>): Promise<string[]> {
  const r = await where;
  return r.map((x) => String(x.source_id)).sort();
}

const search = (extra: Record<string, unknown> = {}) => {
  const params = { sources: [SRC], ...extra };
  return sql`select o.source_id from catalog_search(
      q => ${(params as { q?: string }).q ?? null}, types => ${(params as { types?: string[] }).types ?? null}, eligibility => ${(params as { eligibility?: string[] }).eligibility ?? null},
      naics_prefixes => ${(params as { naics?: string[] }).naics ?? null}, set_asides => ${(params as { setAsides?: string[] }).setAsides ?? null}, states => ${(params as { states?: string[] }).states ?? null},
      causes => ${(params as { causes?: string[] }).causes ?? null}, sources => ${params.sources}, lim => 50) s join catalog_opportunities o on o.id = s.id`;
};

test("with no filters every live, primary row is found, whatever its empty fields", async () => {
  test.skip(!reachable, "No local database");
  expect(await ids(search())).toEqual(["aec-ok", "aec-tx", "dup-a", "nonprofit", "plain"]);
});

test("each filter keeps exactly its rows", async () => {
  test.skip(!reachable, "No local database");
  expect(await ids(search({ types: ["contract"] }))).toEqual(["aec-ok", "aec-tx"]);
  expect(await ids(search({ naics: ["2362"] }))).toEqual(["aec-ok"]);
  expect(await ids(search({ naics: ["5413"], states: ["TX"] }))).toEqual(["aec-tx"]);
  expect(await ids(search({ setAsides: ["Service-disabled veteran-owned small business"] }))).toEqual(["aec-tx"]);
  expect(await ids(search({ eligibility: ["nonprofit"] }))).toEqual(["nonprofit"]);
  expect(await ids(search({ causes: ["youth"] }))).toEqual(["nonprofit"]);
  expect(await ids(search({ q: "mentoring or garden" }))).toEqual(["nonprofit", "plain"]);
});

test("dedupe keeps one primary row and lists the other on it", async () => {
  test.skip(!reachable, "No local database");
  const r = await sql`select source_id, duplicate_of is null as primary, also_listed from catalog_opportunities where source = ${SRC} and canonical_key = ${`num:TEST-${tag}`} order by source_id`;
  expect(r.map((x) => x.primary)).toEqual([true, false]);
  expect((r[0].also_listed as unknown[]).length).toBe(1);
});

test("a run that sees a row again reopens it if the source reopened it", async () => {
  test.skip(!reachable, "No local database");
  await sql`update catalog_opportunities set status = 'closed' where source = ${SRC} and source_id = 'plain'`;
  const [c] = await sql`select status, closed_detected_at is not null as detected from catalog_opportunities where source = ${SRC} and source_id = 'plain'`;
  expect(c).toEqual({ status: "closed", detected: true });
  const hist = await sql`select field, old_value, new_value from catalog_opportunity_changes c join catalog_opportunities o on o.id = c.opportunity_id where o.source = ${SRC} and o.source_id = 'plain'`;
  expect(hist).toEqual([{ field: "status", old_value: "open", new_value: "closed" }]);
});
