import { randomUUID } from "node:crypto";
import type { AgentRun, Application, Fact, Funder, Match, MissingFact, Opportunity, Section } from "@/lib/types";
import { adminClient } from "@/lib/supabase/clients";
import type { SessionContext } from "@/lib/supabase/session";
import { map } from "@/lib/services/supabase";
import type { LoopStore, NewFact } from "./store";

type Row = Record<string, unknown>;

function must<T = Row>(r: { data: unknown; error: { message: string } | null }, what: string): T {
  if (r.error) throw new Error(`${what}: ${r.error.message}`);
  if (r.data == null) throw new Error(`${what}: not found`);
  return r.data as T;
}
function many(r: { data: unknown; error: { message: string } | null }, what: string): Row[] {
  return must<Row[]>(r, what);
}

function factRow(orgId: string, f: NewFact) {
  return { org_id: orgId, label: f.label, value: f.value, category: f.category, source_document_id: null, source_url: f.sourceUrl, source_label: f.sourceLabel, source_excerpt: f.sourceExcerpt, source_page: null, confidence: f.confidence, status: f.status, last_confirmed_at: f.status === "confirmed" ? new Date().toISOString() : null };
}

/** The loop store over Supabase, scoped to one organization. */
export function makeSupabaseStore(s: SessionContext): LoopStore {
  const db = adminClient();
  const orgId = s.orgId;
  return {
    orgId,
    newId: () => randomUUID(),
    async getOrg() {
      return map.org(must(await db.from("organizations").select("*").eq("id", orgId).single(), "organization"));
    },
    async updateOrg(patch) {
      return map.org(must(await db.from("organizations").update(map.orgPatch(patch)).eq("id", orgId).select("*").single(), "organization"));
    },
    async currentUser() {
      return { id: s.userId, orgId, fullName: s.fullName, email: s.email, role: "owner", status: "active" };
    },
    async listFacts() {
      return many(await db.from("facts").select("*").eq("org_id", orgId).order("created_at"), "facts").map(map.fact);
    },
    async replaceReadFacts(facts) {
      await db.from("facts").delete().eq("org_id", orgId).or("source_label.is.null,source_label.neq.You");
      if (!facts.length) return [];
      return many(await db.from("facts").insert(facts.map((f) => factRow(orgId, f))).select("*"), "facts").map(map.fact);
    },
    async addFact(fact) {
      return map.fact(must(await db.from("facts").insert(factRow(orgId, fact)).select("*").single(), "fact"));
    },
    async updateFact(id, patch: Partial<Fact>) {
      return map.fact(must(await db.from("facts").update(map.factPatch(patch)).eq("id", id).eq("org_id", orgId).select("*").single(), "fact"));
    },
    async deleteFacts(ids) {
      if (ids.length) await db.from("facts").delete().eq("org_id", orgId).in("id", ids);
    },
    async upsertOpportunity(opportunity, funder, noticeText) {
      const f = must(await db.from("funders").upsert(map.funderRow(funder), { onConflict: "external_id" }).select("*").single(), "funder");
      const o = must(await db.from("opportunities").upsert(map.opportunityRow(opportunity, f.id as string, noticeText), { onConflict: "external_id" }).select("*").single(), "opportunity");
      return { opportunity: map.opportunity(o), funder: map.funder(f) };
    },
    async replaceMatches(matches) {
      const existing = many(await db.from("matches").select("*").eq("org_id", orgId), "matches").map(map.match);
      const prev = new Map(existing.map((m) => [m.opportunityId, m]));
      const keepIds = new Set(matches.map((m) => m.opportunityId));
      // Matches that are no longer returned go away unless the user acted on them.
      const stale = existing.filter((m) => !keepIds.has(m.opportunityId) && m.status === "new").map((m) => m.id);
      if (stale.length) await db.from("matches").delete().in("id", stale);
      const rows = matches.map((m) => ({ org_id: orgId, opportunity_id: m.opportunityId, fit_score: m.fitScore, reasons: m.reasons, cautions: m.cautions, eligibility_checks: m.eligibilityChecks, status: prev.get(m.opportunityId)?.status ?? "new" }));
      if (!rows.length) return [];
      return many(await db.from("matches").upsert(rows, { onConflict: "org_id,opportunity_id" }).select("*"), "matches").map(map.match) as Match[];
    },
    async upsertMatch(m) {
      const { data: prev } = await db.from("matches").select("status").eq("org_id", orgId).eq("opportunity_id", m.opportunityId).maybeSingle();
      return map.match(must(await db.from("matches").upsert({ org_id: orgId, opportunity_id: m.opportunityId, fit_score: m.fitScore, reasons: m.reasons, cautions: m.cautions, eligibility_checks: m.eligibilityChecks, status: (prev?.status as string | undefined) ?? "new", dismiss_reason: null }, { onConflict: "org_id,opportunity_id" }).select("*").single(), "match"));
    },
    async noticeTextFor(opportunityId) {
      const { data } = await db.from("opportunities").select("notice_text").eq("id", opportunityId).maybeSingle();
      return (data?.notice_text as string | null) ?? null;
    },
    async getApplication(id) {
      const { data: a } = await db.from("applications").select("*").eq("id", id).eq("org_id", orgId).maybeSingle();
      if (!a) return null;
      const { data: o } = await db.from("opportunities").select("*").eq("id", a.opportunity_id).maybeSingle();
      if (!o) return null;
      const f = must(await db.from("funders").select("*").eq("id", o.funder_id).single(), "funder");
      return { application: map.application(a), opportunity: map.opportunity(o), funder: map.funder(f) };
    },
    async updateApplication(id, patch) {
      const row: Record<string, unknown> = {};
      if (patch.stage) row.stage = patch.stage;
      if (patch.askAmount !== undefined) row.ask_amount = patch.askAmount;
      if (Object.keys(row).length) await db.from("applications").update(row).eq("id", id).eq("org_id", orgId);
    },
    async replaceLetter(applicationId, letter) {
      await db.from("compliance_checks").delete().eq("application_id", applicationId);
      await db.from("missing_facts").delete().eq("application_id", applicationId);
      await db.from("sections").delete().eq("application_id", applicationId);
      await db.from("requirements").delete().eq("application_id", applicationId);
      const reqs = many(await db.from("requirements").insert(letter.requirements.map((r) => ({ application_id: applicationId, title: r.title, kind: r.kind, detail: r.detail, word_limit: r.wordLimit, required: r.required, order: r.order, satisfied: r.satisfied }))).select("id"), "requirements");
      await db.from("sections").insert(letter.sections.map((s) => ({ id: s.id, application_id: applicationId, requirement_id: reqs[0]?.id ?? null, title: s.title, body_html: s.bodyHtml, word_limit: s.wordLimit, status: s.status, order: s.order })));
      if (letter.missingFacts.length) await db.from("missing_facts").insert(letter.missingFacts.map((m) => ({ id: m.id, application_id: applicationId, section_id: m.sectionId, question: m.question, why_it_matters: m.whyItMatters, suggested_label: m.suggestedLabel, status: m.status, answer: m.answer, gap_key: m.gapKey })));
      await db.from("compliance_checks").insert(letter.checks.map((c) => ({ application_id: applicationId, section_id: c.sectionId, rule: c.rule, status: c.status, detail: c.detail })));
    },
    async listSections(applicationId) {
      return many(await db.from("sections").select("*").eq("application_id", applicationId).order("order"), "sections").map(map.section) as Section[];
    },
    async updateSection(id, patch) {
      const row: Record<string, unknown> = {};
      if (patch.bodyHtml !== undefined) row.body_html = patch.bodyHtml;
      if (patch.status !== undefined) row.status = patch.status;
      await db.from("sections").update(row).eq("id", id);
    },
    async listMissingFacts(applicationId) {
      return many(await db.from("missing_facts").select("*").eq("application_id", applicationId), "missing facts").map(map.missingFact) as MissingFact[];
    },
    async getMissingFact(id) {
      const { data } = await db.from("missing_facts").select("*").eq("id", id).maybeSingle();
      return data ? map.missingFact(data) : null;
    },
    async updateMissingFact(id, patch) {
      await db.from("missing_facts").update(patch).eq("id", id);
    },
    async addMissingFacts(applicationId, items) {
      if (items.length) await db.from("missing_facts").insert(items.map((m) => ({ id: m.id, application_id: applicationId, section_id: m.sectionId, question: m.question, why_it_matters: m.whyItMatters, suggested_label: m.suggestedLabel, status: m.status, answer: m.answer, gap_key: m.gapKey })));
    },
    async replaceChecks(applicationId, checks) {
      await db.from("compliance_checks").delete().eq("application_id", applicationId);
      await db.from("compliance_checks").insert(checks.map((c) => ({ application_id: applicationId, section_id: c.sectionId, rule: c.rule, status: c.status, detail: c.detail })));
    },
    async createRun(run) {
      return map.run(must(await db.from("agent_runs").insert(map.runRow(run)).select("*").single(), "run")) as AgentRun;
    },
    async updateRun(id, patch) {
      await db.from("agent_runs").update(map.runRow(patch)).eq("id", id);
    },
    async listBoilerplates() {
      return many(await db.from("boilerplates").select("*").eq("org_id", orgId), "boilerplates").map(map.boilerplate);
    },
    async listApplications() {
      const apps = many(await db.from("applications").select("*").eq("org_id", orgId), "applications").map(map.application) as Application[];
      const oppIds = [...new Set(apps.map((a) => a.opportunityId))];
      const opps = oppIds.length ? many(await db.from("opportunities").select("*").in("id", oppIds), "opportunities").map(map.opportunity) as Opportunity[] : [];
      const funderIds = [...new Set(opps.map((o) => o.funderId))];
      const funders = funderIds.length ? many(await db.from("funders").select("*").in("id", funderIds), "funders").map(map.funder) as Funder[] : [];
      const outcomes = apps.length ? many(await db.from("outcomes").select("*").in("application_id", apps.map((a) => a.id)), "outcomes") : [];
      return apps.flatMap((application) => {
        const opportunity = opps.find((o) => o.id === application.opportunityId);
        const funder = opportunity ? funders.find((f) => f.id === opportunity.funderId) : undefined;
        if (!opportunity || !funder) return [];
        const out = outcomes.find((o) => o.application_id === application.id);
        return [{ application, opportunity, funder, awardAmount: out?.award_amount == null ? null : Number(out.award_amount) }];
      });
    },
    async listDismissals() {
      const rows = many(await db.from("matches").select("dismiss_reason, opportunities(title)").eq("org_id", orgId).eq("status", "dismissed").not("dismiss_reason", "is", null), "dismissals");
      return rows.map((r) => ({ title: String((Array.isArray(r.opportunities) ? (r.opportunities[0] as Row | undefined)?.title : (r.opportunities as Row | null)?.title) ?? ""), reason: String(r.dismiss_reason) }));
    },
    async saveVersion(sectionId, bodyHtml, note, byName) {
      return map.version(must(await db.from("section_versions").insert({ section_id: sectionId, body_html: bodyHtml, note, by_name: byName }).select("*").single(), "version"));
    },
    async saveReviewerCheck(check) {
      return map.review(must(await db.from("reviewer_checks").insert({ application_id: check.applicationId, overall: check.overall, criteria: check.criteria, summary: check.summary }).select("*").single(), "review"));
    },
    async getBudget(applicationId) {
      const { data } = await db.from("budgets").select("*").eq("application_id", applicationId).maybeSingle();
      return data ? map.budget(data) : null;
    },
    async saveBudget(applicationId, lines, justification) {
      return map.budget(must(await db.from("budgets").upsert({ org_id: orgId, application_id: applicationId, lines, justification, updated_at: new Date().toISOString() }, { onConflict: "application_id" }).select("*").single(), "budget"));
    },
    async addSection(applicationId, section) {
      return map.section(must(await db.from("sections").insert({ application_id: applicationId, requirement_id: section.requirementId, title: section.title, body_html: section.bodyHtml, word_limit: section.wordLimit, status: section.status, order: section.order }).select("*").single(), "section"));
    },
    async addEmailDraft(draft) {
      return map.emailDraft(must(await db.from("email_drafts").insert({ org_id: orgId, application_id: draft.applicationId, funder_id: draft.funderId || null, contact_id: draft.contactId, kind: draft.kind, subject: draft.subject, body: draft.body, to: draft.to, to_name: draft.toName, status: draft.status, follow_up_at: draft.followUpAt }).select("*").single(), "email draft"));
    },
    async getOrgContact(id) {
      const { data } = await db.from("org_contacts").select("*").eq("id", id).eq("org_id", orgId).maybeSingle();
      return data ? map.orgContact(data) : null;
    },
    async saveCampaign(campaign) {
      return map.campaign(must(await db.from("social_campaigns").upsert({ org_id: orgId, month: campaign.month, theme: campaign.theme, posts: campaign.posts, status: campaign.status }, { onConflict: "org_id,month" }).select("*").single(), "campaign"));
    },
    async getDocumentText(id) {
      const { data } = await db.from("documents").select("*").eq("id", id).eq("org_id", orgId).maybeSingle();
      return data ? { document: map.document(data), text: String(data.extracted_text ?? "") } : null;
    },
    async replaceDocumentFacts(documentId, facts) {
      await db.from("facts").delete().eq("org_id", orgId).eq("source_document_id", documentId);
      const rows = facts.map((f) => ({ ...factRow(orgId, f), source_document_id: documentId }));
      const created = rows.length ? (many(await db.from("facts").insert(rows).select("*"), "facts").map(map.fact) as Fact[]) : [];
      await db.from("documents").update({ status: "ready", fact_count: created.length }).eq("id", documentId);
      return created;
    },
  };
}
