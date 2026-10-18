"use client";

import * as React from "react";
import { Check, FileText, X } from "lucide-react";
import * as seed from "@/lib/mock/data";
import type { InboxItem, MatchView } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useLoop } from "@/lib/use-reduced-motion";
import { useToast } from "@/components/ui/toast";
import { Badge } from "@/components/ui/badge";
import { FitScore } from "@/components/app/fit-score";
import { InboxItemCard, type InboxContext } from "@/components/app/inbox-item";
import { PlanCard } from "@/components/app/plan-card";
import { LanternMark } from "@/components/app/logo";
import { SealedLetter } from "@/components/brand/illustrations";
import { formatShortDate } from "@/lib/format";

/* ---------- demo data, with personality ---------- */

function buildMatches(): Record<string, MatchView> {
  const out: Record<string, MatchView> = {};
  for (const m of seed.matches) {
    const opportunity = seed.opportunities.find((o) => o.id === m.opportunityId)!;
    const funder = seed.funders.find((f) => f.id === opportunity.funderId)!;
    out[m.id] = { ...m, opportunity, funder };
  }
  return out;
}

const demoCtx: InboxContext = {
  matches: buildMatches(),
  emails: Object.fromEntries(seed.emailDrafts.map((e) => [e.id, e])),
  milestones: Object.fromEntries(seed.milestones.map((m) => [m.id, m])),
  missingFacts: Object.fromEntries(seed.missingFacts.map((m) => [m.id, m])),
  facts: Object.fromEntries(seed.facts.map((f) => [f.id, f])),
  documents: Object.fromEntries(seed.documents.map((d) => [d.id, d])),
  funderNames: Object.fromEntries(seed.funders.map((f) => [f.id, f.name])),
  applicationTitles: {},
};

const heroItems: InboxItem[] = [
  seed.inboxItems.find((i) => i.id === "inbox_meridian_draft")!,
  seed.inboxItems.find((i) => i.id === "inbox_email_brightwater")!,
];

/** The real Inbox: real components, demo data, floating straight on the painting. */
export function HeroInbox({ compact = false }: { compact?: boolean }) {
  const { toast } = useToast();
  const [plan, setPlan] = React.useState(seed.monthlyPlan);
  const [gone, setGone] = React.useState<string[]>([]);
  const demoOnly = () => toast({ title: "This one's just the demo", description: "Make your own workspace and every approval is the real thing.", tone: "info" });
  return (
    <div className="flex flex-col gap-5 text-fg">
      <PlanCard
        plan={plan}
        matches={demoCtx.matches}
        onDecision={(id, d) => setPlan((p) => ({ ...p, items: p.items.map((i) => (i.opportunityId === id ? { ...i, decision: d } : i)) }))}
        onApprove={demoOnly}
        onSkip={demoOnly}
      />
      <div className={compact ? "hidden" : "hidden flex-col gap-5 sm:flex"}>
        {heroItems
          .filter((i) => !gone.includes(i.id))
          .map((item) => (
            <InboxItemCard
              key={item.id}
              item={item}
              ctx={demoCtx}
              onApprove={() => {
                setGone((g) => [...g, item.id]);
                toast({ title: "Sealed and filed", description: "In your own workspace, this moves the draft to Review.", action: { label: "Undo", onClick: () => setGone((g) => g.filter((x) => x !== item.id)) } });
              }}
              onReject={() => {
                setGone((g) => [...g, item.id]);
                toast({ title: "Declined", description: "We'll remember why, so you don't see it again.", tone: "info", action: { label: "Undo", onClick: () => setGone((g) => g.filter((x) => x !== item.id)) } });
              }}
            />
          ))}
      </div>
    </div>
  );
}

/* ---------- a product shot: one frame, no cards inside ---------- */

