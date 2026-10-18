"use client";

import * as React from "react";
import * as seed from "@/lib/mock/data";
import type { InboxItem, MatchView } from "@/lib/types";
import { useReducedMotion } from "@/lib/use-reduced-motion";
import { useToast } from "@/components/ui/toast";
import { InboxItemCard, STAMP_HOLD_MS, type InboxContext, type Leaving } from "@/components/app/inbox-item";
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
 * The Inbox on the landing page is the Inbox component itself, on a printed
 * sheet. Shortly after the page loads the first item gets stamped; this is
 * the only thing on the page that moves on its own. Everything else moves
 * only when the visitor does something.
 */
export function HeroInbox() {
  const { toast } = useToast();
  const reduced = useReducedMotion();
  const [items, setItems] = React.useState<InboxItem[]>(() => heroIds.map(pick));
  const [leaving, setLeaving] = React.useState<Record<string, Leaving>>({});
  const timers = React.useRef<number[]>([]);

  const setStatus = React.useCallback((id: string, status: InboxItem["status"]) => {
    setItems((list) => list.map((i) => (i.id === id ? { ...i, status, resolvedAt: status === "pending" ? null : new Date().toISOString() } : i)));
  }, []);

  const stamp = React.useCallback(
    (id: string) => {
      setLeaving((s) => ({ ...s, [id]: "seal" }));
      const t = window.setTimeout(() => {
        setStatus(id, "approved");
        setLeaving((s) => {
          const n = { ...s };
          delete n[id];
          return n;
        });
      }, STAMP_HOLD_MS);
      timers.current.push(t);
    },
    [setStatus],
  );

  React.useEffect(() => {
    if (reduced) return;
    const t = window.setTimeout(() => stamp(heroIds[0]), 1400);
    timers.current.push(t);
    const pending = timers.current;
    return () => pending.forEach((x) => window.clearTimeout(x));
  }, [reduced, stamp]);

  const approve = (item: InboxItem) => {
    stamp(item.id);
    toast({ title: "Approved", description: "In your own workspace this moves the draft to Review.", action: { label: "Undo", onClick: () => setStatus(item.id, "pending") } });
  };
  const reject = (item: InboxItem) => {
    setStatus(item.id, "rejected");
    toast({ title: "Declined", description: "Filed with your reason.", tone: "info", action: { label: "Undo", onClick: () => setStatus(item.id, "pending") } });
  };
  const reset = () => setItems(heroIds.map(pick));

  const today = new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });

  return (
    <div className="sheet-raised px-5 pb-2 pt-5 sm:px-8 sm:pt-7">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b-2 border-ink pb-3">
        <p className="font-display text-2xl text-ink">Waiting on you</p>
        <p className="text-sm text-ink-muted">{today}</p>
      </div>
      <ul>
        {items.map((item) => (
          <li key={item.id}>
            <InboxItemCard item={item} ctx={demoCtx} leaving={leaving[item.id]} fileAway={false} onApprove={approve} onReject={reject} />
          </li>
        ))}
      </ul>
      {items.some((i) => i.status !== "pending") ? (
        <p className="py-4 text-sm text-ink-muted">
          {items.every((i) => i.status !== "pending") ? "Nothing waiting on you. " : ""}
          <button type="button" onClick={reset} className="font-semibold text-ink underline decoration-[1.5px] underline-offset-4 hover:decoration-pink">
            Put them back
          </button>
        </p>
      ) : (
        <div className="h-4" aria-hidden />
      )}
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
      <p className="mt-4 max-w-[60ch] text-base leading-[1.75] text-ink">
        Among seniors enrolled in After-School Studio, 94% graduated on time<span className="cite-chip">Annual report, p.6</span> against a district rate of 81%
        <span className="cite-chip">Annual report, p.6</span>. Four full-time staff<span className="cite-chip">Form 990, p.1</span> and 23 trained volunteers
        <span className="cite-chip">Annual report, p.12</span> live in the neighborhoods we serve. Demand is now ahead of capacity: <span className="gap-chip">Need: waitlist size</span> students are
        waiting at Belmont.
      </p>
      <p className="mt-5 text-sm text-ink-muted">A footnote tag opens the passage it came from. A yellow gap is a question for you, never a guess.</p>
    </div>
  );
}

/** Step three: an item that was read and approved, stamped and filed. */
export function StampSheet() {
  const item = pick("inbox_email_hollis");
  return (
    <div className="sheet px-5 sm:px-7">
      <InboxItemCard item={item} ctx={demoCtx} onApprove={() => {}} onReject={() => {}} />
    </div>
  );
}
