import type { Document, FeeProposal, MatrixStatus, Requirement, Section } from "@/lib/types";

/**
 * The compliance matrix: every requirement in the solicitation, where the
 * proposal answers it, and whether it is done. Recomputed from the draft
 * each time, so it never says "met" for a section that still has a gap.
 */

const ATTACHMENT_DOCS: [RegExp, Document["type"][]][] = [
  [/insurance/i, ["insurance_certificate"]],
  [/bond/i, ["bond_letter"]],
  [/r[ée]sum[ée]/i, ["resume"]],
  [/w-?9/i, ["w9"]],
  [/capabilit/i, ["capability_statement"]],
  [/photo/i, ["project_photo"]],
];

export const SECTION_TITLES: Record<string, string> = {
  cover_letter: "Cover letter",
  qualifications: "Firm qualifications",
  projects: "Relevant past projects",
  personnel: "Key personnel",
  approach: "Project understanding and approach",
  schedule: "Schedule",
  quality_safety: "Quality and safety",
  references: "References",
  forms: "Forms and certifications",
  pricing: "Fee proposal",
  submission: "Submission and format",
};

export interface MatrixInput {
  requirements: Requirement[];
  sections: (Section & { key?: string | null })[];
  documents: Document[];
  fee: FeeProposal | null;
  /** Set-aside and license checks from go/no-go: true when the firm meets them. */
  eligibilityMet: boolean | null;
  /** Section key for each section id, when sections do not carry it. */
  sectionKeyOf: (s: Section) => string | null;
}

const hasGap = (html: string) => /data-gap="/.test(html);

export function matrixStatus(r: Requirement, input: MatrixInput): { status: MatrixStatus; answeredInSectionId: string | null } {
  const key = r.sectionKey ?? null;
  if (r.kind === "evaluation" || r.kind === "section") {
    const section = key ? input.sections.find((s) => input.sectionKeyOf(s) === key) : null;
    if (!section) return { status: key === "pricing" ? feeStatus(input.fee) : "open", answeredInSectionId: null };
    const empty = !section.bodyHtml.replace(/<[^>]+>/g, "").trim();
    return { status: empty ? "open" : hasGap(section.bodyHtml) ? "partial" : "met", answeredInSectionId: section.id };
  }
  if (r.kind === "attachment" || r.kind === "form") {
    const text = `${r.title} ${r.excerpt ?? ""}`;
    const types = ATTACHMENT_DOCS.find(([re]) => re.test(text))?.[1];
    if (types && input.documents.some((d) => types.includes(d.type))) return { status: "met", answeredInSectionId: null };
    if (key && key !== "forms") {
      const section = input.sections.find((s) => input.sectionKeyOf(s) === key);
      if (section) return { status: hasGap(section.bodyHtml) ? "partial" : "met", answeredInSectionId: section.id };
    }
    return { status: "firm_action", answeredInSectionId: null };
  }
  if (r.kind === "eligibility") return { status: input.eligibilityMet === false ? "open" : input.eligibilityMet ? "met" : "firm_action", answeredInSectionId: null };
  if (key === "pricing") return { status: feeStatus(input.fee), answeredInSectionId: null };
  // Format and submission rules are checked by the person who produces the package.
  return { status: "firm_action", answeredInSectionId: null };
}

function feeStatus(fee: FeeProposal | null): MatrixStatus {
  if (!fee) return "open";
  const lines = [...fee.phases.flatMap((p) => p.lines), ...fee.expenses];
  if (!lines.length) return "open";
  const priced = lines.filter((l) => l.amount != null || (l.hours != null && l.rate != null)).length;
  return priced === lines.length ? "met" : priced ? "partial" : "firm_action";
}

export function recomputeMatrix(input: MatrixInput): Requirement[] {
  return input.requirements.map((r) => {
    const m = matrixStatus(r, input);
    return { ...r, matrixStatus: m.status, answeredInSectionId: m.answeredInSectionId, satisfied: m.status === "met" || m.status === "not_applicable" };
  });
}

export function matrixSummary(reqs: Requirement[]): { total: number; met: number; partial: number; open: number; firmAction: number } {
  const n = (s: MatrixStatus) => reqs.filter((r) => (r.matrixStatus ?? "open") === s).length;
  return { total: reqs.length, met: n("met") + n("not_applicable"), partial: n("partial"), open: n("open"), firmAction: n("firm_action") };
}
