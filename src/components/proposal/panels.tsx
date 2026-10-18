"use client";

import * as React from "react";
import type { ComplianceCheck, Document, Fact, MissingFact, Requirement, Section } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { CitationChip } from "@/components/app/citation-chip";
import { formatDate, wordCount } from "@/lib/format";

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
    <nav aria-label="Requirements checklist" className="flex flex-col gap-6 text-sm">
      <div>
        <div className="flex items-baseline justify-between gap-3">
          <p className="text-sm font-semibold text-ink">Checklist</p>
          <span className="text-sm text-ink-muted tnum">
            {done} of {requirements.length}
          </span>
        </div>
        <p className="mt-1 text-sm text-ink-muted">Pulled from the funder&apos;s guidelines.</p>
      </div>
      <div>
        <p className="mb-1.5 text-sm font-semibold text-ink">Sections</p>
        <ol className="flex flex-col">
          {sections.map((s) => {
            const words = wordCount(s.bodyHtml.replace(/<[^>]+>/g, " "));
            const active = s.id === activeId;
            return (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => onSelect(s.id)}
                  aria-current={active ? "true" : undefined}
                  className={cn("w-full border-l-2 py-2 pl-3 pr-2 text-left transition-colors hover:bg-paper-tint", active ? "border-ink bg-paper-tint font-semibold" : "border-transparent")}
                >
                  <span className="block truncate text-ink">{s.title}</span>
                  <span className="mt-0.5 flex flex-wrap gap-x-4 text-xs font-normal text-ink-muted">
                    {s.status === "needs_facts" ? <mark className="highlight">{statusLabel[s.status]}</mark> : <span>{statusLabel[s.status]}</span>}
                    {s.wordLimit ? (
                      <span className="tnum">
                        {words} of {s.wordLimit} words
                      </span>
                    ) : null}
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      </div>
      <div>
        <p className="mb-1.5 text-sm font-semibold text-ink">Attachments</p>
        <ul className="border-t border-rule">
          {attachments.map((r) => (
            <li key={r.id} className="flex items-start gap-3 border-b border-rule py-2">
              <span className={cn("w-10 shrink-0 text-xs", r.satisfied ? "text-ink-muted" : "font-semibold text-ink")}>{r.satisfied ? "Done" : "To do"}</span>
              <span className="min-w-0 flex-1">
                <span className={cn("block", r.satisfied ? "text-ink-muted" : "text-ink")}>{r.title}</span>
                {r.detail ? <span className="block text-xs text-ink-muted">{r.detail}</span> : null}
              </span>
            </li>
          ))}
        </ul>
      </div>
      {rules.length ? (
        <div>
          <p className="mb-1.5 text-sm font-semibold text-ink">Rules</p>
          <ul className="border-t border-rule">
            {rules.map((r) => (
              <li key={r.id} className="border-b border-rule py-2 text-ink">
                {r.title}
                {r.detail ? <span className="block text-xs text-ink-muted">{r.detail}</span> : null}
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
    <div className="flex flex-col gap-5">
      <p className="text-sm text-ink-muted">
        {open.length === 0 ? "Every question is answered. The draft cites you as the source." : `We could not find ${open.length} fact${open.length === 1 ? "" : "s"} in your documents, so we left a marked gap instead of guessing.`}
      </p>
      {open.map((q, i) => (
        <QuestionCard key={q.id} q={q} index={i} sectionTitle={sectionTitle(q.sectionId)} highlighted={highlightId === q.id} onAnswer={onAnswer} onSkip={onSkip} />
      ))}
      {closed.length ? (
        <div className="mt-2">
          <h3 className="text-sm font-semibold text-ink">Answered</h3>
          <ul className="mt-2 border-t border-rule">
            {closed.map((q) => (
              <li key={q.id} className="border-b border-rule py-3 text-sm">
                <p className="text-ink-muted">{q.question}</p>
                <p className="mt-1 font-semibold text-ink">{q.status === "skipped" ? "Skipped for now" : q.answer}</p>
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
      className={cn("pt-4 transition-colors", highlighted ? "border-t-2 border-ink" : "border-t border-rule")}
    >
      <p className="flex flex-wrap gap-x-4 text-sm">
        <span className="font-semibold text-ink tnum">Question {index + 1}</span>
        <span className="text-ink-muted">{sectionTitle}</span>
      </p>
      <Label htmlFor={`q-${q.id}`} className="mt-2 block leading-snug">
        {q.question}
      </Label>
      <p className="mt-1 text-sm text-ink-muted">{q.whyItMatters}</p>
      <div className="mt-3 flex gap-2">
        <Input ref={ref} id={`q-${q.id}`} value={value} onChange={(e) => setValue(e.target.value)} placeholder="Your answer" className="h-9" />
        <Button type="submit" size="sm" loading={saving} disabled={!value.trim()}>
          Save
        </Button>
      </div>
      <button type="button" onClick={() => onSkip(q.id)} className="mt-3 inline-flex min-h-6 items-center text-sm text-ink-muted underline decoration-[1px] underline-offset-4 hover:text-ink hover:decoration-pink">
        Skip for now
      </button>
    </form>
  );
}

const checkWord: Record<ComplianceCheck["status"], { label: string; className: string }> = {
  pass: { label: "Passed", className: "text-ink-muted" },
  warn: { label: "Review", className: "text-ink" },
  fail: { label: "Failed", className: "text-burgundy" },
};

export function CompliancePanel({ checks, onRerun, running, onJump }: { checks: ComplianceCheck[]; onRerun: () => void; running: boolean; onJump: (sectionId: string) => void }) {
  const fails = checks.filter((c) => c.status === "fail");
  const warns = checks.filter((c) => c.status === "warn");
  const passes = checks.filter((c) => c.status === "pass");
  const ready = fails.length === 0;
  return (
    <div className="flex flex-col gap-4">
      <div className={cn("border-l-[6px] py-2 pl-4 text-sm", ready ? "border-l-pink" : "border-l-burgundy")}>
        <p className="font-display text-xl text-ink">{ready ? "Ready to submit" : `${fails.length} thing${fails.length === 1 ? "" : "s"} to sort out before you submit`}</p>
        <p className="mt-1 flex flex-wrap gap-x-4 text-ink-muted">
          <span className="tnum">{passes.length} passed</span>
          <span className="tnum">{warns.length} to review</span>
          <span className={cn("tnum", fails.length && "font-semibold text-burgundy")}>{fails.length} failed</span>
        </p>
      </div>
      <Button variant="secondary" size="sm" onClick={onRerun} loading={running} className="w-fit">
        Run the checks again
      </Button>
      <ul className="border-t border-rule">
        {[...fails, ...warns, ...passes].map((c) => {
          const w = checkWord[c.status];
          return (
            <li key={c.id} className="flex items-start gap-3 border-b border-rule py-2.5 text-sm">
              <span className={cn("w-16 shrink-0 text-sm font-semibold", w.className)}>{w.label}</span>
              <div className="min-w-0 flex-1">
                <p className="text-ink">{c.rule}</p>
                <p className="text-xs text-ink-muted">{c.detail}</p>
                {c.sectionId && c.status !== "pass" ? (
                  <button type="button" onClick={() => onJump(c.sectionId!)} className="mt-1 text-sm font-semibold text-ink underline decoration-[1.5px] underline-offset-4 hover:decoration-pink">
                    Go to the section
                  </button>
                ) : null}
              </div>
            </li>
          );
        })}
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
  const docTitles = docsUsed.map((id) => docOf(id)?.title).filter(Boolean) as string[];
  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-ink-muted">
        Every number in this draft comes from a source you confirmed. <span className="tnum">{usedFacts.length}</span> fact{usedFacts.length === 1 ? "" : "s"} cited{docsUsed.length ? <> from <span className="tnum">{docsUsed.length}</span> document{docsUsed.length === 1 ? "" : "s"}</> : null}, and you can check each one.
      </p>
      {docTitles.length ? <p className="text-sm text-ink">{docTitles.join(", ")}</p> : null}
      <ul className="flex flex-col">
        {usedFacts.map((f) => {
          const d = docOf(f.sourceDocumentId);
          const hl = highlightFactId === f.id;
          const times = used.get(f.id) ?? 0;
          return (
            <li
              key={f.id}
              ref={(el) => {
                refs.current[f.id] = el;
              }}
              className={cn("py-3 text-sm transition-colors", hl ? "border-t-2 border-ink" : "border-t border-rule")}
            >
              <p className="text-sm text-ink-muted">{f.label}</p>
              <p className="flex flex-wrap items-baseline gap-x-4">
                <span className="font-display text-xl text-ink">{f.value}</span>
                <span className="text-xs text-ink-muted tnum">
                  used {times} time{times === 1 ? "" : "s"}
                </span>
              </p>
              {f.sourceExcerpt ? <blockquote className="mt-2 border-l-2 border-ink pl-3 text-sm italic leading-relaxed text-ink">“{f.sourceExcerpt}”</blockquote> : null}
              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-muted">
                <CitationChip label={d ? `${d.title}${f.sourcePage ? `, p.${f.sourcePage}` : ""}` : f.sourceLabel ?? (f.sourceUrl ? "Website" : "You")} sourceTitle={d?.title ?? f.sourceLabel ?? undefined} url={f.sourceUrl} excerpt={f.sourceExcerpt} page={f.sourcePage} verifiedAt={f.lastConfirmedAt} />
                {f.status !== "confirmed" ? <Badge variant="warning">{f.status === "stale" ? "Over a year old" : "Check this"}</Badge> : <span>Confirmed {formatDate(f.lastConfirmedAt)}</span>}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
