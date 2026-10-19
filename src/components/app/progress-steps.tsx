"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { useReducedMotion } from "@/lib/use-reduced-motion";

export interface FeedEvent {
  id: number;
  kind: "page" | "fact" | "dropped" | "search" | "notice" | "score" | "foundation" | "section" | "question" | "note";
  text: string;
  detail?: string;
  url?: string;
  score?: number;
}

export interface JobView {
  status: "running" | "done" | "failed";
  steps: { label: string; state: "done" | "active" | "pending"; detail?: string }[];
  events?: FeedEvent[];
}

const KIND_LABEL: Record<FeedEvent["kind"], string> = {
  page: "Read",
  fact: "Fact",
  dropped: "Set aside",
  search: "Search",
  notice: "Notice",
  score: "Fit",
  foundation: "Foundation",
  section: "Paragraph",
  question: "Question",
  note: "Note",
};

/**
 * The live feed under the steps: each page read, each fact with the passage
 * it came from, each search, each score, each paragraph. Events arrive in
 * batches from the poll; they are shown one at a time so a person can follow.
 */
export function LiveFeed({ events, done, onDrained }: { events: FeedEvent[]; done: boolean; onDrained?: () => void }) {
  const reduced = useReducedMotion();
  const [shown, setShown] = React.useState(0);
  const box = React.useRef<HTMLOListElement>(null);
  const target = events.length;
  React.useEffect(() => {
    if (shown >= target) return;
    // Once the run is over, the rest of the feed catches up quickly rather than all at once.
    const t = setTimeout(() => setShown((n) => Math.min(target, n + 1)), reduced ? 0 : done ? 140 : events[shown]?.kind === "fact" || events[shown]?.kind === "section" ? 420 : 260);
    return () => clearTimeout(t);
  }, [shown, target, reduced, done, events]);
  const drained = done && shown >= target;
  React.useEffect(() => {
    if (drained) onDrained?.();
  }, [drained, onDrained]);
  React.useEffect(() => {
    const el = box.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [shown]);
  if (!events.length) return null;
  const visible = events.slice(0, shown);
  return (
    <section aria-label="What it is doing" className="mt-8">
      <h2 className="text-sm font-semibold text-ink">What it is doing</h2>
      <ol ref={box} tabIndex={0} aria-label="Steps taken so far" className="mt-2 max-h-[26rem] overflow-y-auto border-t border-rule focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus" aria-live="polite" aria-relevant="additions">
        {visible.map((e) => (
          <li key={e.id} className="grid grid-cols-[5.5rem_1fr] gap-3 border-b border-rule py-2.5 text-sm">
            <span className={cn("pt-px text-ink-muted", e.kind === "dropped" && "text-alert")}>{e.kind === "score" && e.score != null ? `Fit ${e.score}` : KIND_LABEL[e.kind]}</span>
            <span className="min-w-0">
              <span className="block break-words text-ink">{e.text}</span>
              {e.detail ? <span className={cn("mt-0.5 block break-words text-ink-muted", e.kind === "fact" && "italic")}>{e.kind === "fact" ? `\u201c${e.detail}\u201d` : e.detail}</span> : null}
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}

/** Plain-words progress: one line per step, the active one in ink, done ones with their note, and the live feed. */
export function ProgressSteps({ job, feed = true, onDrained }: { job: JobView; feed?: boolean; onDrained?: () => void }) {
  return (
    <div>
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
      {feed && job.events?.length ? <LiveFeed events={job.events} done={job.status !== "running"} onDrained={onDrained} /> : null}
    </div>
  );
}
