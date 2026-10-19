/**
 * Domain types. Each type mirrors a table in supabase/migrations/0001_init.sql.
 * Column names are snake_case in Postgres and camelCase here; the Supabase
 * service adapter is the only place that maps between the two.
 */

export type ISODate = string;

// ---------- Enums (match Postgres enums) ----------

export type DocumentType = "annual_report" | "past_proposal" | "form_990" | "budget" | "board_list" | "determination_letter" | "w9" | "audit" | "other";
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
export type MilestoneKind = "deadline" | "draft_due" | "board_review" | "budget_signoff" | "submit" | "follow_up" | "report_due";
export type AgentName = "profile" | "discovery" | "planner" | "proposal" | "outreach" | "calendar";
export type InboxItemType = "monthly_plan" | "proposal_draft" | "email_draft" | "new_matches" | "milestones" | "missing_facts" | "profile_update";
export type InboxStatus = "pending" | "approved" | "rejected" | "edited";
export type AgentRunStatus = "queued" | "running" | "succeeded" | "failed";
export type OutcomeResult = "won" | "lost" | "no_response" | "withdrawn";
export type EmailKind = "intro" | "question" | "loi_cover" | "thank_you" | "follow_up" | "feedback_request";
export type PlanTier = "free" | "starter" | "growth";
export type MemberRole = "owner" | "editor" | "reviewer";
export type ProposalMode = "letter" | "proposal" | "concept_note";
export type EmailStatus = "draft" | "approved" | "sent";
export type ContactKind = "board" | "staff" | "funder" | "partner" | "volunteer" | "other";
export type SocialPlatform = "instagram" | "linkedin" | "facebook" | "x";
export type BudgetCategory = "personnel" | "fringe" | "travel" | "equipment" | "supplies" | "contractual" | "other" | "indirect";

// ---------- Tables ----------

/** organizations */
export interface Organization {
  id: string;
  name: string;
  ein: string;
  websiteUrl: string;
  mission: string;
  /** Null when the organization has not stated it anywhere we read. Never inferred. */
  annualBudget: number | null;
  fiscalYearEnd: string;
  foundedYear: number | null;
  city: string;
  state: string;
  serviceArea: string;
  causes: string[];
  populations: string[];
  staffCount: number | null;
  volunteerCount: number | null;
  /** Where the user is in setup, so they can leave and come back. */
  onboardingStep: OnboardingStep;
  /** Secret in the ICS feed URL. */
  calendarToken: string;
  createdAt: ISODate;
}

export type OnboardingStep = "start" | "ein" | "reading" | "profile" | "gaps" | "matches" | "done";

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
  /** Web page the fact was read from, when the source is the org's own site. */
  sourceUrl: string | null;
  /** Short printed label for the source, e.g. "riverbendyouth.org/about" or "You". */
  sourceLabel: string | null;
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
  /** See Opportunity.sourceNote. */
  sourceNote?: string;
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
  /** True when the funder has only announced the opportunity and has not opened it yet. */
  forecasted: boolean;
  /** How old the source is, when that matters more than when we read it, e.g. "IRS Form 990-PF, tax year 2024". */
  sourceNote?: string;
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
  /** Why the user set it aside. Fed back into the next search so similar notices score lower. */
  dismissReason: string | null;
  createdAt: ISODate;
}

/** applications */
export interface Application {
  id: string;
  orgId: string;
  opportunityId: string;
  matchId: string | null;
  stage: ApplicationStage;
  /** A one-page letter of inquiry, or a full proposal built from the funder's guidelines. */
  mode: ProposalMode;
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
  /** The [[gap:KEY]] the letter writer used, so a redraft can find it again. */
  gapKey?: string | null;
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
  /** Recipient address when known. */
  to: string | null;
  toName: string | null;
  status: EmailStatus;
  sentAt: ISODate | null;
  sentVia: "gmail" | "outlook" | "manual" | null;
  /** When a follow-up reminder is due, if one was set. */
  followUpAt: ISODate | null;
  createdAt: ISODate;
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
  | {
      type: "profile_update";
      factId: string;
      proposedValue: string;
      sourceDocumentId: string;
      /** The passage in the source document the proposed value was read from. */
      sourceExcerpt?: string;
      sourcePage?: number | null;
    };

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
  tokensIn: number;
  tokensOut: number;
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
  /** Why it was declined, from a fixed list, when the funder said or the director judged. */
  lossReasons?: LossReason[];
  /** What the director wants the next application to do differently. */
  lessons?: string | null;
}

