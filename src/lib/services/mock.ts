import * as seed from "@/lib/mock/data";
import type {
  Application,
  ApplicationView,
  EmailDraft,
  OrgContact,
  ReviewerCheck,
  SectionVersion,
  CalendarEvent,
  Document,
  Fact,
  InboxItem,
  MatchView,
  Member,
  MonthlyPlan,
  Section,
} from "@/lib/types";
import type { Services } from "./contracts";
import { wordCount } from "@/lib/format";
import { hasAi, runtimeMode } from "@/lib/env";
import { exportCampaign, icsUrlFor } from "./shared";
import { countRuns, summarize } from "@/lib/usage/limits";
import { planMilestones as planFromDeadline } from "@/lib/loop/milestones";
import { BUDGET_CATEGORY_LABEL, budgetTotal } from "@/lib/loop/budget";
import { reviseText as demoRevise } from "@/lib/agents";
import type { LoopResult } from "./contracts";
import { nextInSequence, sessionMap, sessionTable } from "./demo-session";
import { sampleById, sampleForInput, samples, type SampleOrg } from "@/lib/mock/samples";
import { shiftSeedDates } from "@/lib/mock/dates";
import { DEFAULT_AUTONOMY, makeFeatureServices } from "./mock-features";
import { makeMockSegments } from "./mock-segments";
import * as firmSeed from "@/lib/mock/firm";
import type { Addendum, BoilerplateVersion, Certification, FeeProposal, FirmProfile, FundedAnalog, GoNoGo, PersonProfile, Personnel, PortfolioProject, ResearchProfile, ScholarshipProfile } from "@/lib/types";
import type { BidMeta } from "@/lib/bids/store";

/**
 * In-memory mock adapter. State lives for the life of the page (or server
 * process) and resets on reload, which is what we want for a demo. Every
 * method is async so the Supabase adapter can replace it without UI changes.
 */

const clone = <T>(v: T): T => structuredClone(v);

function seededState() {
  return shiftSeedDates({
    org: clone(seed.organization),
    members: clone(seed.members),
    documents: clone(seed.documents),
    facts: clone(seed.facts),
    boilerplates: clone(seed.boilerplates),
    funders: clone(seed.funders),
    contacts: clone(seed.contacts),
    opportunities: clone(seed.opportunities),
    matches: clone(seed.matches),
    applications: clone(seed.applications),
    outcomes: clone(seed.outcomes),
    requirements: clone(seed.requirements),
    sections: clone(seed.sections),
    missingFacts: clone(seed.missingFacts),
    complianceChecks: clone(seed.complianceChecks),
    milestones: clone(seed.milestones),
    emailDrafts: clone(seed.emailDrafts),
    plans: [clone(seed.monthlyPlan)] as MonthlyPlan[],
    inbox: clone(seed.inboxItems),
    runs: clone(seed.agentRuns),
    savedSearches: clone(seed.savedSearches),
    orgContacts: clone(seed.orgContacts),
    contactNotes: clone(seed.contactNotes),
    socialCampaigns: clone(seed.socialCampaigns),
    budgets: clone(seed.budgets),
    sectionVersions: [] as SectionVersion[],
    reviewerChecks: [] as ReviewerCheck[],
    documentTexts: {} as Record<string, string>,
    notifications: clone(seed.notificationSettings),
    metrics: clone(seed.impactMetrics),
    voiceNote: seed.voiceNote,
    autonomy: { ...DEFAULT_AUTONOMY },
    boilerplateVersions: [] as BoilerplateVersion[],
    scholarshipProfile: null as ScholarshipProfile | null,
    // Firms, research teams, individuals (src/lib/segments)
    firmProfile: null as FirmProfile | null,
    projects: [] as PortfolioProject[],
    personnel: [] as Personnel[],
    certifications: [] as Certification[],
    goNoGo: [] as GoNoGo[],
    fees: [] as FeeProposal[],
    addenda: [] as Addendum[],
    bidMeta: {} as Record<string, BidMeta>,
    researchProfile: null as ResearchProfile | null,
    personProfile: null as PersonProfile | null,
    fundedAnalogs: [] as FundedAnalog[],
  });
}

export type DemoState = ReturnType<typeof seededState>;

/** A sample organization that has not been set up yet: no facts, no matches, no history. */
function blankState(sample: SampleOrg): DemoState {
  const base = seededState();
  return {
    ...base,
    org: { ...clone(sample.org), createdAt: now() },
    members: clone(sample.members),
    documents: [],
    facts: [],
    boilerplates: [],
    matches: [],
    applications: [],
    outcomes: [],
    requirements: [],
    sections: [],
    missingFacts: [],
    complianceChecks: [],
    milestones: [],
    emailDrafts: [],
    plans: [],
    inbox: [],
    runs: [],
    savedSearches: [],
    orgContacts: [],
    contactNotes: [],
    socialCampaigns: [],
    budgets: [],
    metrics: [],
    voiceNote: "",
  };
}

/** The sample firm: set up, with a portfolio, staff, credentials, and a year of bids. */
function firmState(sample: SampleOrg): DemoState {
  const base = blankState(sample);
  const f = shiftSeedDates(
    clone({
      org: firmSeed.firmOrg,
      members: firmSeed.firmMembers,
      facts: firmSeed.firmFacts,
      boilerplates: firmSeed.firmBoilerplates,
      funders: firmSeed.firmFunders,
      opportunities: firmSeed.firmOpportunities,
      applications: firmSeed.firmApplications,
      outcomes: firmSeed.firmOutcomes,
      milestones: firmSeed.firmMilestones,
      firmProfile: firmSeed.firmProfile,
      projects: firmSeed.firmProjects,
      personnel: firmSeed.firmPersonnel,
      certifications: firmSeed.firmCertifications,
    }),
  );
  return {
    ...base,
    ...f,
    funders: [...base.funders.filter((x) => !f.funders.some((y) => y.id === x.id)), ...f.funders],
    opportunities: [...base.opportunities.filter((x) => !f.opportunities.some((y) => y.id === x.id)), ...f.opportunities],
  };
}

/** Organizations a visitor added in consultant mode, by id. Names only; their contents live in the visitor's session. */
const addedWorkspaces = sessionMap<string>("addedWorkspaces");

