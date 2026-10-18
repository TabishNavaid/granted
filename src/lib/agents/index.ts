/**
 * Agent entry points. Each function has the real input and output types the
 * backend will honor. Bodies are stubs that return mock data after a short
 * delay so the UI can show loading states.
 */
import type { Fact, Boilerplate, Match, Requirement, Section, MissingFact, ComplianceCheck, EmailDraft, Milestone, MonthlyPlan, EmailKind, AgentRun } from "@/lib/types";
import * as seed from "@/lib/mock/data";

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

export interface AgentResult<T> {
  output: T;
  run: Pick<AgentRun, "toolsCalled" | "sourcesUsed" | "costUsd">;
}

// ---------- Profile agent ----------
export interface ProfileAgentInput {
  orgId: string;
  websiteUrl: string;
  ein: string;
  documentIds: string[];
  interviewAnswers: Record<string, string>;
}
export interface ProfileAgentOutput {
  profile: { mission: string; programs: string[]; city: string; state: string; annualBudget: number | null; populations: string[]; causes: string[] };
  facts: Fact[];
  boilerplates: Boilerplate[];
  questions: { id: string; question: string; why: string }[];
}
export async function runProfileAgent(input: ProfileAgentInput): Promise<AgentResult<ProfileAgentOutput>> {
  await delay(1200);
  void input;
  return {
    output: {
      profile: {
        mission: seed.organization.mission,
        programs: ["After-School Studio", "Summer Launch", "Family Navigators"],
        city: seed.organization.city,
        state: seed.organization.state,
        annualBudget: seed.organization.annualBudget,
        populations: seed.organization.populations,
        causes: seed.organization.causes,
      },
      facts: seed.facts,
      boilerplates: seed.boilerplates,
      questions: [
        { id: "q_budget", question: "Your 990 shows $342,000 in expenses. Is that still about right for this year?", why: "Funders filter by budget size." },
        { id: "q_geo", question: "Which neighborhoods or ZIP codes do most of your students come from?", why: "Many funders restrict by county or city." },
        { id: "q_outcomes", question: "What is one result from last year you are proudest of?", why: "It becomes the opening line of your need statement." },
      ],
    },
    run: { toolsCalled: seed.agentRuns[6].toolsCalled, sourcesUsed: seed.agentRuns[6].sourcesUsed, costUsd: 0.47 },
  };
}

// ---------- Discovery agent ----------
export interface DiscoveryAgentInput {
  orgId: string;
  mode: "weekly" | "onboarding";
  maxResults?: number;
}
export interface DiscoveryAgentOutput {
  matches: Match[];
  screened: number;
  ineligible: number;
}
export async function runDiscoveryAgent(input: DiscoveryAgentInput): Promise<AgentResult<DiscoveryAgentOutput>> {
  await delay(1500);
  const list = seed.matches.slice(0, input.maxResults ?? 10);
  return {
    output: { matches: list, screened: 412, ineligible: 381 },
    run: { toolsCalled: seed.agentRuns[2].toolsCalled, sourcesUsed: seed.agentRuns[2].sourcesUsed, costUsd: 0.31 },
  };
}

// ---------- Planner (orchestrator) ----------
export interface PlannerAgentInput {
  orgId: string;
  month: string;
  hoursAvailable: number;
}
export async function runPlannerAgent(input: PlannerAgentInput): Promise<AgentResult<MonthlyPlan>> {
  await delay(900);
  return { output: { ...seed.monthlyPlan, month: input.month }, run: { toolsCalled: seed.agentRuns[5].toolsCalled, sourcesUsed: [], costUsd: 0.09 } };
}

// ---------- Proposal agent ----------
export interface ProposalAgentInput {
  orgId: string;
  applicationId: string;
  askAmount: number | null;
}
export interface ProposalAgentOutput {
  requirements: Requirement[];
  sections: Section[];
  missingFacts: MissingFact[];
  complianceChecks: ComplianceCheck[];
}
export async function runProposalAgent(input: ProposalAgentInput): Promise<AgentResult<ProposalAgentOutput>> {
  await delay(2000);
  void input;
  return {
    output: { requirements: seed.requirements, sections: seed.sections, missingFacts: seed.missingFacts, complianceChecks: seed.complianceChecks },
    run: { toolsCalled: seed.agentRuns[1].toolsCalled, sourcesUsed: seed.agentRuns[1].sourcesUsed, costUsd: 0.62 },
  };
}

export type ReviseAction = "rewrite" | "shorten" | "expand" | "tone";
export type ReviseTone = "plain" | "warm" | "formal" | "confident";
export interface ReviseTextInput {
  html: string;
  action: ReviseAction;
  tone?: ReviseTone;
  wordLimit?: number | null;
}
export interface ReviseTextOutput {
  html: string;
  note: string;
}
/**
 * Inline editor action. The stub applies a visible, deterministic transformation
 * so the UI can be exercised; the real implementation calls the model with revise_text.
 */
