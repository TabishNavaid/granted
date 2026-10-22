import { existsSync } from "node:fs";
import { createHash, randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import postgres from "postgres";
import { EMBEDDING_DIMENSIONS, documentText, queryText, toVector, type Embedder } from "@/lib/ai/embed";
import { embedMissing } from "@/lib/catalog/ingest/embed";

/**
 * Semantic matching against the local database, with a stand-in embedder (hashed bag of words) so no key is
 * needed: missing vectors are filled for live rows only, the nearest row comes back first, and changing a title
 * clears its vector so the next run refills it.
 */
if (existsSync(".env.localdb")) process.loadEnvFile(".env.localdb");
const URL = process.env.DATABASE_URL ?? "";
const local = /@(127\.0\.0\.1|localhost)[:/]/.test(URL);

test.describe.configure({ mode: "serial" });
let sql: postgres.Sql;
let reachable = false;
const tag = randomUUID().slice(0, 8);
const SRC = `test_embed_${tag}`;
const future = new Date(Date.now() + 20 * 864e5).toISOString();

const words = (t: string) => t.toLowerCase().replace(/^(title|task):.*?\|\s*(text|query):/, " ").match(/[a-z]{3,}/g) ?? [];
const fake: Embedder = async (texts) =>
  texts.map((t) => {
    const v = new Array<number>(EMBEDDING_DIMENSIONS).fill(0);
    for (const w of words(t)) v[createHash("md5").update(w).digest().readUInt16BE(0) % EMBEDDING_DIMENSIONS] += 1;
    const n = Math.hypot(...v) || 1;
    return v.map((x) => x / n);
  });

test.beforeAll(async () => {
  if (!local) return;
  sql = postgres(URL, { max: 2, onnotice: () => undefined });
  try {
    await sql`select 1`;
    reachable = true;
  } catch {
    return;
  }
  await sql`insert into catalog_sources (id, name, homepage, license, kinds, cadence, priority) values (${SRC}, 'Test source', 'https://example.test', 'Test', ${["grant"]}, 'Never', 99)`;
  const rows = [
    ["tutoring", "Out of school time tutoring and reading support", "open"],
    ["water", "Rural drinking water infrastructure", "open"],
    ["old", "Tutoring program that has closed", "closed"],
  ];
  for (const [id, title, status] of rows)
    await sql`insert into catalog_opportunities (source, source_id, source_url, type, title, summary, status, close_at, content_hash)
      values (${SRC}, ${id}, ${`https://example.test/${id}`}, 'grant', ${title}, ${`${title}. Test row.`}, ${status}, ${future}, 'x')`;
});

test.afterAll(async () => {
  if (!reachable) return;
  await sql`delete from catalog_opportunities where source = ${SRC}`;
  await sql`delete from catalog_sources where id = ${SRC}`;
  await sql.end({ timeout: 5 });
});

test("document and query text carry the retrieval prefixes", () => {
  expect(documentText("A title", "  some\n body ")).toBe("title: A title | text: some body");
  expect(queryText("after school  tutoring")).toBe("task: search result | query: after school tutoring");
});

test("fills vectors for live rows only, and the nearest row comes first", async () => {
  test.skip(!reachable, "No local database");
  const r = await embedMissing(sql, fake, { source: SRC });
  expect(r.embedded).toBe(2);
  const filled = await sql`select source_id from catalog_opportunities where source = ${SRC} and embedding is not null order by 1`;
  expect(filled.map((x) => x.source_id)).toEqual(["tutoring", "water"]);
  const [q] = await fake([queryText("reading tutoring after school")]);
  const hits = await sql`select o.source_id from catalog_match_embedding(${toVector(q)}::vector, lim => 200) m join catalog_opportunities o on o.id = m.id where o.source = ${SRC}`;
  expect(hits.map((x) => x.source_id)).toEqual(["tutoring", "water"]);
  expect((await embedMissing(sql, fake, { source: SRC })).embedded).toBe(0);
});

test("a changed title clears the vector so the next run refills it", async () => {
  test.skip(!reachable, "No local database");
  await sql`update catalog_opportunities set title = 'Rural water and wastewater systems' where source = ${SRC} and source_id = 'water'`;
  const [w] = await sql`select embedding is null as cleared from catalog_opportunities where source = ${SRC} and source_id = 'water'`;
  expect(w.cleared).toBe(true);
  expect((await embedMissing(sql, fake, { source: SRC })).embedded).toBe(1);
});