const workspaces = sessionTable<DemoState>((id) => {
  const sample = sampleById(id);
  if (sample?.id === firmSeed.FIRM_ORG_ID) return firmState(sample);
  if (sample) return sample.history ? seededState() : blankState(sample);
  const name = addedWorkspaces.get(id);
  if (name) {
    const base = samples[1];
    return blankState({ ...base, id, label: name, history: false, org: { ...base.org, id, name, websiteUrl: "", calendarToken: `demo-calendar-${id}` }, members: base.members.map((mm) => ({ ...mm, orgId: id, fullName: "You", email: "you@example.org" })) });
  }
  return seededState();
}, seed.ORG_ID);

const sampleInfo = (s: SampleOrg) => ({ id: s.id, label: s.label, kind: s.kind, host: s.host, history: s.history, orgType: s.org.orgType });

export const demoWorkspaces = workspaces;

/**
 * The current visitor's current workspace. Reads and writes go to the
 * session the request runs in (see ./demo-session.ts), so this behaves like
 * one plain object everywhere it is used.
 */
export const state: DemoState = new Proxy({} as DemoState, {
  get: (_t, key) => Reflect.get(workspaces.workspace(), key),
  set: (_t, key, value) => Reflect.set(workspaces.workspace(), key, value),
  has: (_t, key) => Reflect.has(workspaces.workspace(), key),
  ownKeys: () => Reflect.ownKeys(workspaces.workspace()),
  getOwnPropertyDescriptor: (_t, key) => Reflect.getOwnPropertyDescriptor(workspaces.workspace(), key),
});

/**
 * Account connections need the server (OAuth tokens never leave it). The
 * server registers them (./server.ts); in the browser demo there are none,
 * and this module never imports them, so they stay out of the browser bundle.
 */
let integrationsServer: (() => Promise<typeof import("./mock-integrations-server")>) | null = null;
export function registerIntegrationsServer(load: () => Promise<typeof import("./mock-integrations-server")>) {
  integrationsServer = load;
}

export const now = () => new Date().toISOString();
const delay = (ms = 0) => new Promise((r) => setTimeout(r, ms));
export const newId = (prefix: string) => `${prefix}_${nextInSequence("id", 1000)}`;

/** The team and deleting the workspace belong to the owner (roles: owner, editor, board reviewer). */
function requireOwner() {
  const me = state.members.find((m) => m.id === seed.CURRENT_USER_ID);
  if (me && me.role !== "owner") throw new Error("Only the workspace owner can change the team or the workspace itself.");
}

/** Board reviewers read, comment, and approve sections; they do not change drafts or plans. */
function requireEditor() {
  const me = state.members.find((m) => m.id === seed.CURRENT_USER_ID);
  if (me?.role === "reviewer") throw new Error("Board reviewers can read and approve sections but cannot change this. Ask the owner or an editor.");
}

/** A plain email from the open organization's own confirmed facts, for the demo without a model key. Labelled as a template. */
function demoEmailBody(input: { kind: string; toName: string | null; notes: string }, opportunityTitle: string | null) {
  const me = state.members.find((m) => m.id === seed.CURRENT_USER_ID);
  const reach = state.facts.find((f) => f.status === "confirmed" && f.category === "reach");
  const where = state.org.serviceArea || [state.org.city, state.org.state].filter(Boolean).join(", ");
  const about = `I lead ${state.org.name}${where ? `, which serves ${where}` : ""}.${reach ? ` ${reach.label}: ${reach.value}.` : ""}`;
  const middle = opportunityTitle
    ? input.kind === "thank_you"
      ? `Thank you for your support through ${opportunityTitle}. It makes a real difference to our work.`
      : input.kind === "follow_up"
        ? `I am following up on our application to ${opportunityTitle}. Is there anything else you need from us?`
        : input.kind === "feedback_request"
          ? `Thank you for reviewing our application to ${opportunityTitle}. If you can share any feedback that would make a future request stronger, we would be grateful.`
          : `We are preparing an application to ${opportunityTitle} and want to make sure we are a good fit before we go further.`
    : "I would welcome a short conversation about whether our work fits your priorities.";
  return `Hello${input.toName ? ` ${input.toName.split(" ")[0]}` : ""},\n\n${about}\n\n${middle}${input.notes ? `\n\n${input.notes}` : ""}\n\nThanks,\n${me?.fullName || state.org.name}\n\n(Template draft. With a model key, this is written for the funder from your facts.)`;
}

function notFound(what: string, id: string): never {
  throw new Error(`${what} ${id} not found`);
}

const noAi = <T,>(): LoopResult<T> => ({ ok: false, code: "no_ai", error: "This needs a model key. In the demo, nothing new is written; connect Gemini on the Integrations page to try it for real." });
const store = () => import("@/lib/loop/memory-store").then((m) => m.memoryStore);

function toMatchView(m: (typeof state.matches)[number]): MatchView {
  const opportunity = state.opportunities.find((o) => o.id === m.opportunityId) ?? notFound("opportunity", m.opportunityId);
  const funder = state.funders.find((f) => f.id === opportunity.funderId) ?? notFound("funder", opportunity.funderId);
  return { ...m, opportunity, funder };
}

function toApplicationView(a: Application): ApplicationView {
  const opportunity = state.opportunities.find((o) => o.id === a.opportunityId) ?? notFound("opportunity", a.opportunityId);
  const funder = state.funders.find((f) => f.id === opportunity.funderId) ?? notFound("funder", opportunity.funderId);
  const upcoming = state.milestones
    .filter((m) => m.applicationId === a.id && !m.done)
    .sort((x, y) => x.dueDate.localeCompare(y.dueDate));
  const secs = state.sections.filter((s) => s.applicationId === a.id);
  const done = secs.filter((s) => s.status === "approved" || s.status === "edited" || s.status === "drafted").length;
  const outcome = state.outcomes.find((o) => o.applicationId === a.id) ?? null;
  return {
    ...a,
    opportunity,
    funder,
    nextMilestone: upcoming[0] ?? null,
    sectionProgress: { done, total: secs.length },
    outcome,
  };
}

