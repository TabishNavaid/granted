"use client";

import * as React from "react";
import Link from "next/link";
import { addMonths, eachDayOfInterval, endOfMonth, endOfWeek, format, isSameDay, isSameMonth, isToday, parseISO, startOfMonth, startOfWeek, subMonths } from "date-fns";
import { Bell, ChevronLeft, ChevronRight } from "lucide-react";
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

const kindColor: Record<MilestoneKind, string> = {
  deadline: "bg-danger",
  draft_due: "bg-accent",
  board_review: "bg-info",
  budget_signoff: "bg-warning",
  submit: "bg-success",
  follow_up: "bg-fg-subtle",
};

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
        description={`Deadlines and the milestones planned backward from each one. Email reminders go out ${reminderDays} days before each milestone.`}
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
        <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_18rem]">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-display text-2xl text-fg">{format(month, "MMMM yyyy")}</h2>
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
            <div className="mt-4 overflow-hidden rounded-lg border border-border bg-surface" role="grid" aria-label={`${format(month, "MMMM yyyy")} calendar`}>
              <div className="grid grid-cols-7 border-b border-border bg-surface-sunken/60" role="row">
                {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
                  <div key={d} role="columnheader" className="px-2 py-1.5 text-center text-2xs font-medium uppercase tracking-wide text-fg-subtle">
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
                        "flex min-h-[4.5rem] flex-col items-start gap-1 border-b border-r border-border p-1.5 text-left transition-colors hover:bg-surface-hover sm:min-h-[6rem]",
                        !inMonth && "bg-surface-sunken/40 text-fg-subtle",
                        sel && "bg-accent-soft/50",
                      )}
                    >
                      <span className={cn("inline-flex size-6 items-center justify-center rounded-full text-xs tnum", isToday(d) && "bg-accent font-semibold text-accent-fg")}>{format(d, "d")}</span>
                      <span className="flex w-full flex-col gap-0.5">
                        {list.slice(0, 3).map((e) => (
                          <span key={e.id} className={cn("hidden truncate rounded px-1 text-2xs leading-4 sm:block", e.done ? "text-fg-subtle line-through" : "text-fg", e.kind === "deadline" ? "bg-danger-soft text-danger-soft-fg" : "bg-surface-sunken")}>
                            {e.title}
                          </span>
                        ))}
                        <span className="flex gap-0.5 sm:hidden">
                          {list.slice(0, 4).map((e) => (
                            <span key={e.id} className={cn("size-1.5 rounded-full", kindColor[e.kind])} aria-hidden />
                          ))}
                        </span>
                        {list.length > 3 ? <span className="hidden text-2xs text-fg-subtle sm:block">+{list.length - 3} more</span> : null}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
            <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-fg-subtle" aria-label="Legend">
              {(Object.keys(milestoneMeta) as MilestoneKind[]).map((k) => (
                <li key={k} className="inline-flex items-center gap-1.5">
                  <span className={cn("size-2 rounded-full", kindColor[k])} aria-hidden /> {milestoneMeta[k].label}
                </li>
              ))}
            </ul>
          </div>
          <aside className="min-w-0 lg:sticky lg:top-6 lg:self-start">
            <h3 className="font-display text-lg text-fg">{selected ? format(selected, "EEEE, MMMM d") : "Next up"}</h3>
            <DayList events={selected ? byDay(selected) : upcoming.slice(0, 6)} appTitle={appTitle} onToggle={toggle} emptyText={selected ? "Nothing planned this day." : "No upcoming milestones."} />
            {selected ? (
              <Button variant="link" size="sm" className="mt-2" onClick={() => setSelected(null)}>
                Show next up
              </Button>
            ) : null}
          </aside>
        </div>
      ) : (
        <div className="mt-6 flex flex-col gap-8">
          {Object.keys(grouped).length === 0 ? (
            <EmptyState title="Nothing scheduled" description="Milestones appear here once you approve a schedule in your Inbox." />
          ) : (
            Object.entries(grouped).map(([label, list]) => (
              <section key={label} aria-labelledby={`m-${label}`}>
                <h2 id={`m-${label}`} className="font-display text-2xl text-fg">
                  {label}
                </h2>
                <DayList events={list} appTitle={appTitle} onToggle={toggle} showDate emptyText="" />
              </section>
            ))
          )}
        </div>
      )}
      <p className="mt-6 flex items-center gap-1.5 text-xs text-fg-subtle">
        <Bell className="size-3.5" aria-hidden /> Change reminder timing in Settings.
      </p>
    </PageContainer>
  );
}

function DayList({ events, appTitle, onToggle, showDate, emptyText }: { events: CalendarEvent[]; appTitle: (id: string) => string; onToggle: (e: CalendarEvent, done: boolean) => void; showDate?: boolean; emptyText: string }) {
  if (events.length === 0) return <p className="mt-3 text-sm text-fg-subtle">{emptyText}</p>;
  return (
    <ul className="mt-3 flex flex-col gap-2">
      {events.map((e) => {
        const d = daysUntil(e.date);
        return (
          <li key={e.id} className={cn("flex items-start gap-3 rounded-md border border-border bg-surface p-3", e.done && "opacity-60")}>
            {e.kind !== "deadline" ? (
              <Checkbox id={`ev-${e.id}`} checked={e.done} onCheckedChange={(c) => onToggle(e, c === true)} aria-label={`Mark ${e.title} done`} className="mt-0.5" />
            ) : (
              <span className="mt-1.5 size-2.5 shrink-0 rounded-full bg-danger" aria-hidden />
            )}
            <div className="min-w-0 flex-1">
              <label htmlFor={e.kind !== "deadline" ? `ev-${e.id}` : undefined} className={cn("block text-sm font-medium text-fg", e.done && "line-through")}>
                {e.title}
              </label>
              <Link href={`/applications/${e.applicationId}`} className="block truncate text-xs text-fg-muted hover:underline">
                {e.funderName}: {appTitle(e.applicationId)}
              </Link>
              <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-fg-subtle">
                <MilestoneBadge kind={e.kind} />
                {showDate ? <span>{formatDate(e.date, "EEE, MMM d")}</span> : null}
                {!e.done ? <span className={cn(d <= 3 && "text-danger", d > 3 && d <= 10 && "text-warning")}>{d === 0 ? "Today" : d === 1 ? "Tomorrow" : d < 0 ? `${-d} days ago` : `In ${d} days`}</span> : null}
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
