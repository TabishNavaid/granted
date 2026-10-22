import type { UsageSummary } from "@/lib/usage/limits";
import type {
  ContactKind,
  EmailKind,
  AgentRun,
  Budget,
  ContactNote,
  IntegrationConnection,
  OrgContact,
  ProposalMode,
  ReviewerCheck,
  SavedSearch,
  BidSearchFilters,
  SearchCandidate,
  SectionVersion,
  SocialCampaign,
  SocialPost,
  Application,
  ApplicationStage,
  ApplicationView,
  Boilerplate,
  CalendarEvent,
  Contact,
  Document,
  EmailDraft,
  Fact,
  Funder,
  InboxItem,
  MatchView,
  Member,
  Milestone,
  MissingFact,
  MonthlyPlan,
  NotificationSettings,
  Opportunity,
  Organization,
  OutcomeResult,
  PlanItem,
  ProposalWorkspace,
  Section,
  AgentAutonomy,
  AgentName,
  BoilerplateVersion,
  CopilotAnswer,
  FunderProfile,
  FunderSummary,
  ImpactMetric,
  LogicModelRow,
  LossReason,
  ReminderPreview,
  ScholarshipMatch,
  ScholarshipProfile,
  VoiceProfile,
  WinAnalytics,
  WinKit,
  Addendum,
  Certification,
  FeeProposal,
  FirmProfile,
  FundedAnalog,
  GoNoGo,
  PersonProfile,
  Personnel,
  PortfolioProject,
  Requirement,
  ResearchProfile,
  Sf330,
  Solicitation,
} from "@/lib/types";
import type { BidMeta } from "@/lib/bids/store";

/**
 * Service contracts. The UI only imports `services` from "@/lib/services".
 * Today the implementation is the in-memory mock adapter; the Supabase adapter
 * implements the same interfaces and is swapped in one place.
 */

export interface OrgService {
  get(): Promise<Organization>;
  update(patch: Partial<Organization>): Promise<Organization>;
  /** What the IRS registry says about an EIN, in plain words. Null when this server has no registry (the demo). */
  verifyEin(ein: string): Promise<{ status: "eligible" | "not_eligible" | "not_found" | "unavailable"; message: string } | null>;
  listMembers(): Promise<Member[]>;
  inviteMember(email: string, role: Member["role"]): Promise<Member>;
  updateMemberRole(id: string, role: Member["role"]): Promise<Member>;
  removeMember(id: string): Promise<void>;
  currentUser(): Promise<Member>;
  /** Delete the workspace and everything in it. */
  deleteWorkspace(): Promise<void>;
  /** Consultant mode: every organization this login can open, and which one is open now. */
  listWorkspaces(): Promise<WorkspaceSummary[]>;
  switchWorkspace(id: string): Promise<void>;
  /** Add an organization this login manages (a consultant's new client). */
  createWorkspace(name: string): Promise<WorkspaceSummary>;
  /** How far each agent may go on its own. Nothing is ever sent or submitted without a click, at any level. */
  getAutonomy(): Promise<Record<AgentName, AgentAutonomy>>;
  setAutonomy(agent: AgentName, level: AgentAutonomy): Promise<Record<AgentName, AgentAutonomy>>;
  /** Demo only: see the workspace as an editor or a board reviewer would. */
  previewRole(role: Member["role"]): Promise<Member>;
}

export interface WorkspaceSummary {
  id: string;
  name: string;
  /** A few words about it, e.g. "Food bank in western North Carolina". */
  kind: string;
  current: boolean;
  /** True for the demo's sample organizations. */
  sample: boolean;
}

export interface SampleInfo {
  id: string;
  label: string;
  kind: string;
  host: string;
  history: boolean;
  orgType: import("@/lib/types").OrgType;
}

