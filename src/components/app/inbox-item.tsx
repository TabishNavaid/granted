"use client";

import * as React from "react";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import type { EmailDraft, Fact, InboxItem, MatchView, Milestone, MissingFact, Document } from "@/lib/types";
import { inboxKindLabel, doneWord } from "@/lib/agents/meta";
import { cn } from "@/lib/utils";
import { formatDate, formatShortDate, relativeTime, formatRange } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Input, Textarea } from "@/components/ui/input";
import { Label, Field } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Bloom } from "@/components/drawings/bloom";
import { flowerFor } from "@/lib/drawings";
import { FitScore } from "./fit-score";
import { MilestoneBadge } from "./badges";
import { CitationChip } from "./citation-chip";

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

/** How long the flower takes to grow, plus a beat to enjoy it, before the item is filed away. In ms. */
export const BLOOM_HOLD_MS = 1600;

interface InboxItemCardProps {
  item: InboxItem;
  ctx: InboxContext;
  leaving?: Leaving;
  onApprove: (item: InboxItem, extra?: { answers?: Record<string, string>; email?: Pick<EmailDraft, "subject" | "body"> }) => void;
  onReject: (item: InboxItem, reason: string | null) => void;
  onEdited?: (item: InboxItem) => void;
  /** Whether the item is filed away after its flower grows. The landing page keeps it on the page. */
  fileAway?: boolean;
}

/**
 * One item waiting on the user: what it is (circled when it should come first), when it
 * arrived, the title, a preview, and the actions. Approving grows a crayon
 * flower up from the bottom edge of the item before it is filed.
 */
