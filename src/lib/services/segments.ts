import type { ApplicationView, Certification, FirmProfile, PersonProfile, Personnel, PortfolioProject, ResearchProfile, BidSearchFilters } from "@/lib/types";
import type { BidService, FirmService, LoopResult, PersonService, ResearchService, SamNotice } from "./contracts";
import type { BidStore } from "@/lib/bids/store";
import type { RfpPage } from "@/lib/bids/rfp";
import { recordFacts } from "@/lib/firm/facts";
import { addAddendum, addRfp, decide, draftBid, refreshMatrix, scoreAndSave } from "@/lib/bids/run";
import { matrixSummary } from "@/lib/bids/matrix";
import { buildSf330 } from "@/lib/bids/sf330";
import { holdsSetAside, pickProjects, solicitationProfile } from "@/lib/bids/select";
import { stateOf } from "@/lib/bids/gonogo";
import { replayActive } from "@/lib/replay/active";
import { isDemoMode } from "@/lib/env";
import { emptySolicitation } from "@/lib/bids/run";
import { SET_ASIDE_CODES } from "@/lib/bids/rfp";

/**
 * Firms, bids, research teams, and individuals. The rules live here once;
 * each adapter (the in-memory demo, Supabase) only says how to read and
 * write rows, through SegmentBackend.
 */
export interface SegmentBackend {
  store(): Promise<BidStore>;
  requireEditor(): void | Promise<void>;
  newId(prefix: string): string;
  now(): string;
  applicationView(id: string): Promise<ApplicationView | null>;
  firm: {
    get(): Promise<FirmProfile | null>;
    save(p: FirmProfile): Promise<FirmProfile>;
    projects(): Promise<PortfolioProject[]>;
    saveProject(p: PortfolioProject): Promise<PortfolioProject>;
    removeProject(id: string): Promise<void>;
    personnel(): Promise<Personnel[]>;
    savePerson(p: Personnel): Promise<Personnel>;
    removePerson(id: string): Promise<void>;
    certifications(): Promise<Certification[]>;
    saveCertification(c: Certification): Promise<Certification>;
    removeCertification(id: string): Promise<void>;
  };
  research: { get(): Promise<ResearchProfile | null>; save(p: ResearchProfile): Promise<ResearchProfile> };
  person: { get(): Promise<PersonProfile | null>; save(p: PersonProfile): Promise<PersonProfile> };
  /** Pages of a document the firm uploaded as a solicitation, when the upload kept them. */
  documentPages(id: string): Promise<{ pages: RfpPage[]; fileName: string } | null>;
  /** Ids of SAM.gov notices this workspace already turned into bids. */
  addedNoticeIds(): Promise<Set<string>>;
}

const emptyFirm = (orgId: string, now: string): FirmProfile => ({ orgId, disciplines: [], naics: [], sectors: [], states: [], uei: null, cageCode: null, samRegistrationExpires: null, bonding: null, insurance: [], safety: null, employeesByDiscipline: [], averageAnnualRevenue: null, rates: [], activeBidCapacity: null, updatedAt: now });

/** A solicitation by link. The browser demo cannot fetch other sites (CORS), so it asks the server, which reads the link and keeps nothing. */
async function urlPages(url: string): Promise<{ pages: RfpPage[]; title: string | null } | { error: string }> {
  if (typeof window !== "undefined") {
    const res = await fetch("/api/segments/link", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ url }) }).catch(() => null);
    return ((await res?.json().catch(() => null)) as { pages: RfpPage[]; title: string | null } | { error: string } | null) ?? { error: "We could not reach the server to read that link. Try again, or upload the file." };
  }
  const { linkPages } = await import("@/lib/bids/link");
  return linkPages(url);
}

