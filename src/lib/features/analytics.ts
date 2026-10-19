import type { AnalyticsRow, Application, Funder, LossReason, Opportunity, Outcome, Section, WinAnalytics } from "@/lib/types";

/**
 * Win analytics from the pipeline: which funders, ask sizes, relationships,
 * and sections go with wins. Plain counting over the organization's own
 * outcomes. Every rate carries the number of decisions behind it, and the
 * findings never say more than a small sample allows.
 */
export const LOSS_REASON_LABEL: Record<LossReason, string> = {
  fit: "Not a strong fit for the funder's priorities",
  budget_size: "Ask too large or too small for the funder",
  competition: "Strong competition, limited funds",
  eligibility: "Turned out not to be eligible",
  outcomes_data: "Outcomes or evaluation not strong enough",
  timing: "Timing or deadline problems",
  relationship: "No relationship with the funder",
  writing: "The application itself was weak",
  unknown: "No reason given",
};

const FUNDER_TYPE_LABEL: Record<Funder["type"], string> = {
  private_foundation: "Private foundations",
  community_foundation: "Community foundations",
  corporate: "Corporate giving",
  federal: "Federal agencies",
  state: "State agencies",
  family_fund: "Family funds",
};

export interface AnalyticsInput {
  applications: Application[];
  opportunities: Opportunity[];
  funders: Funder[];
  outcomes: Outcome[];
  sections: Pick<Section, "applicationId" | "title" | "bodyHtml">[];
}

const rate = (won: number, decided: number) => (decided ? Math.round((won / decided) * 100) : null);

function rows(groups: Map<string, { decided: number; won: number; dollars: number }>, order?: string[]): AnalyticsRow[] {
  const keys = order ? order.filter((k) => groups.has(k)) : [...groups.keys()];
  return keys.map((label) => {
    const g = groups.get(label)!;
    return { label, decided: g.decided, won: g.won, winRate: rate(g.won, g.decided), dollarsWon: g.dollars };
  });
}

function bump(map: Map<string, { decided: number; won: number; dollars: number }>, key: string, won: boolean, dollars: number) {
  const g = map.get(key) ?? { decided: 0, won: 0, dollars: 0 };
  g.decided++;
  if (won) {
    g.won++;
    g.dollars += dollars;
  }
  map.set(key, g);
}

const SIZE_BUCKETS: [number, string][] = [
  [15_000, "Under $15K"],
  [40_000, "$15K to $40K"],
  [100_000, "$40K to $100K"],
  [Infinity, "Over $100K"],
];
const bucketFor = (n: number | null) => (n == null ? "No ask set" : SIZE_BUCKETS.find(([max]) => n < max)![1]);

/** Section titles reduced to the few kinds funders ask for, so "Statement of need" and "The need" count together. */
function sectionKind(title: string): string | null {
  const t = title.toLowerCase();
  if (/evaluat|measur|outcome|result/.test(t)) return "An evaluation or results section";
  if (/budget/.test(t)) return "A budget narrative";
  if (/sustain/.test(t)) return "A sustainability plan";
  if (/partner|collaborat/.test(t)) return "A partnerships section";
  if (/story|voice|testimon/.test(t)) return "A participant story";
  return null;
}