export type LossReason = "fit" | "budget_size" | "competition" | "eligibility" | "outcomes_data" | "timing" | "relationship" | "writing" | "unknown";

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

/** saved_searches */
export interface SavedSearch {
  id: string;
  orgId: string;
  name: string;
  keyword: string;
  fundingCategories: string[];
  createdAt: ISODate;
  lastRunAt: ISODate | null;
}

/** A Grants.gov notice from a search, before anyone has scored it. Everything here is from the API. */
export interface SearchCandidate {
  externalId: string;
  number: string;
  title: string;
  agency: string;
  status: "posted" | "forecasted";
  closeDate: string | null;
  url: string;
}

/** section_versions */
export interface SectionVersion {
  id: string;
  sectionId: string;
  bodyHtml: string;
  note: string;
  byName: string;
  createdAt: ISODate;
}

/** org_contacts: people the organization knows, as opposed to funder staff found on public pages. */
export interface OrgContact {
  id: string;
  orgId: string;
  name: string;
  organization: string;
  role: string;
  email: string | null;
  phone: string | null;
  kind: ContactKind;
  /** How the organization knows them, in their words. */
  relationship: string;
  funderId: string | null;
  source: "manual" | "csv";
  lastTouchAt: ISODate | null;
  createdAt: ISODate;
}

/** contact_notes */
export interface ContactNote {
  id: string;
  orgId: string;
  contactId: string;
  kind: "note" | "call" | "email" | "meeting" | "intro";
  note: string;
  nextStep: string | null;
  happenedAt: ISODate;
}

export interface SocialPost {
  id: string;
  platform: SocialPlatform;
  date: ISODate;
  text: string;
  /** What the post is about, so the user sees why it is on the calendar. */
  tiedTo: { kind: "application" | "win" | "program" | "general"; id: string | null; label: string };
  status: "draft" | "approved" | "skipped";
}

/** social_campaigns */
export interface SocialCampaign {
  id: string;
  orgId: string;
  /** YYYY-MM */
  month: string;
  theme: string;
  posts: SocialPost[];
  status: "draft" | "approved";
  createdAt: ISODate;
}

export interface BudgetLine {
  id: string;
  category: BudgetCategory;
  item: string;
  amount: number;
  note: string;
}

/** budgets */
export interface Budget {
  id: string;
  orgId: string;
  applicationId: string;
  lines: BudgetLine[];
  justification: string;
  updatedAt: ISODate;
}

export interface ReviewCriterion {
  criterion: string;
  /** 1 to 5 */
  score: number;
  evidence: string;
  fix: string;
}

/** reviewer_checks */
export interface ReviewerCheck {
  id: string;
  applicationId: string;
  overall: number;
  criteria: ReviewCriterion[];
  summary: string;
  createdAt: ISODate;
}

/** integration_connections (tokens stay server-side and never reach the browser) */
export interface IntegrationConnection {
  id: string;
  orgId: string;
  provider: "google" | "microsoft";
  accountEmail: string;
  scopes: string[];
  connectedAt: ISODate;
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
  assigneeId: string | null;
}


// ---------- Complete demo: analytics, funders, knowledge, planning ----------

/** One measure a program tracks month by month. The latest entry is also a fact a draft may cite. */
export interface ImpactMetric {
  id: string;
  orgId: string;
  label: string;
  unit: string;
  program: string | null;
  entries: { month: string; value: number; note: string | null }[];
  factId: string | null;
}

/** How the organization writes, measured from its own text, plus a note in its own words that drafting follows. */
export interface VoiceProfile {
  note: string;
  sampleWords: number;
  avgSentenceWords: number;
  usesWe: boolean;
  contractions: boolean;
  readingGrade: number;
  commonPhrases: string[];
  sources: string[];
}

export type AgentAutonomy = "draft" | "schedule" | "act";

