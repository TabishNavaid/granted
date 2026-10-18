import type { AgentName, ApplicationStage, MilestoneKind } from "@/lib/types";

export const agentMeta: Record<AgentName, { label: string; shortLabel: string; description: string }> = {
  profile: { label: "Profile agent", shortLabel: "Profile", description: "Reads your website and documents and keeps your facts current." },
  discovery: { label: "Discovery agent", shortLabel: "Discovery", description: "Scans funders every week and scores each one for fit." },
  planner: { label: "Planner", shortLabel: "Planner", description: "Proposes what to apply for each month." },
  proposal: { label: "Proposal agent", shortLabel: "Proposal", description: "Parses guidelines and drafts every section from your facts." },
  outreach: { label: "Outreach agent", shortLabel: "Outreach", description: "Drafts funder emails for you to send." },
  calendar: { label: "Calendar agent", shortLabel: "Calendar", description: "Plans milestones backward from each deadline." },
};

export const stageMeta: Record<ApplicationStage, { label: string; tone: "neutral" | "info" | "accent" | "warning" | "success" | "danger" }> = {
  discovered: { label: "Discovered", tone: "neutral" },
  researching: { label: "Researching", tone: "info" },
  drafting: { label: "Drafting", tone: "accent" },
  review: { label: "Review", tone: "warning" },
  submitted: { label: "Submitted", tone: "info" },
  won: { label: "Won", tone: "success" },
  lost: { label: "Lost", tone: "danger" },
};

export const stageOrder: ApplicationStage[] = ["discovered", "researching", "drafting", "review", "submitted", "won", "lost"];

export const milestoneMeta: Record<MilestoneKind, { label: string; tone: "neutral" | "info" | "accent" | "warning" | "success" | "danger" }> = {
  deadline: { label: "Deadline", tone: "danger" },
  draft_due: { label: "Draft due", tone: "accent" },
  board_review: { label: "Board review", tone: "info" },
  budget_signoff: { label: "Budget sign-off", tone: "warning" },
  submit: { label: "Submit", tone: "success" },
  follow_up: { label: "Follow up", tone: "neutral" },
};
