"use client";

import * as React from "react";
import { Sparkles } from "lucide-react";
import type { EmailDraft, InboxItem, MonthlyPlan, PlanItem } from "@/lib/types";
import { services } from "@/lib/services";
import { useToast } from "@/components/ui/toast";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { PageContainer } from "@/components/app/page-header";
import { CompactInboxRow, InboxItemCard, type InboxContext, type Leaving } from "@/components/app/inbox-item";
import { PlanCard } from "@/components/app/plan-card";
import { LanternMark } from "@/components/app/logo";
import { LanternGlyph, SealedLetter } from "@/components/brand/illustrations";
import { cn } from "@/lib/utils";

type Filter = "all" | "proposal" | "email" | "matches" | "schedule" | "profile";
const filters: { value: Filter; label: string; types: InboxItem["type"][] }[] = [
  { value: "all", label: "All", types: [] },
  { value: "proposal", label: "Proposals", types: ["proposal_draft", "missing_facts"] },
  { value: "email", label: "Emails", types: ["email_draft"] },
  { value: "matches", label: "Matches", types: ["new_matches"] },
  { value: "schedule", label: "Schedule", types: ["milestones"] },
  { value: "profile", label: "Profile", types: ["profile_update"] },
];

const decideTypes: InboxItem["type"][] = ["proposal_draft", "email_draft"];
const answerTypes: InboxItem["type"][] = ["missing_facts"];

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}

interface Props {
  items: InboxItem[];
  plan: MonthlyPlan | null;
  planItemId: string | null;
  ctx: InboxContext;
  firstName: string;
}

