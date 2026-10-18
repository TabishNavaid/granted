"use client";

import * as React from "react";
import * as seed from "@/lib/mock/data";
import type { InboxItem, MatchView } from "@/lib/types";
import { useReducedMotion } from "@/lib/use-reduced-motion";
import { useToast } from "@/components/ui/toast";
import { CompactInboxRow, InboxItemCard, BLOOM_HOLD_MS, type InboxContext, type Leaving } from "@/components/app/inbox-item";
import { OpportunityCard } from "@/components/app/opportunity-card";

/* ---------- the same seed data the app runs on ---------- */

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

const heroIds = ["inbox_meridian_draft", "inbox_email_brightwater"];
const pick = (id: string) => seed.inboxItems.find((i) => i.id === id)!;

/**
 * The Inbox on the landing page is the Inbox component itself, on a clean
 * sheet of paper. When the sheet comes into view the first item is approved
 * and its flower grows: the only thing on the page that moves on its own.
 * With reduced motion the item is shown already approved, flower and all.
 */
export function HeroInbox() {
  const { toast } = useToast();
  const reduced = useReducedMotion();
  const [items, setItems] = React.useState<InboxItem[]>(() => heroIds.map(pick));
  const [leaving, setLeaving] = React.useState<Record<string, Leaving>>({});
  const sheetRef = React.useRef<HTMLDivElement>(null);
  const timers = React.useRef<number[]>([]);

  const setStatus = React.useCallback((id: string, status: InboxItem["status"]) => {
    setItems((list) => list.map((i) => (i.id === id ? { ...i, status, resolvedAt: status === "pending" ? null : new Date().toISOString() } : i)));
  }, []);

  const bloom = React.useCallback(
    (id: string) => {
      setLeaving((s) => ({ ...s, [id]: "seal" }));
      const t = window.setTimeout(() => {
        setStatus(id, "approved");
        setLeaving((s) => {
          const n = { ...s };
          delete n[id];
          return n;
        });
      }, BLOOM_HOLD_MS);
      timers.current.push(t);
    },
    [setStatus],
  );

  React.useEffect(() => {
    const pending = timers.current;
    if (reduced) {
      const t = window.setTimeout(() => setStatus(heroIds[0], "approved"), 0);
      pending.push(t);
      return () => pending.forEach((x) => window.clearTimeout(x));
    }
    const el = sheetRef.current?.querySelector("article");
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        io.disconnect();
        pending.push(window.setTimeout(() => bloom(heroIds[0]), 900));
      },
      { threshold: 0.8 },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      pending.forEach((x) => window.clearTimeout(x));
    };
  }, [reduced, bloom, setStatus]);

  const approve = (item: InboxItem) => {
    bloom(item.id);
    toast({ title: "Approved", description: "In your own workspace this moves the draft to Review.", tone: "success", action: { label: "Undo", onClick: () => setStatus(item.id, "pending") } });
  };
  const reject = (item: InboxItem) => {
    setStatus(item.id, "rejected");
    toast({ title: "Declined", description: "Filed with your reason.", tone: "info", action: { label: "Undo", onClick: () => setStatus(item.id, "pending") } });
  };
  const reset = () => setItems(heroIds.map(pick));

  const today = new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
  const [first, second] = items;

  return (
    <div ref={sheetRef} className="sheet-raised px-5 pb-3 pt-5 sm:px-8 sm:pt-7">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-rule pb-3">
        <p className="font-display text-2xl text-ink">Waiting on you</p>
        <p className="text-sm text-ink-muted">{today}</p>
      </div>
      <InboxItemCard item={first} ctx={demoCtx} leaving={leaving[first.id]} fileAway={false} onApprove={approve} onReject={reject} />
      <CompactInboxRow item={second} ctx={demoCtx} leaving={leaving[second.id]} onApprove={approve} onReject={reject} />
      {items.some((i) => i.status !== "pending") ? (
        <p className="pt-3 text-sm text-ink-muted">
          {items.every((i) => i.status !== "pending") ? "Nothing waiting on you. " : ""}
          <button type="button" onClick={reset} className="rounded-sm font-semibold text-ink underline decoration-[1.5px] underline-offset-4 hover:decoration-corn">
            Put them back
          </button>
        </p>
      ) : null}
    </div>
  );
}

/* ---------- three still sheets for the three steps ---------- */

/** Step one: a funder arrives with reasons. The real row from Opportunities. */
export function MatchSheet() {
  const m = demoCtx.matches.match_meridian;
  return (
    <div className="sheet px-5 sm:px-7">
      <p className="pt-4 text-sm font-semibold text-ink">New this week</p>
      <OpportunityCard match={m} className="border-t-0 pt-3" />
    </div>
  );
}

/** Step two: a paragraph of the draft, every number with its receipt, one gap left for the user. */
export function DraftSheet() {
  return (
    <div className="sheet px-5 py-5 sm:px-7 sm:py-6">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 border-b border-rule pb-2">
        <p className="font-display text-xl text-ink">Statement of need</p>
        <p className="text-sm text-ink-muted tnum">212 of 500 words</p>
      </div>
      <p className="mt-4 max-w-[60ch] text-base leading-[1.8] text-ink">
        Among seniors enrolled in After-School Studio, 94% graduated on time<span className="cite-chip">Annual report, p.6</span> against a district rate of 81%
        <span className="cite-chip">Annual report, p.6</span>. Four full-time staff<span className="cite-chip">Form 990, p.1</span> and 23 trained volunteers
        <span className="cite-chip">Annual report, p.12</span> live in the neighborhoods we serve. Demand is now ahead of capacity: <span className="gap-chip">waitlist size</span> students are
        waiting at Belmont.
      </p>
      <p className="mt-5 text-sm text-ink-muted">A footnote tag opens the passage it came from. A circled gap is a question for you, never a guess.</p>
    </div>
  );
}

/** Step three: an item that was read and approved, with its flower. */
export function ApprovedSheet() {
  const item = pick("inbox_email_hollis");
  return (
    <div className="sheet px-5 sm:px-7">
      <InboxItemCard item={item} ctx={demoCtx} onApprove={() => {}} onReject={() => {}} />
    </div>
  );
}
