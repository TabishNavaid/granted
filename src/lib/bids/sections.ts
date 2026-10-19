import type { Boilerplate, BidDate, Organization, Personnel, PortfolioProject } from "@/lib/types";
import type { ParsedRequirement } from "./rfp";
import type { RoleAssignment } from "./select";
import { ROLE_WORDS } from "@/lib/firm/facts";

/**
 * The sections a firm's records can write on their own: past projects, key
 * personnel, references, schedule, quality and safety. Each is marked-up
 * text, [[fact:ID]] after each claim and [[gap:KEY]] where a record is
 * missing, so it goes through the same checks as anything a model writes.
 * The other sections (cover letter, qualifications, approach) have code
 * fallbacks here too, used when there is no model key and no recording.
 */

export interface DraftGap {
  key: string;
  sectionKey: string;
  question: string;
  whyItMatters: string;
  suggestedLabel: string;
}

export interface CodeSection {
  key: string;
  text: string;
  gaps: DraftGap[];
}

const usd = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;
const cite = (id: string) => `[[fact:rec_${id}]]`;
const clean = (s: string) => s.replace(/\s+/g, " ").trim().replace(/[.]+$/, "");

export function projectsSection(picks: PortfolioProject[]): CodeSection {
  if (!picks.length) {
    return { key: "projects", text: "[[gap:projects_none]]", gaps: [{ key: "projects_none", sectionKey: "projects", question: "Which of your past projects are most like this one? Add them to your portfolio on the Profile page.", whyItMatters: "Past projects of the same kind are usually the most heavily weighted factor.", suggestedLabel: "Relevant past projects" }] };
  }
  const blocks = picks.map((p) => {
    const where = [p.city, p.state].filter(Boolean).join(", ");
    const head = `${p.name}, ${p.client}${where ? `, ${where}` : ""}. ${cite(p.id)}`;
    const facts = [
      p.sizeSqft ? `${p.sizeSqft.toLocaleString("en-US")} square feet` : null,
      p.constructionCost ? `construction cost ${usd(p.constructionCost)}` : null,
      p.contractValue ? `fee ${usd(p.contractValue)}` : null,
      p.status === "completed" && p.completionDate ? `completed ${p.completionDate.slice(0, 4)}` : p.status === "in_progress" ? "in progress" : null,
      `role: ${ROLE_WORDS[p.role]}`,
    ].filter(Boolean);
    const lines = [`- ${facts.join("; ")}. ${cite(p.id)}`];
    if (p.scope) lines.push(`- ${clean(p.scope)}. ${cite(p.id)}`);
    if (p.outcomes.length) lines.push(`- ${p.outcomes.map(clean).join("; ")}. ${cite(p.id)}`);
    return `${head}\n\n${lines.join("\n")}`;
  });
  return { key: "projects", text: blocks.join("\n\n"), gaps: [] };
}

export function personnelSection(assignments: RoleAssignment[], people: Personnel[], projects: PortfolioProject[]): CodeSection {
  const gaps: DraftGap[] = [];
  const blocks: string[] = [];
  for (const a of assignments) {
    const p = people.find((x) => x.id === a.personnelId);
    if (!p) {
      const key = `role_${a.role.toLowerCase().replace(/\W+/g, "_")}`;
      blocks.push(`${a.role}: [[gap:${key}]]`);
      gaps.push({ key, sectionKey: "personnel", question: `Who will be the ${a.role.toLowerCase()}? Name a person on staff or a subconsultant.`, whyItMatters: "The solicitation names this role, and reviewers score the people proposed for it.", suggestedLabel: `${a.role} for this project` });
      continue;
    }
    const regs = p.registrations.map((r) => `${r.license} (${r.state})`).join(", ");
    const lines = [
      `- ${p.title}${p.yearsTotal != null ? `, ${p.yearsTotal} years of experience` : ""}${p.yearsWithFirm != null ? `, ${p.yearsWithFirm} with the firm` : ""}. ${cite(p.id)}`,
      p.education.length ? `- ${p.education.join("; ")}. ${cite(p.id)}` : null,
      regs ? `- Registrations: ${regs}. ${cite(p.id)}` : null,
      p.summary ? `- ${clean(p.summary)}. ${cite(p.id)}` : null,
    ].filter(Boolean);
    const theirs = projects.filter((x) => p.projectIds.includes(x.id)).slice(0, 3);
    if (theirs.length) lines.push(`- Projects: ${theirs.map((x) => `${x.name} ${cite(x.id)}`).join("; ")}.`);
    blocks.push(`${a.role}: ${p.name}. ${cite(p.id)}\n\n${lines.join("\n")}`);
  }
  return { key: "personnel", text: blocks.join("\n\n"), gaps };
}

