import type { JobView } from "@/components/app/progress-steps";
import { inBrowserDemo } from "@/lib/demo/flags";
import { services } from "@/lib/services";

/** The job as the server has it, or, in the browser demo, as this tab has it (the run is happening here). */
async function readProgress(jobId: string): Promise<JobView | null> {
  if (inBrowserDemo()) {
    const { readJob } = await import("@/lib/loop/progress");
    const j = readJob(jobId);
    return j ? structuredClone({ status: j.status, steps: j.steps, events: j.events }) : null;
  }
  const r = await fetch(`/api/progress/${jobId}`, { cache: "no-store" });
  return (await r.json()) as JobView | null;
}

export function newJobId() {
  return `job_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
}

/** Poll the progress route until stopped. Server actions queue behind each other, so this uses fetch. */
export function watchJob(jobId: string, onUpdate: (job: JobView) => void, everyMs = 1000): () => void {
  let alive = true;
  const tick = async () => {
    if (!alive) return;
    try {
      const p = await readProgress(jobId);
      if (alive && p) onUpdate({ status: p.status, steps: p.steps, events: p.events });
    } catch {
      // keep the fallback view
    }
    if (alive) setTimeout(tick, everyMs);
  };
  setTimeout(tick, 400);
  return () => {
    alive = false;
  };
}

/** One last read after the run returns, so the feed has every event, then marked done. */
export async function finalJob(jobId: string, fallback: JobView): Promise<JobView> {
  try {
    const p = await readProgress(jobId);
    if (p) return { status: "done", steps: p.steps.map((s) => ({ ...s, state: "done" })), events: p.events };
  } catch {
    // fall through
  }
  return { ...fallback, status: "done", steps: fallback.steps.map((s) => ({ ...s, state: "done" })) };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Run a long step. In the real product the server records it as a background job and this waits for the result
 * by polling, so no request is held open for minutes. In the demo it is called directly.
 */
export async function runLong<T>(jobId: string, kind: string, args: unknown[], direct: () => Promise<T>): Promise<T> {
  if (inBrowserDemo()) return direct();
  const { mode } = await services.jobs.start({ jobId, kind, args });
  if (mode === "inline") return direct();
  const started = Date.now();
  for (;;) {
    await sleep(1500);
    try {
      const r = await fetch(`/api/progress/${jobId}`, { cache: "no-store" });
      const j = (await r.json()) as { finished?: boolean; status?: string; result?: T; error?: string } | null;
      if (j?.finished) {
        if (j.status === "done") return j.result as T;
        throw new Error(j.error || "The job stopped before it finished. Try again.");
      }
    } catch (err) {
      if (err instanceof Error && /stopped|job/i.test(err.message)) throw err;
    }
    if (Date.now() - started > 15 * 60_000) throw new Error("This is taking much longer than it should. Reload the page to see where it got to.");
  }
}
