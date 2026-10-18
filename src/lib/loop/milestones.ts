import type { Milestone, MilestoneKind } from "@/lib/types";

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

export function planMilestones(deadline: string, opts: { boardReview?: boolean; effort?: "low" | "medium" | "high"; mode?: "letter" | "proposal"; today?: string } = {}): PlannedMilestone[] {
  const today = opts.today ?? new Date().toISOString().slice(0, 10);
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
