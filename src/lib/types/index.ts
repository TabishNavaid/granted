/**
 * Domain types. Each type mirrors a table in supabase/migrations/0001_init.sql.
 * Column names are snake_case in Postgres and camelCase here; the Supabase
 * service adapter is the only place that maps between the two.
 */

export type ISODate = string;

// ---------- Enums (match Postgres enums) ----------

export type DocumentType = "annual_report" | "past_proposal" | "form_990" | "budget" | "board_list" | "determination_letter" | "w9" | "audit" | "rfp" | "addendum" | "resume" | "capability_statement" | "bond_letter" | "insurance_certificate" | "project_photo" | "other";
export type DocumentStatus = "uploaded" | "extracting" | "ready" | "failed";
export type FactCategory = "reach" | "outcomes" | "finance" | "organization" | "geography" | "people" | "portfolio" | "credentials";
export type FactStatus = "confirmed" | "needs_review" | "stale";
export type BoilerplateType = "mission" | "history" | "program" | "staff_bio" | "evaluation" | "budget_narrative" | "need_statement" | "approach" | "quality_control" | "safety_plan" | "facilities" | "personal_statement";
export type FunderType = "private_foundation" | "community_foundation" | "corporate" | "federal" | "state" | "family_fund" | "local_government" | "university" | "private_owner";
export type DeadlineType = "fixed" | "rolling" | "loi";
export type MatchStatus = "new" | "saved" | "dismissed" | "applying";
/** Every stage any kind of application can be in. Each opportunity kind shows its own subset and labels (src/lib/segments). */
export type ApplicationStage = "discovered" | "go_no_go" | "researching" | "drafting" | "review" | "submitted" | "shortlisted" | "interview" | "won" | "lost";
export type RequirementKind = "section" | "attachment" | "format" | "eligibility" | "evaluation" | "submission" | "form";
export type SectionStatus = "drafted" | "edited" | "approved" | "needs_facts" | "empty";
export type MissingFactStatus = "open" | "answered" | "skipped";
export type ComplianceStatus = "pass" | "warn" | "fail";
export type MilestoneKind = "deadline" | "draft_due" | "board_review" | "budget_signoff" | "submit" | "follow_up" | "report_due" | "go_no_go" | "questions_due" | "prebid_meeting" | "site_visit" | "addendum" | "interview";
export type AgentName = "profile" | "discovery" | "planner" | "proposal" | "outreach" | "calendar";
export type InboxItemType = "monthly_plan" | "proposal_draft" | "email_draft" | "new_matches" | "milestones" | "missing_facts" | "profile_update" | "go_no_go" | "addendum";
export type InboxStatus = "pending" | "approved" | "rejected" | "edited";
export type AgentRunStatus = "queued" | "running" | "succeeded" | "failed";
export type OutcomeResult = "won" | "lost" | "no_response" | "withdrawn";
export type EmailKind = "intro" | "question" | "loi_cover" | "thank_you" | "follow_up" | "feedback_request";
export type PlanTier = "free" | "starter" | "growth";
export type MemberRole = "owner" | "editor" | "reviewer";
export type ProposalMode = "letter" | "proposal" | "concept_note" | "bid" | "sf330" | "research" | "essay";
export type EmailStatus = "draft" | "approved" | "sent";
export type ContactKind = "board" | "staff" | "funder" | "partner" | "volunteer" | "other";
export type SocialPlatform = "instagram" | "linkedin" | "facebook" | "x";
export type BudgetCategory = "personnel" | "fringe" | "travel" | "equipment" | "supplies" | "contractual" | "other" | "indirect";

// ---------- Tables ----------

/** organizations */
export interface Organization {
  id: string;
  /** What kind of applicant this is. Setup asks first, and every later step adapts. */
  orgType: OrgType;
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

export type OnboardingStep = "start" | "type" | "ein" | "reading" | "profile" | "gaps" | "matches" | "done";

/** Nonprofit, a for-profit firm (architecture, engineering, and construction first), a research team, or one person. */
export type OrgType = "nonprofit" | "firm" | "research" | "individual";

/** Grant, contract or bid, research funding, or scholarship or fellowship. Each has its own rules, sections, dates, and stages. */
export type OpportunityKind = "grant" | "contract" | "research" | "scholarship";

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
  /** Grant when missing, for rows written before kinds existed. */
  kind?: OpportunityKind;
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
  /** Contracts and bids: the solicitation as issued. */
  solicitation?: Solicitation | null;
  /** Bids: the market sector, e.g. "Healthcare", for win analytics by sector. */
  sector?: string | null;
}

