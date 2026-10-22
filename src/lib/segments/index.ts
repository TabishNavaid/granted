import type { ApplicationStage, MilestoneKind, OpportunityKind, OrgType, ProposalMode } from "@/lib/types";

/**
 * One engine, four kinds of applicant and four kinds of opportunity. This file
 * is the only place that says how they differ: the stages each kind of
 * application moves through, the sections and attachments it needs, the
 * dates that matter, and the eligibility rules to check. Screens and agents
 * read it; nothing else hard-codes a stage list or a section list.
 */

export interface StageDef {
  stage: ApplicationStage;
  label: string;
  /** One line under the column heading on the pipeline board. */
  hint: string;
}

export interface SectionDef {
  key: string;
  title: string;
  /** What the section has to do, for the drafter and for the person reading the draft. */
  prompt: string;
  /** "records": built in code from the knowledge base; "model": written by the model from facts (recorded in the demo). */
  writtenBy: "records" | "model";
  wordLimit: number | null;
}

export interface KindDef {
  kind: OpportunityKind;
  label: string;
  plural: string;
  /** What a funder or buyer is called for this kind. */
  issuer: string;
  stages: StageDef[];
  /** The proposal formats that make sense for this kind, first is the default. */
  modes: ProposalMode[];
  sections: SectionDef[];
  attachments: string[];
  dateKinds: MilestoneKind[];
  eligibility: string[];
}

const GRANT_STAGES: StageDef[] = [
  { stage: "discovered", label: "Discovered", hint: "Matched, not started" },
  { stage: "researching", label: "Researching", hint: "Reading the guidelines" },
  { stage: "drafting", label: "Drafting", hint: "Writing and answering questions" },
  { stage: "review", label: "Review", hint: "Board or reviewer read" },
  { stage: "submitted", label: "Submitted", hint: "Waiting on the funder" },
  { stage: "won", label: "Won", hint: "Awarded" },
  { stage: "lost", label: "Declined", hint: "Not funded this time" },
];

export const BID_STAGES: StageDef[] = [
  { stage: "discovered", label: "Found", hint: "On the list, not decided" },
  { stage: "go_no_go", label: "Go/no-go", hint: "Deciding whether to pursue" },
  { stage: "drafting", label: "Preparing", hint: "Writing the proposal" },
  { stage: "submitted", label: "Submitted", hint: "With the owner" },
  { stage: "shortlisted", label: "Shortlisted", hint: "Made the short list" },
  { stage: "interview", label: "Interview", hint: "Presenting to the panel" },
  { stage: "won", label: "Won", hint: "Selected or awarded" },
  { stage: "lost", label: "Lost", hint: "Not selected" },
];

