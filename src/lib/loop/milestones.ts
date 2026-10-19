import type { BidDate, Milestone, MilestoneKind, ProposalMode } from "@/lib/types";

/**
 * Backward planning from a deadline. Deterministic: no model call. Dates fall
 * on weekdays, and anything that would land in the past lands today.
 */
export type PlannedMilestone = Pick<Milestone, "title" | "dueDate" | "kind">;

function weekday(d: Date): Date {
  const x = new Date(d);
  if (x.getUTCDay() === 6) x.setUTCDate(x.getUTCDate() - 1);
  if (x.getUTCDay() === 0) x.setUTCDate(x.getUTCDate() - 2);
  return x;
}
function minus(iso: string, days: number): Date {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - days);
  return d;
}
const ymd = (d: Date) => d.toISOString().slice(0, 10);

export function planMilestones(deadline: string, opts: { boardReview?: boolean; effort?: "low" | "medium" | "high"; mode?: ProposalMode; today?: string; bidDates?: BidDate[] } = {}): PlannedMilestone[] {
  const today = opts.today ?? new Date().toISOString().slice(0, 10);
  if (opts.mode === "bid" || opts.mode === "sf330" || opts.bidDates?.length) return planBid(deadline, opts.bidDates ?? [], today);
  if (opts.mode === "essay") {
    return planFrom(deadline, today, [
      { kind: "follow_up", title: "Ask your recommenders for letters", daysBefore: 21 },
      { kind: "draft_due", title: "Essay draft ready to reread", daysBefore: 10 },
      { kind: "submit", title: "Submit the application", daysBefore: 2 },
      { kind: "deadline", title: "Application due", daysBefore: 0 },
    ]);
  }
  if (opts.mode === "research") {
    return planFrom(deadline, today, [
      { kind: "draft_due", title: "Full draft to co-investigators", daysBefore: 21 },
      { kind: "budget_signoff", title: "Budget to the sponsored programs office", daysBefore: 10 },
      { kind: "board_review", title: "Institutional review and sign-off", daysBefore: 5 },
      { kind: "submit", title: "Submit through the institution", daysBefore: 2 },
      { kind: "deadline", title: "Proposals due", daysBefore: 0 },
    ]);
  }
  const long = opts.effort === "high" || opts.mode === "proposal";
  const plan: { kind: MilestoneKind; title: string; daysBefore: number }[] = long
    ? [
        { kind: "draft_due", title: "Full draft ready for review", daysBefore: 14 },
        { kind: "budget_signoff", title: "Budget sign-off", daysBefore: 10 },
        ...(opts.boardReview !== false ? [{ kind: "board_review" as const, title: "Board review", daysBefore: 7 }] : []),
        { kind: "submit", title: "Submit on the funder's portal", daysBefore: 2 },
        { kind: "deadline", title: "Deadline", daysBefore: 0 },
        { kind: "follow_up", title: "Check on the application", daysBefore: -30 },
      ]
    : [
        { kind: "draft_due", title: "Letter ready for review", daysBefore: 5 },
        ...(opts.boardReview ? [{ kind: "board_review" as const, title: "Board chair reads the letter", daysBefore: 3 }] : []),
        { kind: "submit", title: "Send the letter", daysBefore: 1 },
        { kind: "deadline", title: "Deadline", daysBefore: 0 },
        { kind: "follow_up", title: "Follow up if no reply", daysBefore: -21 },
      ];
  return plan.map((p) => {
    const d = p.daysBefore === 0 ? new Date(`${deadline}T12:00:00Z`) : weekday(minus(deadline, p.daysBefore));
    let due = ymd(d);
    if (due < today && p.kind !== "deadline") due = today;
    return { title: p.title, dueDate: due, kind: p.kind };
  });
}

const BID_EVENT: Partial<Record<BidDate["kind"], MilestoneKind>> = { questions_due: "questions_due", prebid_meeting: "prebid_meeting", site_visit: "site_visit", interview: "interview" };

/**
 * A bid works back from the submission date and forward from the
 * solicitation's own dates: decide go or no-go before the questions are due,
 * send questions two days ahead of that cutoff, attend the pre-bid meeting
 * and site visit, then draft, review, produce, and submit with a day to spare.
 */
function planBid(deadline: string, dates: BidDate[], today: string): PlannedMilestone[] {
  const at = (iso: string) => iso.slice(0, 10);
  const day = (iso: string, before: number) => {
    let due = ymd(weekday(minus(at(iso), before)));
    if (due < today) due = today;
    return due;
  };
  const out: PlannedMilestone[] = [];
  const questions = dates.find((d) => d.kind === "questions_due");
  // Decide within about a week, or sooner when the questions deadline forces it; never a year out.
  const soon = ymd(weekday(minus(today, -7)));
  const fromDates = questions ? day(questions.date, 4) : day(deadline, 14);
  const decideBy = fromDates < soon ? fromDates : soon;
  out.push({ kind: "go_no_go", title: "Decide go or no-go", dueDate: decideBy });
  if (questions) out.push({ kind: "draft_due", title: "Send the firm's questions", dueDate: day(questions.date, 2) });
  for (const d of dates) {
    const kind = BID_EVENT[d.kind];
    if (!kind) continue;
    const due = at(d.date);
    if (due < today) continue;
    out.push({ kind, title: d.mandatory ? `${d.label} (mandatory)` : d.label, dueDate: due });
  }
  out.push(
    { kind: "draft_due", title: "Full draft ready for internal review", dueDate: day(deadline, 7) },
    { kind: "board_review", title: "Principal review and quality check", dueDate: day(deadline, 4) },
    { kind: "budget_signoff", title: "Fee proposal and forms signed", dueDate: day(deadline, 2) },
    { kind: "submit", title: "Submit the proposal", dueDate: day(deadline, 1) },
    { kind: "deadline", title: "Proposals due", dueDate: at(deadline) },
  );
  return out.sort((a, b) => a.dueDate.localeCompare(b.dueDate));
}

function planFrom(deadline: string, today: string, plan: { kind: MilestoneKind; title: string; daysBefore: number }[]): PlannedMilestone[] {
  return plan.map((p) => {
    let due = p.daysBefore === 0 ? deadline : ymd(weekday(minus(deadline, p.daysBefore)));
    if (due < today && p.kind !== "deadline") due = today;
    return { title: p.title, dueDate: due, kind: p.kind };
  });
}
