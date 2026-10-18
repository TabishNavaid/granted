"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight, Check, ChevronDown, Copy, Pencil, X } from "lucide-react";
import type { EmailDraft, Fact, InboxItem, MatchView, Milestone, MissingFact, Document } from "@/lib/types";
import { agentMeta } from "@/lib/agents/meta";
import { cn } from "@/lib/utils";
import { formatDate, formatShortDate, relativeTime, formatRange } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Input, Textarea } from "@/components/ui/input";
import { Label, Field } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AgentMark } from "./badges";
import { FitScore } from "./fit-score";
import { MilestoneBadge } from "./badges";
import { CitationChip } from "./citation-chip";
import { LanternMark } from "./logo";
import { SealedLetter } from "@/components/brand/illustrations";

export interface InboxContext {
  matches: Record<string, MatchView>;
  emails: Record<string, EmailDraft>;
  milestones: Record<string, Milestone>;
  missingFacts: Record<string, MissingFact>;
  facts: Record<string, Fact>;
  documents: Record<string, Document>;
  funderNames: Record<string, string>;
  applicationTitles: Record<string, string>;
}

const approveLabels: Record<InboxItem["type"], string> = {
  monthly_plan: "Approve plan",
  proposal_draft: "Approve draft",
  email_draft: "Approve email",
  new_matches: "Save matches",
  milestones: "Add to calendar",
  missing_facts: "Save answers",
  profile_update: "Update fact",
};

export type Leaving = false | "seal" | "dismiss";

interface InboxItemCardProps {
  item: InboxItem;
  ctx: InboxContext;
  leaving?: Leaving;
  onApprove: (item: InboxItem, extra?: { answers?: Record<string, string>; email?: Pick<EmailDraft, "subject" | "body"> }) => void;
  onReject: (item: InboxItem, reason: string | null) => void;
  onEdited?: (item: InboxItem) => void;
}

