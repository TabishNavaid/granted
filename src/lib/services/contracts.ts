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
  Invoice,
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
  Subscription,
} from "@/lib/types";

/**
 * Service contracts. The UI only imports `services` from "@/lib/services".
 * Today the implementation is the in-memory mock adapter; the Supabase adapter
 * implements the same interfaces and is swapped in one place.
 */

export interface OrgService {
  get(): Promise<Organization>;
  update(patch: Partial<Organization>): Promise<Organization>;
  listMembers(): Promise<Member[]>;
  inviteMember(email: string, role: Member["role"]): Promise<Member>;
  updateMemberRole(id: string, role: Member["role"]): Promise<Member>;
  removeMember(id: string): Promise<void>;
  currentUser(): Promise<Member>;
  /** Delete the workspace and everything in it. */
  deleteWorkspace(): Promise<void>;
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
  /** Read a document's extracted text and turn it into facts waiting for review. */
  extractDocument(id: string): Promise<LoopResult<{ factCount: number; droppedCount: number }>>;
  addBoilerplate(input: { type: Boilerplate["type"]; title: string; body: string }): Promise<Boilerplate>;
  removeBoilerplate(id: string): Promise<void>;
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
  saveSearch(input: { name: string; keyword: string; fundingCategories: string[] }): Promise<SavedSearch>;
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
  logOutcome(id: string, result: OutcomeResult, awardAmount: number | null, feedback: string | null): Promise<ApplicationView>;
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
}

export interface SocialService {
  listCampaigns(): Promise<SocialCampaign[]>;
  getCampaign(id: string): Promise<SocialCampaign | null>;
  generate(month: string): Promise<LoopResult<SocialCampaign>>;
  updatePost(campaignId: string, postId: string, patch: Partial<Pick<SocialPost, "text" | "date" | "status" | "platform">>): Promise<SocialCampaign>;
  approve(campaignId: string): Promise<SocialCampaign>;
  /** Plain text or CSV of the month's posts for pasting into a scheduler. */
  exportCampaign(id: string, format: "text" | "csv"): Promise<string>;
}

export interface IntegrationsService {
  status(): Promise<{ id: string; name: string; required: boolean; present: boolean; unlocks: string; envVars: string[]; howTo: string; docsUrl: string }[]>;
  connections(): Promise<IntegrationConnection[]>;
  /** Where to send the browser to connect a provider. Refused when the provider's keys are missing. */
  connectUrl(provider: "google" | "microsoft", purpose: "gmail" | "calendar" | "outlook"): Promise<LoopResult<{ url: string }>>;
  disconnect(provider: "google" | "microsoft"): Promise<void>;
  /** Push every open milestone to the connected Google Calendar. */
  syncCalendar(): Promise<LoopResult<{ pushed: number }>>;
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
}

export interface ActivityService {
  listRuns(): Promise<AgentRun[]>;
  getRun(id: string): Promise<AgentRun | null>;
}

export interface BillingService {
  getSubscription(): Promise<Subscription>;
  listInvoices(): Promise<Invoice[]>;
  /** Without Stripe: switches the plan in place (free only, or demo). With Stripe: use checkoutUrl instead. */
  changePlan(plan: Subscription["plan"]): Promise<Subscription>;
  /** Stripe Checkout for a paid plan, when Stripe is connected. */
  checkoutUrl(plan: "starter" | "growth"): Promise<LoopResult<{ url: string }>>;
  portalUrl(): Promise<LoopResult<{ url: string }>>;
  /** Can this workspace do one more of these under its plan? */
  canUse(what: "proposal" | "match"): Promise<{ ok: boolean; message: string | null }>;
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
export type LoopErrorCode = "bad_url" | "unreachable" | "no_ai" | "rate_limited" | "no_facts" | "grants_gov" | "not_found" | "failed";
export type LoopResult<T> = { ok: true; data: T } | { ok: false; code: LoopErrorCode; error: string };

export interface RuntimeInfo {
  /** Mock data everywhere. */
  demo: boolean;
  /** A model key is set, so the agents can run (against the in-memory store in demo mode). */
  ai: boolean;
  persistence: "memory" | "supabase";
  /** Google OAuth keys are present. */
  googleAuth: boolean;
}

export interface LoopService {
  runtime(): Promise<RuntimeInfo>;
  buildProfile(input: { websiteUrl: string; ein: string | null; jobId?: string }): Promise<LoopResult<{ pageCount: number; factCount: number; droppedCount: number; runId: string; fromCache: boolean }>>;
  /** Live steps for a running job, or null when this server has no record of it. */
  progress(jobId: string): Promise<{ jobId: string; status: "running" | "done" | "failed"; steps: { label: string; state: "done" | "active" | "pending"; detail?: string }[] } | null>;
  answerGaps(answers: { budgetRange?: string; peopleServed?: string; location?: string }): Promise<LoopResult<{ added: number }>>;
  confirmProfile(input: { keptFactIds: string[]; factEdits: Record<string, string>; org: { mission?: string; serviceArea?: string; name?: string } }): Promise<LoopResult<{ confirmed: number; removed: number }>>;
  findMatches(jobId?: string): Promise<LoopResult<{ matchCount: number; screened: number; read: number; runId: string; fromCache: boolean }>>;
  draftLetter(applicationId: string): Promise<LoopResult<{ sectionCount: number; openQuestions: number; issues: number; wordCount: number; runId: string }>>;
  /** Full proposal: read the funder's guidelines into a requirements checklist, then draft every section from confirmed facts. */
  draftProposal(applicationId: string, jobId?: string): Promise<LoopResult<{ sectionCount: number; requirementCount: number; openQuestions: number; issues: number; wordCount: number; runId: string }>>;
}

export interface Services {
  org: OrgService;
  knowledge: KnowledgeService;
  opportunities: OpportunityService;
  applications: ApplicationService;
  inbox: InboxService;
  calendar: CalendarService;
  activity: ActivityService;
  billing: BillingService;
  auth: AuthService;
  loop: LoopService;
  outreach: OutreachService;
  contacts: ContactsService;
  social: SocialService;
  integrations: IntegrationsService;
}