/** The public demo. Every method is inert outside demo mode. */
export interface DemoService {
  status(): Promise<{ active: boolean; replay: boolean; recordedOn: string; current: SampleInfo | null; samples: SampleInfo[] }>;
  /** Which sample organization a pasted address refers to, if any. Never guesses beyond the samples. */
  sampleFor(input: string): Promise<SampleInfo | null>;
  /** Open a sample and start setup for it: a sample with no history starts empty again. */
  startSetup(sampleId: string): Promise<void>;
  /** Put the open sample back the way it started. */
  reset(): Promise<void>;
}

export interface KnowledgeService {
  listFacts(): Promise<Fact[]>;
  updateFact(id: string, patch: Partial<Fact>): Promise<Fact>;
  confirmFact(id: string): Promise<Fact>;
  listBoilerplates(): Promise<Boilerplate[]>;
  updateBoilerplate(id: string, body: string): Promise<Boilerplate>;
  listDocuments(): Promise<Document[]>;
  addDocument(file: { name: string; size: number; type: string }): Promise<Document>;
  removeDocument(id: string): Promise<void>;
  /** Change what kind of document it is, e.g. mark an upload as the W-9 a funder asks for. */
  updateDocument(id: string, patch: { type: Document["type"] }): Promise<Document>;
  /** Read a document's extracted text and turn it into facts waiting for review. */
  extractDocument(id: string): Promise<LoopResult<{ factCount: number; droppedCount: number }>>;
  addBoilerplate(input: { type: Boilerplate["type"]; title: string; body: string }): Promise<Boilerplate>;
  removeBoilerplate(id: string): Promise<void>;
  listBoilerplateVersions(id: string): Promise<BoilerplateVersion[]>;
  restoreBoilerplateVersion(versionId: string): Promise<Boilerplate>;
  /** Impact metrics logged month by month; the latest value of each is a fact drafts may cite. */
  listMetrics(): Promise<ImpactMetric[]>;
  addMetric(input: { label: string; unit: string; program: string | null }): Promise<ImpactMetric>;
  logMetric(id: string, month: string, value: number, note: string | null): Promise<ImpactMetric>;
  getVoice(): Promise<VoiceProfile>;
  setVoiceNote(note: string): Promise<VoiceProfile>;
}

export interface OpportunityService {
  listMatches(): Promise<MatchView[]>;
  getMatch(id: string): Promise<MatchView | null>;
  getMatchByOpportunity(opportunityId: string): Promise<MatchView | null>;
  getOpportunity(id: string): Promise<{ opportunity: Opportunity; funder: Funder; contacts: Contact[] } | null>;
  setMatchStatus(id: string, status: MatchView["status"]): Promise<MatchView>;
  /** Set aside with a reason. The reason is shown to the scorer next time so similar notices rank lower. */
  dismiss(id: string, reason: string): Promise<MatchView>;
  startApplication(opportunityId: string, mode?: ProposalMode): Promise<Application>;
  listSavedSearches(): Promise<SavedSearch[]>;
  saveSearch(input: { name: string; keyword: string; fundingCategories: string[]; filters?: BidSearchFilters | null }): Promise<SavedSearch>;
  deleteSavedSearch(id: string): Promise<void>;
  /** Run a keyword search on Grants.gov now and return open notices nonprofits can apply for, unscored. */
  runSearch(input: { keyword: string; fundingCategories: string[]; savedSearchId?: string }): Promise<LoopResult<{ candidates: SearchCandidate[]; hitCount: number }>>;
  /** Read and score chosen notices against the confirmed profile; they join the matches list. */
  scoreCandidates(externalIds: string[]): Promise<LoopResult<{ added: number; dropped: number }>>;
}

