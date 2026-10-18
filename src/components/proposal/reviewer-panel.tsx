"use client";

import * as React from "react";
import type { ReviewerCheck } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/format";

/** A reviewer's read of the draft against the funder's criteria, with one fix per criterion. */
export function ReviewerPanel({ check, onRun, running }: { check: ReviewerCheck | null; onRun: () => void; running: boolean }) {
  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-ink-muted">A second reader scores the draft the way a funder&apos;s panel would, against the criteria in the notice. It never adds a number; it tells you what to ask for.</p>
      <Button variant="secondary" size="sm" onClick={onRun} loading={running} className="w-fit">
        {check ? "Score it again" : "Score this draft"}
      </Button>
      {check ? (
        <>
          <div className={cn("border-l-[6px] py-2 pl-4", check.overall >= 75 ? "border-l-ink" : check.overall >= 50 ? "border-l-ink" : "border-l-alert")}>
            <p className="font-display text-3xl text-ink tnum">
              {check.overall} <span className="font-body text-sm font-normal text-ink-muted">of 100</span>
            </p>
            <p className="mt-1 text-sm text-ink">{check.summary}</p>
            <p className="mt-1 text-xs text-ink-muted">Scored {formatDate(check.createdAt)}</p>
          </div>
          <ul className="border-t border-rule">
            {check.criteria.map((c) => (
              <li key={c.criterion} className="border-b border-rule py-3 text-sm">
                <p className="flex items-baseline justify-between gap-3">
                  <span className="font-semibold text-ink">{c.criterion}</span>
                  <span className={cn("shrink-0 tnum", c.score <= 2 ? "font-semibold text-alert" : "text-ink-muted")}>{c.score} of 5</span>
                </p>
                <p className="mt-1 text-ink-muted">{c.evidence}</p>
                <p className="mt-1 text-ink">
                  <span className="font-semibold">Fix: </span>
                  {c.fix}
                </p>
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </div>
  );
}
