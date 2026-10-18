"use client";

import * as React from "react";
import { AlertTriangle, Check, CircleHelp, FileText, Paperclip, RefreshCw, X } from "lucide-react";
import type { ComplianceCheck, Document, Fact, MissingFact, Requirement, Section } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { CitationChip } from "@/components/app/citation-chip";
import { formatDate, wordCount } from "@/lib/format";

const statusDot: Record<Section["status"], string> = {
  drafted: "bg-accent",
  edited: "bg-info",
  approved: "bg-success",
  needs_facts: "bg-warning",
  empty: "bg-border-strong",
};
const statusLabel: Record<Section["status"], string> = {
  drafted: "Drafted",
  edited: "Edited",
  approved: "Approved",
  needs_facts: "Needs facts",
  empty: "Not started",
};

export function Checklist({
  requirements,
  sections,
  activeId,
  onSelect,
}: {
  requirements: Requirement[];
  sections: Section[];
  activeId: string;
  onSelect: (sectionId: string) => void;
}) {
  const attachments = requirements.filter((r) => r.kind === "attachment");
  const rules = requirements.filter((r) => r.kind === "format" || r.kind === "eligibility");
  const done = requirements.filter((r) => r.satisfied).length;
  return (
    <nav aria-label="Requirements checklist" className="flex flex-col gap-5 text-sm">
      <div>
        <div className="flex items-baseline justify-between">
          <p className="text-xs font-semibold uppercase tracking-wider text-fg-subtle">Checklist</p>
          <span className="text-xs text-fg-subtle tnum">
            {done} of {requirements.length}
          </span>
        </div>
        <p className="mt-1 text-xs text-fg-subtle">Pulled from the funder&apos;s guidelines.</p>
      </div>
      <div>
        <p className="mb-1.5 text-xs font-medium text-fg-muted">Sections</p>
        <ol className="flex flex-col gap-0.5">
          {sections.map((s) => {
            const words = wordCount(s.bodyHtml.replace(/<[^>]+>/g, " "));
            const active = s.id === activeId;
            return (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => onSelect(s.id)}
                  aria-current={active ? "true" : undefined}
                  className={cn(
                    "flex w-full items-start gap-2.5 rounded-md px-2.5 py-2 text-left transition-colors hover:bg-surface-hover",
                    active && "bg-accent-soft text-accent-soft-fg hover:bg-accent-soft",
                  )}
                >
                  <span className={cn("mt-[0.45rem] size-2 shrink-0 rounded-full", statusDot[s.status])} aria-hidden />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{s.title}</span>
                    <span className={cn("block text-xs", active ? "text-accent-soft-fg/80" : "text-fg-subtle")}>
                      {statusLabel[s.status]}
                      {s.wordLimit ? ` · ${words}/${s.wordLimit}` : ""}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      </div>
      <div>
        <p className="mb-1.5 text-xs font-medium text-fg-muted">Attachments</p>
        <ul className="flex flex-col gap-1">
          {attachments.map((r) => (
            <li key={r.id} className="flex items-start gap-2.5 px-2.5 py-1.5">
              <span className={cn("mt-0.5 inline-flex size-4 shrink-0 items-center justify-center rounded-full", r.satisfied ? "bg-success-soft text-success-soft-fg" : "border border-border-strong text-transparent")} aria-hidden>
                <Check className="size-2.5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className={cn("block", r.satisfied ? "text-fg-muted" : "text-fg")}>{r.title}</span>
                {r.detail ? <span className="block text-xs text-fg-subtle">{r.detail}</span> : null}
              </span>
              <span className="sr-only">{r.satisfied ? "Done" : "To do"}</span>
              {!r.satisfied ? <Paperclip className="mt-0.5 size-3.5 shrink-0 text-fg-subtle" aria-hidden /> : null}
            </li>
          ))}
        </ul>
      </div>
      {rules.length ? (
        <div>
          <p className="mb-1.5 text-xs font-medium text-fg-muted">Rules</p>
          <ul className="flex flex-col gap-1">
            {rules.map((r) => (
              <li key={r.id} className="px-2.5 py-1.5 text-fg-muted">
                {r.title}
                {r.detail ? <span className="block text-xs text-fg-subtle">{r.detail}</span> : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </nav>
  );
}

export function QuestionsPanel({
  questions,
  sections,
  highlightId,
  onAnswer,
  onSkip,
}: {
  questions: MissingFact[];
  sections: Section[];
  highlightId: string | null;
  onAnswer: (id: string, answer: string) => Promise<void>;
  onSkip: (id: string) => Promise<void>;
}) {
  const open = questions.filter((q) => q.status === "open");
  const closed = questions.filter((q) => q.status !== "open");
  const sectionTitle = (id: string | null) => sections.find((s) => s.id === id)?.title ?? "General";
  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-fg-muted">
        {open.length === 0 ? "Every question is answered. The draft cites you as the source. Thank you." : `We couldn't find ${open.length} fact${open.length === 1 ? "" : "s"} in your documents, so we left a marked gap instead of guessing.`}
      </p>
      {open.map((q, i) => (
        <QuestionCard key={q.id} q={q} index={i} sectionTitle={sectionTitle(q.sectionId)} highlighted={highlightId === q.id} onAnswer={onAnswer} onSkip={onSkip} />
      ))}
      {closed.length ? (
        <div className="mt-2">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-fg-subtle">Answered</p>
          <ul className="flex flex-col gap-2">
            {closed.map((q) => (
              <li key={q.id} className="rounded-md border border-border bg-surface p-3 text-sm">
                <p className="text-fg-muted">{q.question}</p>
                <p className="mt-1 flex items-center gap-1.5 font-medium text-fg">
                  <Check className="size-3.5 text-success" aria-hidden />
                  {q.status === "skipped" ? "Skipped for now" : q.answer}
                </p>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function QuestionCard({ q, index, sectionTitle, highlighted, onAnswer, onSkip }: { q: MissingFact; index: number; sectionTitle: string; highlighted: boolean; onAnswer: (id: string, a: string) => Promise<void>; onSkip: (id: string) => Promise<void> }) {
  const [value, setValue] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const ref = React.useRef<HTMLInputElement>(null);
  React.useEffect(() => {
    if (highlighted) ref.current?.focus();
  }, [highlighted]);
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        if (!value.trim()) return;
        setSaving(true);
        await onAnswer(q.id, value.trim());
        setSaving(false);
      }}
      className={cn("rounded-md border bg-surface-raised p-3 transition-colors", highlighted ? "border-accent ring-2 ring-ring/30" : "border-border")}
    >
      <p className="text-xs text-fg-subtle">
        {index + 1} · {sectionTitle}
      </p>
      <Label htmlFor={`q-${q.id}`} className="mt-1.5 block leading-snug">
        {q.question}
      </Label>
      <p className="mt-1 text-xs text-fg-subtle">{q.whyItMatters}</p>
      <div className="mt-2.5 flex gap-2">
        <Input ref={ref} id={`q-${q.id}`} value={value} onChange={(e) => setValue(e.target.value)} placeholder="Your answer" className="h-9" />
        <Button type="submit" size="sm" className="h-9" loading={saving} disabled={!value.trim()}>
          Save
        </Button>
      </div>
      <button type="button" onClick={() => onSkip(q.id)} className="mt-2 text-xs text-fg-subtle underline-offset-2 hover:text-fg hover:underline">
        Skip for now
      </button>
    </form>
  );
}

export function CompliancePanel({ checks, onRerun, running, onJump }: { checks: ComplianceCheck[]; onRerun: () => void; running: boolean; onJump: (sectionId: string) => void }) {
  const fails = checks.filter((c) => c.status === "fail");
  const warns = checks.filter((c) => c.status === "warn");
  const passes = checks.filter((c) => c.status === "pass");
  const ready = fails.length === 0;
  return (
    <div className="flex flex-col gap-4">
      <div className={cn("flex items-start gap-3 rounded-md p-3 text-sm", ready ? "bg-success-soft text-success-soft-fg" : "bg-danger-soft text-danger-soft-fg")}>
        {ready ? <Check className="mt-0.5 size-4 shrink-0" aria-hidden /> : <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />}
        <div>
          <p className="font-medium">{ready ? "Ready to submit" : `${fails.length} thing${fails.length === 1 ? "" : "s"} to sort out before you submit`}</p>
          <p className="mt-0.5 text-xs opacity-90">
            {passes.length} passed · {warns.length} to review · {fails.length} failed
          </p>
        </div>
      </div>
      <Button variant="secondary" size="sm" onClick={onRerun} loading={running} className="w-fit">
        <RefreshCw aria-hidden /> Run check again
      </Button>
      <ul className="flex flex-col gap-1.5">
        {[...fails, ...warns, ...passes].map((c) => (
          <li key={c.id} className="flex items-start gap-2.5 rounded-md border border-border bg-surface px-3 py-2.5 text-sm">
            <span
              className={cn(
                "mt-0.5 inline-flex size-4 shrink-0 items-center justify-center rounded-full",
                c.status === "pass" && "bg-success-soft text-success-soft-fg",
                c.status === "warn" && "bg-warning-soft text-warning-soft-fg",
                c.status === "fail" && "bg-danger-soft text-danger-soft-fg",
              )}
              aria-hidden
            >
              {c.status === "pass" ? <Check className="size-2.5" /> : c.status === "warn" ? <span className="text-[9px] font-bold">!</span> : <X className="size-2.5" />}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-fg">
                <span className="sr-only">{c.status === "pass" ? "Passed: " : c.status === "warn" ? "Review: " : "Failed: "}</span>
                {c.rule}
              </p>
              <p className="text-xs text-fg-subtle">{c.detail}</p>
              {c.sectionId && c.status !== "pass" ? (
                <button type="button" onClick={() => onJump(c.sectionId!)} className="mt-1 text-xs font-medium text-accent underline-offset-2 hover:underline">
                  Go to section
                </button>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function SourcesPanel({ facts, documents, sections, highlightFactId }: { facts: Fact[]; documents: Document[]; sections: Section[]; highlightFactId: string | null }) {
  const used = new Map<string, number>();
  for (const s of sections) {
    for (const m of s.bodyHtml.matchAll(/data-citation="([^"]+)"/g)) used.set(m[1], (used.get(m[1]) ?? 0) + 1);
  }
  const usedFacts = facts.filter((f) => used.has(f.id)).sort((a, b) => (used.get(b.id) ?? 0) - (used.get(a.id) ?? 0));
  const docOf = (id: string | null) => documents.find((d) => d.id === id);
  const refs = React.useRef<Record<string, HTMLLIElement | null>>({});
  React.useEffect(() => {
    if (highlightFactId) refs.current[highlightFactId]?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [highlightFactId]);
  const docsUsed = Array.from(new Set(usedFacts.map((f) => f.sourceDocumentId).filter(Boolean))) as string[];
  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-fg-muted">
        Every number in this draft comes from one of your own documents. {usedFacts.length} facts cited from {docsUsed.length} document{docsUsed.length === 1 ? "" : "s"}, and you can check each one.
      </p>
      <div className="flex flex-wrap gap-1.5">
        {docsUsed.map((id) => {
          const d = docOf(id);
          return d ? (
            <Badge key={id} variant="neutral">
              <FileText aria-hidden /> {d.title}
            </Badge>
          ) : null;
        })}
      </div>
      <ul className="flex flex-col gap-2">
        {usedFacts.map((f) => {
          const d = docOf(f.sourceDocumentId);
          const hl = highlightFactId === f.id;
          return (
            <li
              key={f.id}
              ref={(el) => {
                refs.current[f.id] = el;
              }}
              className={cn("rounded-md border bg-surface p-3 text-sm transition-colors", hl ? "border-accent ring-2 ring-ring/30" : "border-border")}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-xs text-fg-subtle">{f.label}</p>
                  <p className="font-display text-lg text-fg">{f.value}</p>
                </div>
                <span className="shrink-0 text-xs text-fg-subtle tnum">×{used.get(f.id)}</span>
              </div>
              <blockquote className="mt-1.5 border-l-2 border-border-strong pl-2.5 text-xs leading-relaxed text-fg-muted">“{f.sourceExcerpt}”</blockquote>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-fg-subtle">
                <CitationChip label={d ? `${d.title}${f.sourcePage ? `, p.${f.sourcePage}` : ""}` : "You"} sourceTitle={d?.title} excerpt={f.sourceExcerpt} page={f.sourcePage} verifiedAt={f.lastConfirmedAt} />
                {f.status !== "confirmed" ? (
                  <Badge variant="warning">
                    <CircleHelp aria-hidden /> {f.status === "stale" ? "Over a year old" : "Needs review"}
                  </Badge>
                ) : (
                  <span>Confirmed {formatDate(f.lastConfirmedAt)}</span>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
