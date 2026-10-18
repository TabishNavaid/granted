import type {
  AgentRun,
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
  currentUser(): Promise<Member>;
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
}

export interface OpportunityService {
  listMatches(): Promise<MatchView[]>;
  getMatch(id: string): Promise<MatchView | null>;
  getMatchByOpportunity(opportunityId: string): Promise<MatchView | null>;
  getOpportunity(id: string): Promise<{ opportunity: Opportunity; funder: Funder; contacts: Contact[] } | null>;
  setMatchStatus(id: string, status: MatchView["status"]): Promise<MatchView>;
  startApplication(opportunityId: string): Promise<Application>;
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
}

export interface ActivityService {
  listRuns(): Promise<AgentRun[]>;
  getRun(id: string): Promise<AgentRun | null>;
}

export interface BillingService {
  getSubscription(): Promise<Subscription>;
  listInvoices(): Promise<Invoice[]>;
  changePlan(plan: Subscription["plan"]): Promise<Subscription>;
  getNotificationSettings(): Promise<NotificationSettings>;
  updateNotificationSettings(patch: Partial<NotificationSettings>): Promise<NotificationSettings>;
}

export interface AuthService {
  signIn(email: string, password: string): Promise<{ ok: true } | { ok: false; error: string }>;
  signUp(input: { fullName: string; email: string; password: string; orgName: string }): Promise<{ ok: true } | { ok: false; error: string }>;
  signOut(): Promise<void>;
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
}