export function InboxItemCard({ item, ctx, leaving, onApprove, onReject }: InboxItemCardProps) {
  const [rejectOpen, setRejectOpen] = React.useState(false);
  const [reason, setReason] = React.useState("");
  const [answers, setAnswers] = React.useState<Record<string, string>>({});
  const [emailEdit, setEmailEdit] = React.useState<Pick<EmailDraft, "subject" | "body"> | null>(null);
  const [emailOpen, setEmailOpen] = React.useState(false);
  const headingId = `inbox-${item.id}-title`;
  const resolved = item.status !== "pending";

  const editTarget = editHref(item);
  const canApprove = item.type !== "missing_facts" || Object.values(answers).some((a) => a.trim());

  return (
    <article
      aria-labelledby={headingId}
      className={cn(
        "group relative overflow-hidden rounded-2xl border border-border bg-surface-raised shadow-xs transition-[box-shadow,border-color]",
        !resolved && "hover:border-border-strong hover:shadow-sm",
        resolved && "opacity-85",
        leaving === "seal" && "animate-seal",
        leaving === "dismiss" && "animate-collapse-out",
      )}
    >
      {leaving === "seal" ? (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-surface-raised/90 animate-fade-in [animation-delay:200ms]" aria-hidden>
          <SealedLetter size={88} className="text-fg" />
          <p className="text-sm font-semibold text-fg">Sealed and filed</p>
        </div>
      ) : null}
      <div className="flex gap-4 p-5">
        <AgentMark agent={item.agent} className="mt-0.5 hidden sm:inline-flex" />
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-fg-subtle">
            <span className="font-semibold text-fg-muted">{agentMeta[item.agent].label}</span>
            <span aria-hidden>·</span>
            <time dateTime={item.createdAt}>{relativeTime(item.createdAt)}</time>
            {item.sourceCount > 0 ? (
              <>
                <span aria-hidden>·</span>
                <span>
                  {item.sourceCount} source{item.sourceCount === 1 ? "" : "s"}
                </span>
              </>
            ) : null}
            {resolved ? (
              <Badge variant={item.status === "approved" ? "success" : item.status === "rejected" ? "neutral" : "info"} className="ml-auto">
                {item.status === "approved" ? "Sealed" : item.status === "rejected" ? "Declined" : "Edited and sealed"}
              </Badge>
            ) : (
              <span className="ml-auto inline-flex items-center gap-1 text-glow-text" title="Waiting on you">
                <LanternMark className="size-3.5" />
                <span className="sr-only">Waiting on you</span>
              </span>
            )}
          </p>
          <h3 id={headingId} className="mt-1.5 font-display text-xl leading-snug text-fg">
            {item.title}
          </h3>
          <p className="mt-1.5 text-sm text-fg-muted">{item.summary}</p>

          <div className="mt-4">
            <ItemPreview item={item} ctx={ctx} answers={answers} setAnswers={setAnswers} emailOverride={emailEdit} />
          </div>

          {item.rejectionReason ? (
            <p className="mt-3 rounded-md bg-surface-sunken px-3 py-2 text-sm text-fg-muted">
              <span className="font-medium text-fg">Why: </span>
              {item.rejectionReason}
            </p>
          ) : null}

          {!resolved ? (
            <div className="mt-5 flex flex-wrap items-center gap-2">
              <Button onClick={() => onApprove(item, { answers, email: emailEdit ?? undefined })} disabled={!canApprove}>
                <Check aria-hidden />
                {approveLabels[item.type]}
              </Button>
              {item.type === "email_draft" ? (
                <Button variant="secondary" onClick={() => setEmailOpen(true)}>
                  <Pencil aria-hidden />
                  Edit
                </Button>
              ) : editTarget ? (
                <Button variant="secondary" asChild>
                  <Link href={editTarget.href}>
                    {editTarget.label}
                    <ArrowRight aria-hidden />
                  </Link>
                </Button>
              ) : null}
              <Button variant="ghost" className="sm:ml-auto" onClick={() => setRejectOpen(true)}>
                <X aria-hidden />
                {item.type === "missing_facts" ? "Skip for now" : "Decline"}
              </Button>
            </div>
          ) : null}
        </div>
      </div>

      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent size="sm">
          <DialogHeader>
            <DialogTitle>{item.type === "missing_facts" ? "Skip these questions?" : "Decline this item?"}</DialogTitle>
            <DialogDescription>
              {item.type === "missing_facts"
                ? "No problem. The draft keeps its placeholders until you get a minute."
                : "A short reason helps us do better next time. Totally optional."}
            </DialogDescription>
          </DialogHeader>
          {item.type !== "missing_facts" ? (
            <Field id={`reason-${item.id}`} label="Reason" optional>
              <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Not for us because..." className="min-h-20" />
            </Field>
          ) : null}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRejectOpen(false)}>
              Keep it
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                setRejectOpen(false);
                onReject(item, reason.trim() || null);
              }}
            >
              {item.type === "missing_facts" ? "Skip" : "Decline"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {item.type === "email_draft" && item.payload.type === "email_draft" ? (
        <EmailEditDialog
          key={String(emailOpen)}
          open={emailOpen}
          onOpenChange={setEmailOpen}
          draft={{ ...ctx.emails[item.payload.emailDraftId], ...(emailEdit ?? {}) }}
          onSave={(d) => {
            setEmailEdit(d);
            setEmailOpen(false);
          }}
        />
      ) : null}
    </article>
  );
}

function editHref(item: InboxItem): { href: string; label: string } | null {
  const p = item.payload;
  switch (p.type) {
    case "proposal_draft":
      return { href: `/applications/${p.applicationId}`, label: "Open workspace" };
    case "missing_facts":
      return { href: `/applications/${p.applicationId}`, label: "Answer in workspace" };
    case "new_matches":
      return { href: "/opportunities", label: "See all matches" };
    case "milestones":
      return { href: "/calendar", label: "Open calendar" };
    case "profile_update":
      return { href: "/profile?tab=facts", label: "Open facts" };
    case "monthly_plan":
      return null;
    default:
      return null;
  }
}

