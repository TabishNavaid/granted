import { state, newId, now } from "@/lib/services/mock";
import { sessionMap } from "@/lib/services/demo-session";
import { memoryStore } from "@/lib/loop/memory-store";
import type { Application, GoNoGo, Match, Requirement, Section } from "@/lib/types";
import type { RfpPage } from "./rfp";
import type { BidStore } from "./store";

/**
 * The bid store over the demo's in-memory state. RFP pages are kept by
 * opportunity id in the visitor's session, which outlives this module's
 * copies (route handlers, server actions) and, in the browser, a reload.
 */
const rfpPages = sessionMap<RfpPage[]>("rfpPages");
const clone = <T>(v: T): T => structuredClone(v);

export const memoryBidStore: BidStore = {
  ...memoryStore,
  get orgId() {
    return state.org.id;
  },
  async firmRecords() {
    return clone({ profile: state.firmProfile, projects: state.projects, personnel: state.personnel, certifications: state.certifications, boilerplates: state.boilerplates });
  },
  async createBid({ funder, opportunity, mode, noticeText }) {
    await memoryStore.upsertOpportunity(opportunity, funder, noticeText);
    const existing = state.applications.find((a) => a.opportunityId === opportunity.id);
    if (existing) return clone({ application: existing, opportunity, funder });
    const match: Match = { id: newId("match"), orgId: state.org.id, opportunityId: opportunity.id, fitScore: 0, reasons: [], cautions: [], eligibilityChecks: [], status: "applying", isNew: false, dismissReason: null, createdAt: now() };
    state.matches.push(match);
    const application: Application = { id: newId("app"), orgId: state.org.id, opportunityId: opportunity.id, matchId: match.id, stage: "go_no_go", mode, askAmount: null, ownerId: state.members.find((m) => m.role === "owner")?.id ?? null, submittedAt: null, createdAt: now(), updatedAt: now() };
    state.applications.push(application);
    return clone({ application, opportunity, funder });
  },
  async updateOpportunity(id, patch) {
    const o = state.opportunities.find((x) => x.id === id);
    if (o) Object.assign(o, patch);
  },
  async saveRfpPages(opportunityId, pages) {
    rfpPages.set(opportunityId, pages);
  },
  async rfpPages(opportunityId) {
    return rfpPages.get(opportunityId) ?? null;
  },
  async getBidMeta(applicationId) {
    return clone(state.bidMeta[applicationId] ?? null);
  },
  async saveBidMeta(meta) {
    state.bidMeta[meta.applicationId] = clone(meta);
  },
  async listRequirements(applicationId) {
    return clone(state.requirements.filter((r) => r.applicationId === applicationId).sort((a, b) => a.order - b.order));
  },
  async replaceRequirements(applicationId, reqs) {
    const old = state.requirements.filter((r) => r.applicationId === applicationId);
    state.requirements = state.requirements.filter((r) => r.applicationId !== applicationId);
    // Keep ids stable by order, so a link to a matrix row survives a recompute.
    const rows: Requirement[] = reqs.map((r, i) => ({ ...r, id: old[i]?.id ?? newId("req"), applicationId }));
    state.requirements.push(...rows);
    return clone(rows);
  },
  async replaceDraft(applicationId, draft) {
    state.sections = state.sections.filter((s) => s.applicationId !== applicationId);
    state.missingFacts = state.missingFacts.filter((m) => m.applicationId !== applicationId);
    state.complianceChecks = state.complianceChecks.filter((c) => c.applicationId !== applicationId);
    state.sections.push(...draft.sections.map((s): Section => ({ ...s, applicationId, requirementId: null, updatedAt: now() })));
    state.missingFacts.push(...draft.missingFacts.map((m) => ({ ...m, applicationId })));
    state.complianceChecks.push(...draft.checks.map((c) => ({ ...c, id: newId("cc"), applicationId })));
  },
  async saveGoNoGo(row) {
    const g: GoNoGo = { ...clone(row), id: newId("gng"), createdAt: now() };
    state.goNoGo.push(g);
    // The match shows the go/no-go score as its fit, so the list and the board agree.
    const app = state.applications.find((a) => a.id === row.applicationId);
    const match = app ? state.matches.find((m) => m.id === app.matchId || m.opportunityId === app.opportunityId) : null;
    if (match) {
      match.fitScore = row.score;
      match.reasons = row.factors.filter((f) => f.score >= 0.6).sort((a, b) => b.weight * b.score - a.weight * a.score).slice(0, 3).map((f) => f.detail);
      match.cautions = [...row.stoppers, ...row.factors.filter((f) => f.score < 0.5).map((f) => f.detail)].slice(0, 3);
    }
    return clone(g);
  },
  async latestGoNoGo(applicationId) {
    const rows = state.goNoGo.filter((g) => g.applicationId === applicationId);
    return clone(rows[rows.length - 1] ?? null);
  },
  async updateGoNoGo(id, patch) {
    const g = state.goNoGo.find((x) => x.id === id);
    if (!g) throw new Error(`go/no-go ${id} not found`);
    Object.assign(g, patch);
    return clone(g);
  },
  async getFee(applicationId) {
    return clone(state.fees.find((f) => f.applicationId === applicationId) ?? null);
  },
  async saveFee(fee) {
    const i = state.fees.findIndex((f) => f.applicationId === fee.applicationId);
    const row = { ...clone(fee), updatedAt: now() };
    if (i >= 0) state.fees[i] = row;
    else state.fees.push(row);
    return clone(row);
  },
  async listAddenda(applicationId) {
    return clone(state.addenda.filter((a) => a.applicationId === applicationId));
  },
  async addAddendum(row) {
    const a = { ...clone(row), id: newId("add"), createdAt: now() };
    state.addenda.push(a);
    return clone(a);
  },
  async updateAddendum(id, patch) {
    const a = state.addenda.find((x) => x.id === id);
    if (!a) throw new Error(`addendum ${id} not found`);
    Object.assign(a, patch);
    return clone(a);
  },
  async listDocuments() {
    return clone(state.documents);
  },
  async activeBidCount(excluding) {
    return state.applications.filter((a) => a.id !== excluding && ["go_no_go", "drafting", "review"].includes(a.stage) && state.opportunities.find((o) => o.id === a.opportunityId)?.kind === "contract").length;
  },
  async replaceMilestones(applicationId, items) {
    state.milestones = state.milestones.filter((m) => m.applicationId !== applicationId || m.done);
    const owner = state.applications.find((a) => a.id === applicationId)?.ownerId ?? null;
    state.milestones.push(...items.map((p) => ({ id: newId("ms"), orgId: state.org.id, applicationId, title: p.title, dueDate: p.dueDate, kind: p.kind, assigneeId: owner, done: false })));
  },
};