export function referencesSection(picks: PortfolioProject[]): CodeSection {
  const withRef = picks.filter((p) => p.reference);
  if (!withRef.length) return { key: "references", text: "[[gap:references]]", gaps: [{ key: "references", sectionKey: "references", question: "Who are three clients who will speak for your work? Add a reference to each project on the Profile page.", whyItMatters: "Most solicitations ask for references, and owners call them.", suggestedLabel: "Client references" }] };
  const lines = withRef.slice(0, 4).map((p) => {
    const r = p.reference!;
    return `- ${r.name}, ${r.title}, ${r.organization}${r.phone ? `, ${r.phone}` : ""}${r.email ? `, ${r.email}` : ""}, for ${p.name}. [[fact:rec_${p.id}_ref]]`;
  });
  return { key: "references", text: lines.join("\n"), gaps: [] };
}

const fmtDate = (iso: string) => {
  const d = new Date(`${iso.slice(0, 10)}T12:00:00Z`);
  return d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });
};

/** The solicitation's own dates, then the phases with durations the firm confirms. */
export function scheduleSection(dates: BidDate[], dueDate: string | null): CodeSection {
  const lines = dates
    .filter((d) => d.kind !== "other")
    .map((d) => `- ${d.label}: ${fmtDate(d.date)}${d.date.length > 10 ? ` at ${d.date.slice(11, 16)}` : ""}.`);
  if (dueDate && !dates.some((d) => d.kind === "submission")) lines.push(`- Proposals due: ${fmtDate(dueDate)}.`);
  const text = [lines.length ? `The solicitation sets these dates:\n\n${lines.join("\n")}` : "", "After award, we propose this schedule: [[gap:schedule_phases]]"].filter(Boolean).join("\n\n");
  return { key: "schedule", text, gaps: [{ key: "schedule_phases", sectionKey: "schedule", question: "How long would each phase take, in weeks: design, documents, bidding, and construction administration?", whyItMatters: "Reviewers want a schedule the firm stands behind, and only the firm can set durations.", suggestedLabel: "Proposed phase durations" }] };
}

export function qualitySafetySection(boilerplates: Boilerplate[], hasSafetyRecord: boolean): CodeSection {
  const qc = boilerplates.find((b) => b.type === "quality_control" && b.body.trim());
  const safety = boilerplates.find((b) => b.type === "safety_plan" && b.body.trim());
  const gaps: DraftGap[] = [];
  const parts: string[] = [];
  if (qc) parts.push(`${clean(qc.body)}. ${cite(qc.id)}`);
  else {
    parts.push("[[gap:qc_plan]]");
    gaps.push({ key: "qc_plan", sectionKey: "quality_safety", question: "How does the firm check drawings and specifications before they go out? A paragraph you can reuse in every bid.", whyItMatters: "Most solicitations score a quality control plan.", suggestedLabel: "Quality control process" });
  }
  if (safety) parts.push(`${clean(safety.body)}. ${cite(safety.id)}`);
  if (hasSafetyRecord) parts.push("Our current safety record: [[fact:rec_safety]]");
  return { key: "quality_safety", text: parts.join("\n\n"), gaps };
}

