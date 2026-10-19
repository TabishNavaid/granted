import type { Certification, FirmProfile, Member, Organization, Personnel, PortfolioProject, Sf330, Sf330Project, Sf330Resume } from "@/lib/types";
import type { RoleAssignment } from "./select";
import { certWords } from "@/lib/firm/facts";

/**
 * The Standard Form 330 (Architect-Engineer Qualifications) as data, built
 * from the firm's own records for one notice. Part I is contract-specific:
 * A contract information, B the firm's point of contact, C the proposed
 * team, D the organizational chart, E résumés, F up to ten example
 * projects, G who worked on which example project, H additional
 * information, I the authorized representative. Part II is the firm's
 * general qualifications. Anything the records cannot answer goes in
 * `missing` rather than being filled in.
 */

export const SF330_LIMITS = { exampleProjects: 10, projectsPerResume: 5 };

/** SF 330 Part II revenue index: 1 is under $100,000, 10 is $50 million or more. */
export const REVENUE_INDEX = ["Less than $100,000", "$100,000 to less than $250,000", "$250,000 to less than $500,000", "$500,000 to less than $1 million", "$1 million to less than $2 million", "$2 million to less than $5 million", "$5 million to less than $10 million", "$10 million to less than $25 million", "$25 million to less than $50 million", "$50 million or greater"];

const where = (p: { city: string; state: string }) => [p.city, p.state].filter(Boolean).join(", ");

export interface Sf330Input {
  org: Organization;
  profile: FirmProfile | null;
  owner: Member | null;
  notice: { title: string; location: string | null; date: string | null; number: string | null };
  projects: PortfolioProject[];
  /** Selected example projects, best first. At most ten are used. */
  exampleProjectIds: string[];
  personnel: Personnel[];
  assignments: RoleAssignment[];
  certifications: Certification[];
  /** Section H, written by the firm or drafted for it. */
  additionalInformation: string;
  /** Other firms on the team (Section C), as the firm entered them. */
  teamFirms?: { role: string; firm: string; address: string; branch?: string | null }[];
}

