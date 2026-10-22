import { AiError, getAi, type JsonSchema } from "@/lib/ai";
import { stateCode as stateCodeOf } from "@/lib/catalog/vocab";
import { hasAi } from "@/lib/env";
import { replayActive } from "@/lib/replay/active";
import type { CrawledPage } from "@/lib/crawl";
import type { Certification, Organization, Personnel, PortfolioProject, ResearchProfile } from "@/lib/types";
import { logJob } from "@/lib/loop/progress";
import type { Recorder } from "@/lib/loop/runs";
import type { LoopStore } from "@/lib/loop/store";
import { matchScholarships, toFunder as foundationFunder, toOpportunity as foundationOpportunity, foundationByFunderId, rememberFoundations } from "@/lib/foundations";
import { fundedAnalogs } from "@/lib/research";
import { firmGrants, researchMatches } from "./discover";
import type { SegmentBackend } from "@/lib/services/segments";

/**
 * Setup for firms, research teams, and individuals, on top of the same
 * website reading every organization gets. A record is kept only when its
 * quoted passage is on the page it names, the same check facts pass.
 */

const flat = (s: string) => s.replace(/\s+/g, " ").trim().toLowerCase();
const onPage = (pages: CrawledPage[], excerpt: string) => {
  const e = flat(excerpt);
  return e.length >= 12 && pages.some((p) => flat(p.text).includes(e));
};

const firmSchema: JsonSchema = {
  type: "object",
  properties: {
    projects: { type: "array", items: { type: "object", properties: { name: { type: "string" }, client: { type: "string" }, city: { type: "string" }, state: { type: "string" }, projectType: { type: "string" }, sector: { type: "string" }, sizeSqft: { type: "integer", nullable: true }, constructionCost: { type: "integer", nullable: true }, completionYear: { type: "integer", nullable: true }, scope: { type: "string" }, outcomes: { type: "array", items: { type: "string" } }, excerpt: { type: "string" } }, required: ["name", "client", "city", "state", "projectType", "sector", "sizeSqft", "constructionCost", "completionYear", "scope", "outcomes", "excerpt"] } },
    people: { type: "array", items: { type: "object", properties: { name: { type: "string" }, title: { type: "string" }, discipline: { type: "string" }, yearsTotal: { type: "integer", nullable: true }, registrations: { type: "array", items: { type: "object", properties: { license: { type: "string" }, state: { type: "string" } }, required: ["license", "state"] } }, certifications: { type: "array", items: { type: "string" } }, excerpt: { type: "string" } }, required: ["name", "title", "discipline", "yearsTotal", "registrations", "certifications", "excerpt"] } },
    certifications: { type: "array", items: { type: "object", properties: { kind: { type: "string", enum: ["small_business", "8a", "wosb", "edwosb", "sdvosb", "vosb", "hubzone", "mbe", "wbe", "dbe", "license", "registration", "other"] }, label: { type: "string" }, issuer: { type: "string" }, state: { type: "string", nullable: true }, number: { type: "string", nullable: true }, excerpt: { type: "string" } }, required: ["kind", "label", "issuer", "state", "number", "excerpt"] } },
    sectors: { type: "array", items: { type: "string" } },
  },
  required: ["projects", "people", "certifications", "sectors"],
};

type FirmRead = { projects: (Omit<PortfolioProject, "id" | "orgId" | "contractValue" | "startDate" | "completionDate" | "status" | "role" | "deliveryMethod" | "services" | "reference" | "photos" | "personnelIds" | "profileCode" | "source" | "clientType"> & { completionYear: number | null; excerpt: string })[]; people: { name: string; title: string; discipline: string; yearsTotal: number | null; registrations: { license: string; state: string }[]; certifications: string[]; excerpt: string }[]; certifications: { kind: Certification["kind"]; label: string; issuer: string; state: string | null; number: string | null; excerpt: string }[]; sectors: string[] };

const researchSchema: JsonSchema = {
  type: "object",
  properties: {
    institution: { type: "string" },
    department: { type: "string" },
    investigators: { type: "array", items: { type: "object", properties: { name: { type: "string" }, title: { type: "string" }, role: { type: "string", enum: ["pi", "co_pi", "senior", "postdoc", "student"] }, expertise: { type: "array", items: { type: "string" } }, excerpt: { type: "string" } }, required: ["name", "title", "role", "expertise", "excerpt"] } },
    publications: { type: "array", items: { type: "object", properties: { title: { type: "string" }, venue: { type: "string" }, year: { type: "integer" }, authors: { type: "string" }, excerpt: { type: "string" } }, required: ["title", "venue", "year", "authors", "excerpt"] } },
    priorAwards: { type: "array", items: { type: "object", properties: { funder: { type: "string" }, title: { type: "string" }, amount: { type: "integer", nullable: true }, startYear: { type: "integer", nullable: true }, endYear: { type: "integer", nullable: true }, role: { type: "string" }, excerpt: { type: "string" } }, required: ["funder", "title", "amount", "startYear", "endYear", "role", "excerpt"] } },
    facilities: { type: "array", items: { type: "object", properties: { name: { type: "string" }, description: { type: "string" }, excerpt: { type: "string" } }, required: ["name", "description", "excerpt"] } },
    capabilities: { type: "array", items: { type: "string" } },
    keywords: { type: "array", items: { type: "string" }, description: "Two to four specific phrases to search funding notices for, e.g. 'harmful algal bloom'." },
  },
  required: ["institution", "department", "investigators", "publications", "priorAwards", "facilities", "capabilities", "keywords"],
};