export async function reviseText(input: ReviseTextInput): Promise<ReviseTextOutput> {
  await delay(900);
  const { html, action, tone } = input;
  const protect: string[] = [];
  const shielded = html.replace(/<span data-(citation|gap)="[^"]*"[^>]*><\/span>/g, (m) => {
    protect.push(m);
    return `\u0000${protect.length - 1}\u0000`;
  });
  let out = shielded;
  let note = "";
  if (action === "shorten") {
    out = shielded
      .replace(/\b(very|really|truly|deliberately|simply|just)\s+/gi, "")
      .replace(/,\s+which is[^.,;]*(?=[.,;])/g, "")
      .replace(/\bin order to\b/gi, "to");
    note = "Trimmed filler words and one aside.";
  } else if (action === "expand") {
    out = shielded.replace(/<\/p>\s*$/, " We will report on each of these points in our mid-year update.</p>");
    note = "Added a closing sentence that points to reporting.";
  } else if (action === "tone") {
    const map: Record<ReviseTone, [RegExp, string][]> = {
      plain: [[/\butilize\b/gi, "use"], [/\bin order to\b/gi, "to"]],
      warm: [[/\bstudents\b/g, "our students"], [/\bWe\b/g, "Together, we"]],
      formal: [[/\bkids\b/gi, "students"], [/\bget\b/g, "receive"], [/\bfun\b/g, "engaging"]],
      confident: [[/\bwe hope to\b/gi, "we will"], [/\btry to\b/gi, ""], [/\bmay\b/g, "will"]],
    };
    for (const [re, rep] of map[tone ?? "plain"]) out = out.replace(re, rep);
    note = `Adjusted wording toward a ${tone ?? "plain"} tone.`;
  } else {
    out = shielded.replace(/\bThe structure is simple on purpose\./, "We keep the structure simple by design.");
    note = "Rewrote for flow. Facts and citations unchanged.";
  }
  const restored = out.replace(/\u0000(\d+)\u0000/g, (_, i) => protect[Number(i)]);
  return { html: restored, note };
}

// ---------- Outreach agent ----------
export interface OutreachAgentInput {
  orgId: string;
  funderId: string;
  applicationId: string | null;
  kind: EmailKind;
  notes?: string;
}
export async function runOutreachAgent(input: OutreachAgentInput): Promise<AgentResult<EmailDraft>> {
  await delay(1000);
  const draft = seed.emailDrafts.find((e) => e.funderId === input.funderId && e.kind === input.kind) ?? seed.emailDrafts[0];
  return { output: draft, run: { toolsCalled: seed.agentRuns[3].toolsCalled, sourcesUsed: seed.agentRuns[3].sourcesUsed, costUsd: 0.03 } };
}

// ---------- Calendar agent ----------
export interface CalendarAgentInput {
  orgId: string;
  applicationId: string;
  deadline: string;
  effort: "low" | "medium" | "high";
  needsBoardReview: boolean;
}
export async function runCalendarAgent(input: CalendarAgentInput): Promise<AgentResult<Milestone[]>> {
  await delay(700);
  const d = new Date(input.deadline);
  const minus = (days: number) => {
    const x = new Date(d);
    x.setDate(x.getDate() - days);
    return x.toISOString().slice(0, 10);
  };
  const lead = input.effort === "high" ? 21 : input.effort === "medium" ? 14 : 7;
  const out: Milestone[] = [
    { id: "ms_new_draft", orgId: input.orgId, applicationId: input.applicationId, title: "Full draft ready for review", dueDate: minus(lead), kind: "draft_due", assigneeId: null, done: false },
    { id: "ms_new_budget", orgId: input.orgId, applicationId: input.applicationId, title: "Budget sign-off", dueDate: minus(Math.round(lead * 0.7)), kind: "budget_signoff", assigneeId: null, done: false },
    ...(input.needsBoardReview
      ? [{ id: "ms_new_board", orgId: input.orgId, applicationId: input.applicationId, title: "Board review", dueDate: minus(Math.round(lead * 0.5)), kind: "board_review" as const, assigneeId: null, done: false }]
      : []),
    { id: "ms_new_submit", orgId: input.orgId, applicationId: input.applicationId, title: "Submit on funder portal", dueDate: minus(2), kind: "submit", assigneeId: null, done: false },
    { id: "ms_new_deadline", orgId: input.orgId, applicationId: input.applicationId, title: "Funder deadline", dueDate: input.deadline, kind: "deadline", assigneeId: null, done: false },
  ];
  return { output: out, run: { toolsCalled: seed.agentRuns[4].toolsCalled, sourcesUsed: seed.agentRuns[4].sourcesUsed, costUsd: 0.02 } };
}

export { tools, toolsFor, agentToolsets } from "./tools";
