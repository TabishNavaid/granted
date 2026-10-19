"use client";

import * as React from "react";
import type { LogicModelRow, WinKit } from "@/lib/types";
import { services } from "@/lib/services";
import { formatMoney } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Skeleton, SkeletonText } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type Recommendation = { amount: number; low: number; high: number; why: string[] };

/** The suggested ask, shown inside the ask dialog. It only fills the input; saving is the user's call. */
export function AskSuggestion({ applicationId, open, onUse }: { applicationId: string; open: boolean; onUse: (amount: number) => void }) {
  const [rec, setRec] = React.useState<Recommendation | null | undefined>(undefined);
  React.useEffect(() => {
    if (!open || rec !== undefined) return;
    let live = true;
    services.applications
      .recommendAsk(applicationId)
      .then((r) => live && setRec(r))
      .catch(() => live && setRec(null));
    return () => {
      live = false;
    };
  }, [open, applicationId, rec]);

  if (rec === undefined) {
    return (
      <div className="border-t border-rule pt-4" aria-hidden>
        <Skeleton className="mb-2 h-4 w-48" />
        <SkeletonText lines={2} />
      </div>
    );
  }
  if (rec === null) {
    return <p className="border-t border-rule pt-4 text-sm text-ink-muted">No suggestion for this funder yet. We suggest an ask once we know the size of its typical grants or this notice&apos;s award range.</p>;
  }
  return (
    <div className="border-t border-rule pt-4 text-sm">
      <p className="text-ink">
        Suggested: <span className="font-semibold tnum">{formatMoney(rec.amount)}</span>{" "}
        <span className="text-ink-muted tnum">
          (range {formatMoney(rec.low)} to {formatMoney(rec.high)})
        </span>
      </p>
      {rec.why.length ? (
        <ul className="mt-2 flex list-disc flex-col gap-1 pl-5 text-ink-muted">
          {rec.why.map((w) => (
            <li key={w}>{w}</li>
          ))}
        </ul>
      ) : null}
      <Button variant="secondary" size="sm" className="mt-3" onClick={() => onUse(rec.amount)}>
        Use this
      </Button>
    </div>
  );
}

const COLUMNS: { key: LogicModelRow["column"]; label: string }[] = [
  { key: "inputs", label: "Inputs" },
  { key: "activities", label: "Activities" },
  { key: "outputs", label: "Outputs" },
  { key: "outcomes", label: "Outcomes" },
];

