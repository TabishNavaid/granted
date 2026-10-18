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
import { SealedLetter, LanternGlyph } from "@/components/brand/illustrations";
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

/** The real Inbox, real components, demo data. */
export function HeroInbox({ compact = false }: { compact?: boolean }) {
  const { toast } = useToast();
  const [plan, setPlan] = React.useState(seed.monthlyPlan);
  const [gone, setGone] = React.useState<string[]>([]);
  const demoOnly = () => toast({ title: "This one's just the demo", description: "Make your own workspace and every approval is the real thing.", tone: "info" });
  return (
    <div className="flex flex-col gap-5">
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

/* ---------- step 1: a match arrives ---------- */

export function MatchArrivesDemo() {
  const step = useLoop(4, 900);
  const m = demoCtx.matches.match_meridian;
  const reasons = ["Funded you in 2024 and asks past grantees to reapply.", "Ages 10 to 18 in southwest Ohio: that is all three of your programs.", "Their usual award sits right inside your usual ask."];
  return (
    <DemoFrame label="Discovery agent · Monday, 6:02 am">
      <div className={cn("rounded-xl border border-border bg-surface-raised p-4 shadow-sm transition-all duration-500", step >= 1 ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0")}>
        <div className="flex items-start gap-3">
          <FitScore score={step >= 2 ? m.fitScore : 0} size="md" showLabel={false} />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <Badge variant="accent">New</Badge>
              <span className="text-xs text-fg-subtle">Due {formatShortDate(m.opportunity.deadline!)}</span>
            </div>
            <p className="mt-1 font-display text-lg leading-snug text-fg">{m.opportunity.title}</p>
            <p className="text-sm text-fg-muted">{m.funder.name} · $10K to $50K</p>
          </div>
        </div>
        <ul className="mt-3 flex flex-col gap-1.5 text-sm text-fg-muted">
          {reasons.map((r, i) => (
            <li key={r} className={cn("flex gap-2 transition-all duration-400", step >= 3 ? "translate-x-0 opacity-100" : "-translate-x-1 opacity-0")} style={{ transitionDelay: `${i * 160}ms` }}>
              <Check className="mt-1 size-3.5 shrink-0 text-success" aria-hidden /> {r}
            </li>
          ))}
        </ul>
        <p className={cn("mt-3 text-xs text-fg-subtle transition-opacity duration-500", step >= 4 ? "opacity-100" : "opacity-0")}>We checked meridianfamilyfdn.org this morning. Still open.</p>
      </div>
    </DemoFrame>
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

export function DraftFillsDemo() {
  const step = useLoop(draftLine.length, 650, 2600);
  return (
    <DemoFrame label="Proposal agent · Statement of need">
      <div className="rounded-xl border border-border bg-surface-raised p-5 shadow-sm">
        <p className="font-display text-[1.05rem] leading-relaxed text-fg">
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
        <p className="mt-3 text-xs text-fg-subtle">Every claim carries a receipt. The one we couldn't find became a question for you.</p>
      </div>
    </DemoFrame>
  );
}

/* ---------- step 3: approve seals ---------- */

export function ApproveSealsDemo() {
  const step = useLoop(3, 1100, 2200);
  return (
    <DemoFrame label="Your Inbox · Thursday, lunch">
      <div className="relative min-h-[11rem]">
        <div className={cn("rounded-xl border border-border bg-surface-raised p-4 shadow-sm transition-all duration-700", step >= 2 && "scale-95 opacity-0")} style={{ transformOrigin: "center" }}>
          <p className="text-xs text-fg-subtle">Outreach agent · 2 sources</p>
          <p className="mt-1 font-display text-lg leading-snug text-fg">Thank-you note to Hollis &amp; Marsh</p>
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
          <p className="text-sm font-semibold text-fg">Sealed and filed</p>
          <p className="text-xs text-fg-subtle">Copy it into your email whenever you're ready.</p>
        </div>
      </div>
    </DemoFrame>
  );
}

/* ---------- feature: sources ---------- */

export function SourcesDemo() {
  const step = useLoop(2, 1400, 3000);
  return (
    <DemoFrame label="Proposal workspace">
      <div className="relative rounded-xl border border-border bg-surface-raised p-5 shadow-sm">
        <p className="font-display text-[1.05rem] leading-relaxed text-fg">
          In 2025 we served <span className={cn("cite-chip", step >= 1 && "!border-info")}>214 students</span> across three programs, up from 181 the year before.
        </p>
        <div className={cn("mt-3 rounded-lg border border-border bg-surface p-3 text-sm shadow-md transition-all duration-400", step >= 1 ? "translate-y-0 opacity-100" : "-translate-y-1 opacity-0")}>
          <p className="flex items-center gap-1.5 text-xs font-semibold text-fg-subtle">
            <FileText className="size-3.5" aria-hidden /> 2025 Annual Report, page 4
          </p>
          <blockquote className="mt-1.5 border-l-2 border-info pl-3 font-display text-[0.95rem] leading-relaxed text-fg">“In 2025 we served 214 young people across our three programs, up from 181 the year before.”</blockquote>
          <p className={cn("mt-2 text-xs text-success transition-opacity", step >= 2 ? "opacity-100" : "opacity-0")}>Confirmed by you on Sep 3. Still true.</p>
        </div>
      </div>
    </DemoFrame>
  );
}

/* ---------- feature: questions ---------- */

export function QuestionsDemo() {
  const answer = "31 students";
  const step = useLoop(answer.length + 2, 90, 2800);
  const typed = answer.slice(0, Math.min(step, answer.length));
  const saved = step > answer.length;
  return (
    <DemoFrame label="Questions panel · 1 of 4">
      <div className="rounded-xl border border-border bg-surface-raised p-4 shadow-sm">
        <p className="text-xs text-fg-subtle">Statement of need</p>
        <p className="mt-1 text-sm font-semibold text-fg">How many students are on the Belmont waitlist right now?</p>
        <p className="mt-1 text-xs text-fg-subtle">The 2025 report doesn't say, and we won't guess.</p>
        {saved ? (
          <p className="mt-3 flex items-center gap-2 rounded-lg bg-success-soft px-3 py-2 text-sm text-success-soft-fg animate-fade-in">
            <Check className="size-4" aria-hidden /> Saved. The draft now cites you as the source.
          </p>
        ) : (
          <div className="mt-3 flex gap-2">
            <div className="flex h-9 flex-1 items-center rounded-md border border-border-input bg-surface px-3 text-sm text-fg">
              {typed || <span className="text-fg-subtle">Your answer</span>}
              <span className="ml-0.5 h-4 w-0.5 animate-pulse bg-accent" aria-hidden />
            </div>
            <span className={cn("inline-flex h-9 items-center rounded-full bg-accent px-4 text-sm font-semibold text-accent-fg", step === answer.length && "scale-95")}>Save</span>
          </div>
        )}
      </div>
    </DemoFrame>
  );
}

/* ---------- feature: calendar ---------- */

export function CalendarDemo() {
  const step = useLoop(5, 500, 2600);
  const days = Array.from({ length: 35 }, (_, i) => i - 6); // Nov 2026 starts on a Sunday; offset for a 5-week view
  const marks: Record<number, { label: string; cls: string; order: number }> = {
    20: { label: "Deadline", cls: "bg-danger text-danger-fg", order: 1 },
    18: { label: "Submit", cls: "bg-success text-white", order: 2 },
    13: { label: "Board", cls: "bg-info text-white", order: 3 },
    10: { label: "Budget", cls: "bg-warning text-white", order: 4 },
    6: { label: "Draft", cls: "bg-accent text-accent-fg", order: 5 },
  };
  return (
    <DemoFrame label="Calendar agent · November">
      <div className="rounded-xl border border-border bg-surface-raised p-4 shadow-sm">
        <div className="grid grid-cols-7 gap-1 text-center text-2xs font-semibold uppercase text-fg-subtle">
          {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
            <span key={i}>{d}</span>
          ))}
        </div>
        <div className="mt-1 grid grid-cols-7 gap-1">
          {days.map((d, i) => {
            const mark = marks[d];
            const show = mark && step >= mark.order;
            return (
              <div key={i} className={cn("flex h-9 flex-col items-center justify-center rounded-md text-xs tnum", d < 1 || d > 30 ? "text-fg-subtle/40" : "text-fg", show && mark.cls, show && "animate-rise-in font-semibold")}>
                {d >= 1 && d <= 30 ? d : ""}
                {show ? <span className="text-[9px] leading-none">{mark.label}</span> : null}
              </div>
            );
          })}
        </div>
        <p className="mt-3 text-xs text-fg-subtle">Due Friday, 5pm Eastern. Of course it is. So we put the draft on the Friday before.</p>
      </div>
    </DemoFrame>
  );
}

/* ---------- feature: introductions ---------- */

export function IntroDemo() {
  const step = useLoop(2, 1200, 3000);
  return (
    <DemoFrame label="Connections · coming with Growth">
      <div className="rounded-xl border border-border bg-surface-raised p-4 shadow-sm">
        <div className="flex items-center gap-3">
          <span className="inline-flex size-9 items-center justify-center rounded-full bg-night text-sm font-semibold text-night-fg" aria-hidden>MB</span>
          <div className="text-sm">
            <p className="font-semibold text-fg">Marcus Bell, your board chair</p>
            <p className="text-fg-muted">served on a panel with Elaine Marsh-Whitfield at Meridian in 2024.</p>
          </div>
        </div>
        <div className={cn("mt-3 rounded-lg border border-dashed border-glow bg-glow-soft p-3 text-sm text-glow-fg transition-all duration-500", step >= 1 ? "opacity-100" : "opacity-0")}>
          <p className="font-semibold">Intro email for Marcus to send</p>
          <p className="mt-1 text-xs opacity-90">“Elaine, I wanted you to meet Dana before the Youth Development round closes...”</p>
        </div>
        <p className={cn("mt-2 text-xs text-fg-subtle transition-opacity", step >= 2 ? "opacity-100" : "opacity-0")}>Public sources only. Marcus sends it, or nobody does.</p>
      </div>
    </DemoFrame>
  );
}

/* ---------- frame ---------- */

function DemoFrame({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <figure className="wash-paper relative rounded-2xl border border-border p-4 sm:p-5">
      <figcaption className="mb-3 flex items-center gap-2 text-xs font-semibold text-fg-subtle">
        <LanternGlyph size={16} glow={false} className="text-fg-subtle" />
        {label}
      </figcaption>
      {children}
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