export function InboxItemCard({ item, ctx, leaving, onApprove, onReject, fileAway = true }: InboxItemCardProps) {
  const [rejectOpen, setRejectOpen] = React.useState(false);
  const [reason, setReason] = React.useState("");
  const [answers, setAnswers] = React.useState<Record<string, string>>({});
  const [emailEdit, setEmailEdit] = React.useState<Pick<EmailDraft, "subject" | "body"> | null>(null);
  const [emailOpen, setEmailOpen] = React.useState(false);
  const headingId = `inbox-${item.id}-title`;
  const resolved = item.status !== "pending";
  const approved = leaving === "seal" || item.status === "approved" || item.status === "edited";
  const flower = flowerFor(item.id);

  const editTarget = editHref(item);
  const canApprove = item.type !== "missing_facts" || Object.values(answers).some((a) => a.trim());

  return (
    <article
      aria-labelledby={headingId}
      className={cn(
        "relative border-b border-rule py-6",
        leaving === "seal" && fileAway && "animate-leave [animation-delay:1150ms]",
        leaving === "dismiss" && fileAway && "animate-leave",
      )}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 text-sm">
        {!resolved && !leaving && item.priority === "high" ? (
          <mark className="circled font-semibold text-ink">{inboxKindLabel[item.type]}</mark>
        ) : (
          <span className="font-semibold text-ink">{inboxKindLabel[item.type]}</span>
        )}
        <span className="flex flex-wrap gap-x-4 text-ink-muted">
          <time dateTime={item.createdAt}>{relativeTime(item.createdAt)}</time>
          {item.sourceCount > 0 ? <span>Built from {item.sourceCount} source{item.sourceCount === 1 ? "" : "s"}</span> : null}
        </span>
      </div>

      <h3 id={headingId} className="mt-2 max-w-[30ch] font-display text-2xl leading-tight text-ink sm:text-[1.75rem]">
        {item.title}
      </h3>
      <p className="mt-2 max-w-[65ch] text-base text-ink-muted">{item.summary}</p>

      <div className="mt-5">
        <ItemPreview item={item} ctx={ctx} answers={answers} setAnswers={setAnswers} emailOverride={emailEdit} />
      </div>

      {item.rejectionReason ? (
        <p className="mt-4 max-w-[65ch] border-l-[3px] border-rule-strong pl-3 text-sm text-ink-muted">
          <span className="font-semibold text-ink">Why you declined: </span>
          {item.rejectionReason}
        </p>
      ) : null}

      {!resolved && !leaving ? (
        <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-3">
          <Button onClick={() => onApprove(item, { answers, email: emailEdit ?? undefined })} disabled={!canApprove}>
            {approveLabels[item.type]}
          </Button>
          {item.type === "email_draft" ? (
            <Button variant="ghost" onClick={() => setEmailOpen(true)}>
              Edit the email
            </Button>
          ) : editTarget ? (
            <Button variant="ghost" asChild>
              <Link href={editTarget.href}>{editTarget.label}</Link>
            </Button>
          ) : null}
          <Button variant="ghost" className="sm:ml-auto" onClick={() => setRejectOpen(true)}>
            {item.type === "missing_facts" ? "Skip for now" : "Decline"}
          </Button>
        </div>
      ) : (
        <div className={cn("relative mt-5 flex flex-wrap items-end gap-x-3 pr-24 text-sm text-ink-muted sm:pr-32", approved && "min-h-20")}>
          <span className="font-semibold text-ink">{approved ? (item.status === "edited" ? "Approved with edits" : doneWord[item.type]) : "Declined"}</span>
          <span>{leaving === "seal" ? "Just now" : item.resolvedAt ? formatDate(item.resolvedAt, "EEEE, MMMM d") : null}</span>
          {approved ? <Bloom flower={flower} grow={leaving === "seal"} className="pointer-events-none absolute -bottom-6 right-0 h-[6.5rem] sm:right-4" /> : null}
        </div>
      )}

      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent size="sm">
          <DialogHeader>
            <DialogTitle>{item.type === "missing_facts" ? "Skip these questions?" : "Decline this?"}</DialogTitle>
            <DialogDescription>{item.type === "missing_facts" ? "The draft keeps its marked gaps until you get a minute." : "A short reason helps the next one fit better. It is optional."}</DialogDescription>
          </DialogHeader>
          {item.type !== "missing_facts" ? (
            <Field id={`reason-${item.id}`} label="Reason" optional>
              <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Not for us because" className="min-h-20" />
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
      return { href: `/applications/${p.applicationId}`, label: "Open the draft" };
    case "missing_facts":
      return { href: `/applications/${p.applicationId}`, label: "Answer in the draft" };
    case "new_matches":
      return { href: "/opportunities", label: "See all funders" };
    case "milestones":
      return { href: "/calendar", label: "Open the calendar" };
    case "profile_update":
      return { href: "/profile?tab=facts", label: "Open your facts" };
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
        <div className="max-w-xl">
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="font-semibold text-ink">
              {drafted} of {p.sectionCount} sections drafted
            </span>
            <span className="text-ink-muted tnum">{Math.round((drafted / p.sectionCount) * 100)}%</span>
          </div>
          <Progress value={(drafted / p.sectionCount) * 100} className="mt-2" aria-label="Draft progress" />
          <dl className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-sm text-ink-muted">
            <div className="flex gap-1.5">
              <dt>Citations</dt>
              <dd className="font-semibold text-ink tnum">18</dd>
            </div>
            <div className="flex gap-1.5">
              <dt>Open questions</dt>
              <dd className="font-semibold text-ink tnum">{p.openQuestions}</dd>
            </div>
            <div className="flex gap-1.5">
              <dt>Documents used</dt>
              <dd className="font-semibold text-ink tnum">3</dd>
            </div>
          </dl>
        </div>
      );
    }
    case "email_draft": {
      const d = { ...ctx.emails[p.emailDraftId], ...(emailOverride ?? {}) };
      return <EmailPreview draft={d} funderName={ctx.funderNames[d.funderId]} />;
    }
    case "new_matches":
      return (
        <ul className="max-w-2xl divide-y divide-rule border-y border-rule">
          {p.matchIds.map((id) => {
            const m = ctx.matches[id];
            if (!m) return null;
            return (
              <li key={id} className="flex items-center gap-4 py-3">
                <FitScore score={m.fitScore} size="sm" showLabel={false} />
                <div className="min-w-0 flex-1">
                  <Link href={`/opportunities/${m.opportunityId}`} className="block truncate text-base font-semibold text-ink hover:underline hover:decoration-corn hover:decoration-2 hover:underline-offset-4">
                    {m.opportunity.title}
                  </Link>
                  <p className="flex flex-wrap gap-x-4 text-sm text-ink-muted">
                    <span className="truncate">{m.funder.name}</span>
                    <span className="tnum">{formatRange(m.opportunity.amountMin, m.opportunity.amountMax)}</span>
                    <span>{m.opportunity.deadline ? `Due ${formatShortDate(m.opportunity.deadline)}` : "Rolling"}</span>
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      );
    case "milestones":
      return (
        <ol className="max-w-2xl divide-y divide-rule border-y border-rule">
          {p.milestoneIds.map((id) => {
            const m = ctx.milestones[id];
            if (!m) return null;
            return (
              <li key={id} className="flex items-center gap-4 py-2.5 text-base">
                <span className="w-16 shrink-0 text-sm font-semibold text-ink tnum">{formatShortDate(m.dueDate)}</span>
                <span className="flex-1 text-ink">{m.title}</span>
                <MilestoneBadge kind={m.kind} />
              </li>
            );
          })}
        </ol>
      );
    case "missing_facts":
      return (
        <ol className="flex max-w-xl flex-col gap-5">
          {p.missingFactIds.map((id, i) => {
            const q = ctx.missingFacts[id];
            if (!q) return null;
            return (
              <li key={id} className="flex gap-3">
                <span className="w-5 shrink-0 pt-0.5 text-sm font-semibold text-ink tnum" aria-hidden>
                  {i + 1}.
                </span>
                <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                  <Label htmlFor={`ans-${id}`} className="leading-snug">
                    {q.question}
                  </Label>
                  <p className="text-sm text-ink-muted">{q.whyItMatters}</p>
                  <Input id={`ans-${id}`} value={answers[id] ?? ""} onChange={(e) => setAnswers((a) => ({ ...a, [id]: e.target.value }))} placeholder="Your answer" className="max-w-sm" />
                </div>
              </li>
            );
          })}
        </ol>
      );
    case "profile_update": {
      const f = ctx.facts[p.factId];
      const doc = ctx.documents[p.sourceDocumentId];
      if (!f) return null;
      return (
        <dl className="grid max-w-xl gap-6 border-y border-rule py-4 sm:grid-cols-2">
          <div>
            <dt className="text-sm text-ink-muted">On your profile now</dt>
            <dd className="mt-1 font-display text-3xl text-ink-muted line-through decoration-ink decoration-2">{f.value}</dd>
            <dd className="mt-1 text-sm text-ink-muted">{f.label}</dd>
          </div>
          <div>
            <dt className="text-sm text-ink-muted">Proposed</dt>
            <dd className="mt-1 font-display text-3xl text-ink">{p.proposedValue}</dd>
            <dd className="mt-1.5">
              <CitationChip label={doc?.title ?? "Uploaded document"} sourceTitle={doc?.title} excerpt="Average attendance across all sites, 2025-26: 89%" />
            </dd>
          </div>
        </dl>
      );
    }
    default:
      return null;
  }
}

/** The email as a letter: who it goes to, the subject, and the first lines. */
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
    <div className="max-w-2xl border-y border-rule">
      <dl className="flex flex-wrap gap-x-6 gap-y-1 border-b border-rule py-2.5 text-sm">
        <div className="flex gap-1.5">
          <dt className="text-ink-muted">To</dt>
          <dd className="font-semibold text-ink">{funderName ?? "Funder"}</dd>
        </div>
        <div className="flex gap-1.5">
          <dt className="text-ink-muted">Subject</dt>
          <dd className="font-semibold text-ink">{draft.subject}</dd>
        </div>
      </dl>
      <pre className="line-clamp-4 whitespace-pre-wrap py-3 font-body text-base leading-relaxed text-ink">{draft.body}</pre>
      <div className="flex justify-end border-t border-rule py-1.5">
        <Button variant="ghost" size="sm" onClick={copy}>
          {copied ? "Copied" : "Copy the email"}
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
          <DialogTitle>Edit the email</DialogTitle>
          <DialogDescription>Your edits are saved to the draft. You send it from your own email when it reads right.</DialogDescription>
        </DialogHeader>
        <Field id="email-subject" label="Subject">
          <Input value={subject} onChange={(e) => setSubject(e.target.value)} />
        </Field>
        <Field id="email-body" label="Message">
          <Textarea value={body} onChange={(e) => setBody(e.target.value)} className="min-h-72" />
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

/** A one-line row that opens into the full item. For things you can decide at a glance. */
export function CompactInboxRow({ item, ctx, leaving, onApprove, onReject, defaultOpen = false }: InboxItemCardProps & { defaultOpen?: boolean }) {
  const [open, setOpen] = React.useState(defaultOpen);
  const resolved = item.status !== "pending";
  const approved = item.status === "approved" || item.status === "edited";
  const panelId = `row-${item.id}`;
  if (open) {
    return (
      <div className="flex flex-col">
        <InboxItemCard item={item} ctx={ctx} leaving={leaving} onApprove={onApprove} onReject={onReject} />
        <button type="button" onClick={() => setOpen(false)} className="self-start py-2 text-sm font-semibold text-ink-muted underline-offset-4 hover:text-ink hover:underline">
          Collapse
        </button>
      </div>
    );
  }
  return (
    <div
      className={cn(
        "relative flex min-h-16 items-center gap-4 border-b border-rule py-3",
        leaving === "seal" && "animate-leave [animation-delay:1150ms]",
        leaving === "dismiss" && "animate-leave",
      )}
    >
      {leaving === "seal" ? <Bloom flower={flowerFor(item.id)} grow className="pointer-events-none absolute bottom-0 right-14 z-10 h-16" /> : null}
      <button type="button" aria-expanded={open} aria-controls={panelId} onClick={() => setOpen(true)} className="min-w-0 flex-1 py-1 text-left">
        <span className="block text-sm text-ink-muted">
          {inboxKindLabel[item.type]}
        </span>
        <span className="mt-1 block truncate text-base font-semibold text-ink">{item.title}</span>
      </button>
      {resolved ? (
        approved ? (
          <span className="flex items-end gap-1 text-sm text-ink-muted">
            <Bloom flower={flowerFor(item.id)} className="h-9" />
            {item.status === "edited" ? "Approved" : doneWord[item.type]}
          </span>
        ) : (
          <span className="text-sm text-ink-muted">Declined</span>
        )
      ) : leaving ? null : (
        <Button size="sm" variant="secondary" className="hidden sm:inline-flex" onClick={() => onApprove(item)}>
          {approveLabels[item.type]}
        </Button>
      )}
      <Button variant="ghost" size="icon-sm" aria-label={`Open ${item.title}`} aria-expanded={open} aria-controls={panelId} onClick={() => setOpen(true)}>
        <ChevronDown />
      </Button>
    </div>
  );
}