const canModel = () => hasAi() || replayActive();

/** After the website is read: a firm's projects, people, and credentials; a research team's people, papers, awards, and facilities. */
export async function readSegmentRecords(org: Organization, pages: CrawledPage[], b: SegmentBackend, rec: Recorder, jobId?: string): Promise<{ kept: number; dropped: number }> {
  if (!canModel() || (org.orgType !== "firm" && org.orgType !== "research")) return { kept: 0, dropped: 0 };
  const prompt = `Read these pages from one ${org.orgType === "firm" ? "architecture, engineering, or construction firm's" : "research team's"} website. Return only what the pages state, with the exact sentence each record comes from as its excerpt.\n\n${pages.map((p) => `=== ${p.url}\n${p.text.slice(0, 8000)}`).join("\n\n")}`;
  try {
    if (org.orgType === "firm") {
      const res = await rec.step("extract_firm", () => getAi().generateJson<FirmRead>({ tier: "lite", label: "extract_firm", system: "You read a firm's website into records for its proposal knowledge base: past projects, people, and certifications. Only what the site states. No em dashes.", prompt, schema: firmSchema, maxOutputTokens: 6000 }), (r) => `${r.data.projects.length} projects, ${r.data.people.length} people, ${r.data.certifications.length} credentials found`);
      rec.tally(res);
      let kept = 0;
      let dropped = 0;
      const existing = await b.firm.projects();
      for (const p of res.data.projects) {
        if (!onPage(pages, p.excerpt)) {
          dropped++;
          logJob(jobId, { kind: "dropped", text: `Project: ${p.name}`, detail: "Set aside: its quote is not on the page." });
          continue;
        }
        const same = existing.find((x) => flat(x.name) === flat(p.name));
        const url = pages.find((pg) => flat(pg.text).includes(flat(p.excerpt)))?.url ?? null;
        await b.firm.saveProject({
          ...(same ?? { id: b.newId("proj"), orgId: org.id, contractValue: null, startDate: null, role: "prime", deliveryMethod: null, services: [], reference: null, photos: [], personnelIds: [], profileCode: null, clientType: "municipal" as const }),
          name: p.name,
          client: p.client || same?.client || "",
          city: p.city,
          state: p.state,
          projectType: p.projectType,
          sector: p.sector,
          scope: same?.scope || p.scope,
          sizeSqft: p.sizeSqft ?? same?.sizeSqft ?? null,
          constructionCost: p.constructionCost ?? same?.constructionCost ?? null,
          completionDate: same?.completionDate ?? (p.completionYear ? `${p.completionYear}-12-31` : null),
          status: p.completionYear || same?.status === "completed" ? "completed" : "in_progress",
          outcomes: same?.outcomes.length ? same.outcomes : p.outcomes,
          source: same?.source ?? { kind: "website", label: "Read from the firm's website", url },
        } as PortfolioProject);
        logJob(jobId, { kind: "fact", text: `Project: ${p.name}`, detail: p.excerpt, url: url ?? undefined });
        kept++;
      }
      const people = await b.firm.personnel();
      for (const p of res.data.people) {
        if (!onPage(pages, p.excerpt)) {
          dropped++;
          continue;
        }
        const same = people.find((x) => flat(x.name).startsWith(flat(p.name).split(",")[0]));
        await b.firm.savePerson({ ...(same ?? { id: b.newId("per"), orgId: org.id, role: p.title, yearsWithFirm: null, education: [], summary: "", projectIds: [], resumeDocumentId: null, office: null }), name: same?.name ?? p.name, title: p.title, discipline: p.discipline, yearsTotal: p.yearsTotal ?? same?.yearsTotal ?? null, registrations: same?.registrations.length ? same.registrations : p.registrations.map((r) => ({ ...r, number: null, expires: null })), certifications: same?.certifications.length ? same.certifications : p.certifications } as Personnel);
        logJob(jobId, { kind: "fact", text: `Person: ${p.name}`, detail: p.excerpt });
        kept++;
      }
      const certs = await b.firm.certifications();
      for (const c of res.data.certifications) {
        if (!onPage(pages, c.excerpt)) {
          dropped++;
          continue;
        }
        const same = certs.find((x) => x.kind === c.kind && (x.kind !== "registration" || x.issuer === c.issuer));
        if (!same) await b.firm.saveCertification({ id: b.newId("cert"), orgId: org.id, kind: c.kind, label: c.label, issuer: c.issuer, state: c.state, number: c.number, expires: null, documentId: null });
        logJob(jobId, { kind: "fact", text: `Credential: ${c.label}`, detail: c.excerpt });
        kept++;
      }
      const profile = await b.firm.get();
      if (res.data.sectors.length && !profile?.sectors.length) await b.firm.save({ ...(profile ?? { orgId: org.id, disciplines: [], naics: [], states: [], uei: null, cageCode: null, samRegistrationExpires: null, bonding: null, insurance: [], safety: null, employeesByDiscipline: [], averageAnnualRevenue: null, rates: [], activeBidCapacity: null, updatedAt: new Date().toISOString() }), sectors: res.data.sectors, updatedAt: new Date().toISOString() });
      return { kept, dropped };
    }
    type R = { institution: string; department: string; investigators: { name: string; title: string; role: ResearchProfile["investigators"][number]["role"]; expertise: string[]; excerpt: string }[]; publications: { title: string; venue: string; year: number; authors: string; excerpt: string }[]; priorAwards: { funder: string; title: string; amount: number | null; startYear: number | null; endYear: number | null; role: string; excerpt: string }[]; facilities: { name: string; description: string; excerpt: string }[]; capabilities: string[]; keywords: string[] };
    const res = await rec.step("extract_research", () => getAi().generateJson<R>({ tier: "lite", label: "extract_research", system: "You read a research team's website into its profile: investigators, publications, prior awards, facilities, capabilities, and search phrases for funding. Only what the site states. No em dashes.", prompt, schema: researchSchema, maxOutputTokens: 6000 }), (r) => `${r.data.investigators.length} investigators, ${r.data.publications.length} publications, ${r.data.priorAwards.length} prior awards`);
    rec.tally(res);
    const d = res.data;
    const keep = <T extends { excerpt: string }>(xs: T[]) => xs.filter((x) => onPage(pages, x.excerpt));
    const inv = keep(d.investigators);
    const pubs = keep(d.publications);
    const awards = keep(d.priorAwards);
    const facs = keep(d.facilities);
    for (const x of [...inv.map((i) => `Investigator: ${i.name}`), ...pubs.map((p) => `Publication: ${p.title}`), ...awards.map((a) => `Prior award: ${a.title}`), ...facs.map((f) => `Facility: ${f.name}`)]) logJob(jobId, { kind: "fact", text: x });
    const cur = await b.research.get();
    await b.research.save({
      orgId: org.id,
      institution: d.institution || cur?.institution || "",
      department: d.department || cur?.department || null,
      investigators: inv.map((i, n) => ({ id: `inv_${n + 1}`, name: i.name, title: i.title, role: i.role, expertise: i.expertise, orcid: null })),
      publications: pubs.map((p, n) => ({ id: `pub_${n + 1}`, title: p.title, venue: p.venue, year: p.year, authors: p.authors, doi: null })),
      priorAwards: awards.map((a, n) => ({ id: `awd_${n + 1}`, funder: a.funder, number: null, title: a.title, amount: a.amount, startYear: a.startYear, endYear: a.endYear, role: a.role })),
      facilities: facs.map((f, n) => ({ id: `fac_${n + 1}`, name: f.name, description: f.description })),
      capabilities: d.capabilities,
      keywords: d.keywords.slice(0, 4),
      smallBusiness: cur?.smallBusiness ?? false,
      updatedAt: new Date().toISOString(),
    });
    const all = d.investigators.length + d.publications.length + d.priorAwards.length + d.facilities.length;
    const kept = inv.length + pubs.length + awards.length + facs.length;
    return { kept, dropped: all - kept };
  } catch (err) {
    if (err instanceof AiError) return { kept: 0, dropped: 0 };
    throw err;
  }
}

