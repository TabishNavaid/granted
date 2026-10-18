import type { AgentRun, Application, Fact, FactCategory, FactStatus, Funder, Match, Member, MissingFact, Opportunity, Organization, Section, ComplianceCheck, Requirement } from "@/lib/types";

/**
 * What the real loop needs from persistence, and nothing more. Two
 * implementations: the in-memory store over the mock state (demo mode) and
 * the Supabase store. The agents never import either directly.
 */
export interface NewFact {
  label: string;
  value: string;
  category: FactCategory;
  sourceUrl: string | null;
  sourceLabel: string | null;
  sourceExcerpt: string;
  confidence: number;
  status: FactStatus;
}

export interface LetterWrite {
  requirements: Omit<Requirement, "id" | "applicationId">[];
  sections: (Omit<Section, "id" | "applicationId" | "requirementId" | "updatedAt"> & { id: string })[];
  missingFacts: (Omit<MissingFact, "applicationId" | "sectionId"> & { id: string; sectionId: string })[];
  checks: Omit<ComplianceCheck, "id" | "applicationId">[];
}

export interface LoopStore {
  readonly orgId: string;
  /** A fresh id for a row we must reference before it is written (a gap chip, a section). */
  newId(prefix: string): string;
  getOrg(): Promise<Organization>;
  updateOrg(patch: Partial<Organization>): Promise<Organization>;
  currentUser(): Promise<Member>;

  listFacts(): Promise<Fact[]>;
  /** Drop every fact that was not stated by the user, then insert these. The site was read again, so the old reading is gone. */
  replaceReadFacts(facts: NewFact[]): Promise<Fact[]>;
  addFact(fact: NewFact): Promise<Fact>;
  updateFact(id: string, patch: Partial<Fact>): Promise<Fact>;
  deleteFacts(ids: string[]): Promise<void>;

  /** Insert or refresh a Grants.gov opportunity and its agency. Returns the stored rows (ids may differ from the input in Supabase). */
  upsertOpportunity(opportunity: Opportunity, funder: Funder, noticeText: string): Promise<{ opportunity: Opportunity; funder: Funder }>;
  /** Replace the org's matches. Keep status for an opportunity the user already saved, dismissed, or started. */
  replaceMatches(matches: Omit<Match, "id" | "orgId" | "createdAt" | "isNew">[]): Promise<Match[]>;
  noticeTextFor(opportunityId: string): Promise<string | null>;

  getApplication(id: string): Promise<{ application: Application; opportunity: Opportunity; funder: Funder } | null>;
  updateApplication(id: string, patch: Partial<Application>): Promise<void>;
  replaceLetter(applicationId: string, letter: LetterWrite): Promise<void>;
  listSections(applicationId: string): Promise<Section[]>;
  updateSection(id: string, patch: Partial<Pick<Section, "bodyHtml" | "status">>): Promise<void>;
  listMissingFacts(applicationId: string): Promise<MissingFact[]>;
  getMissingFact(id: string): Promise<MissingFact | null>;
  updateMissingFact(id: string, patch: Partial<Pick<MissingFact, "status" | "answer">>): Promise<void>;
  addMissingFacts(applicationId: string, items: (Omit<MissingFact, "applicationId"> & { id: string })[]): Promise<void>;
  replaceChecks(applicationId: string, checks: Omit<ComplianceCheck, "id" | "applicationId">[]): Promise<void>;

  createRun(run: Omit<AgentRun, "id">): Promise<AgentRun>;
  updateRun(id: string, patch: Partial<AgentRun>): Promise<void>;
}