function Shot({ label, children, className, bodyClassName }: { label: string; children: React.ReactNode; className?: string; bodyClassName?: string }) {
  return (
    <figure className={cn("overflow-hidden rounded-2xl border border-border bg-surface-raised text-fg shadow-lg", className)}>
      <figcaption className="flex items-center justify-between gap-3 border-b border-border bg-surface px-4 py-2.5 text-xs font-semibold text-fg-subtle">
        <span className="inline-flex items-center gap-2">
          <LanternMark className="size-3.5 text-glow-text" /> {label}
        </span>
        <LiveDot />
      </figcaption>
      <div className={cn("p-4 sm:p-5", bodyClassName)}>{children}</div>
    </figure>
  );
}

export function LiveDot() {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-fg-subtle">
      <span className="relative flex size-2">
        <span className="absolute inline-flex size-full animate-ping rounded-full bg-success opacity-60" />
        <span className="relative inline-flex size-2 rounded-full bg-success" />
      </span>
      Live demo
    </span>
  );
}

/* ---------- step 1: a match arrives ---------- */

export function MatchArrivesDemo() {
  const step = useLoop(4, 900);
  const m = demoCtx.matches.match_meridian;
  const reasons = ["Funded you in 2024 and asks past grantees to reapply.", "Ages 10 to 18 in southwest Ohio: that is all three of your programs.", "Their usual award sits right inside your usual ask."];
  const others = [demoCtx.matches.match_mvct, demoCtx.matches.match_brightwater];
  return (
    <Shot label="Opportunities · Monday, 6:02 am" bodyClassName="p-0">
      <div className="flex items-center justify-between gap-3 px-4 py-3 sm:px-5">
        <p className="font-display text-xl">Opportunities</p>
        <div className="flex gap-1 rounded-full bg-surface-sunken p-0.5 text-xs font-semibold">
          <span className="rounded-full bg-surface-raised px-2.5 py-1 shadow-xs">All 9</span>
          <span className="px-2.5 py-1 text-fg-subtle">New 3</span>
          <span className="hidden px-2.5 py-1 text-fg-subtle sm:inline">In pipeline</span>
        </div>
      </div>
      <ul className="divide-y divide-border border-t border-border">
        <li className={cn("overflow-hidden transition-all duration-500", step >= 1 ? "max-h-[22rem] opacity-100" : "max-h-0 opacity-0")}>
          <div className="flex items-start gap-4 bg-glow-soft/40 px-4 py-4 sm:px-5">
            <FitScore score={step >= 2 ? m.fitScore : 0} size="md" showLabel={false} />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="accent">New</Badge>
                <span className="text-xs text-fg-subtle">Due {formatShortDate(m.opportunity.deadline!)} · $10K to $50K</span>
              </div>
              <p className="mt-1 font-display text-lg leading-snug">{m.opportunity.title}</p>
              <p className="text-sm text-fg-muted">{m.funder.name}</p>
              <ul className="mt-2.5 flex flex-col gap-1 text-sm text-fg-muted">
                {reasons.map((r, i) => (
                  <li key={r} className={cn("flex gap-2 transition-all duration-400", step >= 3 ? "translate-x-0 opacity-100" : "-translate-x-1 opacity-0")} style={{ transitionDelay: `${i * 160}ms` }}>
                    <Check className="mt-1 size-3.5 shrink-0 text-success" aria-hidden /> {r}
                  </li>
                ))}
              </ul>
              <p className={cn("mt-2 text-xs text-fg-subtle transition-opacity duration-500", step >= 4 ? "opacity-100" : "opacity-0")}>We checked meridianfamilyfdn.org this morning. Still open.</p>
            </div>
          </div>
        </li>
        {others.map((o) => (
          <li key={o.id} className="flex items-center gap-4 px-4 py-3 sm:px-5">
            <FitScore score={o.fitScore} size="sm" showLabel={false} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{o.opportunity.title}</p>
              <p className="truncate text-xs text-fg-subtle">
                {o.funder.name} · Due {formatShortDate(o.opportunity.deadline!)}
              </p>
            </div>
            <Badge variant="info" className="hidden sm:inline-flex">In pipeline</Badge>
          </li>
        ))}
      </ul>
    </Shot>
  );
}

