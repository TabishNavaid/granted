"use client";

import * as React from "react";
import Link from "next/link";
import { addMonths, format, isSameMonth, parseISO, startOfMonth, subMonths } from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { ApplicationView, CalendarEvent } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export interface OpenDeadline {
  opportunityId: string;
  date: string;
  title: string;
  funderId: string;
  funderName: string;
  fitScore: number;
  loi: boolean;
}

type Row =
  | { kind: "event"; date: string; event: CalendarEvent; history: string | null }
  | { kind: "open"; date: string; open: OpenDeadline; history: string | null };

/** Twelve months at a glance: every deadline and milestone, plus deadlines of matched funders not applied to yet. */
export function YearView({ events, applications, openDeadlines, appTitle }: { events: CalendarEvent[]; applications: ApplicationView[]; openDeadlines: OpenDeadline[]; appTitle: (id: string) => string }) {
  const [start, setStart] = React.useState(() => startOfMonth(new Date()));
  const months = Array.from({ length: 12 }, (_, i) => addMonths(start, i));

  // How this workspace knows each funder from earlier applications.
  const history = React.useMemo(() => {
    const byFunder = new Map<string, ApplicationView[]>();
    for (const a of applications) byFunder.set(a.funder.id, [...(byFunder.get(a.funder.id) ?? []), a]);
    return (funderId: string, exceptApplicationId: string | null) => {
      const others = (byFunder.get(funderId) ?? []).filter((a) => a.id !== exceptApplicationId);
      if (!others.length) return null;
      const won = others.filter((a) => a.stage === "won" || a.outcome?.result === "won").length;
      if (won) return won === 1 ? "Funded you before" : `Funded you ${won} times`;
      return others.length === 1 ? "Applied before" : `Applied ${others.length} times before`;
    };
  }, [applications]);

  const funderOf = React.useMemo(() => Object.fromEntries(applications.map((a) => [a.id, a.funder.id])), [applications]);

  const rows: Row[] = [
    ...events.map((e): Row => ({ kind: "event", date: e.date, event: e, history: e.kind === "deadline" && funderOf[e.applicationId] ? history(funderOf[e.applicationId], e.applicationId) : null })),
    ...openDeadlines.map((o): Row => ({ kind: "open", date: o.date, open: o, history: history(o.funderId, null) })),
  ].sort((a, b) => a.date.localeCompare(b.date));

  const inRange = rows.filter((r) => {
    const d = parseISO(r.date);
    return d >= start && d < addMonths(start, 12);
  });
  const deadlines = inRange.filter((r) => r.kind === "open" || r.event.kind === "deadline").length;

  return (
    <div className="mt-8">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="font-display text-2xl text-ink">
            {format(start, "MMMM yyyy")} to {format(addMonths(start, 11), "MMMM yyyy")}
          </h2>
          <p className="mt-1 text-sm text-ink-muted tnum">
            {deadlines} deadline{deadlines === 1 ? "" : "s"} and {inRange.length - deadlines} milestone{inRange.length - deadlines === 1 ? "" : "s"} in these twelve months.
          </p>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" onClick={() => setStart(startOfMonth(new Date()))}>
            This month
          </Button>
          <Button variant="ghost" size="icon-sm" aria-label="Previous twelve months" onClick={() => setStart((s) => subMonths(s, 12))}>
            <ChevronLeft />
          </Button>
          <Button variant="ghost" size="icon-sm" aria-label="Next twelve months" onClick={() => setStart((s) => addMonths(s, 12))}>
            <ChevronRight />
          </Button>
        </div>
      </div>

      <div className="mt-4 grid border-l border-t border-rule sm:grid-cols-2 lg:grid-cols-3">
        {months.map((m) => {
          const list = inRange.filter((r) => isSameMonth(parseISO(r.date), m));
          const id = `year-${format(m, "yyyy-MM")}`;
          return (
            <section key={id} aria-labelledby={id} className="min-w-0 border-b border-r border-rule p-4">
              <div className="flex items-baseline justify-between gap-3">
                <h3 id={id} className="font-display text-xl text-ink">
                  {format(m, "MMMM")} <span className="text-base text-ink-muted tnum">{format(m, "yyyy")}</span>
                </h3>
                {list.length ? <span className="text-sm text-ink-muted tnum">{list.length}</span> : null}
              </div>
              {list.length === 0 ? (
                <p className="mt-2 text-sm text-ink-muted">Nothing due.</p>
              ) : (
                <ul className="mt-2 flex flex-col gap-2">
                  {list.map((r) =>
                    r.kind === "event" ? (
                      <li key={`e-${r.event.id}`} className="flex gap-2 text-sm">
                        <span className="w-6 shrink-0 text-ink-muted tnum">{format(parseISO(r.date), "d")}</span>
                        <div className="min-w-0">
                          <Link
                            href={`/applications/${r.event.applicationId}`}
                            className={cn("block hover:underline", r.event.done ? "text-ink-muted line-through" : r.event.kind === "deadline" ? "font-semibold text-alert" : "text-ink")}
                          >
                            {r.event.kind === "deadline" && r.event.funderName ? `Deadline: ${r.event.funderName}` : r.event.title}
                          </Link>
                          <p className="truncate text-xs text-ink-muted">{r.event.kind === "deadline" ? appTitle(r.event.applicationId) : r.event.funderName}</p>
                          {r.history ? <p className="text-xs text-ink-muted">{r.history}</p> : null}
                        </div>
                      </li>
                    ) : (
                      <li key={`o-${r.open.opportunityId}`} className="flex gap-2 text-sm">
                        <span className="w-6 shrink-0 text-ink-muted tnum">{format(parseISO(r.date), "d")}</span>
                        <div className="min-w-0">
                          <Link href={`/opportunities/${r.open.opportunityId}`} className="block text-ink hover:underline">
                            {r.open.loi ? "Letter of inquiry" : "Deadline"}: {r.open.funderName}
                          </Link>
                          <p className="truncate text-xs text-ink-muted">
                            Matched, not started. Fit {r.open.fitScore}. {r.open.title}
                          </p>
                          {r.history ? <p className="text-xs text-ink-muted">{r.history}</p> : null}
                        </div>
                      </li>
                    ),
                  )}
                </ul>
              )}
            </section>
          );
        })}
      </div>
      <p className="mt-3 max-w-[65ch] text-sm text-ink-muted">
        Red is a deadline you are applying to. Plain links are matched funders you have not started yet. Rolling deadlines are left out because they have no date.
      </p>
    </div>
  );
}