export const KINDS: Record<OpportunityKind, KindDef> = {
  grant: {
    kind: "grant",
    label: "Grant",
    plural: "Grants",
    issuer: "Funder",
    stages: GRANT_STAGES,
    modes: ["letter", "proposal", "concept_note"],
    sections: [
      { key: "need", title: "Statement of need", prompt: "The problem, for whom, with the organization's own numbers.", writtenBy: "model", wordLimit: null },
      { key: "project", title: "Project description", prompt: "What the grant pays for and how it works.", writtenBy: "model", wordLimit: null },
      { key: "evaluation", title: "Evaluation", prompt: "How results will be measured.", writtenBy: "model", wordLimit: null },
      { key: "budget", title: "Budget narrative", prompt: "What each budget line buys.", writtenBy: "model", wordLimit: null },
    ],
    attachments: ["IRS determination letter", "Budget", "Board list", "Audit or financial statements"],
    dateKinds: ["deadline", "draft_due", "board_review", "budget_signoff", "submit", "follow_up", "report_due"],
    eligibility: ["Organizations described in section 501(c)(3)", "The applicant type the notice names", "Geography the funder serves"],
  },
  contract: {
    kind: "contract",
    label: "Contract or bid",
    plural: "Bids and RFPs",
    issuer: "Owner",
    stages: BID_STAGES,
    modes: ["bid", "sf330"],
    sections: [
      { key: "cover_letter", title: "Cover letter", prompt: "One page: who the firm is, why it fits this project, the point of contact, and acknowledgement of each addendum.", writtenBy: "model", wordLimit: 400 },
      { key: "qualifications", title: "Firm qualifications", prompt: "The firm's history, size, disciplines, and the experience this project calls for, from the firm's own records.", writtenBy: "model", wordLimit: 600 },
      { key: "projects", title: "Relevant past projects", prompt: "The firm's most relevant projects, chosen from its portfolio for this solicitation, each with client, size, value, dates, role, and outcome.", writtenBy: "records", wordLimit: null },
      { key: "personnel", title: "Key personnel", prompt: "The proposed team with résumés tailored to this project: role, registrations, years, and the projects that show it.", writtenBy: "records", wordLimit: null },
      { key: "approach", title: "Project understanding and approach", prompt: "What the owner needs, the issues the firm sees, and how it will deliver, tied to the solicitation's scope.", writtenBy: "model", wordLimit: 900 },
      { key: "schedule", title: "Schedule", prompt: "The solicitation's dates and the firm's phases, with durations the firm confirms.", writtenBy: "records", wordLimit: null },
      { key: "quality_safety", title: "Quality and safety", prompt: "The firm's quality control process and safety record, from its own plan and numbers.", writtenBy: "records", wordLimit: null },
      { key: "references", title: "References", prompt: "Clients from the selected projects who agreed to be references.", writtenBy: "records", wordLimit: null },
    ],
    attachments: ["Signed forms the solicitation lists", "Addendum acknowledgements", "Licenses and registrations", "Certificate of insurance", "Bid bond or bonding letter", "Small business certifications"],
    dateKinds: ["go_no_go", "questions_due", "prebid_meeting", "site_visit", "addendum", "draft_due", "submit", "interview", "follow_up"],
    eligibility: ["Set-aside status the solicitation requires", "Licenses or registrations in the project's state", "Bonding capacity at or above the bond required", "NAICS size standard"],
  },
  research: {
    kind: "research",
    label: "Research funding",
    plural: "Research funding",
    issuer: "Agency",
    stages: GRANT_STAGES,
    modes: ["research", "letter"],
    sections: [
      { key: "summary", title: "Project summary", prompt: "Overview, intellectual merit, and broader impacts (NSF) or the abstract (NIH), within the funder's length.", writtenBy: "model", wordLimit: 300 },
      { key: "aims", title: "Specific aims or objectives", prompt: "The aims, each with its hypothesis or question, on one page.", writtenBy: "model", wordLimit: 500 },
      { key: "plan", title: "Research plan", prompt: "Significance, innovation, and approach for each aim, with preliminary results the team has published.", writtenBy: "model", wordLimit: null },
      { key: "impacts", title: "Broader impacts", prompt: "Who benefits beyond the research community, and how the team will reach them.", writtenBy: "model", wordLimit: null },
      { key: "biosketches", title: "Biographical sketches", prompt: "For each investigator, in the funder's format, from their records.", writtenBy: "records", wordLimit: null },
      { key: "budget_justification", title: "Budget justification", prompt: "What each budget line pays for, using numbers the team enters.", writtenBy: "model", wordLimit: null },
      { key: "data_management", title: "Data management and sharing plan", prompt: "What data, which standards and repositories, when it is shared, and who is responsible.", writtenBy: "model", wordLimit: 1000 },
      { key: "facilities", title: "Facilities and resources", prompt: "The labs, equipment, and field sites the team already has.", writtenBy: "records", wordLimit: null },
    ],
    attachments: ["Biosketches in the funder's format", "Current and pending support", "Letters of collaboration", "Budget"],
    dateKinds: ["deadline", "draft_due", "budget_signoff", "submit", "follow_up", "report_due"],
    eligibility: ["Institution type the notice names", "Investigator eligibility", "Limits on submissions per investigator or institution"],
  },
  scholarship: {
    kind: "scholarship",
    label: "Scholarship or fellowship",
    plural: "Scholarships and fellowships",
    issuer: "Sponsor",
    stages: [
      { stage: "discovered", label: "Found", hint: "Matched, not started" },
      { stage: "drafting", label: "Writing", hint: "Essays in progress" },
      { stage: "review", label: "Recommenders", hint: "Waiting on letters" },
      { stage: "submitted", label: "Submitted", hint: "Waiting to hear" },
      { stage: "interview", label: "Interview", hint: "Finalist" },
      { stage: "won", label: "Awarded", hint: "Won it" },
      { stage: "lost", label: "Not selected", hint: "Not this time" },
    ],
    modes: ["essay"],
    sections: [{ key: "essay", title: "Personal statement", prompt: "The prompt the sponsor sets, answered from the person's own experiences, in their own voice.", writtenBy: "model", wordLimit: 650 }],
    attachments: ["Transcript", "Recommendation letters", "Résumé"],
    dateKinds: ["deadline", "draft_due", "submit", "interview", "follow_up"],
    eligibility: ["Education level", "Field of study", "State or hometown", "GPA, if the sponsor sets one"],
  },
};

