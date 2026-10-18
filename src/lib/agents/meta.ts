import type { AgentName, ApplicationStage, InboxItemType, MilestoneKind } from "@/lib/types";

/**
 * How each part of the system is named for the user. The user never sees
 * "agent": they see the thing they care about.
 */
export const agentMeta: Record<AgentName, { label: string; shortLabel: string; description: string }> = {
  profile: { label: "Your profile", shortLabel: "Profile", description: "Reads your website and documents and keeps your facts current." },
  discovery: { label: "Funder search", shortLabel: "Funders", description: "Finds funders and tells you which ones fit, and why." },
  planner: { label: "Monthly plan", shortLabel: "Plan", description: "Suggests what to go for each month." },
  proposal: { label: "Proposal drafts", shortLabel: "Drafts", description: "Reads the guidelines and writes every section from your own facts." },
  outreach: { label: "Funder emails", shortLabel: "Emails", description: "Writes funder emails for you to send." },
  calendar: { label: "Deadlines", shortLabel: "Deadlines", description: "Works backward from each deadline so nothing sneaks up on you." },
};

/** What an Inbox item is, in the user's words. */
export const inboxKindLabel: Record<InboxItemType, string> = {
  monthly_plan: "Your plan for the month",
  proposal_draft: "Draft ready for you",
  email_draft: "Email ready to send",
  new_matches: "New funders found",
  milestones: "Schedule to approve",
  missing_facts: "Questions for you",
  profile_update: "A fact to check",
};

/** The word an item of this kind gets once it is approved. */
export const doneWord: Record<InboxItemType, string> = {
  monthly_plan: "Approved",
  proposal_draft: "Approved",
  email_draft: "Approved",
  new_matches: "Saved",
  milestones: "Scheduled",
  missing_facts: "Answered",
  profile_update: "Updated",
};

export const stageMeta: Record<ApplicationStage, { label: string; tone: "neutral" | "info" | "accent" | "warning" | "success" | "danger" | "won" }> = {
  discovered: { label: "Discovered", tone: "neutral" },
  researching: { label: "Researching", tone: "neutral" },
  drafting: { label: "Drafting", tone: "accent" },
  review: { label: "Review", tone: "warning" },
  submitted: { label: "Submitted", tone: "accent" },
  won: { label: "Won", tone: "won" },
  lost: { label: "Lost", tone: "danger" },
};

export const stageOrder: ApplicationStage[] = ["discovered", "researching", "drafting", "review", "submitted", "won", "lost"];

export const milestoneMeta: Record<MilestoneKind, { label: string; tone: "neutral" | "info" | "accent" | "warning" | "success" | "danger" | "won" }> = {
  deadline: { label: "Deadline", tone: "danger" },
  draft_due: { label: "Draft due", tone: "accent" },
  board_review: { label: "Board review", tone: "neutral" },
  budget_signoff: { label: "Budget sign-off", tone: "neutral" },
  submit: { label: "Submit", tone: "accent" },
  follow_up: { label: "Follow up", tone: "neutral" },
};