export type SolicitationType = "RFP" | "RFQ" | "RFI" | "IFB" | "SF330" | "sources_sought";
export type BidDateKind = "questions_due" | "prebid_meeting" | "site_visit" | "submission" | "interview" | "award" | "other";

export interface BidDate {
  kind: BidDateKind;
  /** ISO date, or date and time when the solicitation gives one. */
  date: ISODate;
  label: string;
  /** Where it is, or how to attend, as written. */
  note: string | null;
  /** Section or page of the solicitation that sets it. */
  ref: string | null;
  /** True when it is mandatory to attend. */
  mandatory?: boolean;
}

export interface Solicitation {
  type: SolicitationType;
  number: string | null;
  /** NAICS codes the solicitation names. */
  naics: string[];
  /** Set-aside as written, e.g. "Total Small Business Set-Aside (FAR 19.5)". Null for full and open. */
  setAside: string | null;
  placeOfPerformance: string | null;
  estimatedValue: { min: number | null; max: number | null; note: string | null } | null;
  dates: BidDate[];
  /** Where the solicitation came from. */
  source: "samgov" | "upload" | "link" | "grantsgov";
  /** The document the firm uploaded, when there is one. */
  documentId: string | null;
  /** Bonding the solicitation requires, when stated. */
  bonding: { bidBondPercent: number | null; performanceBondPercent: number | null; paymentBondPercent: number | null; note: string | null } | null;
  /** Licenses, registrations, and certifications it requires, as written. */
  requiredCredentials: string[];
  /** Forms it requires, e.g. "SF 330", "SF 1442", "Bid bond". */
  forms: string[];
  /** Page or length limits, as written. */
  pageLimits: string[];
  /** Evaluation factors with their weight or order of importance. */
  evaluation: { factor: string; weight: string | null; ref: string | null }[];
  /** Words in the notice that suggest how much competition there is (an incumbent, multiple awards, a set-aside). */
  competitionSignals: string[];
  /** The issuing office's contact, as published. */
  contact: { name: string; email: string | null; phone: string | null } | null;
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
  /** Compliance matrix: where the solicitation sets this requirement, e.g. "Section 3.2, page 7". */
  ref?: string | null;
  /** The sentence it comes from, quoted. */
  excerpt?: string | null;
  /** The proposal section that answers it, once one does. */
  answeredInSectionId?: string | null;
  /** Section key the drafter should answer it in (cover_letter, qualifications, projects, personnel, approach, schedule, quality_safety, references, forms, pricing). */
  sectionKey?: string | null;
  matrixStatus?: MatrixStatus;
}

export type MatrixStatus = "met" | "partial" | "open" | "firm_action" | "not_applicable";

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
  /** Bids only: by sector and by estimated project size, and how many the firm decided not to pursue. */
  bySector?: AnalyticsRow[];
  byProjectSize?: AnalyticsRow[];
  noGo?: number;
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
  /** 0 to 100, from state, hometown, level, field, how much of its giving is scholarships, and limits it sets. */
  fit?: number;
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

// ---------- Firms: architecture, engineering, and construction ----------

export type FirmDiscipline = "architecture" | "engineering" | "construction" | "design_build" | "construction_management";
export type ProjectRole = "prime" | "subconsultant" | "joint_venture" | "construction_manager" | "general_contractor" | "design_builder";
export type ClientType = "federal" | "state" | "municipal" | "k12" | "higher_ed" | "healthcare" | "private" | "nonprofit";
export type CertificationKind = "small_business" | "8a" | "wosb" | "edwosb" | "sdvosb" | "vosb" | "hubzone" | "mbe" | "wbe" | "dbe" | "license" | "registration" | "other";