export interface BoilerplateVersion {
  id: string;
  boilerplateId: string;
  version: number;
  body: string;
  savedAt: ISODate;
}

export interface WinAnalytics {
  decided: number;
  won: number;
  lost: number;
  noResponse: number;
  winRate: number | null;
  dollarsWon: number;
  dollarsAsked: number;
  pending: number;
  pendingAsk: number;
  /** Rows the page shows as small tables. `n` is how many decided applications sit behind each rate. */
  byFunderType: AnalyticsRow[];
  byAskSize: AnalyticsRow[];
  byRelationship: AnalyticsRow[];
  bySection: AnalyticsRow[];
  byFunder: AnalyticsRow[];
  lossReasons: { reason: LossReason; label: string; count: number }[];
  lessons: { applicationTitle: string; funder: string; lessons: string; decidedAt: ISODate }[];
  /** Plain sentences about what the numbers suggest, each with its sample size. Never stronger than the data. */
  findings: string[];
  timeline: { month: string; asked: number; won: number }[];
}

export interface AnalyticsRow {
  label: string;
  decided: number;
  won: number;
  winRate: number | null;
  dollarsWon: number;
}

export interface FunderSummary {
  funder: Funder;
  /** "applied", "matched", or "directory": how this workspace knows the funder. */
  relation: "applied" | "matched" | "directory";
  applications: number;
  won: number;
  dollarsWon: number;
  fitScore: number | null;
  acceptsUnsolicited: boolean | null;
}

export interface FunderProfile {
  funder: Funder;
  /** Filled for private foundations read from IRS 990-PF filings. */
  filing: {
    taxYear: number;
    ein: string;
    city: string;
    state: string;
    assets: number | null;
    totalGiving: number | null;
    grantCount: number;
    grantMedian: number | null;
    grantMin: number | null;
    grantMax: number | null;
    acceptsUnsolicited: boolean | null;
    application: { contact: string | null; howTo: string | null; deadlines: string | null; restrictions: string | null } | null;
    granteeStates: { state: string; count: number }[];
    granteeCities: { city: string; state: string; count: number }[];
    grantees: { name: string; city: string; state: string; amount: number; purpose: string }[];
    officers: { name: string; title: string }[];
    irsUrl: string;
  } | null;
  opportunities: Opportunity[];
  match: MatchView | null;
  history: { application: Application; opportunityTitle: string; outcome: Outcome | null }[];
  contacts: Contact[];
  /** People in the director's own network linked to this funder, or whose names appear among its officers. */
  connections: { contactId: string; name: string; role: string; how: string }[];
  peers: { name: string; city: string; state: string; sharedFunders: { funderId: string; name: string; amount: number; purpose: string; year: number }[] }[];
  recommendedAsk: { amount: number; low: number; high: number; why: string[] } | null;
}

export interface ScholarshipProfile {
  state: string;
  level: "high_school" | "undergraduate" | "graduate" | "adult";
  field: string;
  hometown: string;
}

export interface ScholarshipMatch {
  funderId: string;
  name: string;
  city: string;
  state: string;
  taxYear: number;
  totalScholarships: number;
  awards: number;
  typicalAward: number | null;
  /** Schools or places past awards went, as filed. Individual recipients are never named. */
  pastRecipients: { name: string; city: string; state: string; amount: number }[];
  application: { contact: string | null; howTo: string | null; deadlines: string | null; restrictions: string | null } | null;
  reasons: string[];
  cautions: string[];
  irsUrl: string;
}

export interface ReminderPreview {
  milestoneId: string;
  sendOn: ISODate;
  to: string;
  subject: string;
  body: string;
  status: "scheduled" | "due" | "sent";
}

export interface CopilotAnswer {
  answer: string;
  /** Where the answer came from: screens and records in the workspace. */
  sources: { label: string; href: string }[];
  /** "rules" in the demo and without a model key; "model" when a key is set. */
  engine: "rules" | "model";
  suggestions: string[];
}

export interface WinKit {
  post: string;
  newsletter: string;
  thankYou: { subject: string; body: string };
}

export interface LogicModelRow {
  column: "inputs" | "activities" | "outputs" | "outcomes";
  text: string;
  factId: string | null;
}
