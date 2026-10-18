import type { AgentName, ApplicationStage, MilestoneKind } from "@/lib/types";

export const agentMeta: Record<AgentName, { label: string; shortLabel: string; description: string }> = {
  profile: { label: "Profile agent", shortLabel: "Profile", description: "Reads your website and documents, and keeps your facts fresh." },
  discovery: { label: "Discovery agent", shortLabel: "Discovery", description: "Looks at funders every week and tells you which ones fit." },
  planner: { label: "Planner", shortLabel: "Planner", description: "Suggests what to go for each month." },
  proposal: { label: "Proposal agent", shortLabel: "Proposal", description: "Reads the guidelines and writes every section from your own facts." },
  outreach: { label: "Outreach agent", shortLabel: "Outreach", description: "Writes funder emails for you to send." },
  calendar: { label: "Calendar agent", shortLabel: "Calendar", description: "Works backward from each deadline so nothing sneaks up on you." },
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
