import type { Boilerplate, Certification, Fact, FirmProfile, Organization, Personnel, PortfolioProject } from "@/lib/types";

/**
 * A firm's records (its projects, people, credentials, bonding, safety) are
 * the source a bid cites. Each record becomes a confirmed fact with a stable
 * id, so the same checks that guard a grant letter (every claim cites a
 * fact, every number appears in one) guard a bid. Edit the record and the
 * fact changes with it; there is nothing to keep in sync by hand.
 */

const usd = (n: number | null | undefined) => (n == null ? null : `$${Math.round(n).toLocaleString("en-US")}`);
const year = (iso: string | null | undefined) => (iso ? iso.slice(0, 4) : null);

export const ROLE_WORDS: Record<PortfolioProject["role"], string> = {
  prime: "prime consultant",
  subconsultant: "subconsultant",
  joint_venture: "joint venture partner",
  construction_manager: "construction manager",
  general_contractor: "general contractor",
  design_builder: "design-builder",
};

/** One line that says everything a proposal may claim about a project. */
export function projectLine(p: PortfolioProject): string {
  const bits = [
    `${p.projectType || p.sector} for ${p.client}`,
    [p.city, p.state].filter(Boolean).join(", "),
    p.sizeSqft ? `${p.sizeSqft.toLocaleString("en-US")} square feet` : null,
    p.constructionCost ? `construction cost ${usd(p.constructionCost)}` : null,
    p.contractValue ? `firm's contract ${usd(p.contractValue)}` : null,
    p.status === "completed" ? (p.completionDate ? `completed ${year(p.completionDate)}` : "completed") : "in progress",
    `role: ${ROLE_WORDS[p.role]}`,
    p.deliveryMethod ? `delivery: ${p.deliveryMethod}` : null,
    p.services.length ? `services: ${p.services.join(", ")}` : null,
    p.outcomes.length ? `outcomes: ${p.outcomes.join("; ")}` : null,
    p.scope ? `scope: ${p.scope}` : null,
  ];
  return bits.filter(Boolean).join("; ");
}

export function personLine(p: Personnel): string {
  const regs = p.registrations.map((r) => `${r.license} (${r.state})`).join(", ");
  return [
    `${p.title}`,
    p.discipline,
    p.yearsTotal != null ? `${p.yearsTotal} years of experience` : null,
    p.yearsWithFirm != null ? `${p.yearsWithFirm} with the firm` : null,
    p.education.length ? p.education.join("; ") : null,
    regs ? `registrations: ${regs}` : null,
    p.certifications.length ? `certifications: ${p.certifications.join(", ")}` : null,
    p.summary ? `summary: ${p.summary}` : null,
  ]
    .filter(Boolean)
    .join("; ");
}

const CERT_WORDS: Record<Certification["kind"], string> = {
  small_business: "Small business",
  "8a": "SBA 8(a) program participant",
  wosb: "Women-owned small business (WOSB)",
  edwosb: "Economically disadvantaged women-owned small business (EDWOSB)",
  sdvosb: "Service-disabled veteran-owned small business (SDVOSB)",
  vosb: "Veteran-owned small business",
  hubzone: "HUBZone certified",
  mbe: "Minority business enterprise (MBE)",
  wbe: "Women business enterprise (WBE)",
  dbe: "Disadvantaged business enterprise (DBE)",
  license: "License",
  registration: "Registration",
  other: "Certification",
};

export function certLine(c: Certification): string {
  return [c.label || CERT_WORDS[c.kind], c.issuer ? `issued by ${c.issuer}` : null, c.state ? `state: ${c.state}` : null, c.number ? `number ${c.number}` : null, c.expires ? `expires ${c.expires}` : null].filter(Boolean).join("; ");
}

export const certWords = (k: Certification["kind"]) => CERT_WORDS[k];

function fact(id: string, orgId: string, label: string, value: string, category: Fact["category"], sourceLabel: string, updatedAt: string): Fact {
  return { id, orgId, label, value, category, sourceDocumentId: null, sourceUrl: null, sourceLabel, sourceExcerpt: `${label}: ${value}`, sourcePage: null, confidence: 1, status: "confirmed", lastConfirmedAt: updatedAt };
}

/** Every record as a citable fact. Ids are `rec_<record id>` so citations survive edits to the record. */
/** Boilerplate a firm writes once and reuses in every bid. Cited as a whole, so its numbers are checked against it. */
export const FIRM_BOILERPLATE: Boilerplate["type"][] = ["history", "approach", "quality_control", "safety_plan"];

