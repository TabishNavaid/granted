import { cn } from "@/lib/utils";
import { Bloom } from "@/components/drawings/bloom";
import { Drawing } from "@/components/drawings/drawing";
import { drawingOf, flowers } from "@/lib/drawings";

export interface JobView {
  status: "running" | "done" | "failed";
  steps: { label: string; state: "done" | "active" | "pending"; detail?: string }[];
}

/**
 * Plain-words progress: one line per step, the active one in ink, done ones
 * with their note. Beside it a crayon seedling grows with each step and opens
 * into a flower when the job is done. With reduced motion it is simply there.
 */
export function ProgressSteps({ job }: { job: JobView }) {
  const done = job.steps.filter((s) => s.state === "done").length;
  const total = job.steps.length || 1;
  const sprout = drawingOf("seedling");
  const flower = flowers[0];
  const finished = job.status === "done";
  const sproutHeight = `${35 + Math.min(done, total - 1) * (55 / Math.max(total - 1, 1))}%`;
  return (
    <div className="grid gap-8 sm:grid-cols-[1fr_8rem]">
      <ol className="border-t border-rule">
        {job.steps.map((s) => (
          <li key={s.label} className={cn("flex items-baseline gap-4 border-b border-rule py-3", s.state === "pending" && "text-ink-muted")}>
            <span className="w-16 shrink-0 text-sm" aria-hidden>
              {s.state === "done" ? "Done" : s.state === "active" ? (job.status === "failed" ? "Stopped" : "Now") : ""}
            </span>
            <span className="min-w-0 flex-1">
              <span className={cn("block text-base", s.state === "active" && "font-semibold text-ink")}>{s.label}</span>
              {s.detail ? <span className="block text-sm text-ink-muted">{s.detail}</span> : null}
            </span>
            <span className="sr-only">{s.state === "done" ? "done" : s.state === "active" ? "in progress" : "not started"}</span>
          </li>
        ))}
      </ol>
      <div data-seedling-stage={done} className="relative hidden h-40 sm:block" aria-hidden>
        <div className="absolute inset-x-0 bottom-0 flex items-end justify-center border-b border-rule pb-1">
          {finished && flower ? (
            <Bloom flower={flower} grow className="h-36" />
          ) : sprout ? (
            <Drawing asset={sprout} className="w-auto transition-[height] duration-700 ease-out" style={{ height: sproutHeight }} />
          ) : null}
        </div>
      </div>
    </div>
  );
}