function touchSection(s: Section) {
  s.updatedAt = now();
  const words = wordCount(s.bodyHtml.replace(/<[^>]+>/g, " "));
  const check = state.complianceChecks.find((c) => c.sectionId === s.id && c.rule.toLowerCase().includes("within"));
  if (check && s.wordLimit) {
    check.status = words > s.wordLimit ? "fail" : "pass";
    check.detail = words > s.wordLimit ? `Currently ${words} words, ${words - s.wordLimit} over.` : `Currently ${words} words.`;
  }
  const presence = state.complianceChecks.find((c) => c.sectionId === s.id && c.rule.toLowerCase().includes("present"));
  if (presence) {
    presence.status = words > 0 ? "pass" : "fail";
    presence.detail = words > 0 ? `Currently ${words} words.` : "Section is empty. Required by guidelines.";
  }
  const req = state.requirements.find((r) => r.id === s.requirementId);
  if (req) req.satisfied = words > 0;
}

const features = makeFeatureServices({ state, newId, now, currentUserId: seed.CURRENT_USER_ID, toApplicationView, toMatchView });
const { services: segments, backend: segmentBackend } = makeMockSegments({ state, newId, now, requireEditor, toApplicationView });

/** Citable facts made from records: a firm's portfolio and people, a research team's records, a person's résumé. */
async function segmentFacts(): Promise<Fact[]> {
  const t = state.org.orgType;
  if (t === "firm") {
    const { recordFacts } = await import("@/lib/firm/facts");
    return recordFacts({ org: state.org, profile: state.firmProfile, projects: state.projects, personnel: state.personnel, certifications: state.certifications, boilerplates: state.boilerplates });
  }
  if (t === "research" && state.researchProfile) return (await import("@/lib/research/draft")).researchFacts(state.researchProfile);
  if (t === "individual" && state.personProfile) return (await import("@/lib/person")).personFacts(state.personProfile);
  return [];
}

