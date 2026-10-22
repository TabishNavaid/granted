import { existsSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import postgres from "postgres";
import { cleanPath, fingerprint, scrub } from "@/lib/errors/report";

/** Error monitoring: nothing sensitive is stored, repeats group together, and only the service role can read. */
if (existsSync(".env.localdb")) process.loadEnvFile(".env.localdb");
const URL = process.env.DATABASE_URL ?? "";
const local = /@(127\.0\.0\.1|localhost)[:/]/.test(URL);

test("emails, long tokens, and query strings are removed", () => {
  // Built at runtime so no key-shaped string sits in the repository.
  const fakeKey = ["fake", "token", "x".repeat(32)].join("_");
  expect(scrub(`No member jane.doe+x@example.org with key ${fakeKey}`)).toBe("No member [email] with key [token]");
  expect(cleanPath("/auth/callback?token_hash=abc&type=invite")).toBe("/auth/callback");
  expect(cleanPath("/applications/12#draft")).toBe("/applications/12");
});

test("the same error on the same route is one group, whatever the ids and numbers", () => {
  const a = fingerprint({ kind: "server", route: "/applications/[id]", message: "Row 12 of 3f2b1c4d-1111-2222-3333-444455556666 missing" });
  const b = fingerprint({ kind: "server", route: "/applications/[id]", message: "Row 98 of 0a0b0c0d-aaaa-bbbb-cccc-ddddeeeeffff missing" });
  const c = fingerprint({ kind: "server", route: "/inbox", message: "Row 12 of 3f2b1c4d-1111-2222-3333-444455556666 missing" });
  expect(a).toBe(b);
  expect(a).not.toBe(c);
});

test("record_app_error counts repeats and anon cannot read the table", async () => {
  test.skip(!local, "No local database");
  const sql = postgres(URL, { max: 1, onnotice: () => undefined });
  try {
    await sql`select 1`;
  } catch {
    test.skip(true, "No local database");
  }
  const fp = `test_${randomUUID().slice(0, 8)}`;
  try {
    for (let i = 0; i < 3; i++) await sql`select record_app_error(${fp}, 'server', 'Boom', null, '/x', '/x', '{}'::jsonb)`;
    const [row] = await sql`select count from app_errors where fingerprint = ${fp}`;
    expect(row.count).toBe(3);
    const visible = await sql.begin(async (tx) => {
      await tx`set local role anon`;
      return tx`select count(*)::int as n from app_errors`;
    });
    expect(visible[0].n).toBe(0);
  } finally {
    await sql`delete from app_errors where fingerprint = ${fp}`;
    await sql.end({ timeout: 5 });
  }
});
