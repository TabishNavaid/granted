"use client";

import * as React from "react";
import { Inbox as InboxIcon, Sparkles } from "lucide-react";
import type { EmailDraft, InboxItem, MonthlyPlan, PlanItem } from "@/lib/types";
import { services } from "@/lib/services";
import { useToast } from "@/components/ui/toast";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { PageContainer } from "@/components/app/page-header";
import { InboxItemCard, type InboxContext } from "@/components/app/inbox-item";
import { PlanCard } from "@/components/app/plan-card";

type Filter = "all" | "proposal" | "email" | "matches" | "schedule" | "profile";
const filters: { value: Filter; label: string; types: InboxItem["type"][] }[] = [
  { value: "all", label: "All", types: [] },
  { value: "proposal", label: "Proposals", types: ["proposal_draft", "missing_facts"] },
  { value: "email", label: "Emails", types: ["email_draft"] },
  { value: "matches", label: "Matches", types: ["new_matches"] },
  { value: "schedule", label: "Schedule", types: ["milestones"] },
  { value: "profile", label: "Profile", types: ["profile_update"] },
];

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
  const [leaving, setLeaving] = React.useState<Set<string>>(new Set());
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

  const update = (next: InboxItem) => setItems((list) => list.map((i) => (i.id === next.id ? next : i)));

  const withLeave = (id: string, after: () => void) => {
    setLeaving((s) => new Set(s).add(id));
    setTimeout(() => {
      after();
      setLeaving((s) => {
        const n = new Set(s);
        n.delete(id);
        return n;
      });
    }, 330);
  };

  const undo = async (id: string) => {
    const restored = await services.inbox.restore(id);
    update(restored);
    announce("Restored to your Inbox.");
  };

  const approve = async (item: InboxItem, extra?: { answers?: Record<string, string>; email?: Pick<EmailDraft, "subject" | "body"> }) => {
    if (item.payload.type === "missing_facts" && extra?.answers) {
      for (const [id, answer] of Object.entries(extra.answers)) {
        if (answer.trim()) await services.applications.answerMissingFact(id, answer.trim());
      }
    }
    if (item.payload.type === "email_draft" && extra?.email) {
      await services.inbox.updateEmailDraft(item.payload.emailDraftId, extra.email);
    }
    const next = await services.inbox.approve(item.id);
    withLeave(item.id, () => update(next));
    announce(`Approved: ${item.title}`);
    toast({ title: approvedTitle(item), description: approvedDescription(item), action: { label: "Undo", onClick: () => undo(item.id) } });
  };

  const reject = async (item: InboxItem, reason: string | null) => {
    const next = await services.inbox.reject(item.id, reason);
    withLeave(item.id, () => update(next));
    announce(`Declined: ${item.title}`);
    toast({ title: "Declined", description: item.title, tone: "info", action: { label: "Undo", onClick: () => undo(item.id) } });
  };

  const planDecision = async (opportunityId: string, decision: PlanItem["decision"]) => {
    if (!plan) return;
    setPlan(await services.inbox.setPlanDecision(plan.id, opportunityId, decision));
  };
  const approvePlan = async () => {
    if (!planItemId) return;
    const next = await services.inbox.approve(planItemId);
    withLeave(planItemId, () => {
      update(next);
      setPlan(null);
    });
    announce("Plan approved.");
    toast({ title: "Plan approved", description: "The agents will start on the kept applications and send drafts here.", action: { label: "Undo", onClick: async () => { await undo(planItemId); setPlan(initialPlan); } } });
  };
  const skipPlan = async () => {
    if (!planItemId) return;
    const next = await services.inbox.reject(planItemId, "Skipped this month");
    withLeave(planItemId, () => {
      update(next);
      setPlan(null);
    });
    toast({ title: "Plan skipped", description: "We will propose a new one on the 1st.", tone: "info", action: { label: "Undo", onClick: async () => { await undo(planItemId); setPlan(initialPlan); } } });
  };

  const totalPending = pending.length + (plan ? 1 : 0);

  return (
    <PageContainer>
      <div ref={liveRef} aria-live="polite" className="sr-only" />
      <header className="mb-8">
        <p className="text-sm font-medium text-fg-subtle">
          {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
        </p>
        <h1 className="mt-1 font-display text-3xl text-fg sm:text-4xl">
          {greeting()}, {firstName}.
        </h1>
        <p className="mt-2 text-base text-fg-muted">
          {totalPending === 0
            ? "Nothing waiting on you. The agents will add to this page as they work."
            : totalPending === 1
              ? "One item needs your review."
              : `${totalPending} items need your review.${plan ? " Your monthly plan is ready first." : ""}`}
        </p>
      </header>

      {plan && planItemId ? (
        <div className="mb-10">
          <PlanCard plan={plan} matches={ctx.matches} onDecision={planDecision} onApprove={approvePlan} onSkip={skipPlan} leaving={leaving.has(planItemId)} />
        </div>
      ) : null}

      <section aria-labelledby="review-title">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 id="review-title" className="font-display text-2xl text-fg">
            Waiting for you
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
            icon={<InboxIcon />}
            title={filter === "all" ? "You are all caught up" : `No ${active.label.toLowerCase()} waiting`}
            description={
              filter === "all"
                ? "New drafts, matches, and schedules will land here as the agents finish them. Nothing is sent or submitted without you."
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
        ) : (
          <ul className="flex flex-col gap-4">
            {visible.map((item) => (
              <li key={item.id}>
                <InboxItemCard item={item} ctx={ctx} leaving={leaving.has(item.id)} onApprove={approve} onReject={reject} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="resolved-title" className="mt-12">
        <div className="flex items-center justify-between gap-3">
          <h2 id="resolved-title" className="font-display text-xl text-fg-muted">
            Resolved
            <span className="ml-2 text-sm text-fg-subtle tnum">{resolved.length}</span>
          </h2>
          <Button variant="ghost" size="sm" onClick={() => setShowResolved((s) => !s)} aria-expanded={showResolved}>
            {showResolved ? "Hide" : "Show"}
          </Button>
        </div>
        {showResolved ? (
          resolved.length === 0 ? (
            <p className="mt-4 text-sm text-fg-subtle">Nothing resolved yet.</p>
          ) : (
            <ul className="mt-4 flex flex-col gap-3">
              {resolved.map((item) => (
                <li key={item.id}>
                  <InboxItemCard item={item} ctx={ctx} onApprove={approve} onReject={reject} />
                </li>
              ))}
            </ul>
          )
        ) : (
          <p className="mt-2 flex items-center gap-1.5 text-sm text-fg-subtle">
            <Sparkles className="size-3.5" aria-hidden />
            Approved and declined items stay here for your records.
          </p>
        )}
      </section>
    </PageContainer>
  );
}

function approvedTitle(item: InboxItem) {
  switch (item.type) {
    case "proposal_draft":
      return "Draft approved";
    case "email_draft":
      return "Email approved";
    case "new_matches":
      return "Matches saved";
    case "milestones":
      return "Added to calendar";
    case "missing_facts":
      return "Answers saved";
    case "profile_update":
      return "Fact updated";
    default:
      return "Approved";
  }
}
function approvedDescription(item: InboxItem) {
  switch (item.type) {
    case "proposal_draft":
      return "Moved to Review on your pipeline.";
    case "email_draft":
      return "Copy it into your email and send when ready.";
    case "missing_facts":
      return "The proposal now cites you as the source.";
    case "profile_update":
      return "Future drafts will use the new number.";
    default:
      return item.title;
  }
}