/** firm_profiles: one per firm. Everything here is entered or confirmed by the firm. */
export interface FirmProfile {
  orgId: string;
  disciplines: FirmDiscipline[];
  /** Work categories, as NAICS codes. The first marked primary is the firm's primary NAICS. */
  naics: { code: string; label: string; primary: boolean }[];
  /** Sectors the firm works in, e.g. "Healthcare", "K-12 education", "Federal". */
  sectors: string[];
  /** States the firm will travel to or is licensed in. */
  states: string[];
  uei: string | null;
  cageCode: string | null;
  samRegistrationExpires: ISODate | null;
  bonding: { singleLimit: number | null; aggregateLimit: number | null; surety: string | null; asOf: ISODate | null; documentId: string | null } | null;
  insurance: { kind: string; perOccurrence: number | null; aggregate: number | null; carrier: string | null; expires: ISODate | null }[];
  safety: { emr: number | null; emrYear: number | null; trir: number | null; dart: number | null; fatalitiesFiveYears: number | null; programNote: string | null } | null;
  /** SF 330 Part II: employees by discipline. */
  employeesByDiscipline: { discipline: string; code: string | null; count: number }[];
  /** SF 330 Part II item 11, a range the firm chooses. Never computed. */
  averageAnnualRevenue: { federal: string | null; nonFederal: string | null; total: string | null } | null;
  /** Hourly rates the firm uses for fee proposals, by role. Entered by the firm. */
  rates: { role: string; rate: number }[];
  /** How many proposals the team can carry at once, in the firm's own judgment. Go/no-go reads it. */
  activeBidCapacity: number | null;
  updatedAt: ISODate;
}

/** portfolio_projects */
export interface PortfolioProject {
  id: string;
  orgId: string;
  name: string;
  client: string;
  clientType: ClientType;
  city: string;
  state: string;
  /** What the firm did, in a few sentences, in the firm's words. */
  scope: string;
  sector: string;
  /** Building type or project type, e.g. "Fire station", "Clinic renovation". */
  projectType: string;
  sizeSqft: number | null;
  contractValue: number | null;
  /** Construction cost, when it differs from the firm's fee. */
  constructionCost: number | null;
  startDate: ISODate | null;
  completionDate: ISODate | null;
  /** "completed" or "in_progress" */
  status: "completed" | "in_progress";
  role: ProjectRole;
  deliveryMethod: string | null;
  services: string[];
  /** What happened: on time, on budget, awards, certifications. Only what the firm states. */
  outcomes: string[];
  reference: { name: string; title: string; organization: string; phone: string | null; email: string | null } | null;
  photos: { documentId: string | null; url: string | null; caption: string }[];
  personnelIds: string[];
  /** SF 330 experience profile code, e.g. "F02" for fire stations. */
  profileCode: string | null;
  /** Where the record came from: typed by the firm, imported from a document, or read from its site. */
  source: { kind: "entered" | "document" | "website"; label: string; url: string | null };
}

/** personnel */
export interface Personnel {
  id: string;
  orgId: string;
  name: string;
  title: string;
  /** The role this person usually plays on a proposal, e.g. "Project manager", "Architect of record". */
  role: string;
  discipline: string;
  yearsTotal: number | null;
  yearsWithFirm: number | null;
  education: string[];
  registrations: { license: string; state: string; number: string | null; expires: ISODate | null }[];
  certifications: string[];
  /** A short professional summary in the firm's words. Tailored per bid. */
  summary: string;
  projectIds: string[];
  resumeDocumentId: string | null;
  /** Firm's own office this person works from. */
  office: string | null;
}

/** certifications: small business and ownership statuses, licenses, registrations. */
export interface Certification {
  id: string;
  orgId: string;
  kind: CertificationKind;
  label: string;
  issuer: string;
  state: string | null;
  number: string | null;
  expires: ISODate | null;
  documentId: string | null;
}

/** go_no_go: the bid decision, with the reasons behind the suggestion. */
export interface GoNoGo {
  id: string;
  applicationId: string;
  score: number;
  suggestion: "go" | "review" | "no_go";
  factors: GoNoGoFactor[];
  /** Hard stops: a missing set-aside status, a license the firm does not hold, bonding above its limit, a passed deadline. */
  stoppers: string[];
  decision: "go" | "no_go" | null;
  decidedBy: string | null;
  decidedAt: ISODate | null;
  note: string | null;
  createdAt: ISODate;
}

export interface GoNoGoFactor {
  key: "experience" | "capacity" | "location" | "competition" | "deadline" | "credentials" | "bonding" | "staff";
  label: string;
  /** 0 to 1 */
  score: number;
  weight: number;
  /** Plain sentence the firm can check. */
  detail: string;
  /** Records or solicitation lines the detail relies on. */
  evidence: string[];
}

