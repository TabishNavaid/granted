"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { EmailDraft, InboxItem, MonthlyPlan, PlanItem } from "@/lib/types";
import { services } from "@/lib/services";
import { useToast } from "@/components/ui/toast";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { PageContainer } from "@/components/app/page-header";
import { CompactInboxRow, InboxItemCard, BLOOM_HOLD_MS, type InboxContext, type Leaving } from "@/components/app/inbox-item";
import { PlanCard } from "@/components/app/plan-card";
import { doneWord } from "@/lib/agents/meta";
import { InboxTour } from "@/components/app/inbox-tour";

type Filter = "all" | "proposal" | "email" | "matches" | "schedule" | "profile";
const filters: { value: Filter; label: string; types: InboxItem["type"][] }[] = [
  { value: "all", label: "All", types: [] },
  { value: "proposal", label: "Drafts", types: ["proposal_draft", "missing_facts", "go_no_go"] },
  { value: "email", label: "Emails", types: ["email_draft"] },
  { value: "matches", label: "Funders", types: ["new_matches"] },
  { value: "schedule", label: "Schedules", types: ["milestones", "addendum"] },
  { value: "profile", label: "Facts", types: ["profile_update"] },
];

const decideTypes: InboxItem["type"][] = ["proposal_draft", "email_draft"];
const answerTypes: InboxItem["type"][] = ["missing_facts"];

interface Props {
  items: InboxItem[];
  plan: MonthlyPlan | null;
  planItemId: string | null;
  ctx: InboxContext;
  firstName: string;
}