/** Preview the logic model rows built from confirmed facts, then add them to the draft as a section. */
export function LogicModelDialog({ applicationId, open, onOpenChange, onAdded }: { applicationId: string; open: boolean; onOpenChange: (o: boolean) => void; onAdded: (sectionId: string) => Promise<void> }) {
  const { toast } = useToast();
  const [rows, setRows] = React.useState<LogicModelRow[] | null>(null);
  const [adding, setAdding] = React.useState(false);
  React.useEffect(() => {
    if (!open) return;
    let live = true;
    services.applications
      .logicModel(applicationId)
      .then((r) => live && setRows(r))
      .catch(() => live && setRows([]));
    return () => {
      live = false;
    };
  }, [open, applicationId]);

  const add = async () => {
    setAdding(true);
    try {
      const sec = await services.applications.addLogicModelSection(applicationId);
      await onAdded(sec.id);
      onOpenChange(false);
      toast({ title: "Logic model added", description: "It is the last section of the draft. Anything we could not source is marked as a question." });
    } catch (err) {
      toast({ title: "We could not add it", description: err instanceof Error ? err.message : "Try again in a moment.", tone: "warning" });
    } finally {
      setAdding(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>Add a logic model</DialogTitle>
          <DialogDescription>Built from your confirmed facts: what you put in, what you do, what it produces, and what changes. Each line from a fact carries its citation.</DialogDescription>
        </DialogHeader>
        {rows === null ? (
          <SkeletonText lines={6} />
        ) : (
          <dl className="border-t border-rule">
            {COLUMNS.map((c) => {
              const items = rows.filter((r) => r.column === c.key);
              return (
                <div key={c.key} className="grid gap-1 border-b border-rule py-3 sm:grid-cols-[8rem_1fr] sm:gap-4">
                  <dt className="text-sm font-semibold text-ink">{c.label}</dt>
                  <dd className="text-sm">
                    {items.length ? (
                      <ul className="flex flex-col gap-1">
                        {items.map((r, i) => (
                          <li key={`${c.key}-${i}`} className="text-ink">
                            {r.text}
                            {!r.factId ? <span className="text-ink-muted"> (from your causes, not a fact yet)</span> : null}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <span className="text-ink-muted">Nothing confirmed yet. The section will ask you for it.</span>
                    )}
                  </dd>
                </div>
              );
            })}
          </dl>
        )}
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={add} loading={adding} disabled={rows === null}>
            Add to the draft
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

type Reusable = { id: string; title: string; funder: string; awardAmount: number | null; sectionCount: number };

/** Start a draft from the sections of an application that won. */
export function ReuseDialog({ applicationId, open, onOpenChange, onDone }: { applicationId: string; open: boolean; onOpenChange: (o: boolean) => void; onDone: () => Promise<void> }) {
  const { toast } = useToast();
  const [items, setItems] = React.useState<Reusable[] | null>(null);
  const [busy, setBusy] = React.useState<string | null>(null);
  React.useEffect(() => {
    if (!open) return;
    let live = true;
    services.applications
      .listReusable()
      .then((r) => live && setItems(r.filter((x) => x.id !== applicationId)))
      .catch(() => live && setItems([]));
    return () => {
      live = false;
    };
  }, [open, applicationId]);

  const reuse = async (sourceId: string) => {
    setBusy(sourceId);
    try {
      const r = await services.applications.reuseFrom(applicationId, sourceId);
      if (!r.ok) {
        toast({ title: "We could not reuse it", description: r.error, tone: "warning" });
        return;
      }
      await onDone();
      onOpenChange(false);
      toast({ title: `${r.data.sectionCount} section${r.data.sectionCount === 1 ? "" : "s"} copied in`, description: "Anywhere the old funder was named is now a question. Read every section before you send it." });
    } catch (err) {
      toast({ title: "We could not reuse it", description: err instanceof Error ? err.message : "Try again in a moment.", tone: "warning" });
    } finally {
      setBusy(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>Start from a past winning application</DialogTitle>
          <DialogDescription>Its sections are copied into this draft as a starting point. The old funder&apos;s name becomes a question so it cannot slip through.</DialogDescription>
        </DialogHeader>
        {items === null ? (
          <SkeletonText lines={4} />
        ) : items.length === 0 ? (
          <p className="text-sm text-ink-muted">No won applications with a draft yet. When you log a win on the Pipeline, its sections show up here for the next one.</p>
        ) : (
          <ul className="border-t border-rule">
            {items.map((it) => (
              <li key={it.id} className="flex flex-wrap items-center justify-between gap-3 border-b border-rule py-3">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-ink">{it.title}</p>
                  <p className="flex flex-wrap gap-x-4 text-sm text-ink-muted">
                    <span>{it.funder}</span>
                    {it.awardAmount ? <span className="tnum">Won {formatMoney(it.awardAmount)}</span> : null}
                    <span className="tnum">
                      {it.sectionCount} section{it.sectionCount === 1 ? "" : "s"}
                    </span>
                  </p>
                </div>
                <Button variant="secondary" size="sm" onClick={() => reuse(it.id)} loading={busy === it.id} disabled={Boolean(busy)} aria-label={`Start from ${it.title}`}>
                  Start from this
                </Button>
              </li>
            ))}
          </ul>
        )}
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** After a win: a post, a newsletter paragraph, and a thank-you, each ready to copy. */
export function WinKitDialog({ applicationId, open, onOpenChange }: { applicationId: string; open: boolean; onOpenChange: (o: boolean) => void }) {
  const { toast } = useToast();
  const [kit, setKit] = React.useState<WinKit | null | undefined>(undefined);
  React.useEffect(() => {
    if (!open) return;
    let live = true;
    services.applications
      .winKit(applicationId)
      .then((k) => live && setKit(k))
      .catch(() => live && setKit(null));
    return () => {
      live = false;
    };
  }, [open, applicationId]);

  const copy = async (label: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({ title: `${label} copied`, description: "It is on your clipboard.", tone: "info" });
    } catch {
      toast({ title: "Could not copy", description: "Your browser blocked the clipboard. Select the text and copy it by hand.", tone: "warning" });
    }
  };

  const pieces = kit
    ? [
        { label: "Social post", text: kit.post },
        { label: "Newsletter paragraph", text: kit.newsletter },
        { label: "Thank-you email", text: `Subject: ${kit.thankYou.subject}\n\n${kit.thankYou.body}` },
      ]
    : [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>Grant-win kit</DialogTitle>
          <DialogDescription>Written from the award and your confirmed facts. Check with the funder before you announce it; some ask to approve the wording first. Nothing here is posted or sent for you.</DialogDescription>
        </DialogHeader>
        {kit === undefined ? (
          <SkeletonText lines={8} />
        ) : kit === null ? (
          <p className="text-sm text-ink-muted">The kit is written once the application is logged as won on the Pipeline.</p>
        ) : (
          <div className="flex flex-col border-t border-rule">
            {pieces.map((p) => (
              <section key={p.label} className="border-b border-rule py-4">
                <div className="flex flex-wrap items-baseline justify-between gap-3">
                  <h3 className="text-base font-semibold text-ink">{p.label}</h3>
                  <Button variant="secondary" size="sm" onClick={() => copy(p.label, p.text)} aria-label={`Copy the ${p.label.toLowerCase()}`}>
                    Copy
                  </Button>
                </div>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-ink">{p.text}</p>
              </section>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