/** fee_proposals: the structure the firm fills in. Numbers come only from the firm. */
export interface FeeProposal {
  id: string;
  applicationId: string;
  basis: "lump_sum" | "hourly_not_to_exceed" | "percent_of_construction" | "unit_prices";
  phases: { key: string; name: string; lines: FeeLine[] }[];
  expenses: FeeLine[];
  notes: string;
  /** What the solicitation asks for in the price proposal, quoted. */
  instructions: string[];
  updatedAt: ISODate;
}

export interface FeeLine {
  id: string;
  label: string;
  role: string | null;
  hours: number | null;
  rate: number | null;
  /** A lump amount the firm entered directly. */
  amount: number | null;
}

/** addenda: each addendum to a solicitation and what it changed. */
export interface Addendum {
  id: string;
  applicationId: string;
  number: string;
  issuedOn: ISODate | null;
  summary: string;
  changes: { kind: "date" | "scope" | "requirement" | "answer" | "form" | "other"; text: string; before: string | null; after: string | null; ref: string | null }[];
  acknowledged: boolean;
  documentId: string | null;
  createdAt: ISODate;
}

/** The Standard Form 330 as data, built from the firm's records for one notice. */
export interface Sf330 {
  partI: {
    a: { title: string; location: string; date: string | null; number: string | null };
    b: { name: string; title: string; firm: string; phone: string | null; email: string | null } | null;
    c: { role: string; firm: string; address: string; isPrime: boolean; branch: string | null }[];
    d: { note: string; documentId: string | null };
    e: Sf330Resume[];
    f: Sf330Project[];
    g: { projects: { key: string; title: string }[]; people: { name: string; role: string; marks: string[] }[] };
    h: string;
    i: { name: string; title: string; date: string | null };
  };
  partII: {
    firmName: string;
    address: string;
    yearEstablished: number | null;
    uei: string | null;
    ownership: string[];
    smallBusinessStatus: string | null;
    disciplines: { discipline: string; code: string | null; count: number }[];
    experience: { code: string; label: string; projects: number; revenueIndex: string | null }[];
    averageAnnualRevenue: { federal: string | null; nonFederal: string | null; total: string | null } | null;
  };
  /** What the firm still has to supply before it can sign. */
  missing: string[];
}

export interface Sf330Resume {
  personnelId: string;
  name: string;
  role: string;
  yearsTotal: number | null;
  yearsWithFirm: number | null;
  firmAndLocation: string;
  education: string[];
  registrations: string[];
  other: string;
  projects: { title: string; location: string; year: string | null; description: string; withThisFirm: boolean }[];
}

export interface Sf330Project {
  key: string;
  projectId: string;
  title: string;
  location: string;
  completed: { professional: string | null; construction: string | null };
  owner: string;
  pointOfContact: string | null;
  description: string;
  firms: { name: string; location: string; role: string }[];
}

// ---------- Research teams ----------

export interface ResearchProfile {
  orgId: string;
  institution: string;
  department: string | null;
  investigators: { id: string; name: string; title: string; role: "pi" | "co_pi" | "senior" | "postdoc" | "student"; expertise: string[]; orcid: string | null }[];
  publications: { id: string; title: string; venue: string; year: number; authors: string; doi: string | null }[];
  priorAwards: { id: string; funder: string; number: string | null; title: string; amount: number | null; startYear: number | null; endYear: number | null; role: string }[];
  facilities: { id: string; name: string; description: string }[];
  capabilities: string[];
  keywords: string[];
  /** True for a small business, which opens SBIR and STTR. */
  smallBusiness: boolean;
  updatedAt: ISODate;
}

/** A funded project at NSF or NIH that looks like this team's work: evidence of who funds it and through which program. */
export interface FundedAnalog {
  source: "nsf" | "nih";
  id: string;
  title: string;
  institution: string;
  state: string | null;
  investigators: string[];
  program: string | null;
  programOfficer: string | null;
  amount: number | null;
  startDate: ISODate | null;
  endDate: ISODate | null;
  url: string;
}

// ---------- Individuals ----------

export interface PersonProfile {
  orgId: string;
  fullName: string;
  email: string | null;
  level: ScholarshipProfile["level"];
  field: string;
  school: string | null;
  state: string;
  hometown: string;
  gpa: string | null;
  education: { school: string; degree: string; years: string }[];
  experiences: { id: string; title: string; organization: string; years: string; detail: string }[];
  awards: string[];
  activities: string[];
  /** In the person's own words: what matters to them, from setup or the résumé. */
  goals: string | null;
  resumeDocumentId: string | null;
  updatedAt: ISODate;
}