/* ---------- step 2: the draft fills ---------- */

const draftLine = [
  { t: "Among seniors enrolled in After-School Studio, " },
  { t: "94% graduated on time", chip: "Annual report, p.6" },
  { t: " against a district rate of " },
  { t: "81%", chip: "Annual report, p.6" },
  { t: ". Demand is now ahead of capacity: " },
  { gap: "waitlist size" },
  { t: " students are waiting at Belmont." },
];
const sections = [
  ["Organization background", "Drafted"],
  ["Statement of need", "Writing"],
  ["Program description", "Next"],
  ["Goals and outcomes", "Next"],
  ["Budget narrative", "Next"],
];

export function DraftFillsDemo() {
  const step = useLoop(draftLine.length, 650, 2600);
  const words = 180 + step * 7;
  return (
    <Shot label="Proposal workspace · Meridian Family Foundation" bodyClassName="p-0">
      <div className="grid sm:grid-cols-[11rem_1fr]">
        <ol className="hidden border-r border-border bg-surface py-3 text-xs sm:block">
          {sections.map(([t, s], i) => (
            <li key={t} className={cn("flex items-center gap-2 px-4 py-1.5", i === 1 && "bg-surface-raised font-semibold")}>
              <span className={cn("size-1.5 rounded-full", s === "Drafted" ? "bg-success" : s === "Writing" ? "bg-glow animate-pulse" : "bg-border-strong")} aria-hidden />
              <span className="truncate">{t}</span>
            </li>
          ))}
        </ol>
        <div className="px-5 py-5 sm:px-7">
          <p className="text-xs font-semibold text-fg-subtle">Statement of need</p>
          <p className="mt-2 font-display text-[1.05rem] leading-relaxed">
            {draftLine.slice(0, step).map((seg, i) =>
              "gap" in seg ? (
                <span key={i} className="gap-chip animate-fade-in">Need: {seg.gap}</span>
              ) : seg.chip ? (
                <span key={i} className="animate-fade-in">
                  {seg.t}
                  <span className="cite-chip">{seg.chip}</span>
                </span>
              ) : (
                <span key={i} className="animate-fade-in">{seg.t}</span>
              ),
            )}
            {step < draftLine.length ? <span className="ml-0.5 inline-block h-[1em] w-0.5 translate-y-0.5 animate-pulse bg-accent" aria-hidden /> : null}
          </p>
          <div className="mt-5 flex items-center gap-3 border-t border-border pt-3 text-xs text-fg-subtle">
            <span className="h-1.5 w-24 overflow-hidden rounded-full bg-surface-sunken">
              <span className="block h-full rounded-full bg-accent transition-all" style={{ width: `${(words / 500) * 100}%` }} />
            </span>
            <span className="tnum">{words} / 500 words</span>
            <span className="ml-auto hidden sm:inline">Every claim carries a receipt.</span>
          </div>
        </div>
      </div>
    </Shot>
  );
}

/* ---------- step 3: approve seals ---------- */

