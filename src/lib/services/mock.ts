import * as seed from "@/lib/mock/data";
import type {
  Application,
  ApplicationView,
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

/**
 * In-memory mock adapter. State lives for the life of the page (or server
 * process) and resets on reload, which is what we want for a demo. Every
 * method is async so the Supabase adapter can replace it without UI changes.
 */

const clone = <T>(v: T): T => structuredClone(v);

export const state = {
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
  subscription: clone(seed.subscription),
  invoices: clone(seed.invoices),
  notifications: clone(seed.notificationSettings),
};

export const now = () => new Date().toISOString();
const delay = (ms = 0) => new Promise((r) => setTimeout(r, ms));
let idCounter = 1000;
export const newId = (prefix: string) => `${prefix}_${++idCounter}`;

function notFound(what: string, id: string): never {
  throw new Error(`${what} ${id} not found`);
}

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

export const mockServices: Services = {
  org: {
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
      const m: Member = { id: newId("user"), orgId: state.org.id, fullName: "", email, role, status: "invited" };
      state.members.push(m);
      return clone(m);
    },
    async currentUser() {
      return clone(state.members.find((m) => m.id === seed.CURRENT_USER_ID)!);
    },
  },

  knowledge: {
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
    async updateBoilerplate(id, body) {
      const b = state.boilerplates.find((x) => x.id === id) ?? notFound("boilerplate", id);
      b.body = body;
      b.version += 1;
      b.wordCount = wordCount(body);
      b.updatedAt = now();
      return clone(b);
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
    async removeDocument(id) {
      state.documents = state.documents.filter((d) => d.id !== id);
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
    async startApplication(opportunityId) {
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
        facts: state.facts,
        documents: state.documents,
      });
    },
    async updateSection(id, bodyHtml) {
      const s = state.sections.find((x) => x.id === id) ?? notFound("section", id);
      s.bodyHtml = bodyHtml;
      if (s.status === "empty" && bodyHtml.replace(/<[^>]+>/g, "").trim()) s.status = "edited";
      else if (s.status === "drafted") s.status = "edited";
      touchSection(s);
      return clone(s);
    },
    async setSectionStatus(id, status) {
      const s = state.sections.find((x) => x.id === id) ?? notFound("section", id);
      s.status = status;
      s.updatedAt = now();
      return clone(s);
    },
    async answerMissingFact(id, answer) {
      const m = state.missingFacts.find((x) => x.id === id) ?? notFound("missing fact", id);
      if (m.gapKey && hasAi()) {
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
        sourceExcerpt: `Answered by Dana Okafor in the Meridian proposal workspace.`,
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
    async moveStage(id, stage) {
      const a = state.applications.find((x) => x.id === id) ?? notFound("application", id);
      a.stage = stage;
      a.updatedAt = now();
      if (stage === "submitted" && !a.submittedAt) a.submittedAt = now();
      return toApplicationView(a);
    },
    async logOutcome(id, result, awardAmount, feedback) {
      const a = state.applications.find((x) => x.id === id) ?? notFound("application", id);
      a.stage = result === "won" ? "won" : "lost";
      a.updatedAt = now();
      const existing = state.outcomes.find((o) => o.applicationId === id);
      if (existing) Object.assign(existing, { result, awardAmount, feedback, decidedAt: now() });
      else state.outcomes.push({ id: newId("out"), applicationId: id, result, awardAmount, feedback, decidedAt: now() });
      return toApplicationView(a);
    },
  },

  inbox: {
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
    async listEvents() {
      const events: CalendarEvent[] = state.milestones.map((m) => {
        const a = state.applications.find((x) => x.id === m.applicationId);
        const opp = a ? state.opportunities.find((o) => o.id === a.opportunityId) : null;
        const funder = opp ? state.funders.find((f) => f.id === opp.funderId) : null;
        return { id: m.id, date: m.dueDate, title: m.title, kind: m.kind, applicationId: m.applicationId, funderName: funder?.name ?? "", done: m.done };
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
  },

  activity: {
    async listRuns() {
      return clone([...state.runs].sort((a, b) => b.startedAt.localeCompare(a.startedAt)));
    },
    async getRun(id) {
      return clone(state.runs.find((r) => r.id === id) ?? null);
    },
  },

  billing: {
    async getSubscription() {
      return clone(state.subscription);
    },
    async listInvoices() {
      return clone(state.invoices);
    },
    async changePlan(plan) {
      state.subscription.plan = plan;
      state.subscription.usage.proposalLimit = plan === "free" ? 1 : plan === "starter" ? 3 : null;
      state.subscription.usage.matchLimit = plan === "free" ? 5 : null;
      return clone(state.subscription);
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
    async buildProfile(input) {
      if (!hasAi()) {
        await delay(900);
        return { ok: true, data: { pageCount: 6, factCount: state.facts.length, droppedCount: 0, runId: "run_profile_onboard", fromCache: true } };
      }
      const { buildProfile } = await import("@/lib/loop");
      const { memoryStore } = await import("@/lib/loop/memory-store");
      return buildProfile(memoryStore, input);
    },
    async confirmProfile(input) {
      if (!hasAi()) {
        await delay(600);
        return { ok: true, data: { confirmed: input.keptFactIds.length, removed: 0 } };
      }
      const { confirmProfile } = await import("@/lib/loop");
      const { memoryStore } = await import("@/lib/loop/memory-store");
      return confirmProfile(memoryStore, input);
    },
    async findMatches() {
      if (!hasAi()) {
        await delay(1200);
        return { ok: true, data: { matchCount: state.matches.length, screened: 412, read: 24, runId: "run_discovery_w42", fromCache: true } };
      }
      const { findMatches } = await import("@/lib/loop");
      const { memoryStore } = await import("@/lib/loop/memory-store");
      return findMatches(memoryStore);
    },
    async draftLetter(applicationId) {
      if (!hasAi()) {
        await delay(2000);
        const secs = state.sections.filter((s) => s.applicationId === applicationId).length;
        const open = state.missingFacts.filter((m) => m.applicationId === applicationId && m.status === "open").length;
        return { ok: true, data: { sectionCount: secs, openQuestions: open, issues: 0, wordCount: 0, runId: "run_proposal_meridian" } };
      }
      const { draftLetterFor } = await import("@/lib/loop");
      const { memoryStore } = await import("@/lib/loop/memory-store");
      return draftLetterFor(memoryStore, applicationId);
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
        f.sourceExcerpt = "Average attendance across all sites, 2025-26: 89%";
        f.sourcePage = null;
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
