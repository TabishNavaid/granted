"use client";

import * as React from "react";
import Link from "next/link";
import { addMonths, eachDayOfInterval, endOfMonth, endOfWeek, format, isSameDay, isSameMonth, isToday, parseISO, startOfMonth, startOfWeek, subMonths } from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { ApplicationView, CalendarEvent, MilestoneKind } from "@/lib/types";
import { services } from "@/lib/services";
import { milestoneMeta } from "@/lib/agents/meta";
import { cn } from "@/lib/utils";
import { daysUntil, formatDate } from "@/lib/format";
import { PageContainer, PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { MilestoneBadge } from "@/components/app/badges";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState } from "@/components/ui/empty-state";

export function CalendarView({ initial, applications, reminderDays }: { initial: CalendarEvent[]; applications: ApplicationView[]; reminderDays: number }) {
  const [events, setEvents] = React.useState(initial);
  const [month, setMonth] = React.useState(() => startOfMonth(new Date()));
  const [mode, setMode] = React.useState<"month" | "list">("month");
  const [selected, setSelected] = React.useState<Date | null>(null);

  const days = eachDayOfInterval({ start: startOfWeek(startOfMonth(month)), end: endOfWeek(endOfMonth(month)) });
  const byDay = (d: Date) => events.filter((e) => isSameDay(parseISO(e.date), d));
  const upcoming = events.filter((e) => daysUntil(e.date) >= 0).slice(0, 40);
  const appTitle = (id: string) => applications.find((a) => a.id === id)?.opportunity.title ?? "";

  const toggle = async (e: CalendarEvent, done: boolean) => {
    setEvents((list) => list.map((x) => (x.id === e.id ? { ...x, done } : x)));
    await services.calendar.toggleMilestone(e.id, done);
  };

  const grouped = upcoming.reduce<Record<string, CalendarEvent[]>>((acc, e) => {
    const key = format(parseISO(e.date), "MMMM yyyy");
    (acc[key] ??= []).push(e);
    return acc;
  }, {});

  return (
    <PageContainer width="wide">
      <PageHeader
        title="Calendar"
        description={`Every deadline, with the milestones we planned backward from it. We'll email you ${reminderDays} days before each one.`}
        actions={
          <Tabs value={mode} onValueChange={(v) => setMode(v as typeof mode)}>
            <TabsList variant="pill" aria-label="Calendar view">
              <TabsTrigger value="month">Month</TabsTrigger>
              <TabsTrigger value="list">List</TabsTrigger>
            </TabsList>
          </Tabs>
        }
      />

      {mode === "month" ? (
        <div className="mt-8 grid gap-10 lg:grid-cols-[1fr_18rem]">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-display text-2xl text-ink">{format(month, "MMMM yyyy")}</h2>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="sm" onClick={() => setMonth(startOfMonth(new Date()))}>
                  Today
                </Button>
                <Button variant="ghost" size="icon-sm" aria-label="Previous month" onClick={() => setMonth((m) => subMonths(m, 1))}>
                  <ChevronLeft />
                </Button>
                <Button variant="ghost" size="icon-sm" aria-label="Next month" onClick={() => setMonth((m) => addMonths(m, 1))}>
                  <ChevronRight />
                </Button>
              </div>
            </div>
            <div className="mt-4 border-t border-rule border-l border-rule" role="grid" aria-label={`${format(month, "MMMM yyyy")} calendar`}>
              <div className="grid grid-cols-7" role="row">
                {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
                  <div key={d} role="columnheader" className="border-b border-rule bg-paper-tint px-2 py-1.5 text-xs font-semibold text-ink">
                    {d}
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-7" role="rowgroup">
                {days.map((d) => {
                  const list = byDay(d);
                  const inMonth = isSameMonth(d, month);
                  const sel = selected && isSameDay(d, selected);
                  return (
                    <button
                      key={d.toISOString()}
                      type="button"
                      role="gridcell"
                      aria-selected={!!sel}
                      aria-label={`${format(d, "EEEE, MMMM d")}${list.length ? `, ${list.length} item${list.length === 1 ? "" : "s"}` : ""}`}
                      onClick={() => setSelected(d)}
                      className={cn(
                        "flex min-h-[4.5rem] flex-col items-start gap-1 border-b border-r border-rule p-1.5 text-left transition-colors hover:bg-paper-hover sm:min-h-[6rem]",
                        !inMonth && "bg-paper-tint text-ink-muted",
                        sel && "bg-paper-tint",
                      )}
                    >
                      <span className={cn("text-xs tnum", isToday(d) && "font-semibold text-ink underline decoration-2 underline-offset-4")}>{format(d, "d")}</span>
                      <span className="flex w-full flex-col gap-0.5">
                        {list.slice(0, 3).map((e) => (
                          <span key={e.id} className={cn("hidden truncate text-xs sm:block", e.done ? "text-ink-muted line-through" : e.kind === "deadline" ? "font-semibold text-alert" : "text-ink")}>
                            {e.title}
                          </span>
                        ))}
                        <span className="flex gap-1 sm:hidden">
                          {list.slice(0, 4).map((e) => (
                            <span key={e.id} className={cn("size-1.5", e.kind === "deadline" ? "bg-alert" : "bg-ink")} aria-hidden />
                          ))}
                        </span>
                        {list.length > 3 ? <span className="hidden text-xs text-ink-muted sm:block">{list.length - 3} more</span> : null}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
            <ul className="mt-4 flex flex-wrap gap-2" aria-label="Legend">
              {(Object.keys(milestoneMeta) as MilestoneKind[]).map((k) => (
                <li key={k}>
                  <MilestoneBadge kind={k} />
                </li>
              ))}
            </ul>
          </div>
          <aside className="min-w-0 lg:sticky lg:top-6 lg:self-start">
            <h3 className="font-display text-xl text-ink">{selected ? format(selected, "EEEE, MMMM d") : "Next up"}</h3>
            <DayList events={selected ? byDay(selected) : upcoming.slice(0, 6)} appTitle={appTitle} onToggle={toggle} emptyText={selected ? "Nothing planned this day. Enjoy it." : "Nothing coming up."} />
            {selected ? (
              <Button variant="link" size="sm" className="mt-3" onClick={() => setSelected(null)}>
                Show next up
              </Button>
            ) : null}
          </aside>
        </div>
      ) : (
        <div className="mt-8 flex flex-col gap-10">
          {Object.keys(grouped).length === 0 ? (
            <EmptyState title="Nothing on the calendar yet" description="Approve a schedule in your Inbox and the milestones show up here." />
          ) : (
            Object.entries(grouped).map(([label, list]) => (
              <section key={label} aria-labelledby={`m-${label}`}>
                <h2 id={`m-${label}`} className="font-display text-2xl text-ink">
                  {label}
                </h2>
                <DayList events={list} appTitle={appTitle} onToggle={toggle} showDate emptyText="" />
              </section>
            ))
          )}
        </div>
      )}
      <p className="mt-8 text-sm text-ink-muted">
        Change reminder timing in{" "}
        <Link href="/settings?tab=notifications" className="text-ink underline decoration-[1px] underline-offset-2 hover:decoration-corn">
          Settings
        </Link>
        .
      </p>
    </PageContainer>
  );
}

function relativeLabel(d: number) {
  if (d === 0) return "Today";
  if (d === 1) return "Tomorrow";
  if (d < 0) return `${-d} days ago`;
  return `In ${d} days`;
}

function DayList({ events, appTitle, onToggle, showDate, emptyText }: { events: CalendarEvent[]; appTitle: (id: string) => string; onToggle: (e: CalendarEvent, done: boolean) => void; showDate?: boolean; emptyText: string }) {
  if (events.length === 0) return <p className="mt-3 text-base text-ink-muted">{emptyText}</p>;
  return (
    <ul className="mt-3 border-t border-rule">
      {events.map((e) => {
        const d = daysUntil(e.date);
        const soon = !e.done && d >= 0 && d <= 7;
        const passed = !e.done && d < 0;
        return (
          <li key={e.id} className="flex items-start gap-3 border-b border-rule py-3">
            {e.kind !== "deadline" ? (
              <Checkbox id={`ev-${e.id}`} checked={e.done} onCheckedChange={(c) => onToggle(e, c === true)} aria-label={`Mark ${e.title} done`} className="mt-1" />
            ) : (
              <span className="ml-1.5 mr-1.5 mt-2.5 size-2 shrink-0 bg-alert" aria-hidden />
            )}
            <div className="min-w-0 flex-1">
              <label htmlFor={e.kind !== "deadline" ? `ev-${e.id}` : undefined} className={cn("block text-base font-semibold text-ink", e.done && "text-ink-muted line-through")}>
                {e.title}
              </label>
              <Link href={`/applications/${e.applicationId}`} className="block truncate text-sm text-ink-muted underline-offset-2 hover:text-ink hover:underline">
                {e.funderName}: {appTitle(e.applicationId)}
              </Link>
              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-ink-muted">
                <MilestoneBadge kind={e.kind} />
                {showDate ? <span>{formatDate(e.date, "EEE, MMM d")}</span> : null}
                {!e.done ? (
                  <span className={cn(passed && "font-semibold text-alert")}>{soon ? <mark className="circled">{relativeLabel(d)}</mark> : relativeLabel(d)}</span>
                ) : null}
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