export function ApproveSealsDemo() {
  const step = useLoop(3, 1100, 2200);
  return (
    <Shot label="Your Inbox · Thursday, lunch" bodyClassName="p-0">
      <p className="px-5 pt-4 text-xs font-bold uppercase tracking-wider text-fg-subtle">Read and approve</p>
      <div className="relative min-h-[12rem] px-5 pb-4 pt-3">
        <div className={cn("transition-all duration-700", step >= 2 && "scale-95 opacity-0")}>
          <p className="text-xs text-fg-subtle">Outreach agent · 2 sources</p>
          <p className="mt-1 font-display text-lg leading-snug">Thank-you note to Hollis &amp; Marsh</p>
          <p className="mt-1 text-sm text-fg-muted">Short and warm, and it remembers the January update they asked for.</p>
          <div className="mt-4 flex items-center gap-2">
            <span className={cn("inline-flex h-9 items-center gap-2 rounded-full bg-accent px-4 text-sm font-semibold text-accent-fg transition-transform", step === 1 && "scale-95 brightness-95")}>
              <Check className="size-4" aria-hidden /> Approve email
            </span>
            <span className="inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-sm font-semibold text-fg-muted">
              <X className="size-4" aria-hidden /> Decline
            </span>
          </div>
        </div>
        <div className={cn("absolute inset-0 flex flex-col items-center justify-center gap-2 transition-all duration-500", step >= 2 ? "scale-100 opacity-100" : "scale-75 opacity-0")}>
          <SealedLetter size={96} className="text-fg" />
          <p className="text-sm font-semibold">Sealed and filed</p>
          <p className="text-xs text-fg-subtle">Copy it into your email whenever you&apos;re ready.</p>
        </div>
      </div>
      <ul className="divide-y divide-border border-t border-border text-sm">
        <li className="flex items-center gap-3 px-5 py-2.5">
          <span className="min-w-0 flex-1 truncate font-semibold">Four quick questions for the Meridian proposal</span>
          <span className="text-xs text-fg-subtle">Quick answers</span>
        </li>
        <li className="flex items-center gap-3 px-5 py-2.5">
          <span className="min-w-0 flex-1 truncate font-semibold">Three new matches this week</span>
          <span className="text-xs text-fg-subtle">At a glance</span>
        </li>
      </ul>
    </Shot>
  );
}

/* ---------- feature: sources ---------- */

export function SourcesDemo() {
  const step = useLoop(2, 1400, 3000);
  return (
    <Shot label="Proposal workspace · Organization background">
      <p className="font-display text-[1.05rem] leading-relaxed">
        In 2025 we served <span className={cn("cite-chip", step >= 1 && "!border-info")}>214 students</span> across three programs, up from 181 the year before. Four full-time staff <span className="cite-chip">Form 990, p.1</span> and 23 trained volunteers <span className="cite-chip">Annual report, p.12</span> live in the neighborhoods we serve.
      </p>
      <div className={cn("relative mt-3 rounded-lg bg-surface p-3 text-sm shadow-md ring-1 ring-border transition-all duration-400", step >= 1 ? "translate-y-0 opacity-100" : "-translate-y-1 opacity-0")}>
        <p className="flex items-center gap-1.5 text-xs font-semibold text-fg-subtle">
          <FileText className="size-3.5" aria-hidden /> 2025 Annual Report, page 4
        </p>
        <blockquote className="mt-1.5 border-l-2 border-info pl-3 font-display text-[0.95rem] leading-relaxed">“In 2025 we served 214 young people across our three programs, up from 181 the year before.”</blockquote>
        <p className={cn("mt-2 text-xs text-success transition-opacity", step >= 2 ? "opacity-100" : "opacity-0")}>Confirmed by you on Sep 3. Still true.</p>
      </div>
    </Shot>
  );
}

/* ---------- feature: questions ---------- */

export function QuestionsDemo() {
  const answer = "31 students";
  const step = useLoop(answer.length + 2, 90, 2800);
  const typed = answer.slice(0, Math.min(step, answer.length));
  const saved = step > answer.length;
  return (
    <Shot label="Questions panel" bodyClassName="p-0">
      <div className="flex gap-4 border-b border-border px-5 text-sm font-semibold">
        <span className="border-b-2 border-accent py-2.5">
          Questions <Badge variant="warning" className="ml-1 px-1.5 py-0">4</Badge>
        </span>
        <span className="py-2.5 text-fg-subtle">
          Checks <Badge variant="danger" className="ml-1 px-1.5 py-0">3</Badge>
        </span>
        <span className="py-2.5 text-fg-subtle">Sources</span>
      </div>
      <div className="px-5 py-4">
        <p className="text-xs text-fg-subtle">1 · Statement of need</p>
        <p className="mt-1 text-sm font-semibold">How many students are on the Belmont waitlist right now?</p>
        <p className="mt-1 text-xs text-fg-subtle">The 2025 report doesn&apos;t say, and we won&apos;t guess.</p>
        {saved ? (
          <p className="mt-3 flex items-center gap-2 rounded-lg bg-success-soft px-3 py-2 text-sm text-success-soft-fg animate-fade-in">
            <Check className="size-4" aria-hidden /> Saved. The draft now cites you as the source.
          </p>
        ) : (
          <div className="mt-3 flex gap-2">
            <div className="flex h-9 flex-1 items-center rounded-md border border-border-input bg-surface px-3 text-sm">
              {typed || <span className="text-fg-subtle">Your answer</span>}
              <span className="ml-0.5 h-4 w-0.5 animate-pulse bg-accent" aria-hidden />
            </div>
            <span className={cn("inline-flex h-9 items-center rounded-full bg-accent px-4 text-sm font-semibold text-accent-fg", step === answer.length && "scale-95")}>Save</span>
          </div>
        )}
      </div>
      <div className="border-t border-border px-5 py-4 opacity-70">
        <p className="text-xs text-fg-subtle">2 · Program description</p>
        <p className="mt-1 text-sm font-semibold">How many lead tutors will receive stipends from this grant?</p>
      </div>
    </Shot>
  );
}