export function InboxView({ items: initial, plan: initialPlan, planItemId, ctx, firstName }: Props) {
  const { toast } = useToast();
  const [items, setItems] = React.useState(initial);
  const [plan, setPlan] = React.useState(initialPlan);
  const [leaving, setLeaving] = React.useState<Record<string, Leaving>>({});
  const [filter, setFilter] = React.useState<Filter>("all");
  const [showResolved, setShowResolved] = React.useState(false);
  const liveRef = React.useRef<HTMLDivElement>(null);

  const announce = (msg: string) => {
    if (liveRef.current) liveRef.current.textContent = msg;
  };

  const pending = items.filter((i) => i.status === "pending" && i.type !== "monthly_plan");
  const resolved = items.filter((i) => i.status !== "pending").sort((a, b) => (b.resolvedAt ?? "").localeCompare(a.resolvedAt ?? ""));
  const active = filters.find((f) => f.value === filter)!;
  const visible = filter === "all" ? pending : pending.filter((i) => active.types.includes(i.type));
  const counts = Object.fromEntries(filters.map((f) => [f.value, f.value === "all" ? pending.length : pending.filter((i) => f.types.includes(i.type)).length]));
  const decide = pending.filter((i) => decideTypes.includes(i.type));
  const answer = pending.filter((i) => answerTypes.includes(i.type));
  const glance = pending.filter((i) => !decideTypes.includes(i.type) && !answerTypes.includes(i.type));

  const update = (next: InboxItem) => setItems((list) => list.map((i) => (i.id === next.id ? next : i)));

  const withLeave = (id: string, how: Leaving, after: () => void) => {
    setLeaving((s) => ({ ...s, [id]: how }));
    setTimeout(
      () => {
        after();
        setLeaving((s) => {
          const n = { ...s };
          delete n[id];
          return n;
        });
      },
      how === "seal" ? 950 : 500,
    );
  };

  const undo = async (id: string) => {
    const restored = await services.inbox.restore(id);
    update(restored);
    announce("Back in your Inbox.");
  };

  const approve = async (item: InboxItem, extra?: { answers?: Record<string, string>; email?: Pick<EmailDraft, "subject" | "body"> }) => {
    if (item.payload.type === "missing_facts" && extra?.answers) {
      for (const [id, a] of Object.entries(extra.answers)) {
        if (a.trim()) await services.applications.answerMissingFact(id, a.trim());
      }
    }
    if (item.payload.type === "email_draft" && extra?.email) {
      await services.inbox.updateEmailDraft(item.payload.emailDraftId, extra.email);
    }
    const next = await services.inbox.approve(item.id);
    withLeave(item.id, "seal", () => update(next));
    announce(`Sealed: ${item.title}`);
    toast({ title: approvedTitle(item), description: approvedDescription(item), action: { label: "Undo", onClick: () => undo(item.id) } });
  };

  const reject = async (item: InboxItem, reason: string | null) => {
    const next = await services.inbox.reject(item.id, reason);
    withLeave(item.id, "dismiss", () => update(next));
    announce(`Declined: ${item.title}`);
    toast({ title: "Declined", description: "The agents remember why.", tone: "info", action: { label: "Undo", onClick: () => undo(item.id) } });
  };

  const planDecision = async (opportunityId: string, decision: PlanItem["decision"]) => {
    if (!plan) return;
    setPlan(await services.inbox.setPlanDecision(plan.id, opportunityId, decision));
  };
  const approvePlan = async () => {
    if (!planItemId) return;
    const next = await services.inbox.approve(planItemId);
    withLeave(planItemId, "seal", () => {
      update(next);
      setPlan(null);
    });
    announce("Plan sealed.");
    toast({
      title: "Plan sealed",
      description: "The agents start on the kept applications. Drafts land here.",
      action: {
        label: "Undo",
        onClick: async () => {
          await undo(planItemId);
          setPlan(initialPlan);
        },
      },
    });
  };
  const skipPlan = async () => {
    if (!planItemId) return;
    const next = await services.inbox.reject(planItemId, "Skipped this month");
    withLeave(planItemId, "dismiss", () => {
      update(next);
      setPlan(null);
    });
    toast({
      title: "Plan skipped",
      description: "A new one arrives on the 1st.",
      tone: "info",
      action: {
        label: "Undo",
        onClick: async () => {
          await undo(planItemId);
          setPlan(initialPlan);
        },
      },
    });
  };

  const totalPending = pending.length + (plan ? 1 : 0);
  const summary =
    totalPending === 0
      ? "Nothing waiting on you. The lantern is out, in a good way."
      : [plan ? "your plan for the month" : null, decide.length ? `${decide.length} to read and approve` : null, answer.length ? `${answer.length} with quick questions` : null, glance.length ? `${glance.length} to glance at` : null]
          .filter(Boolean)
          .join(", ")
          .replace(/, ([^,]*)$/, " and $1") + ".";

  return (
    <PageContainer>
      <div ref={liveRef} aria-live="polite" className="sr-only" />
      <header className="mb-8 flex items-start justify-between gap-6">
        <div>
          <p className="text-sm font-semibold text-fg-subtle">{new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}</p>
          <h1 className="mt-1 font-display text-3xl text-fg sm:text-4xl">
            {greeting()}, {firstName}.
          </h1>
          <p className="mt-2 max-w-xl text-base text-fg-muted">
            {totalPending === 0 ? summary : `Waiting on you: ${summary}`}
          </p>
        </div>
        <LanternGlyph size={64} lit={totalPending > 0} className="hidden shrink-0 text-fg-muted sm:block" />
      </header>

      {plan && planItemId ? (
        <div className="mb-10">
          <PlanCard plan={plan} matches={ctx.matches} onDecision={planDecision} onApprove={approvePlan} onSkip={skipPlan} leaving={!!leaving[planItemId]} />
        </div>
      ) : null}

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 font-display text-2xl text-fg">
          <LanternMark className="size-5 text-glow-text" /> Waiting for you
        </h2>
        <Tabs value={filter} onValueChange={(v) => setFilter(v as Filter)}>
          <TabsList variant="pill" aria-label="Filter inbox">
            {filters.map((f) => (
              <TabsTrigger key={f.value} value={f.value}>
                {f.label}
                {counts[f.value] > 0 ? <span className="text-xs text-fg-subtle tnum">{counts[f.value]}</span> : null}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>

      {visible.length === 0 ? (
        <EmptyState
          title={filter === "all" ? "You are all caught up" : `No ${active.label.toLowerCase()} waiting`}
          description={
            filter === "all"
              ? "New drafts, matches, and schedules land here as the agents finish them. Nothing is sent or submitted without you. Go outside."
              : "Try another filter, or check back after the next agent run."
          }
          action={
            filter !== "all" ? (
              <Button variant="secondary" onClick={() => setFilter("all")}>
                Show everything
              </Button>
            ) : undefined
          }
        />
      ) : filter !== "all" ? (
        <ul className="flex flex-col gap-4">
          {visible.map((item) => (
            <li key={item.id}>
              <InboxItemCard item={item} ctx={ctx} leaving={leaving[item.id]} onApprove={approve} onReject={reject} />
            </li>
          ))}
        </ul>
      ) : (
        <div className="flex flex-col gap-10">
          {decide.length ? (
            <Group title="Read and approve" hint="The agents wrote these. Take a few minutes with each.">
              {decide.map((item) => (
                <li key={item.id}>
                  <InboxItemCard item={item} ctx={ctx} leaving={leaving[item.id]} onApprove={approve} onReject={reject} />
                </li>
              ))}
            </Group>
          ) : null}
          {answer.length ? (
            <Group title="Quick answers" hint="Facts the drafts could not find. A minute each.">
              {answer.map((item) => (
                <li key={item.id}>
                  <InboxItemCard item={item} ctx={ctx} leaving={leaving[item.id]} onApprove={approve} onReject={reject} />
                </li>
              ))}
            </Group>
          ) : null}
          {glance.length ? (
            <Group title="At a glance" hint="Approve from the row, or open one to see more." compact>
              {glance.map((item) => (
                <li key={item.id}>
                  <CompactInboxRow item={item} ctx={ctx} leaving={leaving[item.id]} onApprove={approve} onReject={reject} />
                </li>
              ))}
            </Group>
          ) : null}
        </div>
      )}

      <section aria-labelledby="resolved-title" className="mt-14">
        <div className="flex items-center justify-between gap-3">
          <h2 id="resolved-title" className="flex items-center gap-2 font-display text-xl text-fg-muted">
            <SealedLetter size={26} className="text-fg-subtle" /> Sealed and filed
            <span className="text-sm text-fg-subtle tnum">{resolved.length}</span>
          </h2>
          <Button variant="ghost" size="sm" onClick={() => setShowResolved((s) => !s)} aria-expanded={showResolved}>
            {showResolved ? "Hide" : "Show"}
          </Button>
        </div>
        {showResolved ? (
          resolved.length === 0 ? (
            <p className="mt-4 text-sm text-fg-subtle">Nothing sealed yet.</p>
          ) : (
            <ul className="mt-4 flex flex-col gap-2">
              {resolved.map((item) => (
                <li key={item.id}>
                  <CompactInboxRow item={item} ctx={ctx} onApprove={approve} onReject={reject} />
                </li>
              ))}
            </ul>
          )
        ) : (
          <p className="mt-2 flex items-center gap-1.5 text-sm text-fg-subtle">
            <Sparkles className="size-3.5" aria-hidden />
            Everything you approved or declined stays here, with the time and your name.
          </p>
        )}
      </section>
    </PageContainer>
  );
}

function Group({ title, hint, compact, children }: { title: string; hint: string; compact?: boolean; children: React.ReactNode }) {
  const id = title.toLowerCase().replace(/\s+/g, "-");
  return (
    <section aria-labelledby={id}>
      <div className="mb-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h3 id={id} className="text-sm font-bold uppercase tracking-wider text-fg-subtle">
          {title}
        </h3>
        <p className="text-sm text-fg-subtle">{hint}</p>
      </div>
      <ul className={cn("flex flex-col", compact ? "gap-2" : "gap-4")}>{children}</ul>
    </section>
  );
}

function approvedTitle(item: InboxItem) {
  switch (item.type) {
    case "proposal_draft":
      return "Draft sealed";
    case "email_draft":
      return "Email sealed";
    case "new_matches":
      return "Matches saved";
    case "milestones":
      return "On your calendar";
    case "missing_facts":
      return "Answers saved";
    case "profile_update":
      return "Fact updated";
    default:
      return "Sealed";
  }
}
function approvedDescription(item: InboxItem) {
  switch (item.type) {
    case "proposal_draft":
      return "Moved to Review on your pipeline.";
    case "email_draft":
      return "Copy it into your email and send when you are ready.";
    case "missing_facts":
      return "The draft now cites you as the source.";
    case "profile_update":
      return "Every draft from now on uses the new number.";
    case "milestones":
      return "Reminders go out before each one.";
    default:
      return item.title;
  }
}
