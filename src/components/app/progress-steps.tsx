import { cn } from "@/lib/utils";

export interface JobView {
  status: "running" | "done" | "failed";
  steps: { label: string; state: "done" | "active" | "pending"; detail?: string }[];
}

/**
 * Plain-words progress: one line per step, the active one in ink, done ones
 * with their note. A slot on the right holds the seedling drawing that grows
 * with each step (data-seedling-stage), added with the drawings.
 */
export function ProgressSteps({ job }: { job: JobView }) {
  const done = job.steps.filter((s) => s.state === "done").length;
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
      <div data-seedling-stage={done} className="hidden sm:block" aria-hidden />
    </div>
  );
}
