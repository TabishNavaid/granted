import { countRuns } from "@/lib/usage/limits";
import { state, newId, now } from "@/lib/services/mock";
import { sessionMap } from "@/lib/services/demo-session";
import * as seed from "@/lib/mock/data";
import type { Fact, Match, Section } from "@/lib/types";
import type { LoopStore, NewFact } from "./store";

/**
 * The loop store over the demo's in-memory state. Lets the real agents run
 * without Supabase: in the browser demo, and in DEMO_MODE with a
 * GEMINI_API_KEY on a server.
 */
// Keyed by opportunity id, in the visitor's session so drafting still has the notice after a reload.
const noticeTexts = sessionMap<string>("noticeTexts");

function toFact(f: NewFact, id: string): Fact {
  return { id, orgId: state.org.id, label: f.label, value: f.value, category: f.category, sourceDocumentId: null, sourceUrl: f.sourceUrl, sourceLabel: f.sourceLabel, sourceExcerpt: f.sourceExcerpt, sourcePage: null, confidence: f.confidence, status: f.status, lastConfirmedAt: now() };
}

export const memoryStore: LoopStore = {
  get orgId() {
    return state.org.id;
  },
  newId,
  async getOrg() {
    return structuredClone(state.org);
  },
  async updateOrg(patch) {
    Object.assign(state.org, patch);
    return structuredClone(state.org);
  },
  async currentUser() {
    return structuredClone(state.members.find((m) => m.id === seed.CURRENT_USER_ID)!);
  },
  async listFacts() {
    return structuredClone(state.facts);
  },
  async replaceReadFacts(facts) {
    // Facts the director stated or that came from an uploaded document stay; only the old reading of the site goes.
    state.facts = state.facts.filter((f) => f.sourceLabel === "You" || f.sourceDocumentId != null);
    const created = facts.map((f) => toFact(f, newId("fact")));
    state.facts.push(...created);
    return structuredClone(created);
  },
  async addFact(fact) {
    const f = toFact(fact, newId("fact"));
    state.facts.push(f);
    return structuredClone(f);
  },
  async updateFact(id, patch) {
    const f = state.facts.find((x) => x.id === id);
    if (!f) throw new Error(`fact ${id} not found`);
    Object.assign(f, patch);
    return structuredClone(f);
  },
  async deleteFacts(ids) {
    state.facts = state.facts.filter((f) => !ids.includes(f.id));
  },
  async upsertOpportunity(opportunity, funder, noticeText) {
    const fi = state.funders.findIndex((f) => f.id === funder.id);
    if (fi >= 0) state.funders[fi] = funder;
    else state.funders.push(funder);
    const oi = state.opportunities.findIndex((o) => o.id === opportunity.id);
    if (oi >= 0) state.opportunities[oi] = opportunity;
    else state.opportunities.push(opportunity);
    noticeTexts.set(opportunity.id, noticeText);
    return { opportunity, funder };
  },
  async replaceMatches(matches) {
    const keep = new Map(state.matches.map((m) => [m.opportunityId, m]));
    const next: Match[] = matches.map((m) => {
      const prev = keep.get(m.opportunityId);
      return { ...m, id: prev?.id ?? newId("match"), orgId: state.org.id, status: prev?.status ?? "new", isNew: !prev, createdAt: now() };
    });
    // A match the director already saved, dismissed, or started stays even if this search did not find it again.
    const found = new Set(next.map((m) => m.opportunityId));
    const decided = state.matches.filter((m) => m.status !== "new" && !found.has(m.opportunityId));
    state.matches = [...next, ...decided];
    return structuredClone(next);
  },
  async upsertMatch(m) {
    const prev = state.matches.find((x) => x.opportunityId === m.opportunityId);
    if (prev) {
      Object.assign(prev, { fitScore: m.fitScore, reasons: m.reasons, cautions: m.cautions, eligibilityChecks: m.eligibilityChecks, createdAt: now() });
      return structuredClone(prev);
    }
    const next: Match = { ...m, id: newId("match"), orgId: state.org.id, isNew: true, createdAt: now() };
    state.matches.unshift(next);
    return structuredClone(next);
  },
  async noticeTextFor(opportunityId) {
    return noticeTexts.get(opportunityId) ?? null;
  },
  async getApplication(id) {
    const application = state.applications.find((a) => a.id === id);
    if (!application) return null;
    const opportunity = state.opportunities.find((o) => o.id === application.opportunityId);
    const funder = opportunity ? state.funders.find((f) => f.id === opportunity.funderId) : null;
    if (!opportunity || !funder) return null;
    return structuredClone({ application, opportunity, funder });
  },
  async updateApplication(id, patch) {
    const a = state.applications.find((x) => x.id === id);
    if (a) Object.assign(a, patch, { updatedAt: now() });
  },
  async replaceLetter(applicationId, letter) {
    state.requirements = state.requirements.filter((r) => r.applicationId !== applicationId);
    state.sections = state.sections.filter((s) => s.applicationId !== applicationId);
    state.missingFacts = state.missingFacts.filter((m) => m.applicationId !== applicationId);
    state.complianceChecks = state.complianceChecks.filter((c) => c.applicationId !== applicationId);
    const reqs = letter.requirements.map((r) => ({ ...r, id: newId("req"), applicationId }));
    state.requirements.push(...reqs);
    state.sections.push(...letter.sections.map((s): Section => ({ ...s, applicationId, requirementId: reqs[0]?.id ?? null, updatedAt: now() })));
    state.missingFacts.push(...letter.missingFacts.map((m) => ({ ...m, applicationId })));
    state.complianceChecks.push(...letter.checks.map((c) => ({ ...c, id: newId("cc"), applicationId })));
  },
  async listSections(applicationId) {
    return structuredClone(state.sections.filter((s) => s.applicationId === applicationId).sort((a, b) => a.order - b.order));
  },
  async updateSection(id, patch) {
    const s = state.sections.find((x) => x.id === id);
    if (s) Object.assign(s, patch, { updatedAt: now() });
  },
  async listMissingFacts(applicationId) {
    return structuredClone(state.missingFacts.filter((m) => m.applicationId === applicationId));
  },
  async getMissingFact(id) {
    return structuredClone(state.missingFacts.find((m) => m.id === id) ?? null);
  },
  async updateMissingFact(id, patch) {
    const m = state.missingFacts.find((x) => x.id === id);
    if (m) Object.assign(m, patch);
  },
  async addMissingFacts(applicationId, items) {
    state.missingFacts.push(...items.map((m) => ({ ...m, applicationId })));
  },
  async replaceChecks(applicationId, checks) {
    state.complianceChecks = state.complianceChecks.filter((c) => c.applicationId !== applicationId);
    state.complianceChecks.push(...checks.map((c) => ({ ...c, id: newId("cc"), applicationId })));
  },
  async addInboxItem(item) {
    const row = { ...item, id: newId("inbox"), orgId: state.org.id, status: "pending" as const, createdAt: now(), resolvedAt: null, rejectionReason: null };
    state.inbox.unshift(row);
    return structuredClone(row);
  },
  async createRun(run) {
    const r = { ...run, id: newId("run") };
    state.runs.unshift(r);
    return structuredClone(r);
  },
  async updateRun(id, patch) {
    const r = state.runs.find((x) => x.id === id);
    if (r) Object.assign(r, patch);
  },
  async usageThisMonth() {
    return countRuns(state.runs);
  },
  async listBoilerplates() {
    return structuredClone(state.boilerplates);
  },
  async listApplications() {
    return state.applications.flatMap((application) => {
      const opportunity = state.opportunities.find((o) => o.id === application.opportunityId);
      const funder = opportunity ? state.funders.find((f) => f.id === opportunity.funderId) : null;
      if (!opportunity || !funder) return [];
      const outcome = state.outcomes.find((o) => o.applicationId === application.id);
      return [structuredClone({ application, opportunity, funder, awardAmount: outcome?.awardAmount ?? null })];
    });
  },
  async listDismissals() {
    return state.matches
      .filter((m) => m.status === "dismissed" && m.dismissReason)
      .map((m) => ({ title: state.opportunities.find((o) => o.id === m.opportunityId)?.title ?? "", reason: m.dismissReason! }));
  },
  async saveVersion(sectionId, bodyHtml, note, byName) {
    const v = { id: newId("ver"), sectionId, bodyHtml, note, byName, createdAt: now() };
    state.sectionVersions.unshift(v);
    state.sectionVersions = state.sectionVersions.filter((x) => x.sectionId !== sectionId || state.sectionVersions.filter((y) => y.sectionId === sectionId).indexOf(x) < 30);
    return structuredClone(v);
  },
  async saveReviewerCheck(check) {
    const c = { ...check, id: newId("review"), createdAt: now() };
    state.reviewerChecks.unshift(c);
    return structuredClone(c);
  },
  async getBudget(applicationId) {
    return structuredClone(state.budgets.find((b) => b.applicationId === applicationId) ?? null);
  },
  async saveBudget(applicationId, lines, justification) {
    let b = state.budgets.find((x) => x.applicationId === applicationId);
    if (!b) {
      b = { id: newId("budget"), orgId: state.org.id, applicationId, lines: [], justification: "", updatedAt: now() };
      state.budgets.push(b);
    }
    Object.assign(b, { lines, justification, updatedAt: now() });
    return structuredClone(b);
  },
  async addSection(applicationId, section) {
    const s: Section = { ...section, id: newId("sec"), applicationId, updatedAt: now() };
    state.sections.push(s);
    return structuredClone(s);
  },
  async addEmailDraft(draft) {
    const e = { ...draft, id: newId("email"), orgId: state.org.id, createdAt: now() };
    state.emailDrafts.unshift(e);
    return structuredClone(e);
  },
  async getOrgContact(id) {
    return structuredClone(state.orgContacts.find((c) => c.id === id) ?? null);
  },
  async saveCampaign(campaign) {
    const i = state.socialCampaigns.findIndex((c) => c.month === campaign.month);
    const c = { ...campaign, id: i >= 0 ? state.socialCampaigns[i].id : newId("camp"), orgId: state.org.id, createdAt: now() };
    if (i >= 0) state.socialCampaigns[i] = c;
    else state.socialCampaigns.unshift(c);
    return structuredClone(c);
  },
  async getDocumentText(id) {
    const document = state.documents.find((d) => d.id === id);
    if (!document) return null;
    return { document: structuredClone(document), text: state.documentTexts[id] ?? "" };
  },
  async replaceDocumentFacts(documentId, facts) {
    state.facts = state.facts.filter((f) => f.sourceDocumentId !== documentId);
    const created = facts.map((f) => ({ ...toFact(f, newId("fact")), sourceDocumentId: documentId }));
    state.facts.push(...created);
    const d = state.documents.find((x) => x.id === documentId);
    if (d) {
      d.factCount = created.length;
      d.status = "ready";
    }
    return structuredClone(created);
  },
};