/* ---------- feature: calendar ---------- */

export function CalendarDemo() {
  const step = useLoop(5, 500, 2600);
  const days = Array.from({ length: 35 }, (_, i) => i);
  const marks: Record<number, { label: string; cls: string; order: number }> = {
    20: { label: "Deadline", cls: "bg-danger text-danger-fg", order: 1 },
    18: { label: "Submit", cls: "bg-success text-white", order: 2 },
    13: { label: "Board", cls: "bg-info text-white", order: 3 },
    10: { label: "Budget", cls: "bg-warning text-white", order: 4 },
    6: { label: "Draft", cls: "bg-accent text-accent-fg", order: 5 },
  };
  return (
    <Shot label="Calendar · November 2026">
      <div className="grid grid-cols-7 gap-1 text-center text-2xs font-semibold uppercase text-fg-subtle">
        {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
          <span key={i}>{d}</span>
        ))}
      </div>
      <div className="mt-1 grid grid-cols-7 gap-1">
        {days.map((i) => {
          const d = i + 1;
          const mark = marks[d];
          const show = mark && step >= mark.order;
          return (
            <div key={i} className={cn("flex h-10 flex-col items-center justify-center rounded-md text-xs tnum", d > 30 ? "text-fg-subtle/40" : "text-fg", show && mark.cls, show && "animate-rise-in font-semibold")}>
              {d <= 30 ? d : ""}
              {show ? <span className="text-[9px] leading-none">{mark.label}</span> : null}
            </div>
          );
        })}
      </div>
      <p className="mt-3 text-xs text-fg-subtle">Due Friday, 5pm Eastern. Of course it is. So we put the draft on the Friday before.</p>
    </Shot>
  );
}

/* ---------- feature: introductions ---------- */

export function IntroDemo() {
  const step = useLoop(2, 1200, 3000);
  return (
    <Shot label="Connections · coming with Growth">
      <div className="flex items-center gap-3">
        <span className="inline-flex size-9 items-center justify-center rounded-full bg-night text-sm font-semibold text-night-fg" aria-hidden>MB</span>
        <div className="text-sm">
          <p className="font-semibold">Marcus Bell, your board chair</p>
          <p className="text-fg-muted">served on a panel with Elaine Marsh-Whitfield at Meridian in 2024.</p>
        </div>
      </div>
      <div className={cn("mt-4 border-l-2 border-glow pl-4 text-sm transition-all duration-500", step >= 1 ? "opacity-100" : "opacity-0")}>
        <p className="font-semibold">Intro email for Marcus to send</p>
        <p className="mt-1 font-display text-[0.95rem] text-fg-muted">“Elaine, I wanted you to meet Dana before the Youth Development round closes...”</p>
      </div>
      <p className={cn("mt-3 text-xs text-fg-subtle transition-opacity", step >= 2 ? "opacity-100" : "opacity-0")}>Public sources only. Marcus sends it, or nobody does.</p>
    </Shot>
  );
}