export interface ApplicationService {
  list(): Promise<ApplicationView[]>;
  get(id: string): Promise<ApplicationView | null>;
  getWorkspace(id: string): Promise<ProposalWorkspace | null>;
  updateSection(id: string, bodyHtml: string): Promise<Section>;
  setSectionStatus(id: string, status: Section["status"]): Promise<Section>;
  answerMissingFact(id: string, answer: string): Promise<MissingFact>;
  skipMissingFact(id: string): Promise<MissingFact>;
  moveStage(id: string, stage: ApplicationStage): Promise<ApplicationView>;
  /** Log a decision. A win drafts a thank-you, a grant-win kit, and a report reminder; a decline drafts a feedback request. */
  logOutcome(id: string, result: OutcomeResult, awardAmount: number | null, feedback: string | null, details?: { lossReasons?: LossReason[]; lessons?: string | null }): Promise<ApplicationView>;
  setMode(id: string, mode: ProposalMode): Promise<ApplicationView>;
  setAskAmount(id: string, askAmount: number | null): Promise<ApplicationView>;
  listVersions(sectionId: string): Promise<SectionVersion[]>;
  restoreVersion(versionId: string): Promise<Section>;
  /** Inline AI action on a section or a selection. Citation and gap chips come back unchanged. */
  revise(input: { sectionId: string; html: string; action: "rewrite" | "shorten" | "expand" | "tone"; tone?: "plain" | "warm" | "formal" | "confident"; wordLimit?: number | null }): Promise<LoopResult<{ html: string; note: string }>>;
  runReviewerCheck(id: string): Promise<LoopResult<ReviewerCheck>>;
  getReviewerCheck(id: string): Promise<ReviewerCheck | null>;
  getBudget(id: string): Promise<Budget | null>;
  saveBudget(id: string, lines: Budget["lines"], justification: string): Promise<Budget>;
  writeBudgetJustification(id: string): Promise<LoopResult<Budget>>;
  /** Put the budget table and justification into the draft as a section. */
  addBudgetSection(id: string): Promise<Section>;
  /** A suggested ask from the funder's typical grants and this budget, with the reasoning. */
  recommendAsk(id: string): Promise<{ amount: number; low: number; high: number; why: string[] } | null>;
  logicModel(id: string): Promise<LogicModelRow[]>;
  addLogicModelSection(id: string): Promise<Section>;
  /** A concept note assembled from confirmed facts, no model needed. */
  draftConceptNote(id: string): Promise<LoopResult<{ sectionCount: number; openQuestions: number }>>;
  /** Won applications whose sections can seed a new draft. */
  listReusable(): Promise<{ id: string; title: string; funder: string; awardAmount: number | null; sectionCount: number }[]>;
  reuseFrom(id: string, sourceApplicationId: string): Promise<LoopResult<{ sectionCount: number }>>;
  /** Run the compliance checks again against the current draft and documents. */
  runChecks(id: string): Promise<ProposalWorkspace["complianceChecks"]>;
  winKit(id: string): Promise<WinKit | null>;
}

export interface AnalyticsService {
  summary(): Promise<WinAnalytics>;
}

export interface FunderService {
  list(): Promise<FunderSummary[]>;
  get(id: string): Promise<FunderProfile | null>;
  /** Search the private foundation directory (IRS 990-PF filings). */
  directory(query: string, state: string | null): Promise<FunderSummary[]>;
  /** Foundations that funded organizations like this one, which it has not matched yet. */
  fundersLikeYou(): Promise<{ funder: Funder; peers: string[] }[]>;
  /** Organizations funded by the same foundations, for advice or a joint application. */
  peers(): Promise<FunderProfile["peers"]>;
  /** Score a directory foundation against the profile and add it to Opportunities. */
  addToMatches(funderId: string): Promise<MatchView | null>;
}

export interface CopilotService {
  ask(question: string): Promise<CopilotAnswer>;
}

export interface ScholarshipService {
  getProfile(): Promise<ScholarshipProfile | null>;
  saveProfile(profile: ScholarshipProfile): Promise<ScholarshipProfile>;
  matches(): Promise<ScholarshipMatch[]>;
}

