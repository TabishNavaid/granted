import type { Certification, FirmProfile, GoNoGoFactor, Personnel, PortfolioProject, Solicitation } from "@/lib/types";
import { assignPeople, holdsSetAside, pickProjects, rolesIn, solicitationProfile } from "./select";

/**
 * Bid or no-bid, in plain code. Each factor says what it looked at, so the
 * firm can disagree with a reason rather than with a number. A stopper (a
 * set-aside the firm does not hold, bonding above its limit, a deadline that
 * has passed) turns the suggestion to no-go whatever the score.
 */
export interface GoNoGoInput {
  title: string;
  /** Everything the solicitation says, for matching words. */
  text: string;
  solicitation: Solicitation;
  dueDate: string | null;
  firmState: string | null;
  profile: FirmProfile | null;
  projects: PortfolioProject[];
  personnel: Personnel[];
  certifications: Certification[];
  /** Bids the firm is preparing or deciding on right now, not counting this one. */
  activeBids: number;
  today?: string;
}

export interface GoNoGoResult {
  score: number;
  suggestion: "go" | "review" | "no_go";
  factors: GoNoGoFactor[];
  stoppers: string[];
  projectIds: string[];
  assignments: ReturnType<typeof assignPeople>;
}

const STATE_NAMES: Record<string, string> = { AL: "Alabama", AK: "Alaska", AZ: "Arizona", AR: "Arkansas", CA: "California", CO: "Colorado", CT: "Connecticut", DE: "Delaware", DC: "District of Columbia", FL: "Florida", GA: "Georgia", HI: "Hawaii", ID: "Idaho", IL: "Illinois", IN: "Indiana", IA: "Iowa", KS: "Kansas", KY: "Kentucky", LA: "Louisiana", ME: "Maine", MD: "Maryland", MA: "Massachusetts", MI: "Michigan", MN: "Minnesota", MS: "Mississippi", MO: "Missouri", MT: "Montana", NE: "Nebraska", NV: "Nevada", NH: "New Hampshire", NJ: "New Jersey", NM: "New Mexico", NY: "New York", NC: "North Carolina", ND: "North Dakota", OH: "Ohio", OK: "Oklahoma", OR: "Oregon", PA: "Pennsylvania", RI: "Rhode Island", SC: "South Carolina", SD: "South Dakota", TN: "Tennessee", TX: "Texas", UT: "Utah", VT: "Vermont", VA: "Virginia", WA: "Washington", WV: "West Virginia", WI: "Wisconsin", WY: "Wyoming" };

/** The two-letter state a place of performance names, if any. */
export function stateOf(place: string | null): string | null {
  if (!place) return null;
  const code = place.match(/\b([A-Z]{2})\b(?:\s+\d{5})?\s*$/)?.[1] ?? place.match(/,\s*([A-Z]{2})\b/)?.[1];
  if (code && STATE_NAMES[code]) return code;
  const name = Object.entries(STATE_NAMES).find(([, n]) => new RegExp(`\\b${n}\\b`, "i").test(place));
  return name?.[0] ?? null;
}

export const stateName = (code: string | null) => (code ? (STATE_NAMES[code] ?? code) : null);

function businessDaysBetween(from: string, to: string): number {
  const a = new Date(`${from.slice(0, 10)}T12:00:00Z`);
  const b = new Date(`${to.slice(0, 10)}T12:00:00Z`);
  let n = 0;
  for (const d = new Date(a); d < b; d.setUTCDate(d.getUTCDate() + 1)) if (d.getUTCDay() !== 0 && d.getUTCDay() !== 6) n++;
  return n;
}