export function makeSegmentServices(b: SegmentBackend): { firm: FirmService; bids: BidService; research: ResearchService; person: PersonService } {
  const firm: FirmService = {
    async getProfile() {
      return b.firm.get();
    },
    async saveProfile(patch) {
      await b.requireEditor();
      const st = await b.store();
      const cur = (await b.firm.get()) ?? emptyFirm(st.orgId, b.now());
      return b.firm.save({ ...cur, ...patch, orgId: cur.orgId, updatedAt: b.now() });
    },
    async listProjects() {
      return (await b.firm.projects()).sort((x, y) => (y.completionDate ?? "9999").localeCompare(x.completionDate ?? "9999"));
    },
    async saveProject(input) {
      await b.requireEditor();
      const st = await b.store();
      return b.firm.saveProject({ ...input, id: input.id ?? b.newId("proj"), orgId: st.orgId });
    },
    async removeProject(id) {
      await b.requireEditor();
      await b.firm.removeProject(id);
    },
    async listPersonnel() {
      return b.firm.personnel();
    },
    async savePerson(input) {
      await b.requireEditor();
      const st = await b.store();
      return b.firm.savePerson({ ...input, id: input.id ?? b.newId("per"), orgId: st.orgId });
    },
    async removePerson(id) {
      await b.requireEditor();
      await b.firm.removePerson(id);
    },
    async listCertifications() {
      return b.firm.certifications();
    },
    async saveCertification(input) {
      await b.requireEditor();
      const st = await b.store();
      return b.firm.saveCertification({ ...input, id: input.id ?? b.newId("cert"), orgId: st.orgId });
    },
    async removeCertification(id) {
      await b.requireEditor();
      await b.firm.removeCertification(id);
    },
    async recordFacts() {
      const st = await b.store();
      const [org, records] = await Promise.all([st.getOrg(), st.firmRecords()]);
      return recordFacts({ org, ...records });
    },
  };

  /** Recorded or database notices narrowed by a saved bid search. Empty filter lists mean "any". */
  function matchesFilters(n: import("@/lib/samgov").SamV2Notice, f: BidSearchFilters | null | undefined): boolean {
    if (!f) return true;
    if (f.naics.length && !(n.naicsCode && f.naics.some((c) => n.naicsCode!.startsWith(c)))) return false;
    const st = n.placeOfPerformance?.state?.code ?? null;
    if (f.states.length && st && !f.states.includes(st)) return false;
    if (f.setAsides.length && !f.setAsides.some((a) => [n.typeOfSetAside, n.typeOfSetAsideDescription].some((x) => x && x.toLowerCase().includes(a.toLowerCase())))) return false;
    if (f.keywords.length) {
      const text = `${n.title} ${n.descriptionText ?? ""}`.toLowerCase();
      if (!f.keywords.some((k) => text.includes(k.toLowerCase()))) return false;
    }
    return true;
  }

  async function samNotices(filters?: BidSearchFilters | null): Promise<{ status: "live" | "recorded" | "not_connected"; notices: import("@/lib/samgov").SamV2Notice[]; recordedOn: string | null; note: string }> {
    const sam = await import("@/lib/samgov");
    if (isDemoMode() && (replayActive() || !sam.samKey())) {
      const rec = (await import("@/lib/replay/recordings/firm.samgov.json")).default as unknown as { recordedAt: string; opportunitiesData: import("@/lib/samgov").SamV2Notice[] };
      const notices = rec.opportunitiesData.filter((n) => matchesFilters(n, filters));
      return { status: "recorded", notices, recordedOn: rec.recordedAt, note: `Recorded from SAM.gov on ${rec.recordedAt}. The real product reads every open SAM.gov notice and state and city bid portals daily.` };
    }
    const db = await (await import("@/lib/grantsgov")).catalogBackend();
    if (db) {
      const st = await b.store();
      const [records, org] = await Promise.all([st.firmRecords(), st.getOrg()]);
      const codes = filters?.naics.length ? filters.naics : (records.profile?.naics.map((n) => n.code) ?? []);
      const states = filters?.states.length ? filters.states : [...new Set([org.state, ...(records.profile?.states ?? [])].map((x) => (x ?? "").trim().toUpperCase()))].filter((x) => /^[A-Z]{2}$/.test(x));
      if (!codes.length && !states.length && !filters?.keywords.length) return { status: "live", notices: [], recordedOn: null, note: "Add your NAICS codes and the states you work in on the Profile page so we know which bids to show." };
      try {
        const keywords = filters?.keywords.length ? filters.keywords : ["construction", "design", "engineering", "architectural", "renovation"];
        const notices = (await db.contractNotices({ naics: codes, states: states.length ? states : null, keywords, setAsides: filters?.setAsides ?? [], limit: 80 })).filter((n) => matchesFilters(n, filters));
        return { status: "live", notices, recordedOn: null, note: `Open bids from the opportunity database (SAM.gov and state and city portals, refreshed daily)${codes.length ? ` for NAICS ${codes.join(", ")}` : ""}${states.length ? ` in ${states.join(", ")}` : ""}.` };
      } catch (err) {
        return { status: "live", notices: [], recordedOn: null, note: err instanceof Error ? err.message : "The opportunity search failed." };
      }
    }
    if (!sam.samKey()) return { status: "not_connected", notices: [], recordedOn: null, note: "This server has no opportunity database and no SAM.gov key yet." };
    const st = await b.store();
    const records = await st.firmRecords();
    const codes = filters?.naics.length ? filters.naics : (records.profile?.naics.map((n) => n.code) ?? []);
    if (!codes.length) return { status: "live", notices: [], recordedOn: null, note: "Add your NAICS codes on the Profile page so we know which contract opportunities to search." };
    try {
      const notices = (await sam.searchSam({ naics: codes, state: filters?.states[0] ?? null })).filter((n) => matchesFilters(n, filters));
      return { status: "live", notices, recordedOn: null, note: `Searched SAM.gov for ${codes.join(", ")} in the last 90 days.` };
    } catch (err) {
      return { status: "live", notices: [], recordedOn: null, note: err instanceof Error ? err.message : "SAM.gov search failed." };
    }
  }

  const bids: BidService = {
    async addRfp(input) {
      await b.requireEditor();
      const st = await b.store();
      if (input.sample || input.samNoticeId === "5073642275214db4a200d4010bd55522") {
        const { SAMPLE_RFP } = await import("@/lib/replay/recordings/firm-rfp");
        const r = await addRfp(st, { pages: [{ page: 1, text: SAMPLE_RFP.text }], sourceUrl: SAMPLE_RFP.url, documentId: null, fileName: null, source: "samgov", externalId: `sam_${SAMPLE_RFP.noticeId}`, issuer: SAMPLE_RFP.issuer, known: { title: SAMPLE_RFP.title, number: SAMPLE_RFP.number, naics: [...SAMPLE_RFP.naics], setAside: SAMPLE_RFP.setAside, placeOfPerformance: SAMPLE_RFP.placeOfPerformance, dueDate: SAMPLE_RFP.dueDate, contact: SAMPLE_RFP.contact, type: "SF330" }, jobId: input.jobId });
        return r.ok ? { ok: true, data: { applicationId: r.data.applicationId, requirementCount: r.data.requirementCount, score: r.data.score } } : { ok: false, code: r.code === "no_text" ? "no_facts" : "failed", error: r.error };
      }
      let pages: RfpPage[] | null = null;
      let sourceUrl: string | null = null;
      let fileName: string | null = null;
      let source: "upload" | "link" | "samgov" = "upload";
      let known: Parameters<typeof addRfp>[1]["known"] = {};
      let issuer: string | null = null;
      let externalId: string | null = null;
      if (input.samNoticeId) {
        const sam = await import("@/lib/samgov");
        const { notices } = await samNotices();
        const n = notices.find((x) => x.noticeId === input.samNoticeId);
        if (!n) return { ok: false, code: "not_found", error: "That notice is not in the current SAM.gov results." };
        const text = await sam.fetchDescription(n);
        pages = [{ page: 1, text: [`SUBJECT* | ${n.title}`, n.solicitationNumber ? `SOLICITATION NUMBER* | ${n.solicitationNumber}` : "", n.typeOfSetAside ? `SET-ASIDE | ${n.typeOfSetAside}` : "", n.naicsCode ? `NAICS CODE* | ${n.naicsCode}` : "", "", text].filter((l) => l !== "").join("\n") }];
        sourceUrl = n.uiLink ?? `https://sam.gov/opp/${n.noticeId}/view`;
        source = "samgov";
        issuer = sam.titleCaseAgency(sam.agencyOf(n));
        externalId = `sam_${n.noticeId}`;
        const poc = (n.pointOfContact ?? [])[0];
        known = { title: n.title.replace(/\s+/g, " ").trim(), number: n.solicitationNumber ?? undefined, naics: n.naicsCode ? [n.naicsCode] : [], setAside: n.typeOfSetAsideDescription ?? (n.typeOfSetAside ? (SET_ASIDE_CODES[n.typeOfSetAside] ?? n.typeOfSetAside) : null), placeOfPerformance: sam.placeOf(n), dueDate: n.responseDeadLine ? n.responseDeadLine.slice(0, 16) : null, contact: poc?.fullName ? { name: poc.fullName, email: poc.email ?? null, phone: poc.phone ?? null } : null };
      } else if (input.documentId) {
        const doc = await b.documentPages(input.documentId);
        if (!doc) return { ok: false, code: "not_found", error: "We could not find that file. Upload it again." };
        pages = doc.pages;
        fileName = doc.fileName;
      } else if (input.url) {
        const got = await urlPages(input.url);
        if ("error" in got) return { ok: false, code: "unreachable", error: got.error };
        pages = got.pages;
        sourceUrl = input.url;
        source = "link";
        if (got.title) known = { ...known, title: got.title };
      } else if (input.text?.trim()) {
        pages = [{ page: 1, text: input.text }];
      }
      if (!pages?.length) return { ok: false, code: "bad_url", error: "Paste a link, upload the solicitation, or paste its text." };
      const r = await addRfp(st, { pages, sourceUrl, documentId: input.documentId ?? null, fileName, source, known, issuer, externalId, jobId: input.jobId });
      return r.ok ? { ok: true, data: { applicationId: r.data.applicationId, requirementCount: r.data.requirementCount, score: r.data.score } } : { ok: false, code: r.code === "no_text" ? "no_facts" : "failed", error: r.error };
    },
    async get(applicationId) {
      const st = await b.store();
      const ctx = await st.getApplication(applicationId);
      const view = await b.applicationView(applicationId);
      if (!ctx || !view) return null;
      const [goNoGo, requirements, addenda, fee, meta, records, pages] = await Promise.all([st.latestGoNoGo(applicationId), st.listRequirements(applicationId), st.listAddenda(applicationId), st.getFee(applicationId), st.getBidMeta(applicationId), st.firmRecords(), st.rfpPages(ctx.opportunity.id)]);
      return { application: view, solicitation: ctx.opportunity.solicitation ?? emptySolicitation(), goNoGo, requirements, addenda, fee, meta, projects: records.projects, personnel: records.personnel, matrix: matrixSummary(requirements), readBy: meta?.readBy ?? "rules", pageCount: pages?.length ?? 0 };
    },
    async rescore(applicationId) {
      await b.requireEditor();
      const st = await b.store();
      return scoreAndSave(st, applicationId);
    },
    async decide(applicationId, decision, note) {
      await b.requireEditor();
      return decide(await b.store(), applicationId, decision, note);
    },
    async draft(applicationId, jobId) {
      await b.requireEditor();
      const r = await draftBid(await b.store(), applicationId, jobId);
      return r.ok ? r : { ok: false, code: r.code === "not_found" ? "not_found" : "failed", error: r.error };
    },
    async setSelection(applicationId, input) {
      await b.requireEditor();
      const st = await b.store();
      const meta = await st.getBidMeta(applicationId);
      if (!meta) return null;
      const next = { ...meta, ...(input.projectIds ? { projectIds: input.projectIds } : {}), ...(input.assignments ? { assignments: input.assignments } : {}), ...(input.teamFirms ? { teamFirms: input.teamFirms } : {}), ...(input.additionalInformation != null ? { additionalInformation: input.additionalInformation } : {}) };
      await st.saveBidMeta(next);
      return next;
    },
    async saveFee(applicationId, fee) {
      await b.requireEditor();
      const st = await b.store();
      const saved = await st.saveFee({ ...fee, applicationId });
      await refreshMatrix(st, applicationId);
      return saved;
    },
    async addAddendum(applicationId, input) {
      await b.requireEditor();
      const st = await b.store();
      if (input.sample) {
        const { SAMPLE_RFP } = await import("@/lib/replay/recordings/firm-rfp");
        const have = new Set((await st.listAddenda(applicationId)).map((a) => a.number));
        const next = SAMPLE_RFP.addenda.find((a) => !have.has(a.number));
        if (!next) return { ok: false, code: "not_found", error: "All three amendments to this notice are already on the bid." };
        const r = await addAddendum(st, applicationId, next.text, null);
        if (r.ok && next.issuedOn) await st.updateAddendum(r.data.id, {});
        return r.ok ? r : { ok: false, code: "failed", error: r.error };
      }
      let text = input.text ?? "";
      if (input.documentId) {
        const doc = await b.documentPages(input.documentId);
        text = doc?.pages.map((p) => p.text).join("\n") ?? "";
      }
      const r = await addAddendum(st, applicationId, text, input.documentId ?? null);
      return r.ok ? r : { ok: false, code: r.code === "not_found" ? "not_found" : "failed", error: r.error };
    },
    async acknowledgeAddendum(id, acknowledged) {
      await b.requireEditor();
      const st = await b.store();
      const a = await st.updateAddendum(id, { acknowledged });
      await refreshMatrix(st, a.applicationId);
      return a;
    },
    async refreshMatrix(applicationId) {
      const r = await refreshMatrix(await b.store(), applicationId);
      return r.requirements;
    },
    async sf330(applicationId) {
      const st = await b.store();
      const ctx = await st.getApplication(applicationId);
      if (!ctx) return null;
      const [org, records, meta, user] = await Promise.all([st.getOrg(), st.firmRecords(), st.getBidMeta(applicationId), st.currentUser()]);
      const sol = ctx.opportunity.solicitation;
      return buildSf330({ org, profile: records.profile, owner: user, notice: { title: ctx.opportunity.title, location: sol?.placeOfPerformance ?? null, date: null, number: sol?.number ?? null }, projects: records.projects, exampleProjectIds: meta?.projectIds ?? [], personnel: records.personnel, assignments: meta?.assignments ?? [], certifications: records.certifications, additionalInformation: meta?.additionalInformation ?? "", teamFirms: meta?.teamFirms ?? [] });
    },
    async marketContext(applicationId) {
      const st = await b.store();
      const [ctx, records, org] = await Promise.all([st.getApplication(applicationId), st.firmRecords(), st.getOrg()]);
      const naics = ctx?.opportunity.solicitation?.naics?.[0] ?? records.profile?.naics.find((n) => n.primary)?.code ?? records.profile?.naics[0]?.code;
      if (!naics) return null;
      const db = await (await import("@/lib/grantsgov")).catalogBackend();
      if (db) {
        const states = [...new Set([org.state, ...(records.profile?.states ?? [])].map((x) => (x ?? "").trim().toUpperCase()))].filter((x) => /^[A-Z]{2}$/.test(x));
        const context = await db.marketContext({ naics, states }).catch(() => null);
        return context ? { context, recordedOn: null } : null;
      }
      if (isDemoMode()) {
        const rec = (await import("@/lib/replay/recordings/firm.market.json")).default as unknown as { recordedAt: string; context: import("@/lib/catalog/app").MarketContext };
        return rec.context.naics === naics ? { context: rec.context, recordedOn: rec.recordedAt } : null;
      }
      return null;
    },
    async searchSam(input) {
      const got = await samNotices(input?.filters ?? null);
      const { toSamNotice } = await import("@/lib/samgov");
      const st = await b.store();
      const [records, org, added] = await Promise.all([st.firmRecords(), st.getOrg(), b.addedNoticeIds()]);
      const myCodes = new Set(records.profile?.naics.map((n) => n.code) ?? []);
      const today = new Date().toISOString();
      const notices: SamNotice[] = got.notices
        .map((n) => {
          const s = toSamNotice(n);
          const reasons: string[] = [];
          const cautions: string[] = [];
          let score = 40;
          if (n.naicsCode && myCodes.has(n.naicsCode)) {
            score += 20;
            reasons.push(`NAICS ${n.naicsCode} is one of your work categories.`);
          } else if (n.naicsCode) cautions.push(`NAICS ${n.naicsCode} is not on your list.`);
          const sa = holdsSetAside(s.setAside, records.certifications, records.profile);
          if (s.setAside) {
            if (sa.held) {
              score += 15;
              reasons.push(`Set aside for a status you hold: ${s.setAside}.`);
            } else {
              score -= 30;
              cautions.push(`Set aside for a status your records do not show: ${s.setAside}.`);
            }
          }
          const place = stateOf(s.placeOfPerformance);
          if (place && (place === org.state || records.profile?.states.includes(place))) {
            score += 10;
            reasons.push(`The work is in ${place}, where you work.`);
          } else if (place) cautions.push(`The work is in ${place}, outside the states you list.`);
          const picks = pickProjects(records.projects, solicitationProfile(`${s.title}\n${s.description}`, place), { limit: 2 });
          if (picks[0] && picks[0].score >= 40) {
            score += 10;
            reasons.push(`Like your ${picks[0].project.name}.`);
          }
          if (s.responseDeadLine && s.responseDeadLine < today) {
            score = Math.min(score, 30);
            cautions.push("The response date has passed.");
          }
          return { ...s, fit: { score: Math.max(0, Math.min(95, score)), reasons, cautions }, added: added.has(`sam_${s.noticeId}`) };
        })
        .filter((n) => !n.responseDeadLine || n.responseDeadLine >= today)
        .sort((x, y) => (y.fit?.score ?? 0) - (x.fit?.score ?? 0));
      return { status: got.status, note: got.note, notices, recordedOn: got.recordedOn };
    },
  };

  const research: ResearchService = {
    async getProfile() {
      return b.research.get();
    },
    async saveProfile(patch) {
      await b.requireEditor();
      const st = await b.store();
      const cur = (await b.research.get()) ?? { orgId: st.orgId, institution: "", department: null, investigators: [], publications: [], priorAwards: [], facilities: [], capabilities: [], keywords: [], smallBusiness: false, updatedAt: b.now() };
      return b.research.save({ ...cur, ...patch, orgId: cur.orgId, updatedAt: b.now() });
    },
    async analogs() {
      const { fundedAnalogs } = await import("@/lib/research");
      const profile = await b.research.get();
      return fundedAnalogs(profile);
    },
    async draftProposal(applicationId, jobId) {
      await b.requireEditor();
      const { draftResearch } = await import("@/lib/research/draft");
      return draftResearch(await b.store(), await b.research.get(), applicationId, jobId);
    },
  };

  const person: PersonService = {
    async getProfile() {
      return b.person.get();
    },
    async saveProfile(patch) {
      await b.requireEditor();
      const st = await b.store();
      const cur = (await b.person.get()) ?? { orgId: st.orgId, fullName: "", email: null, level: "undergraduate" as const, field: "", school: null, state: "", hometown: "", gpa: null, education: [], experiences: [], awards: [], activities: [], goals: null, resumeDocumentId: null, updatedAt: b.now() };
      return b.person.save({ ...cur, ...patch, orgId: cur.orgId, updatedAt: b.now() });
    },
    async readResume(input) {
      await b.requireEditor();
      const { readResume } = await import("@/lib/person");
      const st = await b.store();
      return readResume(st, b, input) as Promise<LoopResult<PersonProfile>>;
    },
    async draftEssay(applicationId, prompt, jobId) {
      await b.requireEditor();
      const { draftEssay } = await import("@/lib/person");
      return draftEssay(await b.store(), b, applicationId, prompt, jobId);
    },
  };

  return { firm, bids, research, person };
}
