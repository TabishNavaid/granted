"use client";

import * as React from "react";
import Link from "next/link";
import { GripVertical, MoreHorizontal } from "lucide-react";
import type { ApplicationStage, ApplicationView, LossReason, Member, OutcomeResult } from "@/lib/types";
import { LOSS_REASON_LABEL } from "@/lib/features/analytics";
import { services } from "@/lib/services";
import { stageMeta } from "@/lib/agents/meta";
import { stagesFor, stageLabel } from "@/lib/segments";
import type { OpportunityKind } from "@/lib/types";
import { cn } from "@/lib/utils";
import { deadlineLabel, formatMoney, formatShortDate } from "@/lib/format";
import { PageContainer, PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/components/ui/toast";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field } from "@/components/ui/label";
import { Input, Textarea } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { WonScreen } from "@/components/app/won-screen";

/** Where an application of another kind sits on this board, when its stage has no column here. */
function columnFor(stage: ApplicationView["stage"], columns: ApplicationView["stage"][]): ApplicationView["stage"] {
  if (columns.includes(stage)) return stage;
  const near: Partial<Record<ApplicationView["stage"], ApplicationView["stage"][]>> = { researching: ["discovered"], go_no_go: ["researching", "discovered"], review: ["drafting"], shortlisted: ["submitted"], interview: ["submitted"] };
  return near[stage]?.find((s) => columns.includes(s)) ?? columns[0];
}

export function PipelineView({ initial, members, orgName, kind = "grant" }: { initial: ApplicationView[]; members: Member[]; orgName: string; kind?: OpportunityKind }) {
  const stageOrder = stagesFor(kind).map((s) => s.stage);
  const label = (s: ApplicationView["stage"]) => stageLabel(s, kind);
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
    let next: ApplicationView;
    try {
      next = await services.applications.moveStage(app.id, stage);
    } catch (err) {
      setApps((list) => list.map((a) => (a.id === app.id ? app : a)));
      toast({ title: "We could not move it", description: err instanceof Error ? err.message : "Try again in a moment.", tone: "warning" });
      return;
    }
    setApps((list) => list.map((a) => (a.id === app.id ? next : a)));
    if (liveRef.current) liveRef.current.textContent = `${app.opportunity.title} moved to ${label(stage)}.`;
    // Only the first move to Submitted sets the reminder and drafts the email.
    const firstSubmit = stage === "submitted" && !app.submittedAt;
    toast({ title: `Moved to ${label(stage)}`, description: firstSubmit ? `${app.opportunity.title}. A follow-up reminder is on the calendar for 30 days out, and a follow-up email is drafted in Outreach.` : app.opportunity.title });
  };

  const totals = {
    active: apps.filter((a) => !["won", "lost"].includes(a.stage)).reduce((s, a) => s + (a.askAmount ?? 0), 0),
    won: apps.filter((a) => a.stage === "won").reduce((s, a) => s + (a.outcome?.awardAmount ?? 0), 0),
  };

  return (
    <PageContainer width="full" className="lg:px-8">
      <div ref={liveRef} aria-live="polite" className="sr-only" />
      {won ? <WonScreen orgName={orgName} funderName={won.funder.name} amount={won.outcome?.awardAmount ?? null} onDismiss={() => setWon(null)} /> : null}
      <PageHeader
        title="Pipeline"
        description={
          kind === "contract"
            ? `${apps.filter((a) => !["won", "lost"].includes(a.stage)).length} bids in progress, from go/no-go to interview. ${apps.filter((a) => a.stage === "won").length} won.`
            : `${apps.filter((a) => !["won", "lost"].includes(a.stage)).length} active applications asking ${formatMoney(totals.active)} in total. ${formatMoney(totals.won)} won this year.`
        }
        actions={
          <Button asChild variant="secondary">
            <Link href="/opportunities">{kind === "contract" ? "Find more bids" : kind === "scholarship" ? "Find more scholarships" : "Find more funders"}</Link>
          </Button>
        }
      />
      {/* The board scrolls sideways on smaller screens, so it can take keyboard focus. */}
      <div className="mt-8 -mx-4 overflow-x-auto px-4 pb-4 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8" tabIndex={0} role="region" aria-label="Pipeline board">
        <ol className="grid gap-5" style={{ gridTemplateColumns: `repeat(${stageOrder.length}, minmax(12rem, 1fr))`, minWidth: `${stageOrder.length * 12.5}rem` }} aria-label="Pipeline stages">
          {stageOrder.map((stage) => {
            const items = apps.filter((a) => columnFor(a.stage, stageOrder) === stage);
            const m = { ...stageMeta[stage], label: label(stage) };
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
                className={cn("flex min-h-[28rem] flex-col border-t border-rule pt-3 transition-colors", over === stage && "bg-paper-tint")}
              >
                <h2 className="flex items-baseline gap-x-3 px-1 font-display text-lg text-ink">
                  {m.label}
                  <span className="font-body text-sm font-normal text-ink-muted tnum">{items.length}</span>
                </h2>
                <ul className="mt-3 flex flex-1 flex-col gap-3">
                  {items.map((app) => (
                    <li key={app.id}>
                      <PipelineCard stageOrder={stageOrder} label={label} app={app} members={members} dragging={dragging === app.id} onDragStart={() => setDragging(app.id)} onDragEnd={() => setDragging(null)} onMove={(s) => move(app, s)} />
                    </li>
                  ))}
                  {items.length === 0 ? <li className="border border-dashed border-rule-strong p-3 text-sm text-ink-muted">Nothing here</li> : null}
                </ul>
              </li>
            );
          })}
        </ol>
      </div>
      <p className="max-w-[65ch] text-sm text-ink-muted">Drag an application, or use its menu. When you mark one Submitted, we put a follow-up reminder on the calendar 30 days out and draft a follow-up email for you to send yourself, so it does not drift.</p>

      {outcomeFor ? (
        <OutcomeDialog
          app={outcomeFor}
          onClose={() => setOutcomeFor(null)}
          onSave={async (result, amount, feedback, details) => {
            let next: ApplicationView;
            try {
              next = await services.applications.logOutcome(outcomeFor.id, result, amount, feedback, details);
            } catch (err) {
              toast({ title: "We could not save the outcome", description: err instanceof Error ? err.message : "Try again in a moment.", tone: "warning" });
              return;
            }
            setApps((list) => list.map((a) => (a.id === next.id ? next : a)));
            setOutcomeFor(null);
            if (result === "won") {
              setWon(next);
              toast({ title: "Win logged", description: "A thank-you email is drafted in Outreach and the Inbox, the grant-win kit is ready on the draft's page, and a report reminder about a year out is on the calendar." });
            } else if (result === "lost") {
              toast({ title: "Outcome saved", description: "A short email asking the funder for feedback is drafted in Outreach and the Inbox, for you to send yourself." });
            } else {
              toast({ title: "Outcome saved", description: "It stays with the application, along with what the funder said." });
            }
          }}
        />
      ) : null}
    </PageContainer>
  );
}