export function scoreGoNoGo(input: GoNoGoInput): GoNoGoResult {
  const today = input.today ?? new Date().toISOString().slice(0, 10);
  const sol = input.solicitation;
  const place = stateOf(sol.placeOfPerformance);
  const profile = solicitationProfile(`${input.title}\n${input.text}`, place);
  const picks = pickProjects(input.projects, profile, { limit: sol.type === "SF330" ? 10 : 5, today });
  const roles = rolesIn(input.text);
  const assignments = assignPeople(input.personnel, roles, place);
  const factors: GoNoGoFactor[] = [];
  const stoppers: string[] = [];

  // Experience: how many strong, recent projects of the same kind.
  const strong = picks.filter((p) => p.score >= 40);
  factors.push({
    key: "experience",
    label: "Fit with past projects",
    weight: 0.25,
    score: Math.min(1, strong.length / 3 + (picks.length - strong.length) * 0.08),
    detail: strong.length ? `${strong.length} of your projects are close matches: ${strong.slice(0, 3).map((p) => p.project.name).join(", ")}.` : picks.length ? `Your nearest projects are partial matches: ${picks.slice(0, 2).map((p) => p.project.name).join(", ")}.` : "None of your portfolio projects look like this one.",
    evidence: picks.slice(0, 3).map((p) => `Project: ${p.project.name}`),
  });

  // Staff: roles the solicitation names that the firm can fill from its own people.
  const filled = assignments.filter((a) => a.personnelId);
  factors.push({
    key: "staff",
    label: "Key people for the roles asked for",
    weight: 0.15,
    score: assignments.length ? filled.length / assignments.length : 0.5,
    detail: `${filled.length} of the ${assignments.length} roles are covered by your staff${assignments.length > filled.length ? `; still open: ${assignments.filter((a) => !a.personnelId).map((a) => a.role).join(", ")}` : ""}.${roles.length < 3 ? ` The solicitation names ${roles.length ? roles.join(", ") : "no roles"}; the rest are the roles an A-E team usually shows.` : ""}`,
    evidence: filled.map((a) => a.why),
  });

  // Credentials: set-aside status and state licenses.
  const sa = holdsSetAside(sol.setAside, input.certifications, input.profile);
  const licensed = place ? input.personnel.some((p) => p.registrations.some((r) => r.state === place)) || input.certifications.some((c) => (c.kind === "license" || c.kind === "registration") && c.state === place) : true;
  let credScore = 1;
  const credDetail: string[] = [];
  if (sol.setAside) {
    credDetail.push(sa.held ? `You hold the status this set-aside requires (${sol.setAside}).` : `It is set aside (${sol.setAside}) and your records show no matching status.`);
    if (!sa.held) {
      credScore = 0;
      stoppers.push(`Set aside for a status your records do not show: ${sol.setAside}.`);
    }
  } else credDetail.push("No set-aside.");
  if (place) {
    credDetail.push(licensed ? `Someone on staff or the firm itself is licensed in ${stateName(place)}.` : `No one on staff shows a license in ${stateName(place)}, where the work is.`);
    if (!licensed) credScore = Math.min(credScore, 0.3);
  }
  if (sol.requiredCredentials.length) credDetail.push(`It names ${sol.requiredCredentials.length} required license or registration${sol.requiredCredentials.length === 1 ? "" : "s"}; check them against your people.`);
  factors.push({ key: "credentials", label: "Required certifications and licenses", weight: 0.15, score: credScore, detail: credDetail.join(" "), evidence: input.certifications.map((c) => c.label) });

  // Location.
  const states = new Set([...(input.profile?.states ?? []), input.firmState ?? ""].filter(Boolean));
  const inArea = place ? states.has(place) : true;
  const projectsThere = place ? input.projects.filter((p) => p.state === place).length : 0;
  factors.push({
    key: "location",
    label: "Location",
    weight: 0.1,
    score: !place ? 0.6 : place === input.firmState ? 1 : inArea ? 0.75 : projectsThere ? 0.5 : 0.2,
    detail: !place ? "The place of performance is not stated." : place === input.firmState ? `The work is in ${stateName(place)}, your home state.` : inArea ? `${stateName(place)} is one of the states you work in.` : projectsThere ? `You have ${projectsThere} project${projectsThere === 1 ? "" : "s"} in ${stateName(place)}, but it is not on your list of states.` : `The work is in ${stateName(place)}, outside the states you work in.`,
    evidence: place ? [`Place of performance: ${sol.placeOfPerformance}`] : [],
  });

  // Capacity: proposals already in hand.
  const cap = input.profile?.activeBidCapacity ?? null;
  factors.push({
    key: "capacity",
    label: "Capacity",
    weight: 0.1,
    score: cap ? Math.max(0, Math.min(1, 1 - input.activeBids / cap + 1 / cap)) : 0.6,
    detail: cap ? `You are working on ${input.activeBids} other bid${input.activeBids === 1 ? "" : "s"}; you said the team can carry ${cap} at once.` : `You are working on ${input.activeBids} other bid${input.activeBids === 1 ? "" : "s"}. Set how many the team can carry on the Profile page and this becomes a firm reading.`,
    evidence: [],
  });

  // Competition signals.
  let comp = 0.6;
  if (sol.setAside && sa.held) comp += 0.25;
  if (!sol.setAside) comp -= 0.15;
  if (sol.competitionSignals.some((s) => /incumbent/i.test(s))) comp -= 0.2;
  if (sol.competitionSignals.some((s) => /multiple|up to/i.test(s))) comp += 0.1;
  factors.push({ key: "competition", label: "Competition signals", weight: 0.1, score: Math.max(0, Math.min(1, comp)), detail: sol.competitionSignals.length ? sol.competitionSignals.join(" ") : "The solicitation gives no signal about competition.", evidence: [] });

  // Deadline.
  if (input.dueDate) {
    const days = businessDaysBetween(today, input.dueDate);
    const need = sol.type === "SF330" || sol.type === "RFQ" ? 8 : sol.type === "IFB" ? 10 : 12;
    if (input.dueDate.slice(0, 10) < today) stoppers.push("The submission date has passed.");
    factors.push({ key: "deadline", label: "Time to respond", weight: 0.1, score: input.dueDate.slice(0, 10) < today ? 0 : Math.min(1, days / need), detail: input.dueDate.slice(0, 10) < today ? "The submission date has passed." : `${days} business day${days === 1 ? "" : "s"} until it is due. A ${sol.type === "SF330" ? "qualifications package" : "proposal"} like this usually takes about ${need}.`, evidence: [`Due ${input.dueDate}`] });
  } else factors.push({ key: "deadline", label: "Time to respond", weight: 0.1, score: 0.5, detail: "We did not find a due date. Check the solicitation.", evidence: [] });

  // Bonding, for construction.
  const bondPct = sol.bonding?.performanceBondPercent ?? sol.bonding?.bidBondPercent ?? null;
  const value = sol.estimatedValue?.max ?? null;
  const single = input.profile?.bonding?.singleLimit ?? null;
  if (sol.bonding || (value && /construct/i.test(input.text))) {
    const needed = value && bondPct ? (value * Math.max(bondPct, 100)) / 100 : value;
    let s = 0.6;
    let detail = "Bonding is required; enter your bonding limits on the Profile page to check it.";
    if (needed && single) {
      s = single >= needed ? 1 : 0;
      detail = single >= needed ? `Your single-project bonding limit of $${single.toLocaleString("en-US")} covers the estimated $${Math.round(needed).toLocaleString("en-US")}.` : `The estimated $${Math.round(needed).toLocaleString("en-US")} is above your single-project bonding limit of $${single.toLocaleString("en-US")}.`;
      if (single < needed) stoppers.push("The bond required is above your single-project bonding limit.");
    } else if (single) detail = `Bonding is required and the value is not stated. Your single-project limit is $${single.toLocaleString("en-US")}.`;
    factors.push({ key: "bonding", label: "Bonding", weight: 0.05, score: s, detail, evidence: sol.bonding?.note ? [sol.bonding.note] : [] });
  }

  const totalW = factors.reduce((n, f) => n + f.weight, 0);
  const score = Math.round((100 * factors.reduce((n, f) => n + f.weight * f.score, 0)) / totalW);
  const suggestion = stoppers.length ? "no_go" : score >= 65 ? "go" : score >= 45 ? "review" : "no_go";
  return { score, suggestion, factors, stoppers, projectIds: picks.map((p) => p.project.id), assignments };
}
