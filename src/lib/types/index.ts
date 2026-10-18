/**
 * Domain types. Each type mirrors a table in supabase/migrations/0001_init.sql.
 * Column names are snake_case in Postgres and camelCase here; the Supabase
 * service adapter is the only place that maps between the two.
 */

export type ISODate = string;

// ---------- Enums (match Postgres enums) ----------

export type DocumentType = "annual_report" | "past_proposal" | "form_990" | "budget" | "board_list" | "determination_letter" | "other";
export type DocumentStatus = "uploaded" | "extracting" | "ready" | "failed";
export type FactCategory = "reach" | "outcomes" | "finance" | "organization" | "geography" | "people";
export type FactStatus = "confirmed" | "needs_review" | "stale";
export type BoilerplateType = "mission" | "history" | "program" | "staff_bio" | "evaluation" | "budget_narrative" | "need_statement";
export type FunderType = "private_foundation" | "community_foundation" | "corporate" | "federal" | "state" | "family_fund";
export type DeadlineType = "fixed" | "rolling" | "loi";
export type MatchStatus = "new" | "saved" | "dismissed" | "applying";
export type ApplicationStage = "discovered" | "researching" | "drafting" | "review" | "submitted" | "won" | "lost";
export type RequirementKind = "section" | "attachment" | "format" | "eligibility";
export type SectionStatus = "drafted" | "edited" | "approved" | "needs_facts" | "empty";
export type MissingFactStatus = "open" | "answered" | "skipped";
export type ComplianceStatus = "pass" | "warn" | "fail";
export type MilestoneKind = "deadline" | "draft_due" | "board_review" | "budget_signoff" | "submit" | "follow_up";
export type AgentName = "profile" | "discovery" | "planner" | "proposal" | "outreach" | "calendar";
export type InboxItemType = "monthly_plan" | "proposal_draft" | "email_draft" | "new_matches" | "milestones" | "missing_facts" | "profile_update";
export type InboxStatus = "pending" | "approved" | "rejected" | "edited";
export type AgentRunStatus = "queued" | "running" | "succeeded" | "failed";
export type OutcomeResult = "won" | "lost" | "no_response" | "withdrawn";
export type EmailKind = "intro" | "question" | "loi_cover" | "thank_you" | "follow_up";
export type PlanTier = "free" | "starter" | "growth";
export type MemberRole = "owner" | "editor" | "reviewer";

// ---------- Tables ----------

/** organizations */
export interface Organization {
  id: string;
  name: string;
  ein: string;
  websiteUrl: string;
  mission: string;
  annualBudget: number;
  fiscalYearEnd: string;
  foundedYear: number;
  city: string;
  state: string;
  serviceArea: string;
  causes: string[];
  populations: string[];
  staffCount: number;
  volunteerCount: number;
  createdAt: ISODate;
}

/** org_members (joined with profiles) */
export interface Member {
  id: string;
  orgId: string;
  fullName: string;
  email: string;
  role: MemberRole;
  status: "active" | "invited";
}

/** documents */
export interface Document {
  id: string;
  orgId: string;
  type: DocumentType;
  title: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  status: DocumentStatus;
  pageCount: number | null;
  factCount: number;
  uploadedAt: ISODate;
}

/** facts */
export interface Fact {
  id: string;
  orgId: string;
  label: string;
  value: string;
  category: FactCategory;
  sourceDocumentId: string | null;
  sourceExcerpt: string;
  sourcePage: number | null;
  confidence: number;
  status: FactStatus;
  lastConfirmedAt: ISODate;
}

/** boilerplates */
export interface Boilerplate {
  id: string;
  orgId: string;
  type: BoilerplateType;
  title: string;
  body: string;
  version: number;
  wordCount: number;
  updatedAt: ISODate;
  sourceDocumentIds: string[];
}

/** funders */
export interface Funder {
  id: string;
  name: string;
  ein: string | null;
  type: FunderType;
  description: string;
  focusAreas: string[];
  geography: string;
  givingMin: number | null;
  givingMax: number | null;
  websiteUrl: string;
  sourceUrl: string;
  aiPolicy: string | null;
  lastVerifiedAt: ISODate;
  recentGrantees: { name: string; amount: number; year: number }[];
}

export interface EligibilityRule {
  label: string;
  required: boolean;
}

/** opportunities */
export interface Opportunity {
  id: string;
  funderId: string;
  title: string;
  summary: string;
  deadline: ISODate | null;
  deadlineType: DeadlineType;
  amountMin: number | null;
  amountMax: number | null;
  eligibility: EligibilityRule[];
  guidelinesUrl: string;
  sourceUrl: string;
  lastVerifiedAt: ISODate;
  effort: "low" | "medium" | "high";
}

export interface EligibilityCheck {
  label: string;
  passed: boolean;
  detail: string;
}

/** matches */
export interface Match {
  id: string;
  orgId: string;
  opportunityId: string;
  fitScore: number;
  reasons: string[];
  cautions: string[];
  eligibilityChecks: EligibilityCheck[];
  status: MatchStatus;
  isNew: boolean;
  createdAt: ISODate;
}

/** applications */
export interface Application {
  id: string;
  orgId: string;
  opportunityId: string;
  matchId: string | null;
  stage: ApplicationStage;
  askAmount: number | null;
  ownerId: string | null;
  submittedAt: ISODate | null;
  createdAt: ISODate;
  updatedAt: ISODate;
}