export interface OutreachService {
  list(): Promise<EmailDraft[]>;
  get(id: string): Promise<EmailDraft | null>;
  draft(input: { kind: EmailKind; applicationId: string | null; funderId: string | null; contactId: string | null; to: string | null; toName: string | null; notes: string }): Promise<LoopResult<EmailDraft>>;
  update(id: string, patch: Partial<Pick<EmailDraft, "subject" | "body" | "to" | "toName" | "status" | "followUpAt">>): Promise<EmailDraft>;
  /** The user sent it themselves (copied, or opened in their mail app). Sets a follow-up reminder when asked. */
  markSent(id: string, via: "manual", followUpDays: number | null): Promise<EmailDraft>;
  /** Send from the user's own connected account. Only after explicit approval in the UI; refused when nothing is connected. */
  send(id: string, via: "gmail" | "outlook", followUpDays: number | null): Promise<LoopResult<EmailDraft>>;
  remove(id: string): Promise<void>;
}

export interface ContactsService {
  list(): Promise<OrgContact[]>;
  add(input: Omit<OrgContact, "id" | "orgId" | "createdAt" | "lastTouchAt" | "source">): Promise<OrgContact>;
  update(id: string, patch: Partial<Omit<OrgContact, "id" | "orgId" | "createdAt">>): Promise<OrgContact>;
  remove(id: string): Promise<void>;
  importRows(rows: { name: string; organization?: string; role?: string; email?: string; phone?: string; kind?: ContactKind; relationship?: string }[]): Promise<{ added: number; skipped: number }>;
  listNotes(contactId: string): Promise<ContactNote[]>;
  addNote(contactId: string, input: Pick<ContactNote, "kind" | "note" | "nextStep">): Promise<ContactNote>;
  /** A draft the board member or partner can send to make an introduction to a funder. */
  draftIntroRequest(contactId: string, applicationId: string | null): Promise<LoopResult<EmailDraft>>;
  /** People in this network whose names appear among a funder's officers or trustees, or who are linked to a funder. */
  overlaps(): Promise<{ contact: OrgContact; funderId: string; funderName: string; how: string }[]>;
}

export interface SocialService {
  listCampaigns(): Promise<SocialCampaign[]>;
  getCampaign(id: string): Promise<SocialCampaign | null>;
  generate(month: string): Promise<LoopResult<SocialCampaign>>;
  updatePost(campaignId: string, postId: string, patch: Partial<Pick<SocialPost, "text" | "date" | "status" | "platform">>): Promise<SocialCampaign>;
  approve(campaignId: string): Promise<SocialCampaign>;
  /** Plain text or CSV of the month's posts for pasting into a scheduler. */
  exportCampaign(id: string, format: "text" | "csv"): Promise<string>;
  /** Three posts timed before an application's deadline, so funders who look you up see recent work. */
  planCredibility(applicationId: string): Promise<SocialCampaign>;
}

export interface IntegrationsService {
  status(): Promise<{ id: string; name: string; required: boolean; present: boolean; unlocks: string; envVars: string[]; howTo: string; docsUrl: string }[]>;
  connections(): Promise<IntegrationConnection[]>;
  /** Where to send the browser to connect a provider. Refused when the provider's keys are missing. */
  connectUrl(provider: "google" | "microsoft", purpose: "gmail" | "calendar" | "outlook"): Promise<LoopResult<{ url: string }>>;
  disconnect(provider: "google" | "microsoft"): Promise<void>;
  /** Push every open milestone to the connected Google Calendar. */
  syncCalendar(): Promise<LoopResult<{ pushed: number }>>;
  /** This week's digest as it would be emailed. */
  digestPreview(): Promise<{ subject: string; body: string; to: string; canSend: boolean }>;
}

