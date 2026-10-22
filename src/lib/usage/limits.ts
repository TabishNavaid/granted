import { EMAIL } from "@/lib/brand";

/**
 * Monthly limits on AI work, per workspace. FundFellows is free; these only
 * protect the cost of the model behind it. Change the numbers here and
 * nowhere else. The count starts again on the first of each month (UTC).
 */
export const USAGE_LIMITS = {
  /** Letters of inquiry, full proposals, bid responses, research proposals, and essays. */
  draft: 50,
  /** Everything else that calls the model: reading a website, document, or RFP, scoring matches, edits, emails, checks. */
  assist: 400,
} as const;

export type UsageKind = keyof typeof USAGE_LIMITS;

const NOUNS: Record<UsageKind, { one: string; many: string; what: string }> = {
  draft: { one: "draft", many: "drafts", what: "Letters, proposals, bid responses, and essays." },
  assist: { one: "assistant run", many: "assistant runs", what: "Reading your website, documents, and solicitations, scoring matches, and edits." },
};

export interface UsageLine {
  kind: UsageKind;
  used: number;
  limit: number;
  /** "You have used 12 of 50 drafts this month." */
  sentence: string;
  what: string;
}

export interface UsageSummary {
  /** YYYY-MM, UTC. */
  month: string;
  /** The first day of next month, YYYY-MM-DD. */
  resetsOn: string;
  lines: UsageLine[];
}

export function monthStart(now = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

export function nextMonthStart(now = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
}

export function usageSentence(kind: UsageKind, used: number, limit = USAGE_LIMITS[kind]): string {
  return `You have used ${used} of ${limit} ${NOUNS[kind].many} this month.`;
}

export function summarize(counts: Partial<Record<UsageKind, number>>, now = new Date()): UsageSummary {
  const kinds = Object.keys(USAGE_LIMITS) as UsageKind[];
  return {
    month: now.toISOString().slice(0, 7),
    resetsOn: nextMonthStart(now).toISOString().slice(0, 10),
    lines: kinds.map((kind) => {
      const used = counts[kind] ?? 0;
      return { kind, used, limit: USAGE_LIMITS[kind], sentence: usageSentence(kind, used), what: NOUNS[kind].what };
    }),
  };
}

/** The message a person sees when the month's allowance is used up. Plain, with what happens next. */
export function limitReachedMessage(kind: UsageKind, now = new Date()): string {
  const month = now.toLocaleString("en-US", { month: "long", timeZone: "UTC" });
  const next = nextMonthStart(now).toLocaleString("en-US", { month: "long", day: "numeric", timeZone: "UTC" });
  return `This workspace has used all ${USAGE_LIMITS[kind]} ${NOUNS[kind].many} for ${month}. The count starts again on ${next}. If you need more before then, write to ${EMAIL.support}.`;
}

export class UsageLimitError extends Error {
  constructor(public kind: UsageKind) {
    super(limitReachedMessage(kind));
    this.name = "UsageLimitError";
  }
}

/** True when one more run of this kind fits in the month. */
export function canRun(kind: UsageKind, used: number): boolean {
  return used < USAGE_LIMITS[kind];
}

/** Runs logged before usage kinds existed: a run titled "Draft ..." by the proposal agent was a draft. */
export function kindOfRun(run: { agent: string; title: string; usageKind?: UsageKind | null }): UsageKind {
  if (run.usageKind) return run.usageKind;
  return run.agent === "proposal" && /^Draft (a|an|the) (letter|full proposal|research proposal|essay|proposal)/i.test(run.title) ? "draft" : "assist";
}

/** A run counts against the limit when it called a model. */
export function countsTowardLimit(run: { status: string; tokensIn: number; tokensOut: number; costUsd: number }): boolean {
  return run.status !== "failed" && (run.tokensIn > 0 || run.tokensOut > 0 || run.costUsd > 0);
}

export function countRuns(runs: { agent: string; title: string; usageKind?: UsageKind | null; status: string; tokensIn: number; tokensOut: number; costUsd: number; startedAt: string }[], now = new Date()): Record<UsageKind, number> {
  const from = monthStart(now).toISOString();
  const out: Record<UsageKind, number> = { draft: 0, assist: 0 };
  for (const r of runs) if (r.startedAt >= from && countsTowardLimit(r)) out[kindOfRun(r)]++;
  return out;
}