/** requirements */
export interface Requirement {
  id: string;
  applicationId: string;
  title: string;
  kind: RequirementKind;
  detail: string | null;
  wordLimit: number | null;
  required: boolean;
  order: number;
  satisfied: boolean;
}

/** sections */
export interface Section {
  id: string;
  applicationId: string;
  requirementId: string | null;
  title: string;
  /** TipTap HTML. Citation nodes carry data-fact-id; gap nodes carry data-gap-id. */
  bodyHtml: string;
  wordLimit: number | null;
  status: SectionStatus;
  order: number;
  updatedAt: ISODate;
}

/** missing_facts */
export interface MissingFact {
  id: string;
  applicationId: string;
  sectionId: string | null;
  question: string;
  whyItMatters: string;
  suggestedLabel: string;
  status: MissingFactStatus;
  answer: string | null;
}

/** compliance_checks */
export interface ComplianceCheck {
  id: string;
  applicationId: string;
  rule: string;
  status: ComplianceStatus;
  detail: string;
  sectionId: string | null;
}

/** milestones */
export interface Milestone {
  id: string;
  orgId: string;
  applicationId: string;
  title: string;
  dueDate: ISODate;
  kind: MilestoneKind;
  assigneeId: string | null;
  done: boolean;
}

/** contacts */
export interface Contact {
  id: string;
  funderId: string;
  name: string;
  role: string;
  email: string | null;
  publicSourceUrl: string;
}

/** email_drafts */
export interface EmailDraft {
  id: string;
  orgId: string;
  applicationId: string | null;
  funderId: string;
  contactId: string | null;
  kind: EmailKind;
  subject: string;
  body: string;
}

export interface PlanItem {
  opportunityId: string;
  effort: "low" | "medium" | "high";
  expectedAward: number;
  why: string;
  decision: "keep" | "skip" | "swap";
}

/** monthly_plans */
export interface MonthlyPlan {
  id: string;
  orgId: string;
  month: string;
  summary: string;
  items: PlanItem[];
  status: "proposed" | "approved";
}

export type InboxPayload =
  | { type: "monthly_plan"; planId: string }
  | { type: "proposal_draft"; applicationId: string; sectionCount: number; openQuestions: number }
  | { type: "email_draft"; emailDraftId: string }
  | { type: "new_matches"; matchIds: string[] }
  | { type: "milestones"; applicationId: string; milestoneIds: string[] }
  | { type: "missing_facts"; applicationId: string; missingFactIds: string[] }
  | { type: "profile_update"; factId: string; proposedValue: string; sourceDocumentId: string };

/** inbox_items */
export interface InboxItem {
  id: string;
  orgId: string;
  agent: AgentName;
  type: InboxItemType;
  title: string;
  summary: string;
  payload: InboxPayload;
  status: InboxStatus;
  priority: "high" | "normal";
  sourceCount: number;
  agentRunId: string | null;
  createdAt: ISODate;
  resolvedAt: ISODate | null;
  rejectionReason: string | null;
}

export interface ToolCall {
  name: string;
  summary: string;
  durationMs: number;
}

export interface SourceUsed {
  label: string;
  url: string | null;
  documentId: string | null;
  kind: "document" | "web" | "database";
}

/** agent_runs */
export interface AgentRun {
  id: string;
  orgId: string;
  agent: AgentName;
  trigger: "schedule" | "user" | "event";
  title: string;
  status: AgentRunStatus;
  toolsCalled: ToolCall[];
  sourcesUsed: SourceUsed[];
  outputSummary: string;
  costUsd: number;
  startedAt: ISODate;
  finishedAt: ISODate | null;
  inboxItemId: string | null;
}

/** outcomes */
export interface Outcome {
  id: string;
  applicationId: string;
  result: OutcomeResult;
  awardAmount: number | null;
  feedback: string | null;
  decidedAt: ISODate;
}

/** subscriptions */
export interface Subscription {
  id: string;
  orgId: string;
  plan: PlanTier;
  status: "active" | "trialing" | "past_due" | "canceled";
  currentPeriodEnd: ISODate;
  seats: number;
  usage: { proposalsThisMonth: number; proposalLimit: number | null; matchesThisMonth: number; matchLimit: number | null };
}

export interface Invoice {
  id: string;
  date: ISODate;
  amount: number;
  status: "paid" | "open" | "failed";
  pdfUrl: string;
}

/** notification_settings */
export interface NotificationSettings {
  weeklyDigest: boolean;
  milestoneReminders: boolean;
  inboxAlerts: boolean;
  reminderDaysBefore: number;
}

// ---------- Composite view models (what screens actually need) ----------

export interface MatchView extends Match {
  opportunity: Opportunity;
  funder: Funder;
}

export interface ApplicationView extends Application {
  opportunity: Opportunity;
  funder: Funder;
  nextMilestone: Milestone | null;
  sectionProgress: { done: number; total: number };
  outcome: Outcome | null;
}

export interface ProposalWorkspace {
  application: ApplicationView;
  requirements: Requirement[];
  sections: Section[];
  missingFacts: MissingFact[];
  complianceChecks: ComplianceCheck[];
  facts: Fact[];
  documents: Document[];
}

export interface CalendarEvent {
  id: string;
  date: ISODate;
  title: string;
  kind: MilestoneKind;
  applicationId: string;
  funderName: string;
  done: boolean;
}