export interface InboxService {
  list(): Promise<InboxItem[]>;
  pendingCount(): Promise<number>;
  approve(id: string): Promise<InboxItem>;
  reject(id: string, reason: string | null): Promise<InboxItem>;
  markEdited(id: string): Promise<InboxItem>;
  restore(id: string): Promise<InboxItem>;
  getPlan(id: string): Promise<MonthlyPlan | null>;
  setPlanDecision(planId: string, opportunityId: string, decision: PlanItem["decision"]): Promise<MonthlyPlan>;
  getEmailDraft(id: string): Promise<EmailDraft | null>;
  updateEmailDraft(id: string, patch: Partial<Pick<EmailDraft, "subject" | "body">>): Promise<EmailDraft>;
  /** The planner: propose next month's applications from matches, deadlines, effort, and past outcomes. */
  planNextMonth(): Promise<MonthlyPlan>;
}

export interface CalendarService {
  listEvents(): Promise<CalendarEvent[]>;
  listMilestones(applicationId?: string): Promise<Milestone[]>;
  toggleMilestone(id: string, done: boolean): Promise<Milestone>;
  assignMilestone(id: string, assigneeId: string | null): Promise<Milestone>;
  /** Backward-plan milestones from the application's deadline. Replaces unfinished ones that were planned before. */
  planMilestones(applicationId: string, options?: { boardReview?: boolean; hours?: number }): Promise<Milestone[]>;
  /** The private ICS feed address for this workspace. */
  icsUrl(): Promise<string>;
  /** Reminder emails before each milestone: what would go out, when, and to whom. */
  reminderOutbox(): Promise<{ reminders: ReminderPreview[]; canSend: boolean }>;
}

export interface ActivityService {
  listRuns(): Promise<AgentRun[]>;
  getRun(id: string): Promise<AgentRun | null>;
}

export interface JobsService {
  /**
   * Start a long step (drafting, reading an RFP) in the background when this server keeps jobs, which the
   * real product does. "inline" means the caller should call the method directly, as the demo does.
   */
  start(spec: { jobId: string; kind: string; args: unknown[] }): Promise<{ mode: "background" | "inline" }>;
}

export interface AccountService {
  /** This month's AI allowance, e.g. "You have used 12 of 50 drafts this month." */
  getUsage(): Promise<UsageSummary>;
  getNotificationSettings(): Promise<NotificationSettings>;
  updateNotificationSettings(patch: Partial<NotificationSettings>): Promise<NotificationSettings>;
}

export type AuthResult = { ok: true; next: "redirect" | "check_email" } | { ok: false; error: string };

export interface AuthService {
  /** Password is ignored when the server uses email magic links. */
  signIn(email: string, password: string): Promise<AuthResult>;
  signUp(input: { fullName: string; email: string; password: string; orgName: string }): Promise<AuthResult>;
  signOut(): Promise<void>;
  /** Returns the provider URL to redirect to, or a kind error when Google is not set up. */
  signInWithGoogle(next: string): Promise<{ ok: true; url: string } | { ok: false; error: string }>;
}

/** The real loop: website to facts to matches to a letter. Results carry kind, honest errors for the UI. */
export type LoopErrorCode = "bad_url" | "unreachable" | "no_ai" | "rate_limited" | "no_facts" | "grants_gov" | "not_found" | "usage_limit" | "failed";
export type LoopResult<T> = { ok: true; data: T } | { ok: false; code: LoopErrorCode; error: string };

export interface RuntimeInfo {
  /** Mock data everywhere. */
  demo: boolean;
  /** A model key is set, so the agents can run (against the in-memory store in demo mode). */
  ai: boolean;
  /** The demo with no model key: agents replay recorded runs of the sample organizations. */
  replay: boolean;
  persistence: "memory" | "supabase";
  /** Google OAuth keys are present. */
  googleAuth: boolean;
}