export function InboxView({ items: initial, plan: initialPlan, planItemId: initialPlanItemId, ctx, firstName }: Props) {
  const { toast } = useToast();
  const router = useRouter();
  const [items, setItems] = React.useState(initial);
  const [plan, setPlan] = React.useState(initialPlan);
  const [planItemId, setPlanItemId] = React.useState(initialPlanItemId);
  const [planning, setPlanning] = React.useState(false);
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
      how === "seal" ? BLOOM_HOLD_MS : 420,
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
    announce(`${doneWord[item.type]}: ${item.title}`);
    toast({ title: approvedTitle(item), description: approvedDescription(item), tone: "success", action: { label: "Undo", onClick: () => undo(item.id) } });
  };

  const reject = async (item: InboxItem, reason: string | null) => {
    const next = await services.inbox.reject(item.id, reason);
    withLeave(item.id, "dismiss", () => update(next));
    announce(`Declined: ${item.title}`);
    toast({ title: "Declined", description: "Filed with your reason.", tone: "info", action: { label: "Undo", onClick: () => undo(item.id) } });
  };

  const planDecision = async (opportunityId: string, decision: PlanItem["decision"]) => {
    if (!plan) return;
    setPlan(await services.inbox.setPlanDecision(plan.id, opportunityId, decision));
  };
  const planNextMonth = async () => {
    setPlanning(true);
    try {
      const next = await services.inbox.planNextMonth();
      const list = await services.inbox.list();
      const item = list.find((i) => i.payload.type === "monthly_plan" && i.payload.planId === next.id) ?? null;
      setItems((current) => {
        const known = new Set(current.map((i) => i.id));
        return [...list.filter((i) => !known.has(i.id) && i.type !== "email_draft"), ...current];
      });
      setPlan(next);
      setPlanItemId(item?.id ?? null);
      router.refresh();
      toast({
        title: "Plan ready in your Inbox",
        description: next.items.length ? `${next.items.length} application${next.items.length === 1 ? "" : "s"} proposed. Keep, skip, or swap each one.` : "There are no matches to plan from yet. Run setup to find funders first.",
        tone: next.items.length ? "success" : "info",
      });
    } catch (err) {
      toast({ title: "Could not plan the month", description: err instanceof Error ? err.message : "Try again in a moment.", tone: "warning" });
    } finally {
      setPlanning(false);
    }
  };

  const approvePlan = async () => {
    if (!planItemId) return;
    const before = plan;
    const next = await services.inbox.approve(planItemId);
    withLeave(planItemId, "seal", () => {
      update(next);
      setPlan(null);
    });
    announce("Plan approved.");
    toast({
      title: "Plan approved",
      tone: "success",
      description: "Drafts will show up here as they are ready.",
      action: {
        label: "Undo",
        onClick: async () => {
          await undo(planItemId);
          setPlan(before);
        },
      },
    });
  };
  const skipPlan = async () => {
    if (!planItemId) return;
    const before = plan;
    const next = await services.inbox.reject(planItemId, "Skipped this month");
    withLeave(planItemId, "dismiss", () => {
      update(next);
      setPlan(null);
    });
    toast({
      title: "Plan skipped",
      description: "A fresh one arrives on the 1st.",
      tone: "info",
      action: {
        label: "Undo",
        onClick: async () => {
          await undo(planItemId);
          setPlan(before);
        },
      },
    });
  };

  const totalPending = pending.length + (plan ? 1 : 0);
  const brandNew = items.length === 0 && !plan;
  const summary =
    totalPending === 0
      ? "Nothing is waiting on you."
      : [plan ? "your plan for the month" : null, decide.length ? `${decide.length} to read and approve` : null, answer.length ? `${answer.length} with quick questions` : null, glance.length ? `${glance.length} to glance at` : null]
          .filter(Boolean)
          .join(", ")
          .replace(/, ([^,]*)$/, " and $1") + ".";

  return (
    <PageContainer>
      <React.Suspense fallback={null}>
        <InboxTour />
      </React.Suspense>
      <div ref={liveRef} aria-live="polite" className="sr-only" />
      <header className="border-b border-rule pb-7">
        <p className="text-base text-ink-muted">{new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}</p>
        <div className="mt-1 flex flex-wrap items-end justify-between gap-4">
          <h1 className="font-display text-title text-ink">{totalPending === 0 ? (firstName ? `Nothing waiting on you, ${firstName}.` : "Nothing waiting on you.") : "Waiting on you"}</h1>
          {!brandNew ? (
            <Button variant="secondary" onClick={planNextMonth} loading={planning}>
              {plan && plan.month === nextMonthKey() ? "Plan next month again" : "Plan next month"}
            </Button>
          ) : null}
        </div>
        {totalPending > 0 ? (
          <p className="mt-3 max-w-[60ch] text-lg text-ink-muted">
            {firstName ? `${firstName}, here is ${summary}` : `Here is ${summary}`}
          </p>
        ) : null}
      </header>

      {brandNew ? (
        <EmptyState
          className="mt-8"
          title="Your Inbox is empty for now"
          description="Drafts, new funders, and monthly plans land here once setup has read your website and found matches. You can also ask the planner for next month now. Nothing is sent or submitted without you."
          action={
            <div className="flex flex-wrap gap-3">
              <Button asChild>
                <Link href="/onboarding">Run setup</Link>
              </Button>
              <Button variant="secondary" onClick={planNextMonth} loading={planning}>
                Plan next month
              </Button>
            </div>
          }
        />
      ) : null}

      {plan && planItemId ? (
        <div className="mt-8">
          <PlanCard plan={plan} matches={ctx.matches} onDecision={planDecision} onApprove={approvePlan} onSkip={skipPlan} leaving={!!leaving[planItemId]} />
        </div>
      ) : null}

      {brandNew ? null : (
        <>
          <div className="mt-10 flex flex-wrap items-end justify-between gap-4">
            <h2 className="font-display text-3xl text-ink">Read and decide</h2>
            <Tabs value={filter} onValueChange={(v) => setFilter(v as Filter)}>
              <TabsList variant="pill" aria-label="Filter inbox" className="-mx-4 px-4 sm:mx-0 sm:px-0">
                {filters.map((f) => (
                  <TabsTrigger key={f.value} value={f.value}>
                    {f.label}
                    {counts[f.value] > 0 ? <span className="text-sm font-normal text-ink-muted tnum">{counts[f.value]}</span> : null}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          </div>

          {visible.length === 0 ? (
            <EmptyState
              className="mt-6"
                title={filter === "all" ? "You are caught up" : `No ${active.label.toLowerCase()} waiting`}
              description={filter === "all" ? "New drafts, funders, and schedules land here as they are ready. Nothing is sent or submitted without you." : "Try another filter."}
              action={
                filter !== "all" ? (
                  <Button variant="secondary" onClick={() => setFilter("all")}>
                    Show everything
                  </Button>
                ) : undefined
              }
            />
          ) : filter !== "all" ? (
            <ul className="mt-4 border-t border-rule">
              {visible.map((item) => (
                <li key={item.id}>
                  <InboxItemCard item={item} ctx={ctx} leaving={leaving[item.id]} onApprove={approve} onReject={reject} />
                </li>
              ))}
            </ul>
          ) : (
            <div className="mt-4 flex flex-col gap-12">
              {decide.length ? (
                <Group title="Read and approve" hint="Written for you. Take a few minutes with each one.">
                  {decide.map((item) => (
                    <li key={item.id}>
                      <InboxItemCard item={item} ctx={ctx} leaving={leaving[item.id]} onApprove={approve} onReject={reject} />
                    </li>
                  ))}
                </Group>
              ) : null}
              {answer.length ? (
                <Group title="Quick answers" hint="Facts that are not in your documents. About a minute each.">
                  {answer.map((item) => (
                    <li key={item.id}>
                      <InboxItemCard item={item} ctx={ctx} leaving={leaving[item.id]} onApprove={approve} onReject={reject} />
                    </li>
                  ))}
                </Group>
              ) : null}
              {glance.length ? (
                <Group title="At a glance" hint="Say yes from the row, or open one for the details.">
                  {glance.map((item) => (
                    <li key={item.id}>
                      <CompactInboxRow item={item} ctx={ctx} leaving={leaving[item.id]} onApprove={approve} onReject={reject} />
                    </li>
                  ))}
                </Group>
              ) : null}
            </div>
          )}

          <section aria-labelledby="resolved-title" className="mt-16 border-t border-rule pt-6">
            <div className="flex items-baseline justify-between gap-3">
              <h2 id="resolved-title" className="font-display text-2xl text-ink">
                Done <span className="ml-1 font-body text-base font-normal text-ink-muted tnum">{resolved.length}</span>
              </h2>
              <Button variant="ghost" size="sm" onClick={() => setShowResolved((s) => !s)} aria-expanded={showResolved}>
                {showResolved ? "Hide" : "Show"}
              </Button>
            </div>
            {showResolved ? (
              resolved.length === 0 ? (
                <p className="mt-4 text-base text-ink-muted">Nothing done yet. Your first approval goes here.</p>
              ) : (
                <ul className="mt-4 border-t border-rule">
                  {resolved.map((item) => (
                    <li key={item.id}>
                      <CompactInboxRow item={item} ctx={ctx} onApprove={approve} onReject={reject} />
                    </li>
                  ))}
                </ul>
              )
            ) : null}
          </section>
        </>
      )}
    </PageContainer>
  );
}

function nextMonthKey() {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)).toISOString().slice(0, 7);
}

function Group({ title, hint, children }: { title: string; hint: string; children: React.ReactNode }) {
  const id = title.toLowerCase().replace(/\s+/g, "-");
  return (
    <section aria-labelledby={id}>
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <h3 id={id} className="font-display text-xl text-ink">
          {title}
        </h3>
        <p className="text-sm text-ink-muted">{hint}</p>
      </div>
      <ul className="mt-3 border-t border-rule">{children}</ul>
    </section>
  );
}

function approvedTitle(item: InboxItem) {
  switch (item.type) {
    case "proposal_draft":
      return "Draft approved";
    case "email_draft":
      return "Email approved";
    case "new_matches":
      return "Funders saved";
    case "milestones":
      return "On your calendar";
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
      return "It is in Review on your pipeline now.";
    case "email_draft":
      return "Copy it into your email and send it when you are ready.";
    case "missing_facts":
      return "The draft now cites you as the source.";
    case "profile_update":
      return "Every draft from here on uses the new number.";
    case "milestones":
      return "They are on your calendar and in the weekly digest.";
    default:
      return item.title;
  }
}