export interface OrgTypeDef {
  type: OrgType;
  label: string;
  /** One line on the setup question. */
  description: string;
  /** What the profile is about, in the app's words. */
  profileNoun: string;
  /** Kinds of opportunity this applicant pursues, in the order the Opportunities screen shows them. */
  kinds: OpportunityKind[];
  /** Setup steps after the type question. */
  steps: { href: string; label: string }[];
}

export const ORG_TYPES: Record<OrgType, OrgTypeDef> = {
  nonprofit: {
    type: "nonprofit",
    label: "Nonprofit",
    description: "A 501(c)(3) or a fiscally sponsored project. Grants from foundations and government.",
    profileNoun: "organization",
    kinds: ["grant"],
    steps: [
      { href: "/onboarding", label: "Website" },
      { href: "/onboarding/ein", label: "EIN" },
      { href: "/onboarding/reading", label: "Reading" },
      { href: "/onboarding/profile", label: "Confirm" },
      { href: "/onboarding/gaps", label: "A few questions" },
      { href: "/onboarding/matches", label: "First matches" },
    ],
  },
  firm: {
    type: "firm",
    label: "Architecture, engineering, or construction firm",
    description: "A for-profit firm that wins work through RFPs, qualifications, and bids. Grants and incentives too.",
    profileNoun: "firm",
    kinds: ["contract", "grant"],
    steps: [
      { href: "/onboarding", label: "Website" },
      { href: "/onboarding/reading", label: "Reading" },
      { href: "/onboarding/profile", label: "Confirm" },
      { href: "/onboarding/gaps", label: "Work and credentials" },
      { href: "/onboarding/matches", label: "First bids" },
    ],
  },
  research: {
    type: "research",
    label: "Research team",
    description: "A university lab or a small research company. Federal research funding, SBIR and STTR.",
    profileNoun: "team",
    kinds: ["research", "grant"],
    steps: [
      { href: "/onboarding", label: "Lab page" },
      { href: "/onboarding/reading", label: "Reading" },
      { href: "/onboarding/profile", label: "Confirm" },
      { href: "/onboarding/gaps", label: "Team and awards" },
      { href: "/onboarding/matches", label: "First matches" },
    ],
  },
  individual: {
    type: "individual",
    label: "Individual",
    description: "A student or professional applying for scholarships and fellowships.",
    profileNoun: "profile",
    kinds: ["scholarship"],
    steps: [
      { href: "/onboarding", label: "Résumé" },
      { href: "/onboarding/profile", label: "Confirm" },
      { href: "/onboarding/matches", label: "First matches" },
    ],
  },
};

export const kindOf = (o: { kind?: OpportunityKind | null }): OpportunityKind => o.kind ?? "grant";

/** The stages an application of this kind can be in, in board order. */
export function stagesFor(kind: OpportunityKind | undefined | null): StageDef[] {
  return KINDS[kind ?? "grant"].stages;
}

/** The label this kind uses for a stage, falling back to the plain stage name. */
export function stageLabel(stage: ApplicationStage, kind?: OpportunityKind | null): string {
  return stagesFor(kind).find((s) => s.stage === stage)?.label ?? ALL_STAGE_LABELS[stage];
}

export const ALL_STAGE_LABELS: Record<ApplicationStage, string> = {
  discovered: "Discovered",
  go_no_go: "Go/no-go",
  researching: "Researching",
  drafting: "Drafting",
  review: "Review",
  submitted: "Submitted",
  shortlisted: "Shortlisted",
  interview: "Interview",
  won: "Won",
  lost: "Lost",
};

export const MODE_LABELS: Record<ProposalMode, string> = {
  letter: "Letter of inquiry",
  proposal: "Full proposal",
  concept_note: "Concept note",
  bid: "Proposal to the RFP",
  sf330: "SF 330 qualifications",
  research: "Research proposal",
  essay: "Essay",
};