export interface LoopService {
  runtime(): Promise<RuntimeInfo>;
  buildProfile(input: { websiteUrl: string; ein: string | null; jobId?: string }): Promise<LoopResult<{ pageCount: number; factCount: number; droppedCount: number; runId: string; fromCache: boolean }>>;
  /** Live steps for a running job, or null when this server has no record of it. */
  progress(jobId: string): Promise<{ jobId: string; status: "running" | "done" | "failed"; steps: { label: string; state: "done" | "active" | "pending"; detail?: string }[]; events: import("@/lib/loop/progress").JobEvent[] } | null>;
  answerGaps(answers: { budgetRange?: string; peopleServed?: string; location?: string; result?: string; staff?: string; programs?: string; populations?: string; note?: string }): Promise<LoopResult<{ added: number }>>;
  confirmProfile(input: { keptFactIds: string[]; factEdits: Record<string, string>; org: { mission?: string; serviceArea?: string; name?: string } }): Promise<LoopResult<{ confirmed: number; removed: number }>>;
  findMatches(jobId?: string): Promise<LoopResult<{ matchCount: number; screened: number; read: number; runId: string; fromCache: boolean }>>;
  draftLetter(applicationId: string, jobId?: string): Promise<LoopResult<{ sectionCount: number; openQuestions: number; issues: number; wordCount: number; runId: string }>>;
  /** Full proposal: read the funder's guidelines into a requirements checklist, then draft every section from confirmed facts. */
  draftProposal(applicationId: string, jobId?: string): Promise<LoopResult<{ sectionCount: number; requirementCount: number; openQuestions: number; issues: number; wordCount: number; runId: string }>>;
}

/** A firm's knowledge base: company profile, portfolio, people, and credentials. Every record is something a bid can cite. */
export interface FirmService {
  getProfile(): Promise<FirmProfile | null>;
  saveProfile(patch: Partial<Omit<FirmProfile, "orgId" | "updatedAt">>): Promise<FirmProfile>;
  listProjects(): Promise<PortfolioProject[]>;
  saveProject(input: Omit<PortfolioProject, "id" | "orgId"> & { id?: string }): Promise<PortfolioProject>;
  removeProject(id: string): Promise<void>;
  listPersonnel(): Promise<Personnel[]>;
  savePerson(input: Omit<Personnel, "id" | "orgId"> & { id?: string }): Promise<Personnel>;
  removePerson(id: string): Promise<void>;
  listCertifications(): Promise<Certification[]>;
  saveCertification(input: Omit<Certification, "id" | "orgId"> & { id?: string }): Promise<Certification>;
  removeCertification(id: string): Promise<void>;
  /** The records as the facts a draft may cite. */
  recordFacts(): Promise<Fact[]>;
}

/** A SAM.gov contract opportunity, in the shape the official Opportunities API returns, trimmed to what screens use. */
export interface SamNotice {
  noticeId: string;
  title: string;
  solicitationNumber: string | null;
  agency: string;
  office: string | null;
  postedDate: string | null;
  type: string;
  setAside: string | null;
  setAsideCode: string | null;
  responseDeadLine: string | null;
  naicsCode: string | null;
  classificationCode: string | null;
  placeOfPerformance: string | null;
  description: string;
  pointOfContact: { name: string; email: string | null; phone: string | null } | null;
  uiLink: string;
  /** Plain-code fit for this firm: NAICS, set-aside, location, and similar projects. */
  fit: { score: number; reasons: string[]; cautions: string[] } | null;
  /** True when the firm already added it as a bid. */
  added: boolean;
}

export interface BidView {
  application: ApplicationView;
  solicitation: Solicitation;
  goNoGo: GoNoGo | null;
  requirements: Requirement[];
  addenda: Addendum[];
  fee: FeeProposal | null;
  meta: BidMeta | null;
  projects: PortfolioProject[];
  personnel: Personnel[];
  matrix: { total: number; met: number; partial: number; open: number; firmAction: number };
  /** How the solicitation was read: "rules", or "rules and model". */
  readBy: string;
  pageCount: number;
}

