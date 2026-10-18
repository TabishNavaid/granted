"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight, GripVertical, MoreHorizontal, Trophy } from "lucide-react";
import type { ApplicationStage, ApplicationView, Member, OutcomeResult } from "@/lib/types";
import { services } from "@/lib/services";
import { stageMeta, stageOrder } from "@/lib/agents/meta";
import { cn } from "@/lib/utils";
import { deadlineLabel, formatMoney, formatShortDate, initials } from "@/lib/format";
import { PageContainer, PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field } from "@/components/ui/label";
import { Input, Textarea } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sunrise } from "@/components/brand/illustrations";

export function PipelineView({ initial, members }: { initial: ApplicationView[]; members: Member[] }) {
  const { toast } = useToast();
  const [apps, setApps] = React.useState(initial);
  const [dragging, setDragging] = React.useState<string | null>(null);
  const [over, setOver] = React.useState<ApplicationStage | null>(null);
  const [outcomeFor, setOutcomeFor] = React.useState<ApplicationView | null>(null);
  const [won, setWon] = React.useState<ApplicationView | null>(null);
  const liveRef = React.useRef<HTMLDivElement>(null);

  const move = async (app: ApplicationView, stage: ApplicationStage) => {
    if (app.stage === stage) return;
    if (stage === "won" || stage === "lost") {
      setOutcomeFor({ ...app, stage });
      return;
    }
    setApps((list) => list.map((a) => (a.id === app.id ? { ...a, stage } : a)));
    const next = await services.applications.moveStage(app.id, stage);
    setApps((list) => list.map((a) => (a.id === app.id ? next : a)));
    if (liveRef.current) liveRef.current.textContent = `${app.opportunity.title} moved to ${stageMeta[stage].label}.`;
    toast({ title: `Moved to ${stageMeta[stage].label}`, description: app.opportunity.title });
  };

  const totals = {
    active: apps.filter((a) => !["won", "lost"].includes(a.stage)).reduce((s, a) => s + (a.askAmount ?? 0), 0),
    won: apps.filter((a) => a.stage === "won").reduce((s, a) => s + (a.outcome?.awardAmount ?? 0), 0),
  };

  return (
    <PageContainer width="full" className="lg:px-8">
      <div ref={liveRef} aria-live="polite" className="sr-only" />
      <PageHeader
        title="Pipeline"
        description={`${apps.filter((a) => !["won", "lost"].includes(a.stage)).length} active applications asking ${formatMoney(totals.active)} in total. ${formatMoney(totals.won)} won this year.`}
        actions={
          <Button asChild variant="secondary">
            <Link href="/opportunities">
              Find more <ArrowRight aria-hidden />
            </Link>
          </Button>
        }
      />
      <div className="mt-6 -mx-4 overflow-x-auto px-4 pb-4 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
        <ol className="grid min-w-[88rem] grid-cols-7 gap-3" aria-label="Pipeline stages">
          {stageOrder.map((stage) => {
            const items = apps.filter((a) => a.stage === stage);
            const m = stageMeta[stage];
            return (
              <li
                key={stage}
                onDragOver={(e) => {
                  e.preventDefault();
                  setOver(stage);
                }}
                onDragLeave={() => setOver(null)}
                onDrop={(e) => {
                  e.preventDefault();
                  const id = e.dataTransfer.getData("text/plain");
                  const app = apps.find((a) => a.id === id);
                  setOver(null);
                  setDragging(null);
                  if (app) move(app, stage);
                }}
                className={cn("flex min-h-[28rem] flex-col rounded-lg border border-border bg-surface-sunken/60 p-2 transition-colors", over === stage && "border-accent bg-accent-soft/40")}
              >
                <div className="flex items-center justify-between px-1.5 py-1.5">
                  <h2 className="flex items-center gap-2 text-sm font-medium text-fg">
                    <Badge variant={m.tone}>{m.label}</Badge>
                  </h2>
                  <span className="text-xs text-fg-subtle tnum">{items.length}</span>
                </div>
                <ul className="flex flex-1 flex-col gap-2">
                  {items.map((app) => (
                    <li key={app.id}>
                      <PipelineCard app={app} members={members} dragging={dragging === app.id} onDragStart={() => setDragging(app.id)} onDragEnd={() => setDragging(null)} onMove={(s) => move(app, s)} />
                    </li>
                  ))}
                  {items.length === 0 ? <li className="flex-1 rounded-md border border-dashed border-border p-3 text-center text-xs text-fg-subtle">Nothing here</li> : null}
                </ul>
              </li>
            );
          })}
        </ol>
      </div>
      <p className="text-xs text-fg-subtle">Drag a card, or use its menu. When you mark one Submitted, we'll set a follow-up reminder so it doesn't drift.</p>

      {outcomeFor ? (
        <OutcomeDialog
          app={outcomeFor}
          onClose={() => setOutcomeFor(null)}
          onSave={async (result, amount, feedback) => {
            const next = await services.applications.logOutcome(outcomeFor.id, result, amount, feedback);
            setApps((list) => list.map((a) => (a.id === next.id ? next : a)));
            setOutcomeFor(null);
            if (result === "won") setWon(next);
            else toast({ title: "Logged", description: "Thank you for logging it. It helps us pick better matches next time." });
          }}
        />
      ) : null}
      {won ? (
        <Dialog open onOpenChange={(o) => !o && setWon(null)}>
          <DialogContent size="sm" className="wash-paper items-center text-center">
            <Sunrise size={160} className="mx-auto text-fg" />
            <DialogHeader className="items-center pr-0">
              <DialogTitle className="text-3xl">You won.</DialogTitle>
              <DialogDescription className="text-base">
                {won.outcome?.awardAmount ? <span className="font-display text-2xl text-fg tnum">{formatMoney(won.outcome.awardAmount)}</span> : null}
                {won.outcome?.awardAmount ? <br /> : null}
                from {won.funder.name}. Somebody read what you wrote and said yes. Take a breath.
              </DialogDescription>
            </DialogHeader>
            <p className="text-sm text-fg-muted">We're drafting the thank-you note now. It'll land in your Inbox, and the January update is already on your calendar.</p>
            <DialogFooter className="sm:justify-center">
              <Button onClick={() => setWon(null)}>Back to the board</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ) : null}
    </PageContainer>
  );
}

