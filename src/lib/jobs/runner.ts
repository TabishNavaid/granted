import { after } from "next/server";
import { adminClient } from "@/lib/supabase/clients";
import { runAsSession, type SessionContext } from "@/lib/supabase/session";
import { attachSink, detachSink, readJob, type JobProgress } from "@/lib/loop/progress";
import type { Services } from "@/lib/services/contracts";
import { makeSupabaseServices } from "@/lib/services/supabase";
import { registerCacheBackend } from "@/lib/cache";
import { supabaseCacheBackend } from "@/lib/supabase/cache-backend";

/**
 * Background jobs for long work a person starts. The server records the job in
 * the jobs table, answers the request at once, and runs the job with `after()`
 * in the same function, as the person who started it. Progress is written to
 * the row as it goes, so a poll that lands on another instance still sees it.
 * Each job is built to finish in about two minutes; the function may run for
 * up to five (maxDuration in src/app/layout.tsx). If an instance dies mid-job,
 * the sweeper (/api/cron/jobs) starts it again, up to three tries.
 */
export const BACKGROUND_KINDS = new Set([
  "loop.buildProfile",
  "loop.findMatches",
  "loop.draftLetter",
  "loop.draftProposal",
  "bids.addRfp",
  "bids.draft",
  "research.draftProposal",
  "person.draftEssay",
]);

const MAX_ATTEMPTS = 3;
/** A running job writes a heartbeat at least this often; one quiet for three times as long is presumed dead. */
const HEARTBEAT_MS = 20_000;
const STALE_MS = 3 * 60_000;

export interface StoredJob {
  status: "queued" | "running" | "done" | "failed";
  steps: JobProgress["steps"];
  events: JobProgress["events"];
  result: unknown;
  error: string | null;
}

let services: Services | null = null;
async function realServices(): Promise<Services> {
  if (!services) {
    registerCacheBackend(supabaseCacheBackend());
    services = makeSupabaseServices();
  }
  return services;
}

export function isBackgroundKind(kind: string): boolean {
  return BACKGROUND_KINDS.has(kind);
}

/** Record the job and run it once the response has gone out. */
export async function enqueue(spec: { jobId: string; kind: string; args: unknown[] }, session: SessionContext): Promise<void> {
  if (!isBackgroundKind(spec.kind)) throw new Error(`${spec.kind} does not run in the background.`);
  if (!/^job_[a-z0-9]{6,40}$/i.test(spec.jobId)) throw new Error("Bad job id.");
  const now = new Date().toISOString();
  const { error } = await adminClient()
    .from("jobs")
    .insert({ id: spec.jobId, org_id: session.orgId, user_id: session.userId, user_email: session.email, user_name: session.fullName, kind: spec.kind, args: spec.args, status: "queued", heartbeat_at: now });
  if (error) throw new Error(`Could not start the job: ${error.message}`);
  after(() => runStoredJob(spec.jobId));
}

/** Claim and run one job. Safe to call twice: only one caller wins the claim. */
export async function runStoredJob(jobId: string): Promise<void> {
  const db = adminClient();
  const { data: row } = await db.from("jobs").select("*").eq("id", jobId).maybeSingle();
  if (!row || row.status === "done" || row.status === "failed") return;
  if (row.attempts >= MAX_ATTEMPTS) {
    await db.from("jobs").update({ status: "failed", error: "This stopped three times before finishing. Try again, and tell us if it keeps happening.", finished_at: new Date().toISOString() }).eq("id", jobId);
    return;
  }
  const now = new Date().toISOString();
  const { data: claimed } = await db
    .from("jobs")
    .update({ status: "running", started_at: row.started_at ?? now, heartbeat_at: now, attempts: row.attempts + 1 })
    .eq("id", jobId)
    .eq("attempts", row.attempts)
    .select("id")
    .maybeSingle();
  if (!claimed) return;

  const session: SessionContext = { userId: String(row.user_id), email: String(row.user_email ?? ""), fullName: String(row.user_name ?? ""), orgId: String(row.org_id) };
  let lastWrite = 0;
  let timer: ReturnType<typeof setTimeout> | null = null;
  const write = (p: JobProgress) => db.from("jobs").update({ progress: { status: p.status, steps: p.steps, events: p.events }, heartbeat_at: new Date().toISOString() }).eq("id", jobId);
  attachSink(jobId, (p) => {
    // At most one write a second; the last change is always written.
    if (timer) return;
    const wait = Math.max(0, lastWrite + 1000 - Date.now());
    timer = setTimeout(() => {
      timer = null;
      lastWrite = Date.now();
      void write(p);
    }, wait);
  });
  const beat = setInterval(() => void db.from("jobs").update({ heartbeat_at: new Date().toISOString() }).eq("id", jobId), HEARTBEAT_MS);
  try {
    const [domain, method] = String(row.kind).split(".") as [keyof Services, string];
    const svc = await realServices();
    const target = svc[domain] as unknown as Record<string, (...a: unknown[]) => Promise<unknown>>;
    const fn = target[method];
    if (typeof fn !== "function") throw new Error(`Unknown job ${row.kind}`);
    const result = await runAsSession(session, () => fn.apply(target, (row.args as unknown[]) ?? []));
    const p = readJob(jobId);
    await db
      .from("jobs")
      .update({ status: "done", result: result ?? null, progress: p ? { status: "done", steps: p.steps.map((s) => ({ ...s, state: "done" })), events: p.events } : row.progress, finished_at: new Date().toISOString(), heartbeat_at: new Date().toISOString() })
      .eq("id", jobId);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await db.from("jobs").update({ status: "failed", error: message.slice(0, 500), finished_at: new Date().toISOString() }).eq("id", jobId);
  } finally {
    clearInterval(beat);
    if (timer) clearTimeout(timer);
    detachSink(jobId);
  }
}

/** The job as stored, for the person's own workspace only. */
export async function readStoredJob(jobId: string, orgId: string): Promise<StoredJob | null> {
  const { data } = await adminClient().from("jobs").select("status, progress, result, error").eq("id", jobId).eq("org_id", orgId).maybeSingle();
  if (!data) return null;
  const p = (data.progress as { steps?: JobProgress["steps"]; events?: JobProgress["events"] } | null) ?? {};
  return { status: data.status as StoredJob["status"], steps: p.steps ?? [], events: p.events ?? [], result: data.result, error: (data.error as string | null) ?? null };
}

/** Restart jobs whose worker went quiet. Called by the sweeper on a schedule. */
export async function sweepJobs(limit = 5): Promise<{ restarted: string[] }> {
  const cutoff = new Date(Date.now() - STALE_MS).toISOString();
  const { data } = await adminClient().from("jobs").select("id").in("status", ["queued", "running"]).lt("heartbeat_at", cutoff).order("heartbeat_at").limit(limit);
  const ids = (data ?? []).map((r) => String(r.id));
  for (const id of ids) after(() => runStoredJob(id));
  return { restarted: ids };
}