function PipelineCard({ app, members, dragging, onDragStart, onDragEnd, onMove, stageOrder, label }: { app: ApplicationView; members: Member[]; dragging: boolean; onDragStart: () => void; onDragEnd: () => void; onMove: (s: ApplicationStage) => void; stageOrder: ApplicationStage[]; label: (s: ApplicationStage) => string }) {
  const isBid = app.mode === "bid" || app.mode === "sf330";
  const dl = deadlineLabel(app.opportunity.deadline);
  const soon = dl.tone === "danger";
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
      className={cn("group relative rounded-md border border-rule bg-paper p-3 transition-opacity", dragging && "opacity-50")}
    >
      <GripVertical className="absolute left-0 top-3.5 size-3.5 cursor-grab text-ink-muted opacity-0 transition-opacity group-hover:opacity-100" aria-hidden />
      <div className="flex items-start gap-1">
        <div className="min-w-0 flex-1 pr-8">
          <Link href={`/applications/${app.id}`} className="block text-base font-semibold leading-snug text-ink hover:underline hover:decoration-ink hover:decoration-2 hover:underline-offset-4">
            {app.opportunity.title}
          </Link>
          <p className="line-clamp-1 text-sm text-ink-muted">{app.funder.name}</p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${app.opportunity.title}`} className="absolute right-1 top-1 text-ink-muted hover:text-ink">
              <MoreHorizontal />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem asChild>
              <Link href={`/applications/${app.id}`}>{isBid ? "Open the bid" : "Open the draft"}</Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuLabel>Move to</DropdownMenuLabel>
            {stageOrder.map((s) => (
              <DropdownMenuItem key={s} disabled={s === app.stage} onSelect={() => onMove(s)}>
                {label(s)}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {app.stage === "won" ? (
        <div className="mt-3 flex flex-wrap items-end gap-x-3 gap-y-2 text-sm">
          <span className="font-semibold text-ink">{isBid ? "Awarded" : "Funded"}</span>
          {app.outcome?.awardAmount ? <span className="font-semibold text-ink tnum">{formatMoney(app.outcome.awardAmount)}</span> : null}
        </div>
      ) : (
        <div className="mt-3 flex flex-wrap items-baseline gap-x-4 gap-y-1 text-sm text-ink-muted">
          {app.askAmount ? <span className="tnum">Ask {formatMoney(app.askAmount, { compact: true })}</span> : null}
          {!done && app.opportunity.deadline ? (
            <>
              <span className={cn(soon && "text-alert")}>{formatShortDate(app.opportunity.deadline)}</span>
              <span className={cn(soon && "font-semibold text-alert")}>{dl.text}</span>
            </>
          ) : null}
        </div>
      )}
      {!done && app.sectionProgress.total > 0 ? (
        <Progress value={(app.sectionProgress.done / app.sectionProgress.total) * 100} className="mt-3" aria-label={`${app.sectionProgress.done} of ${app.sectionProgress.total} sections drafted`} />
      ) : null}
      {!done && app.nextMilestone ? <p className="mt-2 truncate text-sm text-ink-muted">Next: {app.nextMilestone.title}</p> : null}
      {app.stage === "lost" && app.outcome?.feedback ? <p className="mt-2 line-clamp-2 text-sm text-ink-muted">{app.outcome.feedback}</p> : null}
      {app.stage === "lost" && app.outcome?.lessons ? (
        <p className="mt-2 line-clamp-3 text-sm text-ink">
          <span className="font-semibold">Next time: </span>
          {app.outcome.lessons}
        </p>
      ) : null}
      {owner ? (
        <div className="mt-3 flex items-center gap-2 text-sm text-ink-muted">
          <Avatar name={owner.fullName} size="sm" />
          {owner.fullName}
        </div>
      ) : null}
    </article>
  );
}

const LOSS_REASONS = Object.keys(LOSS_REASON_LABEL) as LossReason[];

function OutcomeDialog({ app, onClose, onSave }: { app: ApplicationView; onClose: () => void; onSave: (r: OutcomeResult, amount: number | null, feedback: string | null, details: { lossReasons: LossReason[]; lessons: string | null }) => Promise<void> }) {
  const [result, setResult] = React.useState<OutcomeResult>(app.stage === "won" ? "won" : "lost");
  const [amount, setAmount] = React.useState(app.askAmount ? String(app.askAmount) : "");
  const [feedback, setFeedback] = React.useState("");
  const [reasons, setReasons] = React.useState<LossReason[]>([]);
  const [lessons, setLessons] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const declined = result === "lost" || result === "no_response";
  const toggle = (r: LossReason, on: boolean) => setReasons((list) => (on ? [...list.filter((x) => x !== r), r] : list.filter((x) => x !== r)));
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent size="md">
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
        {declined ? (
          <>
            <fieldset className="flex flex-col gap-2">
              <legend className="text-base font-semibold text-ink">Why it was declined</legend>
              <p className="text-sm text-ink-muted">Pick any that apply, from what they said or your own judgment. These feed the win analytics.</p>
              <ul className="mt-1 flex flex-col gap-2">
                {LOSS_REASONS.map((r) => (
                  <li key={r} className="flex items-start gap-3">
                    <Checkbox id={`loss-${r}`} checked={reasons.includes(r)} onCheckedChange={(v) => toggle(r, v === true)} />
                    <Label htmlFor={`loss-${r}`} className="pt-0.5 text-sm font-normal">
                      {LOSS_REASON_LABEL[r]}
                    </Label>
                  </li>
                ))}
              </ul>
            </fieldset>
            <Field id="outcome-lessons" label="What would you do differently next time?" optional>
              <Textarea value={lessons} onChange={(e) => setLessons(e.target.value)} placeholder="One or two sentences for whoever writes the next one." className="min-h-20" />
            </Field>
          </>
        ) : null}
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            loading={saving}
            onClick={async () => {
              setSaving(true);
              await onSave(result, result === "won" && amount ? Number(amount) : null, feedback.trim() || null, declined ? { lossReasons: reasons, lessons: lessons.trim() || null } : { lossReasons: [], lessons: null });
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
