import { existsSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { readStoredJob, runStoredJob } from "@/lib/jobs/runner";

/**
 * Background jobs against the local Supabase: a job runs once as the person who started it, its result and
 * progress land in the jobs table, a second runner cannot claim it, and a job that keeps dying is given up on.
 */
if (existsSync(".env.localdb")) process.loadEnvFile(".env.localdb");
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const local = /127\.0\.0\.1|localhost/.test(URL);

test.describe.configure({ mode: "serial" });
let admin: SupabaseClient;
let reachable = false;
let orgId = "";
let userId = "";
const tag = randomUUID().slice(0, 8);

test.beforeAll(async () => {
  if (!local || !SERVICE) return;
  admin = createClient(URL, SERVICE, { auth: { persistSession: false } });
  try {
    reachable = (await fetch(`${URL}/auth/v1/health`, { headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "" } })).ok;
  } catch {
    reachable = false;
  }
  if (!reachable) return;
  const u = await admin.auth.admin.createUser({ email: `jobs-${tag}@example.test`, email_confirm: true });
  userId = u.data.user!.id;
  const o = await admin.from("organizations").insert({ name: `Jobs ${tag}` }).select("id").single();
  orgId = o.data!.id;
  await admin.from("org_members").insert({ org_id: orgId, user_id: userId, invited_email: `jobs-${tag}@example.test`, role: "owner", status: "active" });
  await admin.from("notification_settings").insert({ org_id: orgId });
});

test.afterAll(async () => {
  if (!reachable) return;
  await admin.from("organizations").delete().eq("id", orgId);
  await admin.auth.admin.deleteUser(userId);
});

test("a job runs as its owner and stores its result", async () => {
  test.skip(!reachable, "No local Supabase running");
  const id = `job_t${tag}a`;
  await admin.from("jobs").insert({ id, org_id: orgId, user_id: userId, user_email: `jobs-${tag}@example.test`, kind: "account.getUsage", args: [], status: "queued", heartbeat_at: new Date().toISOString() });
  await Promise.all([runStoredJob(id), runStoredJob(id)]);
  const { data } = await admin.from("jobs").select("status, attempts, result, error").eq("id", id).single();
  expect(data!.status, String(data!.error)).toBe("done");
  expect(data!.attempts).toBe(1);
  expect((data!.result as { lines: unknown[] }).lines.length).toBe(2);
  const view = await readStoredJob(id, orgId);
  expect(view?.status).toBe("done");
  expect(await readStoredJob(id, randomUUID())).toBeNull();
});

test("a failing job records a plain error, and a job that keeps dying is given up on", async () => {
  test.skip(!reachable, "No local Supabase running");
  const bad = `job_t${tag}b`;
  await admin.from("jobs").insert({ id: bad, org_id: orgId, user_id: userId, kind: "account.noSuchMethod", args: [], status: "queued", heartbeat_at: new Date().toISOString() });
  await runStoredJob(bad);
  const b = await admin.from("jobs").select("status, error").eq("id", bad).single();
  expect(b.data!.status).toBe("failed");
  expect(b.data!.error).toMatch(/Unknown job/);
  const dying = `job_t${tag}c`;
  await admin.from("jobs").insert({ id: dying, org_id: orgId, user_id: userId, kind: "account.getUsage", args: [], status: "running", attempts: 3, heartbeat_at: new Date(Date.now() - 600_000).toISOString() });
  await runStoredJob(dying);
  const d = await admin.from("jobs").select("status, error").eq("id", dying).single();
  expect(d.data!.status).toBe("failed");
  expect(d.data!.error).toMatch(/three times/);
});