function PipelineCard({ app, members, dragging, onDragStart, onDragEnd, onMove }: { app: ApplicationView; members: Member[]; dragging: boolean; onDragStart: () => void; onDragEnd: () => void; onMove: (s: ApplicationStage) => void }) {
  const dl = deadlineLabel(app.opportunity.deadline);
  const owner = members.find((m) => m.id === app.ownerId);
  const done = ["won", "lost"].includes(app.stage);
  return (
    <article
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData("text/plain", app.id);
        e.dataTransfer.effectAllowed = "move";
        onDragStart();
      }}
      onDragEnd={onDragEnd}
      aria-label={`${app.opportunity.title}, ${app.funder.name}`}
      className={cn("group relative rounded-md border border-border bg-surface p-3 shadow-xs transition-[opacity,box-shadow] hover:shadow-sm", dragging && "opacity-50")}
    >
      <GripVertical className="absolute left-0.5 top-3.5 size-3.5 cursor-grab text-fg-subtle opacity-0 transition-opacity group-hover:opacity-100" aria-hidden />
      <div className="flex items-start gap-1">
        <div className="min-w-0 flex-1 pr-6">
          <Link href={`/applications/${app.id}`} className="block text-sm font-medium leading-snug text-fg hover:underline">
            {app.opportunity.title}
          </Link>
          <p className="line-clamp-1 text-xs text-fg-muted">{app.funder.name}</p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${app.opportunity.title}`} className="absolute right-1 top-1 opacity-60 transition-opacity hover:opacity-100 focus-visible:opacity-100 group-hover:opacity-100">
              <MoreHorizontal />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem asChild>
              <Link href={`/applications/${app.id}`}>Open workspace</Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuLabel>Move to</DropdownMenuLabel>
            {stageOrder.map((s) => (
              <DropdownMenuItem key={s} disabled={s === app.stage} onSelect={() => onMove(s)}>
                {stageMeta[s].label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
        {app.stage === "won" && app.outcome?.awardAmount ? (
          <span className="inline-flex items-center gap-1 font-medium text-success">
            <Trophy className="size-3" aria-hidden /> {formatMoney(app.outcome.awardAmount)}
          </span>
        ) : app.askAmount ? (
          <span className="text-fg-muted tnum">Ask {formatMoney(app.askAmount, { compact: true })}</span>
        ) : null}
        {!done && app.opportunity.deadline ? (
          <span className={cn(dl.tone === "danger" ? "text-danger" : dl.tone === "warning" ? "text-warning" : "text-fg-subtle")}>
            {formatShortDate(app.opportunity.deadline)} · {dl.text}
          </span>
        ) : null}
      </div>
      {!done && app.sectionProgress.total > 0 ? (
        <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-surface-sunken" aria-label={`${app.sectionProgress.done} of ${app.sectionProgress.total} sections drafted`} role="img">
          <div className="h-full rounded-full bg-accent" style={{ width: `${(app.sectionProgress.done / app.sectionProgress.total) * 100}%` }} />
        </div>
      ) : null}
      {!done && app.nextMilestone ? <p className="mt-2 truncate text-xs text-fg-subtle">Next: {app.nextMilestone.title}</p> : null}
      {app.stage === "lost" && app.outcome?.feedback ? <p className="mt-2 line-clamp-2 text-xs text-fg-subtle">{app.outcome.feedback}</p> : null}
      {owner ? (
        <div className="mt-2 flex items-center gap-1.5 text-xs text-fg-subtle">
          <span className="inline-flex size-5 items-center justify-center rounded-full bg-surface-sunken text-2xs font-medium text-fg-muted" aria-hidden>
            {initials(owner.fullName)}
          </span>
          {owner.fullName}
        </div>
      ) : null}
    </article>
  );
}

function OutcomeDialog({ app, onClose, onSave }: { app: ApplicationView; onClose: () => void; onSave: (r: OutcomeResult, amount: number | null, feedback: string | null) => Promise<void> }) {
  const [result, setResult] = React.useState<OutcomeResult>(app.stage === "won" ? "won" : "lost");
  const [amount, setAmount] = React.useState(app.askAmount ? String(app.askAmount) : "");
  const [feedback, setFeedback] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle>Log the outcome</DialogTitle>
          <DialogDescription>
            {app.funder.name}: {app.opportunity.title}. Whatever happened, logging it helps us learn which funders are worth your time.
          </DialogDescription>
        </DialogHeader>
        <Field id="outcome-result" label="Result">
          <Select value={result} onValueChange={(v) => setResult(v as OutcomeResult)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="won">Won</SelectItem>
              <SelectItem value="lost">Declined</SelectItem>
              <SelectItem value="no_response">No response</SelectItem>
              <SelectItem value="withdrawn">Withdrawn</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        {result === "won" ? (
          <Field id="outcome-amount" label="Award amount">
            <Input inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d]/g, ""))} placeholder="12000" />
          </Field>
        ) : null}
        <Field id="outcome-feedback" label="What the funder said" optional>
          <Textarea value={feedback} onChange={(e) => setFeedback(e.target.value)} placeholder="Anything they said, even one sentence." className="min-h-20" />
        </Field>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            loading={saving}
            onClick={async () => {
              setSaving(true);
              await onSave(result, result === "won" && amount ? Number(amount) : null, feedback.trim() || null);
              setSaving(false);
            }}
          >
            Save outcome
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
