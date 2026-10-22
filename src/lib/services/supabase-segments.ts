import type { Addendum, ApplicationView, Certification, FeeProposal, FirmProfile, GoNoGo, PersonProfile, Personnel, PortfolioProject, ResearchProfile } from "@/lib/types";
import type { BidMeta, BidStore } from "@/lib/bids/store";
import type { RfpPage } from "@/lib/bids/rfp";
import type { LoopStore } from "@/lib/loop/store";
import { map } from "./supabase";
import { makeSegmentServices, type SegmentBackend } from "./segments";

/**
 * Firms, bids, research teams, and individuals over Supabase. Record bodies
 * live in jsonb `data` columns (migration 0005); ids and org scoping are
 * columns, and row level security limits every table to the org's members.
 */
type Row = Record<string, unknown>;
type Db = ReturnType<typeof import("@/lib/supabase/clients").adminClient>;
type R = { data: unknown; error: { message: string } | null };

function rows(r: R, what: string): Row[] {
  if (r.error) throw new Error(`${what}: ${r.error.message}`);
  return (r.data as Row[]) ?? [];
}
function one(r: R, what: string): Row | null {
  if (r.error) throw new Error(`${what}: ${r.error.message}`);
  return (r.data as Row | null) ?? null;
}

export function makeSupabaseBidStore(db: Db, base: LoopStore): BidStore {
  const orgId = base.orgId;
  const data = <T>(r: Row | null) => (r ? ({ ...(r.data as object), id: r.id ?? (r.data as { id?: string }).id } as T) : null);
  return {
    ...base,
    orgId,
    async firmRecords() {
      const [p, pr, pe, ce, bp] = await Promise.all([
        db.from("firm_profiles").select("*").eq("org_id", orgId).maybeSingle(),
        db.from("portfolio_projects").select("*").eq("org_id", orgId),
        db.from("personnel").select("*").eq("org_id", orgId),
        db.from("certifications").select("*").eq("org_id", orgId),
        base.listBoilerplates(),
      ]);
      return {
        profile: (one(p, "firm profile")?.data as FirmProfile | undefined) ?? null,
        projects: rows(pr, "projects").map((r) => data<PortfolioProject>(r)!),
        personnel: rows(pe, "personnel").map((r) => data<Personnel>(r)!),
        certifications: rows(ce, "certifications").map((r) => data<Certification>(r)!),
        boilerplates: bp,
      };
    },
    async createBid({ funder, opportunity, mode, noticeText }) {
      const stored = await base.upsertOpportunity(opportunity, funder, noticeText);
      const existing = one(await db.from("applications").select("*").eq("org_id", orgId).eq("opportunity_id", stored.opportunity.id).maybeSingle(), "application");
      if (existing) return { application: map.application(existing), ...stored };
      const match = await base.upsertMatch({ opportunityId: stored.opportunity.id, fitScore: 0, reasons: [], cautions: [], eligibilityChecks: [], status: "applying", dismissReason: null });
      const app = one(await db.from("applications").insert({ org_id: orgId, opportunity_id: stored.opportunity.id, match_id: match.id, stage: "go_no_go", mode }).select("*").single(), "application")!;
      return { application: map.application(app), ...stored };
    },
    async updateOpportunity(id, patch) {
      const row: Row = {};
      if (patch.solicitation !== undefined) row.solicitation = patch.solicitation;
      if (patch.deadline !== undefined) row.deadline = patch.deadline;
      if (patch.title !== undefined) row.title = patch.title;
      if (Object.keys(row).length) await db.from("opportunities").update(row).eq("id", id);
    },
    async saveRfpPages(opportunityId, pages) {
      await db.from("rfp_pages").upsert({ opportunity_id: opportunityId, org_id: orgId, pages });
    },
    async rfpPages(opportunityId) {
      return (one(await db.from("rfp_pages").select("pages").eq("opportunity_id", opportunityId).maybeSingle(), "rfp pages")?.pages as RfpPage[] | undefined) ?? null;
    },
    async getBidMeta(applicationId) {
      return (one(await db.from("bid_meta").select("data").eq("application_id", applicationId).maybeSingle(), "bid meta")?.data as BidMeta | undefined) ?? null;
    },
    async saveBidMeta(meta) {
      await db.from("bid_meta").upsert({ application_id: meta.applicationId, org_id: orgId, data: meta });
    },
    async listRequirements(applicationId) {
      return rows(await db.from("requirements").select("*").eq("application_id", applicationId).order("order"), "requirements").map(map.requirement);
    },
    async replaceRequirements(applicationId, reqs) {
      await db.from("requirements").delete().eq("application_id", applicationId);
      if (!reqs.length) return [];
      return rows(await db.from("requirements").insert(reqs.map((r) => ({ application_id: applicationId, title: r.title, kind: r.kind, detail: r.detail, word_limit: r.wordLimit, required: r.required, order: r.order, satisfied: r.satisfied, ref: r.ref ?? null, excerpt: r.excerpt ?? null, section_key: r.sectionKey ?? null, answered_in_section_id: r.answeredInSectionId ?? null, matrix_status: r.matrixStatus ?? "open" }))).select("*").order("order"), "requirements").map(map.requirement);
    },
    async replaceDraft(applicationId, draft) {
      await db.from("compliance_checks").delete().eq("application_id", applicationId);
      await db.from("missing_facts").delete().eq("application_id", applicationId);
      await db.from("requirements").update({ answered_in_section_id: null }).eq("application_id", applicationId);
      await db.from("sections").delete().eq("application_id", applicationId);
      if (draft.sections.length) await db.from("sections").insert(draft.sections.map((s) => ({ id: s.id, application_id: applicationId, title: s.title, body_html: s.bodyHtml, word_limit: s.wordLimit, status: s.status, order: s.order })));
      if (draft.missingFacts.length) await db.from("missing_facts").insert(draft.missingFacts.map((m) => ({ id: m.id, application_id: applicationId, section_id: m.sectionId, question: m.question, why_it_matters: m.whyItMatters, suggested_label: m.suggestedLabel, status: m.status, answer: m.answer, gap_key: m.gapKey })));
      if (draft.checks.length) await db.from("compliance_checks").insert(draft.checks.map((c) => ({ application_id: applicationId, section_id: c.sectionId, rule: c.rule, status: c.status, detail: c.detail })));
    },
    async saveGoNoGo(row) {
      const r = one(await db.from("go_no_go").insert({ org_id: orgId, application_id: row.applicationId, data: row }).select("*").single(), "go/no-go")!;
      const app = one(await db.from("applications").select("match_id").eq("id", row.applicationId).single(), "application");
      if (app?.match_id) await db.from("matches").update({ fit_score: row.score, reasons: row.factors.filter((f) => f.score >= 0.6).map((f) => f.detail).slice(0, 3), cautions: [...row.stoppers, ...row.factors.filter((f) => f.score < 0.5).map((f) => f.detail)].slice(0, 3) }).eq("id", app.match_id);
      return { ...(row as Omit<GoNoGo, "id" | "createdAt">), id: String(r.id), createdAt: String(r.created_at) };
    },
    async latestGoNoGo(applicationId) {
      const r = one(await db.from("go_no_go").select("*").eq("application_id", applicationId).order("created_at", { ascending: false }).limit(1).maybeSingle(), "go/no-go");
      return r ? { ...(r.data as GoNoGo), id: String(r.id), createdAt: String(r.created_at) } : null;
    },
    async updateGoNoGo(id, patch) {
      const r = one(await db.from("go_no_go").select("*").eq("id", id).single(), "go/no-go")!;
      const next = { ...(r.data as GoNoGo), ...patch };
      await db.from("go_no_go").update({ data: next }).eq("id", id);
      return { ...next, id, createdAt: String(r.created_at) };
    },
    async getFee(applicationId) {
      return (one(await db.from("fee_proposals").select("data").eq("application_id", applicationId).maybeSingle(), "fee")?.data as FeeProposal | undefined) ?? null;
    },
    async saveFee(fee) {
      const row = { ...fee, updatedAt: new Date().toISOString() };
      await db.from("fee_proposals").upsert({ application_id: fee.applicationId, org_id: orgId, data: row, updated_at: row.updatedAt });
      return row;
    },
    async listAddenda(applicationId) {
      return rows(await db.from("addenda").select("*").eq("application_id", applicationId).order("created_at"), "addenda").map((r) => ({ ...(r.data as Addendum), id: String(r.id), createdAt: String(r.created_at) }));
    },
    async addAddendum(row) {
      const r = one(await db.from("addenda").insert({ org_id: orgId, application_id: row.applicationId, data: row }).select("*").single(), "addendum")!;
      return { ...(row as Omit<Addendum, "id" | "createdAt">), id: String(r.id), createdAt: String(r.created_at) };
    },
    async updateAddendum(id, patch) {
      const r = one(await db.from("addenda").select("*").eq("id", id).single(), "addendum")!;
      const next = { ...(r.data as Addendum), ...patch };
      await db.from("addenda").update({ data: next }).eq("id", id);
      return { ...next, id, createdAt: String(r.created_at) };
    },
    async listDocuments() {
      return rows(await db.from("documents").select("*").eq("org_id", orgId), "documents").map(map.document);
    },
    async activeBidCount(excluding) {
      const apps = rows(await db.from("applications").select("id, stage, opportunities(kind)").eq("org_id", orgId).in("stage", ["go_no_go", "drafting", "review"]), "applications");
      return apps.filter((a) => a.id !== excluding && (a.opportunities as { kind?: string } | null)?.kind === "contract").length;
    },
    async replaceMilestones(applicationId, items) {
      await db.from("milestones").delete().eq("application_id", applicationId).eq("done", false);
      if (items.length) await db.from("milestones").insert(items.map((p) => ({ org_id: orgId, application_id: applicationId, title: p.title, due_date: p.dueDate, kind: p.kind })));
    },
  };
}