function ItemPreview({
  item,
  ctx,
  answers,
  setAnswers,
  emailOverride,
}: {
  item: InboxItem;
  ctx: InboxContext;
  answers: Record<string, string>;
  setAnswers: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  emailOverride: Pick<EmailDraft, "subject" | "body"> | null;
}) {
  const p = item.payload;
  switch (p.type) {
    case "proposal_draft": {
      const drafted = p.sectionCount - 1;
      return (
        <div className="rounded-md border border-border bg-surface-raised p-4">
          <div className="flex items-center justify-between gap-3 text-sm">
            <span className="font-medium text-fg">
              {drafted} of {p.sectionCount} sections drafted
            </span>
            <span className="text-fg-subtle tnum">{Math.round((drafted / p.sectionCount) * 100)}%</span>
          </div>
          <Progress value={(drafted / p.sectionCount) * 100} className="mt-2" aria-label="Draft progress" />
          <div className="mt-3 flex flex-wrap gap-2">
            <Badge variant="accent">18 citations</Badge>
            <Badge variant="warning">{p.openQuestions} open questions</Badge>
            <Badge variant="neutral">3 documents used</Badge>
          </div>
        </div>
      );
    }
    case "email_draft": {
      const d = { ...ctx.emails[p.emailDraftId], ...(emailOverride ?? {}) };
      return <EmailPreview draft={d} funderName={ctx.funderNames[d.funderId]} />;
    }
    case "new_matches":
      return (
        <ul className="divide-y divide-border rounded-md border border-border bg-surface-raised">
          {p.matchIds.map((id) => {
            const m = ctx.matches[id];
            if (!m) return null;
            return (
              <li key={id} className="flex items-center gap-3 p-3">
                <FitScore score={m.fitScore} size="sm" showLabel={false} />
                <div className="min-w-0 flex-1">
                  <Link href={`/opportunities/${m.opportunityId}`} className="block truncate text-sm font-medium text-fg hover:underline">
                    {m.opportunity.title}
                  </Link>
                  <p className="truncate text-xs text-fg-subtle">
                    {m.funder.name} · {formatRange(m.opportunity.amountMin, m.opportunity.amountMax)} · {m.opportunity.deadline ? `Due ${formatShortDate(m.opportunity.deadline)}` : "Rolling"}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      );
    case "milestones":
      return (
        <ol className="divide-y divide-border rounded-md border border-border bg-surface-raised">
          {p.milestoneIds.map((id) => {
            const m = ctx.milestones[id];
            if (!m) return null;
            return (
              <li key={id} className="flex items-center gap-3 p-3 text-sm">
                <span className="w-14 shrink-0 text-xs font-medium text-fg-subtle tnum">{formatShortDate(m.dueDate)}</span>
                <span className="flex-1 text-fg">{m.title}</span>
                <MilestoneBadge kind={m.kind} />
              </li>
            );
          })}
        </ol>
      );
    case "missing_facts":
      return (
        <div className="flex flex-col gap-4 rounded-md border border-border bg-surface-raised p-4">
          {p.missingFactIds.map((id, i) => {
            const q = ctx.missingFacts[id];
            if (!q) return null;
            return (
              <div key={id} className="flex flex-col gap-1.5">
                <Label htmlFor={`ans-${id}`} className="leading-snug">
                  {i + 1}. {q.question}
                </Label>
                <p className="text-xs text-fg-subtle">{q.whyItMatters}</p>
                <Input
                  id={`ans-${id}`}
                  value={answers[id] ?? ""}
                  onChange={(e) => setAnswers((a) => ({ ...a, [id]: e.target.value }))}
                  placeholder="Your answer"
                  className="max-w-sm"
                />
              </div>
            );
          })}
        </div>
      );
    case "profile_update": {
      const f = ctx.facts[p.factId];
      const doc = ctx.documents[p.sourceDocumentId];
      if (!f) return null;
      return (
        <div className="grid gap-3 rounded-md border border-border bg-surface-raised p-4 sm:grid-cols-2">
          <div>
            <p className="text-xs font-medium text-fg-subtle">Current</p>
            <p className="mt-1 font-display text-2xl text-fg-muted line-through decoration-border-strong">{f.value}</p>
            <p className="mt-1 text-xs text-fg-subtle">{f.label}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-fg-subtle">Proposed</p>
            <p className="mt-1 font-display text-2xl text-fg">{p.proposedValue}</p>
            <div className="mt-1.5">
              <CitationChip label={doc?.title ?? "Uploaded document"} sourceTitle={doc?.title} excerpt="Average attendance across all sites, 2025-26: 89%" />
            </div>
          </div>
        </div>
      );
    }
    default:
      return null;
  }
}

export function EmailPreview({ draft, funderName }: { draft: EmailDraft; funderName?: string }) {
  const [copied, setCopied] = React.useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(`Subject: ${draft.subject}\n\n${draft.body}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard may be unavailable; the button is a convenience only.
    }
  };
  return (
    <div className="rounded-md border border-border bg-surface-raised">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b border-border px-4 py-2.5 text-sm">
        <span className="text-fg-subtle">To</span>
        <span className="text-fg">{funderName ?? "Funder"}</span>
        <span className="ml-auto text-xs text-fg-subtle">You send it. We never send email for you.</span>
      </div>
      <div className="px-4 py-3">
        <p className="text-sm font-medium text-fg">{draft.subject}</p>
        <pre className="mt-2 line-clamp-4 whitespace-pre-wrap font-sans text-sm leading-relaxed text-fg-muted">{draft.body}</pre>
      </div>
      <div className="flex justify-end border-t border-border px-2 py-1.5">
        <Button variant="ghost" size="sm" onClick={copy}>
          <Copy aria-hidden />
          {copied ? "Copied" : "Copy email"}
        </Button>
      </div>
    </div>
  );
}

function EmailEditDialog({
  open,
  onOpenChange,
  draft,
  onSave,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  draft: EmailDraft;
  onSave: (d: Pick<EmailDraft, "subject" | "body">) => void;
}) {
  const [subject, setSubject] = React.useState(draft.subject);
  const [body, setBody] = React.useState(draft.body);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>Edit email</DialogTitle>
          <DialogDescription>We'll save your edits to the draft. Send it from your own email whenever you're ready.</DialogDescription>
        </DialogHeader>
        <Field id="email-subject" label="Subject">
          <Input value={subject} onChange={(e) => setSubject(e.target.value)} />
        </Field>
        <Field id="email-body" label="Message">
          <Textarea value={body} onChange={(e) => setBody(e.target.value)} className="min-h-72 font-sans" />
        </Field>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => onSave({ subject, body })}>Save changes</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function formatResolved(item: InboxItem) {
  return item.resolvedAt ? formatDate(item.resolvedAt) : "";
}

/** A one-line row that opens into the full card. For items you can decide at a glance. */
export function CompactInboxRow({ item, ctx, leaving, onApprove, onReject, defaultOpen = false }: InboxItemCardProps & { defaultOpen?: boolean }) {
  const [open, setOpen] = React.useState(defaultOpen);
  const resolved = item.status !== "pending";
  const panelId = `row-${item.id}`;
  if (open) {
    return (
      <div className="flex flex-col gap-2">
        <InboxItemCard item={item} ctx={ctx} leaving={leaving} onApprove={onApprove} onReject={onReject} />
        <button type="button" onClick={() => setOpen(false)} className="self-start text-xs font-semibold text-fg-subtle underline-offset-2 hover:text-fg hover:underline">
          Collapse
        </button>
      </div>
    );
  }
  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-xl border border-border bg-surface px-3 py-2.5 transition-colors hover:border-border-strong",
        resolved && "opacity-85",
        leaving === "seal" && "animate-seal",
        leaving === "dismiss" && "animate-collapse-out",
      )}
    >
      <AgentMark agent={item.agent} size="sm" />
      <button type="button" aria-expanded={open} aria-controls={panelId} onClick={() => setOpen(true)} className="min-w-0 flex-1 text-left">
        <span className="block truncate text-sm font-semibold text-fg">{item.title}</span>
        <span className="block truncate text-xs text-fg-subtle">{item.summary}</span>
      </button>
      {resolved ? (
        <span className="inline-flex items-center gap-1.5 text-xs text-fg-subtle">
          {item.status === "approved" ? <SealedLetter size={22} className="text-fg-subtle" /> : null}
          {item.status === "approved" ? "Sealed" : item.status === "rejected" ? "Declined" : "Edited"}
        </span>
      ) : (
        <Button size="sm" variant="soft" className="hidden sm:inline-flex" onClick={() => onApprove(item)}>
          <Check aria-hidden /> {approveLabels[item.type]}
        </Button>
      )}
      <Button variant="ghost" size="icon-sm" aria-label={`Open ${item.title}`} aria-expanded={open} aria-controls={panelId} onClick={() => setOpen(true)}>
        <ChevronDown />
      </Button>
    </div>
  );
}
