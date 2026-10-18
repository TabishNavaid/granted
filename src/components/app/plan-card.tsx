"use client";

import * as React from "react";
import Link from "next/link";
import type { MonthlyPlan, MatchView, PlanItem } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { formatMoney, formatShortDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { FitScore } from "./fit-score";
import { Bloom } from "@/components/drawings/bloom";
import { flowerFor } from "@/lib/drawings";

interface PlanCardProps {
  plan: MonthlyPlan;
  matches: Record<string, MatchView>;
  onDecision: (opportunityId: string, decision: PlanItem["decision"]) => void;
  onApprove: () => void;
  onSkip: () => void;
  leaving?: boolean;
}

const effortLabel = { low: "About 2 hours", medium: "About 5 hours", high: "A day or more" };

/** The month's plan: numbered rows in priority order, a total, one primary button. Approving it opens a small flower. */
export function PlanCard({ plan, matches, onDecision, onApprove, onSkip, leaving }: PlanCardProps) {
  const byOpportunity = React.useMemo(() => Object.fromEntries(Object.values(matches).map((m) => [m.opportunityId, m])), [matches]);
  const kept = plan.items.filter((i) => i.decision === "keep");
  const total = kept.reduce((s, i) => s + i.expectedAward, 0);
  const monthName = new Date(plan.month + "-02").toLocaleDateString("en-US", { month: "long", year: "numeric" });
  return (
    <section aria-labelledby="plan-title" className={cn("sheet relative", leaving && "animate-leave [animation-delay:1150ms]")}>
      <div className="border-b border-rule px-5 py-5 sm:px-7">
        <p className="text-sm font-semibold text-ink">Your plan for the month</p>
        <h2 id="plan-title" className="mt-1 font-display text-3xl text-ink">
          {monthName}
        </h2>
        <p className="mt-2 max-w-[65ch] text-base text-ink-muted">{plan.summary}</p>
      </div>
      <ol className="divide-y divide-rule">
        {plan.items.map((item, i) => {
          const m = byOpportunity[item.opportunityId];
          if (!m) return null;
          const skipped = item.decision === "skip";
          return (
            <li key={item.opportunityId} className={cn("grid gap-4 px-5 py-5 sm:grid-cols-[2rem_1fr_auto] sm:px-7", skipped && "opacity-60")}>
              <span className="font-display text-2xl leading-none text-ink tnum" aria-hidden>
                {i + 1}
              </span>
              <div className="min-w-0">
                <Link href={`/opportunities/${m.opportunityId}`} className={cn("font-display text-xl leading-tight text-ink hover:underline hover:decoration-ink hover:decoration-2 hover:underline-offset-4", skipped && "line-through")}>
                  {m.opportunity.title}
                </Link>
                <p className="text-base text-ink-muted">{m.funder.name}</p>
                <p className="mt-2 max-w-[60ch] text-base text-ink">{item.why}</p>
                <dl className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-sm text-ink-muted">
                  <div className="flex gap-1.5">
                    <dt>Your time</dt>
                    <dd className="font-semibold text-ink">{effortLabel[item.effort]}</dd>
                  </div>
                  <div className="flex gap-1.5">
                    <dt>Expected</dt>
                    <dd className="font-semibold text-ink tnum">{formatMoney(item.expectedAward, { compact: true })}</dd>
                  </div>
                  <div className="flex gap-1.5">
                    <dt>Due</dt>
                    <dd className="font-semibold text-ink">{m.opportunity.deadline ? formatShortDate(m.opportunity.deadline) : "Rolling"}</dd>
                  </div>
                </dl>
                <div className="mt-3 flex items-center gap-2 text-sm">
                  <button
                    type="button"
                    aria-pressed={!skipped}
                    onClick={() => onDecision(item.opportunityId, "keep")}
                    className={cn("rounded-sm border px-2.5 py-1 font-semibold transition-colors", !skipped ? "border-ink bg-ink text-paper" : "border-rule-strong text-ink-muted hover:border-ink hover:text-ink")}
                  >
                    Keep
                  </button>
                  <button
                    type="button"
                    aria-pressed={skipped}
                    onClick={() => onDecision(item.opportunityId, "skip")}
                    className={cn("rounded-sm border px-2.5 py-1 font-semibold transition-colors", skipped ? "border-ink bg-ink text-paper" : "border-rule-strong text-ink-muted hover:border-ink hover:text-ink")}
                  >
                    Skip
                  </button>
                </div>
              </div>
              <FitScore score={m.fitScore} size="sm" className="sm:justify-self-end" />
            </li>
          );
        })}
      </ol>
      <div className="flex flex-col gap-4 border-t border-rule px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-7">
        <p className="text-base text-ink">
          <span className="font-semibold">{kept.length} application{kept.length === 1 ? "" : "s"}</span> kept, up to <span className="font-semibold tnum">{formatMoney(total)}</span> in reach.
        </p>
        {leaving ? (
          <p className="flex min-h-10 items-end gap-2 text-base font-semibold text-ink">
            <Bloom flower={flowerFor(plan.id)} grow className="-mb-1 h-12" />
            Plan approved
          </p>
        ) : (
          <div className="flex items-center gap-5">
            <Button variant="ghost" onClick={onSkip}>
              Skip this month
            </Button>
            <Button onClick={onApprove} disabled={kept.length === 0}>
              Approve plan
            </Button>
          </div>
        )}
      </div>
    </section>
  );
}
