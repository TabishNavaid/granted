import type { Addendum, Application, Boilerplate, Certification, Document, FeeProposal, FirmProfile, Funder, GoNoGo, Opportunity, Personnel, PortfolioProject, ProposalMode, Requirement } from "@/lib/types";
import type { LoopStore } from "@/lib/loop/store";
import type { RfpPage } from "./rfp";
import type { RoleAssignment } from "./select";

/**
 * What the bid workflow needs from persistence beyond the grant loop. The
 * in-memory demo store and the Supabase store both implement it, so the same
 * code reads an RFP, scores go/no-go, and drafts the proposal in both.
 */
export interface FirmRecords {
  profile: FirmProfile | null;
  projects: PortfolioProject[];
  personnel: Personnel[];
  certifications: Certification[];
  boilerplates: Boilerplate[];
}

/** Per-bid choices: which projects and people the proposal uses, and which section answers which part of the matrix. */
export interface BidMeta {
  applicationId: string;
  projectIds: string[];
  assignments: RoleAssignment[];
  /** Section id to section key (cover_letter, projects, ...). */
  sectionKeys: Record<string, string>;
  /** SF 330 Section C: other firms on the team, as the firm entered them. */
  teamFirms: { role: string; firm: string; address: string }[];
  /** SF 330 Section H. */
  additionalInformation: string;
  /** "rules" or "rules and model". */
  readBy: string;
}

export interface BidStore extends LoopStore {
  firmRecords(): Promise<FirmRecords>;
  /** Create an owner (funder), an opportunity, and an application in one go, for an RFP the firm brought. */
  createBid(input: { funder: Funder; opportunity: Opportunity; mode: ProposalMode; noticeText: string }): Promise<{ application: Application; opportunity: Opportunity; funder: Funder }>;
  updateOpportunity(id: string, patch: Partial<Opportunity>): Promise<void>;
  saveRfpPages(opportunityId: string, pages: RfpPage[]): Promise<void>;
  rfpPages(opportunityId: string): Promise<RfpPage[] | null>;
  getBidMeta(applicationId: string): Promise<BidMeta | null>;
  saveBidMeta(meta: BidMeta): Promise<void>;
  listRequirements(applicationId: string): Promise<Requirement[]>;
  replaceRequirements(applicationId: string, reqs: Omit<Requirement, "id" | "applicationId">[]): Promise<Requirement[]>;
  /** Write sections, questions, and checks without touching the requirements (the compliance matrix). */
  replaceDraft(applicationId: string, draft: Omit<import("@/lib/loop/store").LetterWrite, "requirements">): Promise<void>;
  saveGoNoGo(row: Omit<GoNoGo, "id" | "createdAt">): Promise<GoNoGo>;
  latestGoNoGo(applicationId: string): Promise<GoNoGo | null>;
  updateGoNoGo(id: string, patch: Partial<Pick<GoNoGo, "decision" | "decidedBy" | "decidedAt" | "note">>): Promise<GoNoGo>;
  getFee(applicationId: string): Promise<FeeProposal | null>;
  saveFee(fee: FeeProposal): Promise<FeeProposal>;
  listAddenda(applicationId: string): Promise<Addendum[]>;
  addAddendum(row: Omit<Addendum, "id" | "createdAt">): Promise<Addendum>;
  updateAddendum(id: string, patch: Partial<Pick<Addendum, "acknowledged" | "summary" | "changes">>): Promise<Addendum>;
  listDocuments(): Promise<Document[]>;
  /** Bids being decided or prepared now, other than this one. */
  activeBidCount(excludingApplicationId: string | null): Promise<number>;
  /** Replace unfinished milestones on an application with these. */
  replaceMilestones(applicationId: string, items: { title: string; dueDate: string; kind: import("@/lib/types").MilestoneKind }[]): Promise<void>;
}