export function buildSf330(input: Sf330Input): Sf330 {
  const { org, profile } = input;
  const missing: string[] = [];
  const firmAddress = [org.city, org.state].filter(Boolean).join(", ");
  const examples = input.exampleProjectIds.map((id) => input.projects.find((p) => p.id === id)).filter((p): p is PortfolioProject => Boolean(p)).slice(0, SF330_LIMITS.exampleProjects);
  if (!examples.length) missing.push("Section F needs at least one example project from your portfolio.");
  const f: Sf330Project[] = examples.map((p, i) => ({
    key: String(i + 1),
    projectId: p.id,
    title: p.name,
    location: where(p),
    completed: { professional: p.status === "completed" && p.completionDate ? p.completionDate.slice(0, 4) : null, construction: p.status === "completed" && p.completionDate ? p.completionDate.slice(0, 4) : null },
    owner: p.client,
    pointOfContact: p.reference ? `${p.reference.name}, ${p.reference.title}${p.reference.phone ? `, ${p.reference.phone}` : ""}` : null,
    description: [p.scope, p.sizeSqft ? `${p.sizeSqft.toLocaleString("en-US")} square feet.` : null, p.constructionCost ? `Construction cost $${p.constructionCost.toLocaleString("en-US")}.` : null, p.outcomes.length ? `${p.outcomes.join("; ")}.` : null].filter(Boolean).join(" "),
    firms: [{ name: org.name, location: firmAddress, role: p.role === "prime" ? "Prime" : p.role.replace(/_/g, " ") }],
  }));
  for (const x of f) if (!x.pointOfContact) missing.push(`Section F, project ${x.key} (${x.title}): add the owner's point of contact.`);

  const people = input.assignments.map((a) => ({ a, p: input.personnel.find((x) => x.id === a.personnelId) ?? null }));
  for (const { a, p } of people) if (!p) missing.push(`Section E: no one is assigned as ${a.role}.`);
  const e: Sf330Resume[] = people
    .filter((x): x is { a: RoleAssignment; p: Personnel } => Boolean(x.p))
    .map(({ a, p }) => {
      const theirs = input.projects.filter((x) => p.projectIds.includes(x.id)).sort((x, y) => (y.completionDate ?? "").localeCompare(x.completionDate ?? "")).slice(0, SF330_LIMITS.projectsPerResume);
      return {
        personnelId: p.id,
        name: p.name,
        role: a.role,
        yearsTotal: p.yearsTotal,
        yearsWithFirm: p.yearsWithFirm,
        firmAndLocation: `${org.name}${p.office ? `, ${p.office}` : firmAddress ? `, ${firmAddress}` : ""}`,
        education: p.education,
        registrations: p.registrations.map((r) => `${r.license}, ${r.state}${r.number ? ` (${r.number})` : ""}`),
        other: p.certifications.join("; "),
        projects: theirs.map((x) => ({ title: x.name, location: where(x), year: x.completionDate?.slice(0, 4) ?? (x.status === "in_progress" ? "Ongoing" : null), description: x.scope, withThisFirm: true })),
      };
    });

  const g = {
    projects: f.map((x) => ({ key: x.key, title: x.title })),
    people: e.map((r) => {
      const person = input.personnel.find((p) => p.id === r.personnelId)!;
      return { name: r.name, role: r.role, marks: f.filter((x) => person.projectIds.includes(x.projectId)).map((x) => x.key) };
    }),
  };

  const contact = input.owner;
  if (!contact) missing.push("Section B: name the firm's point of contact for this notice.");
  if (!input.additionalInformation.trim()) missing.push("Section H: add the firm's response to the evaluation factors not covered elsewhere.");
  missing.push("Section D: attach the organizational chart of the proposed team.");
  missing.push("Section I: the authorized representative signs and dates the form.");

  const ownership = input.certifications.filter((c) => !["license", "registration", "other"].includes(c.kind)).map((c) => certWords(c.kind));
  if (!profile?.uei) missing.push("Part II, block 4: the firm's Unique Entity ID from SAM.gov.");
  if (!profile?.employeesByDiscipline.length) missing.push("Part II, block 9: employees by discipline.");
  if (!profile?.averageAnnualRevenue?.total) missing.push("Part II, block 11: average annual revenue index for the last three years.");

  // Block 10: experience profile codes, counted from the portfolio.
  const codes = new Map<string, { label: string; projects: number }>();
  for (const p of input.projects) if (p.profileCode) codes.set(p.profileCode, { label: p.projectType || p.sector, projects: (codes.get(p.profileCode)?.projects ?? 0) + 1 });

  return {
    partI: {
      a: { title: input.notice.title, location: input.notice.location ?? "", date: input.notice.date, number: input.notice.number },
      b: contact ? { name: contact.fullName, title: contact.role === "owner" ? "Principal" : "Project manager", firm: org.name, phone: null, email: contact.email } : null,
      c: [{ role: "Prime", firm: org.name, address: firmAddress, isPrime: true, branch: null }, ...(input.teamFirms ?? []).map((t) => ({ role: t.role, firm: t.firm, address: t.address, isPrime: false, branch: t.branch ?? null }))],
      d: { note: "Attach the organizational chart of the proposed team, showing each firm and key person.", documentId: null },
      e,
      f,
      g,
      h: input.additionalInformation,
      i: { name: contact?.fullName ?? "", title: contact?.role === "owner" ? "Principal" : "", date: null },
    },
    partII: {
      firmName: org.name,
      address: firmAddress,
      yearEstablished: org.foundedYear,
      uei: profile?.uei ?? null,
      ownership,
      smallBusinessStatus: ownership.length ? ownership.join("; ") : null,
      disciplines: profile?.employeesByDiscipline ?? [],
      experience: [...codes.entries()].map(([code, v]) => ({ code, label: v.label, projects: v.projects, revenueIndex: null })),
      averageAnnualRevenue: profile?.averageAnnualRevenue ?? null,
    },
    missing,
  };
}
