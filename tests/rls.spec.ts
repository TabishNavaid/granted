import { existsSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Row level security, proven against a real Postgres: the local Supabase from `supabase start`
 * (keys in .env.localdb). One workspace can never read or change another's data, the shared
 * opportunity database is readable when signed in and writable only by ingestion, and files in
 * one workspace's folder are invisible to another. Skipped when no local database is running.
 */
if (existsSync(".env.localdb")) process.loadEnvFile(".env.localdb");
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const local = /127\.0\.0\.1|localhost/.test(URL);

test.describe.configure({ mode: "serial" });

let admin: SupabaseClient;
let reachable = false;
const tag = randomUUID().slice(0, 8);
const users = {
  a: { email: `rls-a-${tag}@example.test`, password: `pw-${randomUUID()}`, id: "" },
  b: { email: `rls-b-${tag}@example.test`, password: `pw-${randomUUID()}`, id: "" },
  /** A reviewer in workspace A. */
  r: { email: `rls-r-${tag}@example.test`, password: `pw-${randomUUID()}`, id: "" },
};
const orgs = { a: "", b: "" };
let asA: SupabaseClient;
let asReviewer: SupabaseClient;
let anon: SupabaseClient;

/** Tables seeded in workspace B, with the minimum columns each needs. */
const SEED: [string, Record<string, unknown>][] = [
  ["facts", { label: "Youth served", value: "412", category: "reach" }],
  ["documents", { title: "Annual report", file_name: "report.pdf", storage_path: "x/report.pdf", mime_type: "application/pdf" }],
  ["boilerplates", { type: "mission", title: "Mission", body: "We feed people." }],
  ["inbox_items", { agent: "proposal", type: "proposal_draft", title: "Draft", payload: {} }],
  ["agent_runs", { agent: "proposal", trigger: "user", title: "Draft a letter" }],
  ["email_drafts", { kind: "question", subject: "Question", body: "Hello" }],
  ["org_contacts", { name: "Board member" }],
  ["firm_profiles", { data: {} }],
  ["portfolio_projects", { name: "Fire station 9", data: {} }],
  ["personnel", { name: "Project manager", data: {} }],
  ["integration_connections", { provider: "google", access_token: "enc:v1:not-a-real-token" }],
];

test.beforeAll(async () => {
  if (!local || !ANON || !SERVICE) return;
  admin = createClient(URL, SERVICE, { auth: { persistSession: false } });
  try {
    const ping = await fetch(`${URL}/auth/v1/health`, { headers: { apikey: ANON } });
    reachable = ping.ok;
  } catch {
    reachable = false;
  }
  if (!reachable) return;
  for (const k of ["a", "b"] as const) {
    const { data, error } = await admin.auth.admin.createUser({ email: users[k].email, password: users[k].password, email_confirm: true });
    if (error) throw error;
    users[k].id = data.user.id;
    const { data: org, error: e2 } = await admin.from("organizations").insert({ name: `RLS ${k} ${tag}` }).select("id").single();
    if (e2) throw e2;
    orgs[k] = org.id;
    await admin.from("org_members").insert({ org_id: org.id, user_id: data.user.id, invited_email: users[k].email, role: "owner", status: "active" });
  }
  {
    const { data, error } = await admin.auth.admin.createUser({ email: users.r.email, password: users.r.password, email_confirm: true });
    if (error) throw error;
    users.r.id = data.user.id;
    await admin.from("org_members").insert({ org_id: orgs.a, user_id: data.user.id, invited_email: users.r.email, role: "reviewer", status: "active" });
  }
  for (const [table, row] of SEED) {
    const { error } = await admin.from(table).insert({ ...row, org_id: orgs.b });
    if (error) throw new Error(`${table}: ${error.message}`);
  }
  await admin.from("facts").insert({ org_id: orgs.a, label: "Founded", value: "1998", category: "organization" });
  await admin.from("integration_connections").insert({ org_id: orgs.a, provider: "google", access_token: "enc:v1:not-a-real-token" });
  asA = createClient(URL, ANON, { auth: { persistSession: false } });
  const { error } = await asA.auth.signInWithPassword({ email: users.a.email, password: users.a.password });
  if (error) throw error;
  asReviewer = createClient(URL, ANON, { auth: { persistSession: false } });
  const r = await asReviewer.auth.signInWithPassword({ email: users.r.email, password: users.r.password });
  if (r.error) throw r.error;
  anon = createClient(URL, ANON, { auth: { persistSession: false } });
});

test.afterAll(async () => {
  if (!reachable) return;
  await admin.from("organizations").delete().in("id", [orgs.a, orgs.b]);
  for (const k of ["a", "b", "r"] as const) if (users[k].id) await admin.auth.admin.deleteUser(users[k].id);
});

test("every table in the public schema has row level security on", async () => {
  test.skip(!reachable, "No local Supabase running");
  // PostgREST exposes the public schema, so a table without RLS would be readable with the anon key.
  const { data, error } = await admin.rpc("rls_report");
  expect(error).toBeNull();
  const off = (data as { table_name: string; rls: boolean }[]).filter((r) => !r.rls).map((r) => r.table_name);
  expect(off).toEqual([]);
});

test("a member of one workspace reads none of another workspace's rows", async () => {
  test.skip(!reachable, "No local Supabase running");
  for (const [table] of SEED) {
    const { data, error } = await asA.from(table).select("*").eq("org_id", orgs.b);
    expect(error, table).toBeNull();
    expect(data, table).toEqual([]);
  }
  const { data: org } = await asA.from("organizations").select("id").eq("id", orgs.b);
  expect(org).toEqual([]);
  const { data: members } = await asA.from("org_members").select("*").eq("org_id", orgs.b);
  expect(members).toEqual([]);
});

test("a member cannot write into, change, or delete another workspace's rows", async () => {
  test.skip(!reachable, "No local Supabase running");
  const insert = await asA.from("facts").insert({ org_id: orgs.b, label: "Planted", value: "1", category: "reach" });
  expect(insert.error).not.toBeNull();
  const update = await asA.from("facts").update({ value: "999" }).eq("org_id", orgs.b).select();
  expect(update.data ?? []).toEqual([]);
  const del = await asA.from("facts").delete().eq("org_id", orgs.b).select();
  expect(del.data ?? []).toEqual([]);
  const { data: still } = await admin.from("facts").select("value").eq("org_id", orgs.b);
  expect(still).toEqual([{ value: "412" }]);
});

test("a member reads and writes their own workspace", async () => {
  test.skip(!reachable, "No local Supabase running");
  const ins = await asA.from("facts").insert({ org_id: orgs.a, label: "Meals served", value: "1,200", category: "reach" }).select("label");
  expect(ins.error).toBeNull();
  const { data } = await asA.from("facts").select("label").eq("org_id", orgs.a).order("label");
  expect(data).toEqual([{ label: "Founded" }, { label: "Meals served" }]);
});

test("profiles: your own and your teammates', never a stranger's, and none without signing in", async () => {
  test.skip(!reachable, "No local Supabase running");
  const mine = await asA.from("profiles").select("email").eq("id", users.a.id);
  expect(mine.data).toEqual([{ email: users.a.email }]);
  const stranger = await asA.from("profiles").select("email").eq("id", users.b.id);
  expect(stranger.data).toEqual([]);
  const open = await anon.from("profiles").select("email").limit(5);
  expect(open.data ?? []).toEqual([]);
});

test("the opportunity database: readable when signed in, never writable by users, counts public", async () => {
  test.skip(!reachable, "No local Supabase running");
  const read = await asA.from("catalog_opportunities").select("id").limit(1);
  expect(read.error).toBeNull();
  const write = await asA.from("catalog_opportunities").insert({ source: "grantsgov", source_id: `rls-${tag}`, source_url: "https://example.test", type: "grant", title: "Planted", status: "open", content_hash: "x" });
  expect(write.error).not.toBeNull();
  const wipe = await asA.from("catalog_opportunities").delete().neq("id", randomUUID()).select("id");
  expect(wipe.data ?? []).toEqual([]);
  const anonRows = await anon.from("catalog_opportunities").select("id").limit(1);
  expect(anonRows.data ?? []).toEqual([]);
  const stats = await anon.rpc("catalog_public_stats");
  expect(stats.error).toBeNull();
  const search = await anon.rpc("catalog_search", { q: "health" });
  expect(search.error).not.toBeNull();
  const runs = await asA.from("catalog_ingest_runs").select("id").limit(1);
  expect(runs.data ?? []).toEqual([]);
});

test("files in another workspace's folder cannot be read, listed, or replaced", async () => {
  test.skip(!reachable, "No local Supabase running");
  const path = `${orgs.b}/rls-${tag}.txt`;
  const up = await admin.storage.from("documents").upload(path, new Blob(["private"]), { contentType: "text/plain", upsert: true });
  expect(up.error).toBeNull();
  const get = await asA.storage.from("documents").download(path);
  expect(get.error).not.toBeNull();
  const list = await asA.storage.from("documents").list(orgs.b);
  expect(list.data ?? []).toEqual([]);
  const overwrite = await asA.storage.from("documents").upload(path, new Blob(["mine now"]), { upsert: true });
  expect(overwrite.error).not.toBeNull();
  const own = await asA.storage.from("documents").upload(`${orgs.a}/mine-${tag}.txt`, new Blob(["ok"]), { contentType: "text/plain" });
  expect(own.error).toBeNull();
  await admin.storage.from("documents").remove([path, `${orgs.a}/mine-${tag}.txt`]);
});

test("a reviewer reads the workspace but cannot change it directly", async () => {
  test.skip(!reachable, "No local Supabase running");
  const read = await asReviewer.from("facts").select("label").eq("org_id", orgs.a);
  expect((read.data ?? []).length).toBeGreaterThan(0);
  const ins = await asReviewer.from("facts").insert({ org_id: orgs.a, label: "Reviewer wrote this", value: "1", category: "reach" });
  expect(ins.error).not.toBeNull();
  const upd = await asReviewer.from("facts").update({ value: "2000" }).eq("org_id", orgs.a).select();
  expect(upd.data ?? []).toEqual([]);
  const file = await asReviewer.storage.from("documents").upload(`${orgs.a}/reviewer-${tag}.txt`, new Blob(["x"]));
  expect(file.error).not.toBeNull();
});

test("connected account tokens are never readable through the API, even by the owner", async () => {
  test.skip(!reachable, "No local Supabase running");
  const own = await asA.from("integration_connections").select("access_token").eq("org_id", orgs.a);
  expect(own.data ?? []).toEqual([]);
  const { data } = await admin.from("integration_connections").select("access_token").eq("org_id", orgs.a);
  expect(data?.[0]?.access_token).toMatch(/^enc:/);
});
