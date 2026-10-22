/**
 * Live progress for long steps, in plain words. A client starts a job with
 * an id it made up and polls `progress(jobId)` while it runs. Entries live in
 * this process's memory; in the real product a sink registered by the job
 * runner (src/lib/jobs/runner.ts) also writes them to the jobs table, so a
 * poll that lands on another server instance still sees them.
 */
export interface ProgressStep {
  label: string;
  state: "done" | "active" | "pending";
  detail?: string;
}

/**
 * One thing an agent did, for the live feed under the steps: a page read, a
 * fact written down with the passage it came from, a search, a notice
 * scored, a paragraph written. Real runs and recorded runs emit the same events.
 */
export interface JobEvent {
  id: number;
  kind: "page" | "fact" | "dropped" | "search" | "notice" | "score" | "foundation" | "section" | "question" | "note";
  text: string;
  /** A quoted passage, a reason, or a count. */
  detail?: string;
  url?: string;
  score?: number;
}

export interface JobProgress {
  jobId: string;
  status: "running" | "done" | "failed";
  steps: ProgressStep[];
  events: JobEvent[];
  updatedAt: number;
}

// One table per process. Route handlers and server actions can load separate copies of this module, so it lives on globalThis.
const g = globalThis as typeof globalThis & { __fundfellowsJobs?: Map<string, JobProgress> };
const jobs = (g.__fundfellowsJobs ??= new Map<string, JobProgress>());
const TTL_MS = 15 * 60 * 1000;

/** Somewhere durable to copy progress to. Called after every change; the sink decides how often to write. */
export type ProgressSink = (job: JobProgress) => void;
const sinks = ((g as typeof g & { __fundfellowsJobSinks?: Map<string, ProgressSink> }).__fundfellowsJobSinks ??= new Map<string, ProgressSink>());

/** Copy this job's progress somewhere durable as it changes (the jobs table). */
export function attachSink(jobId: string, sink: ProgressSink) {
  sinks.set(jobId, sink);
}

export function detachSink(jobId: string) {
  sinks.delete(jobId);
}

function changed(j: JobProgress) {
  j.updatedAt = Date.now();
  sinks.get(j.jobId)?.(j);
}

function sweep() {
  const now = Date.now();
  for (const [id, j] of jobs) if (now - j.updatedAt > TTL_MS) jobs.delete(id);
}

export function startJob(jobId: string, labels: string[]): void {
  sweep();
  const j: JobProgress = { jobId, status: "running", steps: labels.map((label, i) => ({ label, state: i === 0 ? "active" : "pending" })), events: [], updatedAt: Date.now() };
  jobs.set(jobId, j);
  changed(j);
}

/** Mark the current active step done (with an optional note) and activate the next one. */
export function advanceJob(jobId: string, detail?: string): void {
  const j = jobs.get(jobId);
  if (!j) return;
  const i = j.steps.findIndex((s) => s.state === "active");
  if (i >= 0) {
    j.steps[i] = { ...j.steps[i], state: "done", detail };
    if (j.steps[i + 1]) j.steps[i + 1] = { ...j.steps[i + 1], state: "active" };
  }
  changed(j);
}

export function noteJob(jobId: string, detail: string): void {
  const j = jobs.get(jobId);
  if (!j) return;
  const i = j.steps.findIndex((s) => s.state === "active");
  if (i >= 0) j.steps[i] = { ...j.steps[i], detail };
  changed(j);
}

const MAX_EVENTS = 80;

/** Add a line to the live feed. Cheap enough to call for every fact or paragraph. */
export function logJob(jobId: string | undefined, event: Omit<JobEvent, "id">): void {
  if (!jobId) return;
  const j = jobs.get(jobId);
  if (!j) return;
  const id = (j.events[j.events.length - 1]?.id ?? 0) + 1;
  j.events.push({ ...event, id });
  if (j.events.length > MAX_EVENTS) j.events.splice(0, j.events.length - MAX_EVENTS);
  changed(j);
}

export function finishJob(jobId: string, status: "done" | "failed"): void {
  const j = jobs.get(jobId);
  if (!j) return;
  j.steps = j.steps.map((s) => (status === "done" ? { ...s, state: "done" } : s));
  j.status = status;
  changed(j);
}

export function readJob(jobId: string): JobProgress | null {
  return jobs.get(jobId) ?? null;
}
