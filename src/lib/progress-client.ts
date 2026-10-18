import type { JobView } from "@/components/app/progress-steps";

export function newJobId() {
  return `job_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
}

/** Poll the progress route until stopped. Server actions queue behind each other, so this uses fetch. */
export function watchJob(jobId: string, onUpdate: (job: JobView) => void, everyMs = 1000): () => void {
  let alive = true;
  const tick = async () => {
    if (!alive) return;
    try {
      const r = await fetch(`/api/progress/${jobId}`, { cache: "no-store" });
      const p = (await r.json()) as JobView | null;
      if (alive && p) onUpdate({ status: p.status, steps: p.steps });
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
