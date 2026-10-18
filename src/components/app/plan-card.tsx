"use client";

import * as React from "react";
import Link from "next/link";
import { Check, Clock3, X } from "lucide-react";
import type { MonthlyPlan, MatchView, PlanItem } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatMoney, formatShortDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { FitScore } from "./fit-score";

interface PlanCardProps {
  plan: MonthlyPlan;
  matches: Record<string, MatchView>;
  onDecision: (opportunityId: string, decision: PlanItem["decision"]) => void;
  onApprove: () => void;
  onSkip: () => void;
  leaving?: boolean;
}

const effortLabel = { low: "About 2 hours", medium: "About 5 hours", high: "A day or more" };

export function PlanCard({ plan, matches, onDecision, onApprove, onSkip, leaving }: PlanCardProps) {
  const byOpportunity = React.useMemo(() => Object.fromEntries(Object.values(matches).map((m) => [m.opportunityId, m])), [matches]);
  const kept = plan.items.filter((i) => i.decision === "keep");
  const total = kept.reduce((s, i) => s + i.expectedAward, 0);
  const monthName = new Date(plan.month + "-02").toLocaleDateString("en-US", { month: "long", year: "numeric" });
  return (
    <section
      aria-labelledby="plan-title"
      className={cn(
        "overflow-hidden rounded-xl border border-border bg-surface-raised shadow-sm",
        leaving && "animate-collapse-out",
      )}
    >
      <div className="border-b border-border bg-accent-soft/50 px-5 py-4 sm:px-6">
        <p className="text-xs font-semibold uppercase tracking-wider text-accent-soft-fg">This month</p>
        <h2 id="plan-title" className="mt-1 font-display text-2xl text-fg">
          Your plan for {monthName}
        </h2>
        <p className="mt-1.5 max-w-2xl text-sm text-fg-muted">{plan.summary}</p>
      </div>
      <ol className="divide-y divide-border">
        {plan.items.map((item, i) => {
          const m = byOpportunity[item.opportunityId];
          if (!m) return null;
          const skipped = item.decision === "skip";
          return (
            <li key={item.opportunityId} className={cn("flex gap-4 px-5 py-4 sm:px-6", skipped && "opacity-60")}>
              <span className="mt-1 hidden size-7 shrink-0 items-center justify-center rounded-full bg-surface-sunken font-display text-sm text-fg-muted sm:flex" aria-hidden>
                {i + 1}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
                  <div className="min-w-0">
                    <Link href={`/opportunities/${m.opportunityId}`} className={cn("font-medium text-fg hover:underline", skipped && "line-through")}>
                      {m.opportunity.title}
                    </Link>
                    <p className="text-sm text-fg-muted">{m.funder.name}</p>
                  </div>
                  <FitScore score={m.fitScore} size="sm" />
                </div>
                <p className="mt-2 text-sm text-fg-muted">{item.why}</p>
                <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-fg-subtle">
                  <span className="inline-flex items-center gap-1">
                    <Clock3 className="size-3.5" aria-hidden />
                    {effortLabel[item.effort]}
                  </span>
                  <span>Expected {formatMoney(item.expectedAward, { compact: true })}</span>
                  {m.opportunity.deadline ? <span>Due {formatShortDate(m.opportunity.deadline)}</span> : <Badge variant="neutral">Rolling</Badge>}
                  <div className="ml-auto flex items-center gap-1">
                    <button
                      type="button"
                      aria-pressed={!skipped}
                      onClick={() => onDecision(item.opportunityId, "keep")}
                      className={cn(
                        "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
                        !skipped ? "border-accent bg-accent-soft text-accent-soft-fg" : "border-border text-fg-subtle hover:text-fg",
                      )}
                    >
                      <Check className="size-3" aria-hidden /> Keep
                    </button>
                    <button
                      type="button"
                      aria-pressed={skipped}
                      onClick={() => onDecision(item.opportunityId, "skip")}
                      className={cn(
                        "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
                        skipped ? "border-border-strong bg-surface-sunken text-fg" : "border-border text-fg-subtle hover:text-fg",
                      )}
                    >
                      <X className="size-3" aria-hidden /> Skip
                    </button>
                  </div>
                </div>
              </div>
            </li>
          );
        })}
      </ol>
      <div className="flex flex-col gap-3 border-t border-border bg-surface px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <p className="text-sm text-fg-muted">
          <span className="font-medium text-fg">{kept.length} application{kept.length === 1 ? "" : "s"}</span> kept, up to{" "}
          <span className="font-medium text-fg tnum">{formatMoney(total)}</span> in reach.
        </p>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={onSkip}>
            Skip this month
          </Button>
          <Button onClick={onApprove} disabled={kept.length === 0}>
            <Check aria-hidden />
            Approve plan
          </Button>
        </div>
      </div>
    </section>
  );
}