export function computeWinAnalytics(input: AnalyticsInput): WinAnalytics {
  const oppById = new Map(input.opportunities.map((o) => [o.id, o]));
  const funderById = new Map(input.funders.map((f) => [f.id, f]));
  const outcomeByApp = new Map(input.outcomes.map((o) => [o.applicationId, o]));
  const decidedApps = input.applications.filter((a) => outcomeByApp.has(a.id) || a.stage === "won" || a.stage === "lost");

  const byType = new Map<string, { decided: number; won: number; dollars: number }>();
  const bySize = new Map<string, { decided: number; won: number; dollars: number }>();
  const byRel = new Map<string, { decided: number; won: number; dollars: number }>();
  const byFunder = new Map<string, { decided: number; won: number; dollars: number }>();
  const bySection = new Map<string, { decided: number; won: number; dollars: number }>();
  const reasons = new Map<LossReason, number>();
  const lessons: WinAnalytics["lessons"] = [];
  let won = 0;
  let lost = 0;
  let noResponse = 0;
  let dollarsWon = 0;
  let dollarsAsked = 0;

  // Applications to each funder in date order, to tell a first request from a returning one.
  const seen = new Map<string, number>();
  const ordered = [...decidedApps].sort((a, b) => (a.submittedAt ?? a.createdAt).localeCompare(b.submittedAt ?? b.createdAt));
  const timeline = new Map<string, { asked: number; won: number }>();

  for (const a of ordered) {
    const o = outcomeByApp.get(a.id) ?? null;
    const result = o?.result ?? (a.stage === "won" ? "won" : "lost");
    const isWon = result === "won";
    const opp = oppById.get(a.opportunityId);
    const funder = opp ? funderById.get(opp.funderId) : undefined;
    const award = isWon ? (o?.awardAmount ?? a.askAmount ?? 0) : 0;
    if (isWon) won++;
    else if (result === "no_response") noResponse++;
    else lost++;
    dollarsWon += award;
    dollarsAsked += a.askAmount ?? 0;
    if (funder) {
      bump(byType, FUNDER_TYPE_LABEL[funder.type], isWon, award);
      bump(byFunder, funder.name, isWon, award);
      const prior = seen.get(funder.id) ?? 0;
      bump(byRel, prior > 0 ? "Returning to a funder we applied to before" : "First request to a funder", isWon, award);
      seen.set(funder.id, prior + 1);
    }
    bump(bySize, bucketFor(a.askAmount), isWon, award);
    const kinds = new Set(input.sections.filter((s) => s.applicationId === a.id && s.bodyHtml.replace(/<[^>]+>/g, "").trim()).map((s) => sectionKind(s.title)).filter((k): k is string => Boolean(k)));
    for (const k of kinds) bump(bySection, k, isWon, award);
    if (!isWon) for (const r of o?.lossReasons?.length ? o.lossReasons : (["unknown"] as LossReason[])) reasons.set(r, (reasons.get(r) ?? 0) + 1);
    if (o?.lessons?.trim()) lessons.push({ applicationTitle: opp?.title ?? "Application", funder: funder?.name ?? "", lessons: o.lessons.trim(), decidedAt: o.decidedAt });
    const month = (o?.decidedAt ?? a.updatedAt).slice(0, 7);
    const t = timeline.get(month) ?? { asked: 0, won: 0 };
    t.asked += a.askAmount ?? 0;
    t.won += award;
    timeline.set(month, t);
  }

  const pendingApps = input.applications.filter((a) => a.stage === "submitted" && !outcomeByApp.has(a.id));
  const decided = won + lost + noResponse;
  const typeRows = rows(byType).sort((a, b) => b.decided - a.decided);
  const relRows = rows(byRel, ["First request to a funder", "Returning to a funder we applied to before"]);
  const sizeRows = rows(bySize, [...SIZE_BUCKETS.map(([, l]) => l), "No ask set"]);
  const sectionRows = rows(bySection).sort((a, b) => b.decided - a.decided);
  const funderRows = rows(byFunder).sort((a, b) => b.dollarsWon - a.dollarsWon || b.decided - a.decided);

  const findings: string[] = [];
  if (decided < 3) findings.push(`Only ${decided} decided application${decided === 1 ? "" : "s"} so far. Patterns will show once a few more come back.`);
  else {
    const first = relRows.find((r) => r.label.startsWith("First"));
    const back = relRows.find((r) => r.label.startsWith("Returning"));
    if (first && back && back.decided >= 2 && first.decided >= 2 && back.winRate != null && first.winRate != null && back.winRate !== first.winRate)
      findings.push(`Returning requests won ${back.winRate}% of the time (${back.won} of ${back.decided}); first requests won ${first.winRate}% (${first.won} of ${first.decided}).`);
    const bestType = typeRows.filter((r) => r.decided >= 2).sort((a, b) => (b.winRate ?? 0) - (a.winRate ?? 0))[0];
    if (bestType) findings.push(`${bestType.label} have been your best source: ${bestType.won} of ${bestType.decided} won.`);
    const bestSize = sizeRows.filter((r) => r.decided >= 2).sort((a, b) => (b.winRate ?? 0) - (a.winRate ?? 0))[0];
    if (bestSize) findings.push(`Asks of ${bestSize.label.charAt(0).toLowerCase() + bestSize.label.slice(1)} won ${bestSize.won} of ${bestSize.decided}.`);
    const evalRow = sectionRows.find((r) => r.label.startsWith("An evaluation"));
    if (evalRow && evalRow.decided >= 2) findings.push(`Applications with an evaluation section won ${evalRow.won} of ${evalRow.decided}.`);
    const topReason = [...reasons.entries()].filter(([r]) => r !== "unknown").sort((a, b) => b[1] - a[1])[0];
    if (topReason && topReason[1] >= 2) findings.push(`The most common reason for a decline: ${LOSS_REASON_LABEL[topReason[0]].charAt(0).toLowerCase() + LOSS_REASON_LABEL[topReason[0]].slice(1)} (${topReason[1]}).`);
    findings.push(`These come from ${decided} decisions. Treat them as hints, not rules.`);
  }

  return {
    decided,
    won,
    lost,
    noResponse,
    winRate: rate(won, decided),
    dollarsWon,
    dollarsAsked,
    pending: pendingApps.length,
    pendingAsk: pendingApps.reduce((n, a) => n + (a.askAmount ?? 0), 0),
    byFunderType: typeRows,
    byAskSize: sizeRows,
    byRelationship: relRows,
    bySection: sectionRows,
    byFunder: funderRows,
    lossReasons: [...reasons.entries()].sort((a, b) => b[1] - a[1]).map(([reason, count]) => ({ reason, label: LOSS_REASON_LABEL[reason], count })),
    lessons: lessons.sort((a, b) => b.decidedAt.localeCompare(a.decidedAt)),
    findings,
    timeline: [...timeline.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([month, v]) => ({ month, ...v })),
  };
}
