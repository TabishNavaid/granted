"use client";

import * as React from "react";
import type { ImpactMetric } from "@/lib/types";
import { services } from "@/lib/services";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/label";
import { EmptyState } from "@/components/ui/empty-state";
import { useToast } from "@/components/ui/toast";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

function thisMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(month: string, style: "short" | "long" = "short") {
  return new Date(`${month}-15T12:00:00Z`).toLocaleDateString("en-US", { month: style, year: style === "long" ? "numeric" : undefined, timeZone: "UTC" });
}

function amount(value: number, unit: string) {
  return `${value.toLocaleString("en-US")}${unit ? ` ${unit}` : ""}`;
}

function errorText(e: unknown) {
  return e instanceof Error ? e.message : "Try again in a moment.";
}

/** Impact measures logged month by month. The newest value of each becomes a confirmed fact a draft can cite. */
export function ImpactTab({ initial, onFactsChanged }: { initial: ImpactMetric[]; onFactsChanged: () => void }) {
  const { toast } = useToast();
  const [metrics, setMetrics] = React.useState(initial);
  const [logging, setLogging] = React.useState<ImpactMetric | null>(null);
  const [adding, setAdding] = React.useState(false);
  const [busy, setBusy] = React.useState(false);

  const log = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!logging) return;
    const fd = new FormData(e.currentTarget);
    const month = String(fd.get("month"));
    const value = Number(fd.get("value"));
    const note = String(fd.get("note") ?? "").trim() || null;
    if (!/^\d{4}-\d{2}$/.test(month) || !Number.isFinite(value)) {
      toast({ title: "Check the month and the number", description: "Both are needed to log a measure.", tone: "warning" });
      return;
    }
    setBusy(true);
    try {
      const next = await services.knowledge.logMetric(logging.id, month, value, note);
      setMetrics((l) => l.map((m) => (m.id === next.id ? next : m)));
      setLogging(null);
      onFactsChanged();
      toast({ title: `Logged ${amount(value, next.unit)} for ${monthLabel(month, "long")}`, description: "The newest value is now a confirmed fact, with you as the source." });
    } catch (err) {
      toast({ title: "Could not log it", description: errorText(err), tone: "warning" });
    } finally {
      setBusy(false);
    }
  };

  const add = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const label = String(fd.get("label") ?? "").trim();
    if (!label) return;
    setBusy(true);
    try {
      const m = await services.knowledge.addMetric({ label, unit: String(fd.get("unit") ?? "").trim(), program: String(fd.get("program") ?? "").trim() || null });
      setMetrics((l) => [...l, m]);
      setAdding(false);
      toast({ title: `${m.label} added`, description: "Log its first month whenever you have the number." });
    } catch (err) {
      toast({ title: "Could not add it", description: errorText(err), tone: "warning" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <p className="max-w-[65ch] text-base text-ink-muted">What your programs count each month. The newest value of each measure becomes a confirmed fact the next draft can cite, with you as the source.</p>
        <Button variant="secondary" size="sm" onClick={() => setAdding(true)}>
          Add a measure
        </Button>
      </div>

      {metrics.length === 0 ? (
        <EmptyState
          title="No measures yet"
          description="Add the numbers funders ask about most, like people served or meals delivered, and log them once a month. Reports and drafts then cite the latest month."
          action={<Button onClick={() => setAdding(true)}>Add a measure</Button>}
        />
      ) : (
        <ul className="border-t border-rule">
          {metrics.map((m) => {
            const recent = m.entries.slice(-6);
            const latest = m.entries[m.entries.length - 1];
            const max = Math.max(1, ...recent.map((e) => e.value));
            return (
              <li key={m.id} className="grid gap-4 border-b border-rule py-5 sm:grid-cols-[1fr_auto] sm:items-center lg:grid-cols-[1fr_14rem_10rem_auto]">
                <div className="min-w-0">
                  <h3 className="font-display text-xl text-ink">{m.label}</h3>
                  <p className="mt-0.5 text-sm text-ink-muted">
                    {m.program ? `${m.program}. ` : ""}
                    {m.entries.length ? `${m.entries.length} month${m.entries.length === 1 ? "" : "s"} logged` : "Nothing logged yet"}
                  </p>
                </div>
                <div className="min-w-0">
                  {recent.length ? (
                    <figure>
                      <div className="flex h-12 items-end gap-1.5" aria-hidden>
                        {recent.map((e, i) => (
                          <div key={e.month} className="flex w-6 flex-col items-center gap-1">
                            <div className={i === recent.length - 1 ? "w-full bg-meadow" : "w-full bg-rule-strong"} style={{ height: `${Math.max(4, (e.value / max) * 36)}px` }} title={`${monthLabel(e.month, "long")}: ${amount(e.value, m.unit)}`} />
                          </div>
                        ))}
                      </div>
                      <div className="mt-1 flex gap-1.5 text-[11px] text-ink-muted" aria-hidden>
                        {recent.map((e) => (
                          <span key={e.month} className="w-6 text-center">
                            {monthLabel(e.month).slice(0, 3)}
                          </span>
                        ))}
                      </div>
                      <figcaption className="sr-only">
                        Last {recent.length} months of {m.label}: {recent.map((e) => `${monthLabel(e.month, "long")}, ${amount(e.value, m.unit)}`).join("; ")}.
                      </figcaption>
                    </figure>
                  ) : (
                    <p className="text-sm text-ink-muted">No months yet</p>
                  )}
                </div>
                <div>
                  {latest ? (
                    <>
                      <p className="font-display text-2xl text-ink tnum">{amount(latest.value, m.unit)}</p>
                      <p className="text-sm text-ink-muted">{monthLabel(latest.month, "long")}</p>
                    </>
                  ) : (
                    <p className="text-sm text-ink-muted">No value yet</p>
                  )}
                </div>
                <div className="sm:justify-self-end">
                  <Button variant="secondary" size="sm" onClick={() => setLogging(m)}>
                    Log this month
                  </Button>
                </div>
                {recent.length > 0 && recent.length < 3 ? <p className="text-sm text-ink-muted sm:col-span-2 lg:col-span-4">Only {recent.length} month{recent.length === 1 ? "" : "s"} so far, too few to call a trend.</p> : null}
              </li>
            );
          })}
        </ul>
      )}

      <Dialog open={!!logging} onOpenChange={(o) => !o && setLogging(null)}>
        <DialogContent size="sm">
          {logging ? (
            <form className="flex flex-col gap-4" onSubmit={log}>
              <DialogHeader>
                <DialogTitle>{logging.label}</DialogTitle>
                <DialogDescription>Logging a month you already have replaces its number. The newest month becomes the fact drafts cite.</DialogDescription>
              </DialogHeader>
              <Field id="metric-month" label="Month">
                <Input name="month" type="month" required defaultValue={thisMonth()} />
              </Field>
              <Field id="metric-value" label={logging.unit ? `Value, in ${logging.unit}` : "Value"}>
                <Input name="value" type="number" inputMode="decimal" step="any" required />
              </Field>
              <Field id="metric-note" label="Note" optional hint="Where the number came from, or anything unusual about the month.">
                <Input name="note" />
              </Field>
              <DialogFooter>
                <Button type="button" variant="ghost" onClick={() => setLogging(null)}>
                  Cancel
                </Button>
                <Button type="submit" loading={busy}>
                  Log it
                </Button>
              </DialogFooter>
            </form>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={adding} onOpenChange={setAdding}>
        <DialogContent size="sm">
          <form className="flex flex-col gap-4" onSubmit={add}>
            <DialogHeader>
              <DialogTitle>Add a measure</DialogTitle>
              <DialogDescription>Something you count every month and would put in a report.</DialogDescription>
            </DialogHeader>
            <Field id="new-metric-label" label="What you count">
              <Input name="label" required placeholder="Students served" />
            </Field>
            <Field id="new-metric-unit" label="Unit" optional hint="Shown after the number, like students or meals.">
              <Input name="unit" placeholder="students" />
            </Field>
            <Field id="new-metric-program" label="Program" optional>
              <Input name="program" placeholder="After-School Studio" />
            </Field>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setAdding(false)}>
                Cancel
              </Button>
              <Button type="submit" loading={busy}>
                Add measure
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