export const mockServices: Services = {
  ...segments,
  org: {
    ...features.org,
    async get() {
      return clone(state.org);
    },
    async update(patch) {
      Object.assign(state.org, patch);
      return clone(state.org);
    },
    async listMembers() {
      return clone(state.members);
    },
    async inviteMember(email, role) {
      requireOwner();
      const m: Member = { id: newId("user"), orgId: state.org.id, fullName: "", email, role, status: "invited" };
      state.members.push(m);
      return clone(m);
    },
    async currentUser() {
      return clone(state.members.find((m) => m.id === seed.CURRENT_USER_ID)!);
    },
    async updateMemberRole(id, role) {
      requireOwner();
      const m = state.members.find((x) => x.id === id) ?? notFound("member", id);
      m.role = role;
      return clone(m);
    },
    async removeMember(id) {
      requireOwner();
      state.members = state.members.filter((m) => m.id !== id || m.id === seed.CURRENT_USER_ID);
    },
    async deleteWorkspace() {
      requireOwner();
      await delay(400);
      // The demo puts the sample back rather than deleting it.
      workspaces.reset();
    },
    async listWorkspaces() {
      const current = workspaces.currentWorkspaceId();
      const opened = new Set(workspaces.openedWorkspaceIds());
      const list = samples.map((s) => ({ id: s.id, name: s.label, kind: s.kind, current: s.id === current, sample: true }));
      for (const [id, name] of addedWorkspaces) if (opened.has(id)) list.push({ id, name, kind: "Added in this demo", current: id === current, sample: false });
      return list;
    },
    async switchWorkspace(id) {
      if (!sampleById(id) && !addedWorkspaces.has(id)) throw new Error(`workspace ${id} not found`);
      workspaces.switchTo(id);
    },
    async createWorkspace(name) {
      const id = newId("org_client");
      addedWorkspaces.set(id, name.trim() || "New organization");
      workspaces.switchTo(id);
      return { id, name: addedWorkspaces.get(id)!, kind: "Added in this demo", current: true, sample: false };
    },
  },

  analytics: features.analytics,
  funders: features.funders,
  copilot: features.copilot,
  scholarships: features.scholarships,

  demo: {
    async status() {
      const mode = runtimeMode();
      const sample = sampleById(state.org.id);
      return { active: mode.demo, replay: mode.replay, recordedOn: "2026-10-18", current: sample ? sampleInfo(sample) : null, samples: samples.map(sampleInfo) };
    },
    async sampleFor(input) {
      const s = sampleForInput(input);
      return s ? sampleInfo(s) : null;
    },
    async startSetup(sampleId) {
      const s = sampleById(sampleId);
      if (!s) throw new Error(`sample ${sampleId} not found`);
      const w = s.history ? workspaces.switchTo(s.id) : (workspaces.switchTo(s.id), workspaces.reset(s.id));
      w.org.websiteUrl = s.host ? `https://${s.host}` : "";
      // Nonprofits confirm their EIN next; firms and labs go straight to the reading; a person starts from a résumé.
      w.org.onboardingStep = s.org.orgType === "nonprofit" ? "ein" : s.org.orgType === "individual" ? "type" : "reading";
    },
    async reset() {
      workspaces.reset();
    },
  },

  knowledge: {
    ...features.knowledge,
    async listFacts() {
      return clone(state.facts);
    },
    async updateFact(id, patch) {
      const f = state.facts.find((x) => x.id === id) ?? notFound("fact", id);
      Object.assign(f, patch);
      return clone(f);
    },
    async confirmFact(id) {
      const f = state.facts.find((x) => x.id === id) ?? notFound("fact", id);
      f.status = "confirmed";
      f.lastConfirmedAt = now();
      return clone(f);
    },
    async listBoilerplates() {
      return clone(state.boilerplates);
    },
    async listDocuments() {
      return clone(state.documents);
    },
    async addDocument(file) {
      const d: Document = {
        id: newId("doc"),
        orgId: state.org.id,
        type: "other",
        title: file.name.replace(/\.[^.]+$/, ""),
        fileName: file.name,
        mimeType: file.type || "application/octet-stream",
        sizeBytes: file.size,
        status: "extracting",
        pageCount: null,
        factCount: 0,
        uploadedAt: now(),
      };
      state.documents.unshift(d);
      // Pretend extraction finishes shortly after.
      setTimeout(() => {
        d.status = "ready";
        d.factCount = 2;
        d.pageCount = 5;
      }, 2500);
      return clone(d);
    },
    async updateDocument(id, patch) {
      requireEditor();
      const d = state.documents.find((x) => x.id === id) ?? notFound("document", id);
      d.type = patch.type;
      return clone(d);
    },
    async removeDocument(id) {
      state.documents = state.documents.filter((d) => d.id !== id);
      state.facts = state.facts.filter((f) => f.sourceDocumentId !== id);
    },
    async extractDocument(id) {
      if (!hasAi()) return noAi();
      const { extractDocumentFacts } = await import("@/lib/loop/features");
      return extractDocumentFacts(await store(), id);
    },
    async addBoilerplate(input) {
      const b = { id: newId("bp"), orgId: state.org.id, type: input.type, title: input.title, body: input.body, version: 1, wordCount: wordCount(input.body), updatedAt: now(), sourceDocumentIds: [] };
      state.boilerplates.unshift(b);
      return clone(b);
    },
    async removeBoilerplate(id) {
      state.boilerplates = state.boilerplates.filter((b) => b.id !== id);
    },
  },

  opportunities: {
    async listMatches() {
      return state.matches
        .filter((m) => m.status !== "dismissed")
        .map(toMatchView)
        .sort((a, b) => b.fitScore - a.fitScore);
    },
    async getMatch(id) {
      const m = state.matches.find((x) => x.id === id);
      return m ? toMatchView(m) : null;
    },
    async getMatchByOpportunity(opportunityId) {
      const m = state.matches.find((x) => x.opportunityId === opportunityId);
      return m ? toMatchView(m) : null;
    },
    async getOpportunity(id) {
      const opportunity = state.opportunities.find((o) => o.id === id);
      if (!opportunity) return null;
      const funder = state.funders.find((f) => f.id === opportunity.funderId)!;
      const contacts = state.contacts.filter((c) => c.funderId === funder.id);
      return clone({ opportunity, funder, contacts });
    },
    async setMatchStatus(id, status) {
      const m = state.matches.find((x) => x.id === id) ?? notFound("match", id);
      m.status = status;
      m.isNew = false;
      return toMatchView(m);
    },
    async dismiss(id, reason) {
      const m = state.matches.find((x) => x.id === id) ?? notFound("match", id);
      m.status = "dismissed";
      m.isNew = false;
      m.dismissReason = reason.trim() || null;
      return toMatchView(m);
    },
    async listSavedSearches() {
      return clone(state.savedSearches);
    },
    async saveSearch(input) {
      const s = { id: newId("search"), orgId: state.org.id, name: input.name.trim() || input.keyword, keyword: input.keyword.trim(), fundingCategories: input.fundingCategories, createdAt: now(), lastRunAt: null };
      state.savedSearches.unshift(s);
      return clone(s);
    },
    async deleteSavedSearch(id) {
      state.savedSearches = state.savedSearches.filter((s) => s.id !== id);
    },
    async runSearch(input) {
      const { customSearch } = await import("@/lib/loop/features");
      const r = await customSearch(await store(), { keyword: input.keyword, fundingCategories: input.fundingCategories });
      if (r.ok && input.savedSearchId) {
        const s = state.savedSearches.find((x) => x.id === input.savedSearchId);
        if (s) s.lastRunAt = now();
      }
      return r;
    },
    async scoreCandidates(externalIds) {
      if (!hasAi()) return noAi();
      const { scoreSelected } = await import("@/lib/loop/features");
      return scoreSelected(await store(), externalIds);
    },
    async startApplication(opportunityId, mode) {
      const existing = state.applications.find((a) => a.opportunityId === opportunityId);
      if (existing) return clone(existing);
      const match = state.matches.find((m) => m.opportunityId === opportunityId);
      if (match) {
        match.status = "applying";
        match.isNew = false;
      }
      const a: Application = {
        id: newId("app"),
        orgId: state.org.id,
        opportunityId,
        matchId: match?.id ?? null,
        stage: "researching",
        mode: mode ?? "letter",
        askAmount: null,
        ownerId: seed.CURRENT_USER_ID,
        submittedAt: null,
        createdAt: now(),
        updatedAt: now(),
      };
      state.applications.unshift(a);
      await delay(400);
      return clone(a);
    },
  },

  applications: {
    ...features.applications,
    async list() {
      return state.applications.map(toApplicationView);
    },
    async get(id) {
      const a = state.applications.find((x) => x.id === id);
      return a ? toApplicationView(a) : null;
    },
    async getWorkspace(id) {
      const a = state.applications.find((x) => x.id === id);
      if (!a) return null;
      return clone({
        application: toApplicationView(a),
        requirements: state.requirements.filter((r) => r.applicationId === id).sort((x, y) => x.order - y.order),
        sections: state.sections.filter((s) => s.applicationId === id).sort((x, y) => x.order - y.order),
        missingFacts: state.missingFacts.filter((m) => m.applicationId === id),
        complianceChecks: state.complianceChecks.filter((c) => c.applicationId === id),
        // Records a firm, a research team, or a person cites are facts too.
        facts: [...state.facts, ...(await segmentFacts())],
        documents: state.documents,
      });
    },
    async setSectionStatus(id, status) {
      const s = state.sections.find((x) => x.id === id) ?? notFound("section", id);
      s.status = status;
      s.updatedAt = now();
      return clone(s);
    },
    async answerMissingFact(id, answer) {
      requireEditor();
      const m = state.missingFacts.find((x) => x.id === id) ?? notFound("missing fact", id);
      if (m.gapKey && (hasAi() || runtimeMode().replay)) {
        const { answerAndRedraft } = await import("@/lib/loop");
        const { memoryStore } = await import("@/lib/loop/memory-store");
        const r = await answerAndRedraft(memoryStore, id, answer);
        if (!r.ok) throw new Error(r.error);
        return clone(state.missingFacts.find((x) => x.id === id)!);
      }
      m.status = "answered";
      m.answer = answer;
      const fact: Fact = {
        id: newId("fact"),
        orgId: state.org.id,
        label: m.suggestedLabel,
        value: answer,
        category: "reach",
        sourceDocumentId: null,
        sourceUrl: null,
        sourceLabel: "You",
        sourceExcerpt: `Answered by ${state.members.find((x) => x.id === seed.CURRENT_USER_ID)?.fullName || "you"} in the proposal workspace.`,
        sourcePage: null,
        confidence: 1,
        status: "confirmed",
        lastConfirmedAt: now(),
      };
      state.facts.push(fact);
      // Replace the gap chip in the section with a citation to the new fact.
      const s = state.sections.find((x) => x.id === m.sectionId);
      if (s) {
        s.bodyHtml = s.bodyHtml.replace(
          new RegExp(`<span data-gap="${id}"[^>]*></span>`),
          `${answer}<span data-citation="${fact.id}" data-label="You, ${new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" })}"></span>`,
        );
        if (!state.missingFacts.some((x) => x.sectionId === s.id && x.status === "open") && s.status === "needs_facts") s.status = "drafted";
      }
      const open = state.missingFacts.filter((x) => x.applicationId === m.applicationId && x.status === "open").length;
      const check = state.complianceChecks.find((c) => c.applicationId === m.applicationId && c.rule.startsWith("No unresolved"));
      if (check) {
        check.status = open === 0 ? "pass" : "warn";
        check.detail = open === 0 ? "All questions answered." : `${open} open question${open === 1 ? "" : "s"} remain.`;
      }
      return clone(m);
    },
    async skipMissingFact(id) {
      const m = state.missingFacts.find((x) => x.id === id) ?? notFound("missing fact", id);
      m.status = "skipped";
      return clone(m);
    },
    async setMode(id, mode) {
      const a = state.applications.find((x) => x.id === id) ?? notFound("application", id);
      a.mode = mode;
      a.updatedAt = now();
      return toApplicationView(a);
    },
    async setAskAmount(id, askAmount) {
      requireEditor();
      const a = state.applications.find((x) => x.id === id) ?? notFound("application", id);
      a.askAmount = askAmount;
      a.updatedAt = now();
      return toApplicationView(a);
    },
    async listVersions(sectionId) {
      return clone(state.sectionVersions.filter((v) => v.sectionId === sectionId));
    },
    async restoreVersion(versionId) {
      requireEditor();
      const v = state.sectionVersions.find((x) => x.id === versionId) ?? notFound("version", versionId);
      const s = state.sections.find((x) => x.id === v.sectionId) ?? notFound("section", v.sectionId);
      const user = state.members.find((m) => m.id === seed.CURRENT_USER_ID)!;
      state.sectionVersions.unshift({ id: newId("ver"), sectionId: s.id, bodyHtml: s.bodyHtml, note: "Before restoring an earlier version", byName: user.fullName, createdAt: now() });
      s.bodyHtml = v.bodyHtml;
      s.status = "edited";
      touchSection(s);
      return clone(s);
    },
    async revise(input) {
      requireEditor();
      const user = state.members.find((m) => m.id === seed.CURRENT_USER_ID)!;
      state.sectionVersions.unshift({ id: newId("ver"), sectionId: input.sectionId, bodyHtml: input.html, note: `Before ${input.action}`, byName: user.fullName, createdAt: now() });
      if (!hasAi()) {
        const r = await demoRevise({ html: input.html, action: input.action, tone: input.tone, wordLimit: input.wordLimit });
        return { ok: true, data: { html: r.html, note: `${r.note} (demo rewrite, no model key)` } };
      }
      const { reviseSection } = await import("@/lib/loop/features");
      return reviseSection(await store(), input);
    },
    async runReviewerCheck(id) {
      if (!hasAi()) {
        const r = features.ruleReview(id);
        const check: ReviewerCheck = { id: newId("review"), applicationId: id, overall: r.overall, summary: r.summary, criteria: r.criteria, createdAt: now() };
        state.reviewerChecks.unshift(check);
        return { ok: true, data: clone(check) };
      }
      const { runReviewer } = await import("@/lib/loop/features");
      return runReviewer(await store(), id);
    },
    async getReviewerCheck(id) {
      return clone(state.reviewerChecks.find((c) => c.applicationId === id) ?? null);
    },
    async getBudget(id) {
      return clone(state.budgets.find((b) => b.applicationId === id) ?? null);
    },
    async saveBudget(id, lines, justification) {
      requireEditor();
      return (await store()).saveBudget(id, lines, justification);
    },
    async writeBudgetJustification(id) {
      if (!hasAi()) {
        const b = state.budgets.find((x) => x.applicationId === id);
        if (!b || !b.lines.length) return { ok: false, code: "failed", error: "Add at least one budget line first." };
        b.justification = b.lines.map((l) => `${BUDGET_CATEGORY_LABEL[l.category]} ($${l.amount.toLocaleString("en-US")}): ${l.item}. ${l.note}`.trim()).join("\n\n") + `\n\nThe total request is $${budgetTotal(b.lines).toLocaleString("en-US")}. (Demo text, no model key.)`;
        b.updatedAt = now();
        return { ok: true, data: clone(b) };
      }
      const { budgetJustification } = await import("@/lib/loop/features");
      return budgetJustification(await store(), id);
    },
    async addBudgetSection(id) {
      const b = state.budgets.find((x) => x.applicationId === id) ?? notFound("budget", id);
      const rows = b.lines.map((l) => `<li>${BUDGET_CATEGORY_LABEL[l.category]}: ${l.item}, $${l.amount.toLocaleString("en-US")}</li>`).join("");
      const html = `<ul>${rows}</ul><p>Total request: $${budgetTotal(b.lines).toLocaleString("en-US")}.</p>${b.justification ? b.justification.split(/\n\n+/).map((p) => `<p>${p.replace(/&/g, "&amp;").replace(/</g, "&lt;")}</p>`).join("") : ""}`;
      const order = state.sections.filter((s) => s.applicationId === id).length + 1;
      const existing = state.sections.find((s) => s.applicationId === id && s.title === "Budget and justification");
      if (existing) {
        existing.bodyHtml = html;
        existing.status = "edited";
        return clone(existing);
      }
      return (await store()).addSection(id, { requirementId: null, title: "Budget and justification", bodyHtml: html, wordLimit: null, status: "edited", order });
    },
  },

  inbox: {
    ...features.inbox,
    async list() {
      return clone([...state.inbox].sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
    },
    async pendingCount() {
      return state.inbox.filter((i) => i.status === "pending").length;
    },
    async approve(id) {
      const item = state.inbox.find((x) => x.id === id) ?? notFound("inbox item", id);
      item.status = "approved";
      item.resolvedAt = now();
      applyApproval(item);
      return clone(item);
    },
    async reject(id, reason) {
      const item = state.inbox.find((x) => x.id === id) ?? notFound("inbox item", id);
      item.status = "rejected";
      item.resolvedAt = now();
      item.rejectionReason = reason;
      return clone(item);
    },
    async markEdited(id) {
      const item = state.inbox.find((x) => x.id === id) ?? notFound("inbox item", id);
      item.status = "edited";
      item.resolvedAt = now();
      return clone(item);
    },
    async restore(id) {
      const item = state.inbox.find((x) => x.id === id) ?? notFound("inbox item", id);
      item.status = "pending";
      item.resolvedAt = null;
      item.rejectionReason = null;
      return clone(item);
    },
    async getPlan(id) {
      return clone(state.plans.find((p) => p.id === id) ?? null);
    },
    async setPlanDecision(planId, opportunityId, decision) {
      const p = state.plans.find((x) => x.id === planId) ?? notFound("plan", planId);
      const item = p.items.find((i) => i.opportunityId === opportunityId);
      if (item) item.decision = decision;
      return clone(p);
    },
    async getEmailDraft(id) {
      return clone(state.emailDrafts.find((e) => e.id === id) ?? null);
    },
    async updateEmailDraft(id, patch) {
      const e = state.emailDrafts.find((x) => x.id === id) ?? notFound("email draft", id);
      Object.assign(e, patch);
      return clone(e);
    },
  },

  calendar: {
    ...features.calendar,
    async listEvents() {
      const events: CalendarEvent[] = state.milestones.map((m) => {
        const a = state.applications.find((x) => x.id === m.applicationId);
        const opp = a ? state.opportunities.find((o) => o.id === a.opportunityId) : null;
        const funder = opp ? state.funders.find((f) => f.id === opp.funderId) : null;
        return { id: m.id, date: m.dueDate, title: m.title, kind: m.kind, applicationId: m.applicationId, funderName: funder?.name ?? "", done: m.done, assigneeId: m.assigneeId };
      });
      return events.sort((a, b) => a.date.localeCompare(b.date));
    },
    async listMilestones(applicationId) {
      const list = applicationId ? state.milestones.filter((m) => m.applicationId === applicationId) : state.milestones;
      return clone([...list].sort((a, b) => a.dueDate.localeCompare(b.dueDate)));
    },
    async toggleMilestone(id, done) {
      const m = state.milestones.find((x) => x.id === id) ?? notFound("milestone", id);
      m.done = done;
      return clone(m);
    },
    async assignMilestone(id, assigneeId) {
      const m = state.milestones.find((x) => x.id === id) ?? notFound("milestone", id);
      m.assigneeId = assigneeId;
      return clone(m);
    },
    async planMilestones(applicationId, options) {
      requireEditor();
      const a = state.applications.find((x) => x.id === applicationId) ?? notFound("application", applicationId);
      const opp = state.opportunities.find((o) => o.id === a.opportunityId) ?? notFound("opportunity", a.opportunityId);
      if (!opp.deadline) return [];
      state.milestones = state.milestones.filter((m) => m.applicationId !== applicationId || m.done);
      const planned = planFromDeadline(opp.deadline, { boardReview: options?.boardReview, effort: opp.effort, mode: a.mode, bidDates: opp.solicitation?.dates });
      const created = planned.map((p) => ({ id: newId("ms"), orgId: state.org.id, applicationId, title: p.title, dueDate: p.dueDate, kind: p.kind, assigneeId: a.ownerId, done: false }));
      state.milestones.push(...created);
      return clone(created);
    },
    async icsUrl() {
      return icsUrlFor(state.org.calendarToken);
    },
  },

  activity: {
    async listRuns() {
      return clone([...state.runs].sort((a, b) => b.startedAt.localeCompare(a.startedAt)));
    },
    async getRun(id) {
      return clone(state.runs.find((r) => r.id === id) ?? null);
    },
  },

  account: {
    async getUsage() {
      return summarize(countRuns(state.runs));
    },
    async getNotificationSettings() {
      return clone(state.notifications);
    },
    async updateNotificationSettings(patch) {
      Object.assign(state.notifications, patch);
      return clone(state.notifications);
    },
  },

  auth: {
    async signIn(email) {
      await delay(600);
      if (!email.includes("@")) return { ok: false, error: "Enter a valid email address." };
      return { ok: true, next: "redirect" };
    },
    async signUp(input) {
      await delay(800);
      if (input.password.length < 8) return { ok: false, error: "Use at least 8 characters." };
      return { ok: true, next: "redirect" };
    },
    async signOut() {
      await delay(200);
    },
    async signInWithGoogle() {
      return { ok: false, error: "Google sign-in is not set up in the demo. Use the email form; any address works here." };
    },
  },

  /**
   * In demo mode the loop runs for real when a model key is set, against this
   * in-memory state. Without a key it only pretends, so the marketing demo
   * still walks through onboarding.
   */
  loop: {
    async runtime() {
      return runtimeMode();
    },
    // The loop always runs the agent code. Without a model key the model, the
    // website reader, and Grants.gov answer from a recorded run (src/lib/replay).
    async buildProfile(input) {
      const [{ buildProfile }, { readSegmentRecords }] = await Promise.all([import("@/lib/loop"), import("@/lib/segments/setup")]);
      return buildProfile(await store(), input, { afterRead: (pages, rec, jobId) => readSegmentRecords(state.org, pages, segmentBackend, rec, jobId) });
    },
    async confirmProfile(input) {
      const { confirmProfile } = await import("@/lib/loop");
      return confirmProfile(await store(), input);
    },
    async findMatches(jobId) {
      const [{ findMatches }, { segmentMatches }] = await Promise.all([import("@/lib/loop"), import("@/lib/segments/setup")]);
      const st = await store();
      return findMatches(st, jobId, (rec, job) => segmentMatches(st, segmentBackend, rec, job));
    },
    async answerGaps(answers) {
      const { answerGaps } = await import("@/lib/loop");
      const { memoryStore } = await import("@/lib/loop/memory-store");
      return answerGaps(memoryStore, answers);
    },
    async progress(jobId) {
      const { readJob } = await import("@/lib/loop/progress");
      return readJob(jobId);
    },
    async draftLetter(applicationId, jobId) {
      requireEditor();
      const { draftLetterFor } = await import("@/lib/loop");
      return draftLetterFor(await store(), applicationId, jobId);
    },
    async draftProposal(applicationId, jobId) {
      requireEditor();
      if (!hasAi() && !state.sections.some((x) => x.applicationId === applicationId)) {
        return { ok: false, code: "no_ai", error: "The demo has one recorded full proposal, Riverbend's Meridian application. Drafting a new full proposal needs a model key. A letter of inquiry works here." };
      }
      if (!hasAi()) {
        const { startJob, advanceJob, finishJob } = await import("@/lib/loop/progress");
        const { PROPOSAL_STEPS } = await import("@/lib/loop/features");
        if (jobId) startJob(jobId, PROPOSAL_STEPS);
        for (const note of ["Guidelines PDF, 4 pages", "12 requirements", "6 sections drafted", "18 citations checked"]) {
          await delay(500);
          if (jobId) advanceJob(jobId, note);
        }
        if (jobId) finishJob(jobId, "done");
        const a = state.applications.find((x) => x.id === applicationId);
        if (a) a.mode = "proposal";
        const secs = state.sections.filter((s) => s.applicationId === applicationId).length;
        const open = state.missingFacts.filter((m) => m.applicationId === applicationId && m.status === "open").length;
        return { ok: true, data: { sectionCount: secs, requirementCount: state.requirements.filter((r) => r.applicationId === applicationId).length, openQuestions: open, issues: 0, wordCount: 0, runId: "run_proposal_meridian" } };
      }
      const { draftProposalFor } = await import("@/lib/loop/features");
      return draftProposalFor(await store(), applicationId, jobId);
    },
  },

  outreach: {
    async list() {
      return clone([...state.emailDrafts].sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
    },
    async get(id) {
      return clone(state.emailDrafts.find((e) => e.id === id) ?? null);
    },
    async draft(input) {
      if (!hasAi()) {
        const app = input.applicationId ? state.applications.find((a) => a.id === input.applicationId) : null;
        const opp = app ? state.opportunities.find((o) => o.id === app.opportunityId) : null;
        const funder = opp ? state.funders.find((f) => f.id === opp.funderId) : state.funders.find((f) => f.id === input.funderId);
        const e: EmailDraft = {
          id: newId("email"),
          orgId: state.org.id,
          applicationId: input.applicationId,
          funderId: funder?.id ?? "",
          contactId: input.contactId,
          kind: input.kind,
          subject: opp ? `${input.kind === "thank_you" ? "Thank you" : input.kind === "follow_up" ? "Following up" : input.kind === "feedback_request" ? "Thank you, and one question" : "A question"} about ${opp.title}` : `Hello from ${state.org.name}`,
          body: demoEmailBody(input, opp?.title ?? null),
          to: input.to,
          toName: input.toName,
          status: "draft",
          sentAt: null,
          sentVia: null,
          followUpAt: null,
          createdAt: now(),
        };
        state.emailDrafts.unshift(e);
        return { ok: true, data: clone(e) };
      }
      const { draftOutreach } = await import("@/lib/loop/features");
      return draftOutreach(await store(), input);
    },
    async update(id, patch) {
      const e = state.emailDrafts.find((x) => x.id === id) ?? notFound("email draft", id);
      Object.assign(e, patch);
      return clone(e);
    },
    async markSent(id, via, followUpDays) {
      const e = state.emailDrafts.find((x) => x.id === id) ?? notFound("email draft", id);
      e.status = "sent";
      e.sentAt = now();
      e.sentVia = via;
      if (followUpDays && e.applicationId) {
        const due = new Date(Date.now() + followUpDays * 864e5).toISOString().slice(0, 10);
        e.followUpAt = due;
        state.milestones.push({ id: newId("ms"), orgId: state.org.id, applicationId: e.applicationId, title: `Follow up on "${e.subject}"`, dueDate: due, kind: "follow_up", assigneeId: seed.CURRENT_USER_ID, done: false });
      }
      return clone(e);
    },
    async send(id, via, followUpDays) {
      const e = state.emailDrafts.find((x) => x.id === id) ?? notFound("email draft", id);
      if (!e.to) return { ok: false, code: "failed", error: "Add a recipient address first." };
      const r = integrationsServer ? await (await integrationsServer()).sendEmail(state.org.id, via, { to: e.to, subject: e.subject, text: e.body }) : { ok: false as const, reason: "not_connected" as const, message: `Connect your ${via === "gmail" ? "Google" : "Microsoft"} account first.` };
      if (!r.ok) return { ok: false, code: r.reason === "not_connected" ? "no_ai" : "failed", error: r.message };
      const sent = await mockServices.outreach.markSent(id, "manual", followUpDays);
      sent.sentVia = via;
      const row = state.emailDrafts.find((x) => x.id === id);
      if (row) row.sentVia = via;
      return { ok: true, data: sent };
    },
    async remove(id) {
      state.emailDrafts = state.emailDrafts.filter((e) => e.id !== id);
    },
  },

  contacts: {
    ...features.contacts,
    async list() {
      return clone([...state.orgContacts].sort((a, b) => a.name.localeCompare(b.name)));
    },
    async add(input) {
      const c: OrgContact = { ...input, id: newId("oc"), orgId: state.org.id, source: "manual", lastTouchAt: null, createdAt: now() };
      state.orgContacts.push(c);
      return clone(c);
    },
    async update(id, patch) {
      const c = state.orgContacts.find((x) => x.id === id) ?? notFound("contact", id);
      Object.assign(c, patch);
      return clone(c);
    },
    async remove(id) {
      state.orgContacts = state.orgContacts.filter((c) => c.id !== id);
      state.contactNotes = state.contactNotes.filter((n) => n.contactId !== id);
    },
    async importRows(rows) {
      let added = 0;
      let skipped = 0;
      for (const r of rows) {
        const name = r.name?.trim();
        if (!name || state.orgContacts.some((c) => c.name.toLowerCase() === name.toLowerCase() && (c.email ?? "") === (r.email ?? ""))) {
          skipped++;
          continue;
        }
        state.orgContacts.push({ id: newId("oc"), orgId: state.org.id, name, organization: r.organization ?? "", role: r.role ?? "", email: r.email || null, phone: r.phone || null, kind: r.kind ?? "other", relationship: r.relationship ?? "", funderId: null, source: "csv", lastTouchAt: null, createdAt: now() });
        added++;
      }
      return { added, skipped };
    },
    async listNotes(contactId) {
      return clone(state.contactNotes.filter((n) => n.contactId === contactId).sort((a, b) => b.happenedAt.localeCompare(a.happenedAt)));
    },
    async addNote(contactId, input) {
      const n = { id: newId("cn"), orgId: state.org.id, contactId, kind: input.kind, note: input.note, nextStep: input.nextStep, happenedAt: now() };
      state.contactNotes.unshift(n);
      const c = state.orgContacts.find((x) => x.id === contactId);
      if (c) c.lastTouchAt = n.happenedAt;
      return clone(n);
    },
    async draftIntroRequest(contactId, applicationId) {
      if (!hasAi()) {
        const c = state.orgContacts.find((x) => x.id === contactId) ?? notFound("contact", contactId);
        return mockServices.outreach.draft({ kind: "intro", applicationId, funderId: c.funderId, contactId, to: c.email, toName: c.name, notes: `Intro request for ${c.name} to send.` });
      }
      const { draftIntro } = await import("@/lib/loop/features");
      return draftIntro(await store(), contactId, applicationId);
    },
  },

  social: {
    ...features.social,
    async listCampaigns() {
      return clone([...state.socialCampaigns].sort((a, b) => b.month.localeCompare(a.month)));
    },
    async getCampaign(id) {
      return clone(state.socialCampaigns.find((c) => c.id === id) ?? null);
    },
    async generate(month) {
      if (!hasAi()) {
        const existing = state.socialCampaigns.find((c) => c.month === month);
        if (existing) return { ok: true, data: clone(existing) };
        const base = seed.socialCampaigns[0];
        // Riverbend has a written sample month; any other organization gets posts built from its own confirmed facts.
        const posts =
          state.org.id === seed.ORG_ID
            ? base.posts.map((p, i) => ({ ...p, id: `post_${i + 1}`, date: `${month}-${String(3 + i * 7).padStart(2, "0")}`, status: "draft" as const }))
            : (await import("@/lib/features")).credibilityPosts({ org: state.org, facts: state.facts, deadline: `${month}-24`, applicationId: "", label: "" }).map((p) => ({ ...p, tiedTo: { kind: "general" as const, id: null, label: state.org.name } }));
        const c = { ...clone(base), orgId: state.org.id, theme: state.org.id === seed.ORG_ID ? base.theme : `A month of plain, true posts about ${state.org.name}, from its confirmed facts. Template posts; with a model key they are written for each platform.`, id: newId("camp"), month, status: "draft" as const, createdAt: now(), posts };
        state.socialCampaigns.unshift(c);
        return { ok: true, data: clone(c) };
      }
      const { generateMonth } = await import("@/lib/loop/features");
      return generateMonth(await store(), month);
    },
    async updatePost(campaignId, postId, patch) {
      const c = state.socialCampaigns.find((x) => x.id === campaignId) ?? notFound("campaign", campaignId);
      const p = c.posts.find((x) => x.id === postId);
      if (p) Object.assign(p, patch);
      return clone(c);
    },
    async approve(campaignId) {
      const c = state.socialCampaigns.find((x) => x.id === campaignId) ?? notFound("campaign", campaignId);
      c.status = "approved";
      for (const p of c.posts) if (p.status === "draft") p.status = "approved";
      return clone(c);
    },
    async exportCampaign(id, format) {
      const c = state.socialCampaigns.find((x) => x.id === id) ?? notFound("campaign", id);
      return exportCampaign(c, format);
    },
  },

  integrations: {
    ...features.integrations,
    async status() {
      const { integrationStatus } = await import("@/lib/integrations");
      return integrationStatus();
    },
    async connections() {
      return integrationsServer ? (await integrationsServer()).connections(state.org.id) : [];
    },
    async connectUrl(provider, purpose) {
      if (!integrationsServer || !(await (await integrationsServer()).providerReady(provider))) return { ok: false, code: "no_ai", error: `${provider === "google" ? "Google" : "Microsoft"} keys are not set on this server yet. The Integrations page says how to add them.` };
      return { ok: true, data: { url: `/api/integrations/${provider}/connect?purpose=${purpose}` } };
    },
    async disconnect(provider) {
      if (integrationsServer) await (await integrationsServer()).disconnect(state.org.id, provider);
    },
    async syncCalendar() {
      const events = state.milestones.filter((m) => !m.done).map((m) => {
        const a = state.applications.find((x) => x.id === m.applicationId);
        const o = a ? state.opportunities.find((x) => x.id === a.opportunityId) : null;
        return { id: m.id, title: `${m.title}${o ? `: ${o.title}` : ""}`, date: m.dueDate, description: o ? `${o.title}. ${o.sourceUrl}` : "" };
      });
      const r = integrationsServer ? await (await integrationsServer()).pushEvents(state.org.id, events) : { ok: false as const, reason: "not_connected" as const, message: "Connect your Google account first." };
      if (!r.ok) return { ok: false, code: r.reason === "not_connected" ? "no_ai" : "failed", error: r.message };
      return { ok: true, data: { pushed: r.pushed } };
    },
  },
};

/** Side effects of approving an Inbox item, mirroring what the backend will do. */
function applyApproval(item: InboxItem) {
  const p = item.payload;
  switch (p.type) {
    case "milestones":
      // Milestones already exist as proposed; approval just keeps them. Nothing to change in the mock.
      break;
    case "profile_update": {
      const f = state.facts.find((x) => x.id === p.factId);
      if (f) {
        f.value = p.proposedValue;
        f.sourceDocumentId = p.sourceDocumentId;
        f.status = "confirmed";
        f.lastConfirmedAt = now();
        // The old excerpt belonged to the old source, so it never carries over.
        f.sourceExcerpt = p.sourceExcerpt ?? "";
        f.sourcePage = p.sourcePage ?? null;
      }
      break;
    }
    case "new_matches":
      for (const id of p.matchIds) {
        const m = state.matches.find((x) => x.id === id);
        if (m) m.isNew = false;
      }
      break;
    case "monthly_plan": {
      const plan = state.plans.find((x) => x.id === p.planId);
      if (plan) plan.status = "approved";
      break;
    }
    case "proposal_draft": {
      const a = state.applications.find((x) => x.id === p.applicationId);
      if (a && a.stage === "drafting") a.stage = "review";
      break;
    }
    default:
      break;
  }
}
