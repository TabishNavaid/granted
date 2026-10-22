/**
 * Live progress for long steps, in plain words. A client starts a job with
 * an id it made up, awaits the server action, and polls `progress(jobId)`
 * in parallel. Entries live in this process's memory; on a platform that
 * spreads requests across instances the poll may miss and the UI falls back
 * to a generic "still working" line, which is honest.
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

function sweep() {
  const now = Date.now();
  for (const [id, j] of jobs) if (now - j.updatedAt > TTL_MS) jobs.delete(id);
}

export function startJob(jobId: string, labels: string[]): void {
  sweep();
  jobs.set(jobId, { jobId, status: "running", steps: labels.map((label, i) => ({ label, state: i === 0 ? "active" : "pending" })), events: [], updatedAt: Date.now() });
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
  j.updatedAt = Date.now();
}

export function noteJob(jobId: string, detail: string): void {
  const j = jobs.get(jobId);
  if (!j) return;
  const i = j.steps.findIndex((s) => s.state === "active");
  if (i >= 0) j.steps[i] = { ...j.steps[i], detail };
  j.updatedAt = Date.now();
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
  j.updatedAt = Date.now();
}

export function finishJob(jobId: string, status: "done" | "failed"): void {
  const j = jobs.get(jobId);
  if (!j) return;
  j.steps = j.steps.map((s) => (status === "done" ? { ...s, state: "done" } : s));
  j.status = status;
  j.updatedAt = Date.now();
}

export function readJob(jobId: string): JobProgress | null {
  return jobs.get(jobId) ?? null;
}
