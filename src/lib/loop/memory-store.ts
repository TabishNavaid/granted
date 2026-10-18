import { state, newId, now } from "@/lib/services/mock";
import * as seed from "@/lib/mock/data";
import type { Fact, Match, Section } from "@/lib/types";
import type { LoopStore, NewFact } from "./store";

/**
 * The loop store over the demo's in-memory state. Lets the real agents run
 * without Supabase (DEMO_MODE with a GEMINI_API_KEY). State resets with the
 * server process.
 */
const noticeTexts = new Map<string, string>();

function toFact(f: NewFact, id: string): Fact {
  return { id, orgId: state.org.id, label: f.label, value: f.value, category: f.category, sourceDocumentId: null, sourceUrl: f.sourceUrl, sourceLabel: f.sourceLabel, sourceExcerpt: f.sourceExcerpt, sourcePage: null, confidence: f.confidence, status: f.status, lastConfirmedAt: now() };
}

export const memoryStore: LoopStore = {
  orgId: state.org.id,
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
    state.facts = state.facts.filter((f) => f.sourceLabel === "You");
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
    // Seeded demo matches go away once real ones exist; the user asked for their own.
    state.matches = next;
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
  async createRun(run) {
    const r = { ...run, id: newId("run") };
    state.runs.unshift(r);
    return structuredClone(r);
  },
  async updateRun(id, patch) {
    const r = state.runs.find((x) => x.id === id);
    if (r) Object.assign(r, patch);
  },
};