/** Matches for a firm (grants and incentives), a research team (research funding), or a person (scholarships). */
export async function segmentMatches(store: LoopStore, b: SegmentBackend, rec: Recorder, jobId?: string): Promise<{ matchCount: number; screened: number; read: number; summary: string }> {
  const org = await store.getOrg();
  const write = async (ms: { opportunity: import("@/lib/types").Opportunity; funder: import("@/lib/types").Funder; noticeText: string; fitScore: number; reasons: string[]; cautions: string[]; eligibilityChecks: import("@/lib/types").EligibilityCheck[] }[]) => {
    const rows = [];
    for (const m of ms) {
      const stored = await store.upsertOpportunity(m.opportunity, m.funder, m.noticeText);
      rows.push({ opportunityId: stored.opportunity.id, fitScore: m.fitScore, reasons: m.reasons, cautions: m.cautions, eligibilityChecks: m.eligibilityChecks, status: "new" as const, dismissReason: null });
    }
    return store.replaceMatches(rows);
  };
  const ev = (e: { kind: "search" | "note" | "dropped"; text: string; detail?: string }) => logJob(jobId, e);
  if (org.orgType === "firm") {
    const r = await rec.step("search_grants", async () => firmGrants({ org, profile: await b.firm.get(), onEvent: ev }), (x) => `${x.matches.length} grants and incentives kept of ${x.read} read`);
    for (const d of r.dropped.slice(0, 12)) logJob(jobId, { kind: "dropped", text: d.title, detail: `Set aside: ${d.reason}.` });
    for (const m of r.matches) logJob(jobId, { kind: "notice", text: m.opportunity.title, score: m.fitScore, detail: m.reasons[1] ?? m.reasons[0] });
    rec.source("Grants.gov", "https://www.grants.gov", "database");
    const stored = await write(r.matches);
    return { matchCount: stored.length, screened: r.searched.reduce((n, s) => n + s.hits, 0), read: r.read, summary: `Found ${stored.length} grants and incentives a for-profit firm can apply for. Bids from SAM.gov and the RFPs you add are on the Bids tab.` };
  }
  if (org.orgType === "research") {
    const profile = await b.research.get();
    const analogs = await rec.step("funded_projects", () => fundedAnalogs(profile), (x) => `${x.analogs.length} funded projects at NSF and NIH like this work${x.status === "recorded" ? " (recorded)" : ""}`);
    for (const a of analogs.analogs.slice(0, 6)) logJob(jobId, { kind: "note", text: `${a.source.toUpperCase()}: ${a.title}`, detail: [a.institution, a.program, a.programOfficer ? `program officer ${a.programOfficer}` : null].filter(Boolean).join(", ") });
    rec.source("NSF Award Search", "https://www.nsf.gov/awardsearch/", "database");
    rec.source("NIH RePORTER", "https://reporter.nih.gov/", "database");
    const r = await rec.step("search_research", () => researchMatches({ org, profile, analogs: analogs.analogs, onEvent: ev }), (x) => `${x.matches.length} research notices kept of ${x.read} read`);
    for (const d of r.dropped.slice(0, 12)) logJob(jobId, { kind: "dropped", text: d.title, detail: `Set aside: ${d.reason}.` });
    for (const m of r.matches) logJob(jobId, { kind: "notice", text: m.opportunity.title, score: m.fitScore, detail: m.reasons[0] });
    rec.source("Grants.gov", "https://www.grants.gov", "database");
    const stored = await write(r.matches);
    return { matchCount: stored.length, screened: r.searched.reduce((n, s) => n + s.hits, 0), read: r.read, summary: `Found ${stored.length} research funding notices, backed by ${analogs.analogs.length} funded projects like yours at NSF and NIH.` };
  }
  // Individuals: scholarships from foundations' IRS filings.
  const person = await b.person.get();
  const db = await (await import("@/lib/grantsgov")).catalogBackend();
  const pool = db ? await db.foundationPool(stateCodeOf(person?.state || org.state), { individuals: true }).catch(() => undefined) : undefined;
  if (pool) rememberFoundations(pool);
  const found = await rec.step("match_scholarships", async () => matchScholarships({ state: person?.state || org.state, level: person?.level ?? "undergraduate", field: person?.field ?? "", hometown: person?.hometown ?? org.city, limit: 10, pool }), (x) => `${x.length} scholarship funds in your state`);
  const ms = found
    .map((s) => {
      const f = foundationByFunderId(s.funderId);
      if (!f) return null;
      const base = foundationOpportunity(f);
      return { opportunity: { ...base, id: `${base.id}_sch`, kind: "scholarship" as const, title: `${f.name} scholarship` }, funder: foundationFunder(f), noticeText: `Scholarship fund: ${f.name}\n${s.reasons.join(" ")}\n${f.application?.howTo ?? ""}\n${f.application?.restrictions ?? ""}`, fitScore: s.fit ?? Math.min(88, 50 + s.reasons.length * 10), reasons: s.reasons, cautions: s.cautions, eligibilityChecks: [] };
    })
    .filter((x): x is NonNullable<typeof x> => Boolean(x));
  for (const m of ms) logJob(jobId, { kind: "notice", text: m.opportunity.title, score: m.fitScore, detail: m.reasons[0] });
  rec.source("IRS Form 990-PF filings", "https://www.irs.gov/charities-non-profits/form-990-series-downloads", "database");
  const stored = await write(ms);
  return { matchCount: stored.length, screened: found.length, read: found.length, summary: `Found ${stored.length} scholarship funds from foundations' IRS filings.` };
}
