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

export interface JobProgress {
  jobId: string;
  status: "running" | "done" | "failed";
  steps: ProgressStep[];
  updatedAt: number;
}

const jobs = new Map<string, JobProgress>();
const TTL_MS = 15 * 60 * 1000;

function sweep() {
  const now = Date.now();
  for (const [id, j] of jobs) if (now - j.updatedAt > TTL_MS) jobs.delete(id);
}

export function startJob(jobId: string, labels: string[]): void {
  sweep();
  jobs.set(jobId, { jobId, status: "running", steps: labels.map((label, i) => ({ label, state: i === 0 ? "active" : "pending" })), updatedAt: Date.now() });
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