export function recordFacts(input: { org: Organization; profile: FirmProfile | null; projects: PortfolioProject[]; personnel: Personnel[]; certifications: Certification[]; boilerplates?: Boilerplate[] }): Fact[] {
  const { org, profile, projects, personnel, certifications } = input;
  const at = profile?.updatedAt ?? org.createdAt;
  const out: Fact[] = [];
  for (const p of projects) out.push(fact(`rec_${p.id}`, org.id, `Project: ${p.name}`, projectLine(p), "portfolio", "Project portfolio", at));
  for (const p of projects) if (p.reference) out.push(fact(`rec_${p.id}_ref`, org.id, `Reference: ${p.name}`, `${p.reference.name}, ${p.reference.title}, ${p.reference.organization}${p.reference.phone ? `, ${p.reference.phone}` : ""}${p.reference.email ? `, ${p.reference.email}` : ""}`, "portfolio", "Project portfolio", at));
  for (const p of personnel) out.push(fact(`rec_${p.id}`, org.id, `Person: ${p.name}`, personLine(p), "people", "Personnel records", at));
  for (const c of certifications) out.push(fact(`rec_${c.id}`, org.id, `Credential: ${c.label || CERT_WORDS[c.kind]}`, certLine(c), "credentials", "Certifications and licenses", at));
  for (const b of input.boilerplates ?? []) if (FIRM_BOILERPLATE.includes(b.type) && b.body.trim()) out.push(fact(`rec_${b.id}`, org.id, `Firm text: ${b.title}`, b.body.trim(), "organization", "Firm boilerplate", b.updatedAt));
  if (profile) {
    if (profile.bonding && (profile.bonding.singleLimit || profile.bonding.aggregateLimit)) {
      out.push(fact("rec_bonding", org.id, "Bonding capacity", [profile.bonding.singleLimit ? `single project ${usd(profile.bonding.singleLimit)}` : null, profile.bonding.aggregateLimit ? `aggregate ${usd(profile.bonding.aggregateLimit)}` : null, profile.bonding.surety ? `surety: ${profile.bonding.surety}` : null, profile.bonding.asOf ? `as of ${profile.bonding.asOf}` : null].filter(Boolean).join("; "), "credentials", "Firm profile", at));
    }
    if (profile.safety && (profile.safety.emr != null || profile.safety.trir != null)) {
      out.push(fact("rec_safety", org.id, "Safety record", [profile.safety.emr != null ? `EMR ${profile.safety.emr}${profile.safety.emrYear ? ` (${profile.safety.emrYear})` : ""}` : null, profile.safety.trir != null ? `TRIR ${profile.safety.trir}` : null, profile.safety.dart != null ? `DART ${profile.safety.dart}` : null, profile.safety.fatalitiesFiveYears != null ? `${profile.safety.fatalitiesFiveYears} fatalities in five years` : null].filter(Boolean).join("; "), "credentials", "Firm profile", at));
    }
    for (const [i, ins] of profile.insurance.entries()) {
      out.push(fact(`rec_ins_${i}`, org.id, `Insurance: ${ins.kind}`, [ins.perOccurrence ? `${usd(ins.perOccurrence)} per occurrence` : null, ins.aggregate ? `${usd(ins.aggregate)} aggregate` : null, ins.carrier ? `carrier: ${ins.carrier}` : null, ins.expires ? `expires ${ins.expires}` : null].filter(Boolean).join("; "), "credentials", "Firm profile", at));
    }
    const staff = profile.employeesByDiscipline.reduce((n, d) => n + d.count, 0);
    if (staff) out.push(fact("rec_staff", org.id, "Staff by discipline", `${staff} employees: ${profile.employeesByDiscipline.map((d) => `${d.count} ${d.discipline}`).join(", ")}`, "people", "Firm profile", at));
    if (profile.naics.length) out.push(fact("rec_naics", org.id, "NAICS codes", profile.naics.map((n) => `${n.code} ${n.label}${n.primary ? " (primary)" : ""}`).join("; "), "organization", "Firm profile", at));
    if (profile.uei) out.push(fact("rec_uei", org.id, "Unique Entity ID", `${profile.uei}${profile.cageCode ? `; CAGE ${profile.cageCode}` : ""}${profile.samRegistrationExpires ? `; SAM registration active through ${profile.samRegistrationExpires}` : ""}`, "credentials", "Firm profile", at));
  }
  return out;
}