export interface BidService {
  /** Read a solicitation the firm brought (a link, pasted text, an uploaded document, or a SAM.gov notice) into a bid with a compliance matrix and a go/no-go score. */
  addRfp(input: { url?: string; text?: string; documentId?: string; samNoticeId?: string; sample?: boolean; jobId?: string }): Promise<LoopResult<{ applicationId: string; requirementCount: number; score: number }>>;
  get(applicationId: string): Promise<BidView | null>;
  rescore(applicationId: string): Promise<GoNoGo | null>;
  decide(applicationId: string, decision: "go" | "no_go", note: string | null): Promise<GoNoGo | null>;
  draft(applicationId: string, jobId?: string): Promise<LoopResult<{ sectionCount: number; openQuestions: number; issues: number; wordCount: number; met: number; total: number }>>;
  setSelection(applicationId: string, input: { projectIds?: string[]; assignments?: BidMeta["assignments"]; teamFirms?: BidMeta["teamFirms"]; additionalInformation?: string }): Promise<BidMeta | null>;
  saveFee(applicationId: string, fee: FeeProposal): Promise<FeeProposal>;
  addAddendum(applicationId: string, input: { text?: string; documentId?: string; sample?: boolean }): Promise<LoopResult<Addendum>>;
  acknowledgeAddendum(id: string, acknowledged: boolean): Promise<Addendum | null>;
  refreshMatrix(applicationId: string): Promise<Requirement[]>;
  sf330(applicationId: string): Promise<Sf330 | null>;
  /** SAM.gov search for the firm's work categories. Live with a key; the recorded search in the demo; not connected otherwise. */
  searchSam(input?: { naics?: string[]; state?: string | null; filters?: BidSearchFilters | null }): Promise<{ status: "live" | "recorded" | "not_connected"; note: string; notices: SamNotice[]; recordedOn: string | null }>;
}

export interface ResearchService {
  getProfile(): Promise<ResearchProfile | null>;
  saveProfile(patch: Partial<Omit<ResearchProfile, "orgId" | "updatedAt">>): Promise<ResearchProfile>;
  /** Funded projects at NSF and NIH like this team's work: who funds it, through which program, and who manages it. */
  analogs(): Promise<{ status: "live" | "recorded"; analogs: FundedAnalog[]; recordedOn: string | null }>;
  /** Draft a research proposal in the standard sections, with the funder's AI rule on the checklist. */
  draftProposal(applicationId: string, jobId?: string): Promise<LoopResult<{ sectionCount: number; openQuestions: number; issues: number; wordCount: number }>>;
}

export interface PersonService {
  getProfile(): Promise<PersonProfile | null>;
  saveProfile(patch: Partial<Omit<PersonProfile, "orgId" | "updatedAt">>): Promise<PersonProfile>;
  /** Read a résumé into a profile for the person to check. Plain rules always; a model adds more when a key is set. */
  readResume(input: { text?: string; documentId?: string; sample?: boolean }): Promise<LoopResult<PersonProfile>>;
  /** Draft an essay for a scholarship from the person's own experiences, in their voice. */
  draftEssay(applicationId: string, prompt: string, jobId?: string): Promise<LoopResult<{ sectionId: string; words: number; openQuestions: number }>>;
}

export interface Services {
  org: OrgService;
  knowledge: KnowledgeService;
  opportunities: OpportunityService;
  applications: ApplicationService;
  inbox: InboxService;
  calendar: CalendarService;
  activity: ActivityService;
  account: AccountService;
  jobs: JobsService;
  auth: AuthService;
  loop: LoopService;
  demo: DemoService;
  analytics: AnalyticsService;
  funders: FunderService;
  copilot: CopilotService;
  scholarships: ScholarshipService;
  outreach: OutreachService;
  contacts: ContactsService;
  social: SocialService;
  integrations: IntegrationsService;
  firm: FirmService;
  bids: BidService;
  research: ResearchService;
  person: PersonService;
}