/** Code fallback for the cover letter, used without a model key and without a recording. Every claim cites a record. */
export function coverLetterFallback(input: { org: Organization; title: string; number: string | null; issuer: string | null; contactName: string | null; signer: string; projects: PortfolioProject[]; hasStaffFact: boolean; addenda: string[] }): CodeSection {
  const { org, projects } = input;
  const lines = [
    `${input.contactName ? `Dear ${input.contactName}:` : "To the selection committee:"}`,
    `${org.name} submits this proposal for ${input.title}${input.number ? `, solicitation ${input.number}` : ""}.`,
    projects.length ? `Our most relevant recent work includes ${projects.slice(0, 3).map((p) => `${p.name} ${cite(p.id)}`).join(", ")}.` : "",
    input.hasStaffFact ? `Our team: [[fact:rec_staff]]` : "",
    input.addenda.length ? `We acknowledge receipt of ${input.addenda.join(", ")}.` : "",
    `${input.signer} is the point of contact for this proposal and is authorized to bind the firm. [[gap:cover_contact]]`,
  ].filter(Boolean);
  return { key: "cover_letter", text: lines.join("\n\n"), gaps: [{ key: "cover_contact", sectionKey: "cover_letter", question: "What phone number and email should the owner use for this proposal?", whyItMatters: "Owners need one point of contact, and the solicitation usually asks for it in the cover letter.", suggestedLabel: "Proposal point of contact" }] };
}

export function qualificationsFallback(input: { org: Organization; history: Boilerplate | null; hasStaffFact: boolean; hasNaics: boolean; credentialFactIds: string[] }): CodeSection {
  const parts: string[] = [];
  const gaps: DraftGap[] = [];
  if (input.history) parts.push(`${clean(input.history.body)}. ${cite(input.history.id)}`);
  else {
    parts.push("[[gap:firm_history]]");
    gaps.push({ key: "firm_history", sectionKey: "qualifications", question: "In a paragraph, who is the firm: when it started, where it works, and what it is known for?", whyItMatters: "Every proposal opens its qualifications with this, and you will reuse it.", suggestedLabel: "Firm history" });
  }
  if (input.hasStaffFact) parts.push("Staff: [[fact:rec_staff]]");
  if (input.credentialFactIds.length) parts.push(`Certifications and licenses: ${input.credentialFactIds.map((id) => `[[fact:${id}]]`).join(" ")}`);
  return { key: "qualifications", text: parts.join("\n\n"), gaps };
}

/** Without a model, the approach section is an outline of what the solicitation asks it to cover, each item with its reference. */
export function approachOutline(reqs: ParsedRequirement[]): CodeSection {
  const asks = reqs.filter((r) => r.sectionKey === "approach" && (r.kind === "section" || r.kind === "evaluation")).slice(0, 10);
  const lines = asks.map((r, i) => `- [[gap:approach_${i + 1}]]`);
  const gaps: DraftGap[] = asks.map((r, i) => ({ key: `approach_${i + 1}`, sectionKey: "approach", question: `How will you address this (${r.ref})? "${r.excerpt.length > 180 ? `${r.excerpt.slice(0, 178)}…` : r.excerpt}"`, whyItMatters: "The solicitation asks for it, and the approach is where reviewers see your thinking.", suggestedLabel: `Approach: ${r.title.slice(0, 50)}` }));
  if (!asks.length) {
    lines.push("- [[gap:approach_1]]");
    gaps.push({ key: "approach_1", sectionKey: "approach", question: "How would you approach this project: the owner's needs, the issues you see, and how you will deliver?", whyItMatters: "Reviewers read the approach to judge whether you understood the project.", suggestedLabel: "Project approach" });
  }
  return { key: "approach", text: lines.join("\n"), gaps };
}