export function makeSupabaseSegments(input: { db: Db; loopStore: () => Promise<LoopStore>; requireEditor: () => void | Promise<void>; applicationView: (id: string) => Promise<ApplicationView | null> }) {
  const { db } = input;
  const store = async () => makeSupabaseBidStore(db, await input.loopStore());
  const orgId = async () => (await input.loopStore()).orgId;
  const upsertData = async (table: string, id: string | undefined, extra: Row, body: object) => {
    const o = await orgId();
    const r = one(await db.from(table).upsert({ ...(id ? { id } : {}), org_id: o, ...extra, data: body }).select("*").single(), table)!;
    return { ...(body as object), id: String(r.id) };
  };
  const listData = async <T>(table: string) => rows(await db.from(table).select("*").eq("org_id", await orgId()), table).map((r) => ({ ...(r.data as object), id: String(r.id) }) as T);
  const isUuid = (s: string) => /^[0-9a-f-]{36}$/.test(s);
  const backend: SegmentBackend = {
    store,
    requireEditor: input.requireEditor,
    newId: () => crypto.randomUUID(),
    now: () => new Date().toISOString(),
    applicationView: input.applicationView,
    firm: {
      async get() {
        return (one(await db.from("firm_profiles").select("data").eq("org_id", await orgId()).maybeSingle(), "firm profile")?.data as FirmProfile | undefined) ?? null;
      },
      async save(p) {
        await db.from("firm_profiles").upsert({ org_id: await orgId(), data: p, updated_at: p.updatedAt });
        return p;
      },
      projects: () => listData<PortfolioProject>("portfolio_projects"),
      saveProject: async (p) => (await upsertData("portfolio_projects", isUuid(p.id) ? p.id : undefined, { name: p.name }, p)) as PortfolioProject,
      async removeProject(id) {
        await db.from("portfolio_projects").delete().eq("id", id);
      },
      personnel: () => listData<Personnel>("personnel"),
      savePerson: async (p) => (await upsertData("personnel", isUuid(p.id) ? p.id : undefined, { name: p.name }, p)) as Personnel,
      async removePerson(id) {
        await db.from("personnel").delete().eq("id", id);
      },
      certifications: () => listData<Certification>("certifications"),
      saveCertification: async (c) => (await upsertData("certifications", isUuid(c.id) ? c.id : undefined, { kind: c.kind }, c)) as Certification,
      async removeCertification(id) {
        await db.from("certifications").delete().eq("id", id);
      },
    },
    research: {
      async get() {
        return (one(await db.from("research_profiles").select("data").eq("org_id", await orgId()).maybeSingle(), "research profile")?.data as ResearchProfile | undefined) ?? null;
      },
      async save(p) {
        await db.from("research_profiles").upsert({ org_id: await orgId(), data: p, updated_at: p.updatedAt });
        return p;
      },
    },
    person: {
      async get() {
        return (one(await db.from("person_profiles").select("data").eq("org_id", await orgId()).maybeSingle(), "person profile")?.data as PersonProfile | undefined) ?? null;
      },
      async save(p) {
        await db.from("person_profiles").upsert({ org_id: await orgId(), data: p, updated_at: p.updatedAt });
        return p;
      },
    },
    async documentPages(id) {
      const kept = one(await db.from("document_pages").select("pages").eq("document_id", id).maybeSingle(), "document pages");
      const doc = one(await db.from("documents").select("file_name, extracted_text").eq("id", id).maybeSingle(), "document");
      if (!doc) return null;
      return { pages: (kept?.pages as RfpPage[] | undefined) ?? [{ page: 1, text: String(doc.extracted_text ?? "") }], fileName: String(doc.file_name ?? "") };
    },
    async addedNoticeIds() {
      const r = rows(await db.from("opportunities").select("external_id").like("external_id", "bid_sam_%"), "opportunities");
      return new Set(r.map((x) => String(x.external_id).replace(/^bid_/, "")));
    },
  };
  return { services: makeSegmentServices(backend), backend };
}
