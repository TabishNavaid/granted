import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  AgentRun,
  Application,
  ApplicationView,
  Boilerplate,
  CalendarEvent,
  ComplianceCheck,
  Contact,
  Document,
  EmailDraft,
  Fact,
  Funder,
  InboxItem,
  Match,
  MatchView,
  Member,
  Milestone,
  MissingFact,
  MonthlyPlan,
  NotificationSettings,
  Opportunity,
  Organization,
  Outcome,
  Requirement,
  Section,
  Subscription,
} from "@/lib/types";
import { wordCount } from "@/lib/format";
import { runtimeMode } from "@/lib/env";
import { adminClient, createUserClient } from "@/lib/supabase/clients";
import { getSession, requireSession, type SessionContext } from "@/lib/supabase/session";
import type { Services } from "./contracts";

/**
 * The Supabase adapter. Every method resolves the signed-in user's
 * organization first and scopes every query to it. Column names are mapped
 * here and nowhere else.
 */
type Row = Record<string, unknown>;

function must<T = Row>(r: { data: unknown; error: { message: string } | null }, what: string): T {
  if (r.error) throw new Error(`${what}: ${r.error.message}`);
  if (r.data == null) throw new Error(`${what}: not found`);
  return r.data as T;
}
function many(r: { data: unknown; error: { message: string } | null }, what: string): Row[] {
  return must<Row[]>(r, what);
}
const num = (v: unknown): number | null => (v == null ? null : Number(v));
const str = (v: unknown, d = ""): string => (v == null ? d : String(v));
const iso = (v: unknown): string => (v == null ? new Date(0).toISOString() : new Date(String(v)).toISOString());
const dateOnly = (v: unknown): string | null => (v == null ? null : String(v).slice(0, 10));

// ---------- Row mappers ----------
export const map = {
  org: (r: Row): Organization => ({
    id: str(r.id),
    name: str(r.name),
    ein: str(r.ein),
    websiteUrl: str(r.website_url),
    mission: str(r.mission),
    annualBudget: num(r.annual_budget),
    fiscalYearEnd: str(r.fiscal_year_end),
    foundedYear: num(r.founded_year),
    city: str(r.city),
    state: str(r.state),
    serviceArea: str(r.service_area),
    causes: (r.causes as string[]) ?? [],
    populations: (r.populations as string[]) ?? [],
    staffCount: num(r.staff_count),
    volunteerCount: num(r.volunteer_count),
    createdAt: iso(r.created_at),
  }),
  orgPatch: (p: Partial<Organization>): Row => {
    const out: Row = {};
    if (p.name !== undefined) out.name = p.name;
    if (p.ein !== undefined) out.ein = p.ein;
    if (p.websiteUrl !== undefined) out.website_url = p.websiteUrl;
    if (p.mission !== undefined) out.mission = p.mission;
    if (p.annualBudget !== undefined) out.annual_budget = p.annualBudget;
    if (p.fiscalYearEnd !== undefined) out.fiscal_year_end = p.fiscalYearEnd;
    if (p.foundedYear !== undefined) out.founded_year = p.foundedYear;
    if (p.city !== undefined) out.city = p.city;
    if (p.state !== undefined) out.state = p.state;
    if (p.serviceArea !== undefined) out.service_area = p.serviceArea;
    if (p.causes !== undefined) out.causes = p.causes;
    if (p.populations !== undefined) out.populations = p.populations;
    if (p.staffCount !== undefined) out.staff_count = p.staffCount;
    if (p.volunteerCount !== undefined) out.volunteer_count = p.volunteerCount;
    return out;
  },
  fact: (r: Row): Fact => ({
    id: str(r.id),
    orgId: str(r.org_id),
    label: str(r.label),
    value: str(r.value),
    category: r.category as Fact["category"],
    sourceDocumentId: (r.source_document_id as string | null) ?? null,
    sourceUrl: (r.source_url as string | null) ?? null,
    sourceLabel: (r.source_label as string | null) ?? null,
    sourceExcerpt: str(r.source_excerpt),
    sourcePage: num(r.source_page),
    confidence: Number(r.confidence ?? 1),
    status: r.status as Fact["status"],
    lastConfirmedAt: iso(r.last_confirmed_at ?? r.created_at),
  }),
  factPatch: (p: Partial<Fact>): Row => {
    const out: Row = {};
    if (p.label !== undefined) out.label = p.label;
    if (p.value !== undefined) out.value = p.value;
    if (p.category !== undefined) out.category = p.category;
    if (p.sourceDocumentId !== undefined) out.source_document_id = p.sourceDocumentId;
    if (p.sourceUrl !== undefined) out.source_url = p.sourceUrl;
    if (p.sourceLabel !== undefined) out.source_label = p.sourceLabel;
    if (p.sourceExcerpt !== undefined) out.source_excerpt = p.sourceExcerpt;
    if (p.sourcePage !== undefined) out.source_page = p.sourcePage;
    if (p.confidence !== undefined) out.confidence = p.confidence;
    if (p.status !== undefined) out.status = p.status;
    if (p.lastConfirmedAt !== undefined) out.last_confirmed_at = p.lastConfirmedAt;
    return out;
  },
  document: (r: Row, factCount = 0): Document => ({
    id: str(r.id),
    orgId: str(r.org_id),
    type: r.type as Document["type"],
    title: str(r.title),
    fileName: str(r.file_name),
    mimeType: str(r.mime_type),
    sizeBytes: Number(r.size_bytes ?? 0),
    status: r.status as Document["status"],
    pageCount: num(r.page_count),
    factCount,
    uploadedAt: iso(r.uploaded_at),
  }),
  boilerplate: (r: Row): Boilerplate => ({
    id: str(r.id),
    orgId: str(r.org_id),
    type: r.type as Boilerplate["type"],
    title: str(r.title),
    body: str(r.body),
    version: Number(r.version ?? 1),
    wordCount: wordCount(str(r.body)),
    updatedAt: iso(r.updated_at),
    sourceDocumentIds: (r.source_document_ids as string[]) ?? [],
  }),
  funder: (r: Row): Funder => ({
    id: str(r.id),
    name: str(r.name),
    ein: (r.ein as string | null) ?? null,
    type: r.type as Funder["type"],
    description: str(r.description),
    focusAreas: (r.focus_areas as string[]) ?? [],
    geography: str(r.geography),
    givingMin: num(r.giving_min),
    givingMax: num(r.giving_max),
    websiteUrl: str(r.website_url),
    sourceUrl: str(r.source_url),
    aiPolicy: (r.ai_policy as string | null) ?? null,
    lastVerifiedAt: iso(r.last_verified_at),
    recentGrantees: (r.recent_grantees as Funder["recentGrantees"]) ?? [],
  }),
  funderRow: (f: Funder): Row => ({
    external_id: f.id,
    name: f.name,
    ein: f.ein,
    type: f.type,
    description: f.description,
    focus_areas: f.focusAreas,
    geography: f.geography,
    giving_min: f.givingMin,
    giving_max: f.givingMax,
    website_url: f.websiteUrl,
    source_url: f.sourceUrl,
    ai_policy: f.aiPolicy,
    recent_grantees: f.recentGrantees,
    last_verified_at: f.lastVerifiedAt,
  }),
  opportunity: (r: Row): Opportunity => ({
    id: str(r.id),
    funderId: str(r.funder_id),
    title: str(r.title),
    summary: str(r.summary),
    deadline: dateOnly(r.deadline),
    deadlineType: r.deadline_type as Opportunity["deadlineType"],
    amountMin: num(r.amount_min),
    amountMax: num(r.amount_max),
    eligibility: (r.eligibility as Opportunity["eligibility"]) ?? [],
    guidelinesUrl: str(r.guidelines_url),
    sourceUrl: str(r.source_url),
    lastVerifiedAt: iso(r.last_verified_at),
    effort: r.effort as Opportunity["effort"],
    forecasted: Boolean(r.forecasted),
  }),
  opportunityRow: (o: Opportunity, funderDbId: string, noticeText: string): Row => ({
    external_id: o.id,
    funder_id: funderDbId,
    title: o.title,
    summary: o.summary,
    deadline: o.deadline,
    deadline_type: o.deadlineType,
    amount_min: o.amountMin,
    amount_max: o.amountMax,
    eligibility: o.eligibility,
    guidelines_url: o.guidelinesUrl,
    source_url: o.sourceUrl,
    effort: o.effort,
    last_verified_at: o.lastVerifiedAt,
    is_active: true,
    forecasted: o.forecasted,
    notice_text: noticeText,
  }),
  contact: (r: Row): Contact => ({ id: str(r.id), funderId: str(r.funder_id), name: str(r.name), role: str(r.role), email: (r.email as string | null) ?? null, publicSourceUrl: str(r.public_source_url) }),
  match: (r: Row): Match => {
    const createdAt = iso(r.created_at);
    return {
      id: str(r.id),
      orgId: str(r.org_id),
      opportunityId: str(r.opportunity_id),
      fitScore: Number(r.fit_score ?? 0),
      reasons: (r.reasons as string[]) ?? [],
      cautions: (r.cautions as string[]) ?? [],
      eligibilityChecks: (r.eligibility_checks as Match["eligibilityChecks"]) ?? [],
      status: r.status as Match["status"],
      isNew: r.status === "new" && Date.now() - new Date(createdAt).getTime() < 7 * 24 * 3600 * 1000,
      createdAt,
    };
  },
  application: (r: Row): Application => ({
    id: str(r.id),
    orgId: str(r.org_id),
    opportunityId: str(r.opportunity_id),
    matchId: (r.match_id as string | null) ?? null,
    stage: r.stage as Application["stage"],
    askAmount: num(r.ask_amount),
    ownerId: (r.owner_id as string | null) ?? null,
    submittedAt: r.submitted_at ? iso(r.submitted_at) : null,
    createdAt: iso(r.created_at),
    updatedAt: iso(r.updated_at),
  }),
  requirement: (r: Row): Requirement => ({ id: str(r.id), applicationId: str(r.application_id), title: str(r.title), kind: r.kind as Requirement["kind"], detail: (r.detail as string | null) ?? null, wordLimit: num(r.word_limit), required: Boolean(r.required), order: Number(r.order ?? 0), satisfied: Boolean(r.satisfied) }),
  section: (r: Row): Section => ({ id: str(r.id), applicationId: str(r.application_id), requirementId: (r.requirement_id as string | null) ?? null, title: str(r.title), bodyHtml: str(r.body_html), wordLimit: num(r.word_limit), status: r.status as Section["status"], order: Number(r.order ?? 0), updatedAt: iso(r.updated_at) }),
  missingFact: (r: Row): MissingFact => ({ id: str(r.id), applicationId: str(r.application_id), sectionId: (r.section_id as string | null) ?? null, question: str(r.question), whyItMatters: str(r.why_it_matters), suggestedLabel: str(r.suggested_label), status: r.status as MissingFact["status"], answer: (r.answer as string | null) ?? null, gapKey: (r.gap_key as string | null) ?? null }),
  check: (r: Row): ComplianceCheck => ({ id: str(r.id), applicationId: str(r.application_id), rule: str(r.rule), status: r.status as ComplianceCheck["status"], detail: str(r.detail), sectionId: (r.section_id as string | null) ?? null }),
  milestone: (r: Row): Milestone => ({ id: str(r.id), orgId: str(r.org_id), applicationId: str(r.application_id), title: str(r.title), dueDate: str(r.due_date).slice(0, 10), kind: r.kind as Milestone["kind"], assigneeId: (r.assignee_id as string | null) ?? null, done: Boolean(r.done) }),
  outcome: (r: Row): Outcome => ({ id: str(r.id), applicationId: str(r.application_id), result: r.result as Outcome["result"], awardAmount: num(r.award_amount), feedback: (r.feedback as string | null) ?? null, decidedAt: iso(r.decided_at) }),
  emailDraft: (r: Row): EmailDraft => ({ id: str(r.id), orgId: str(r.org_id), applicationId: (r.application_id as string | null) ?? null, funderId: str(r.funder_id), contactId: (r.contact_id as string | null) ?? null, kind: r.kind as EmailDraft["kind"], subject: str(r.subject), body: str(r.body) }),
  plan: (r: Row): MonthlyPlan => ({ id: str(r.id), orgId: str(r.org_id), month: str(r.month).slice(0, 7), summary: str(r.summary), items: (r.items as MonthlyPlan["items"]) ?? [], status: (r.status as MonthlyPlan["status"]) ?? "proposed" }),
  inbox: (r: Row): InboxItem => ({
    id: str(r.id),
    orgId: str(r.org_id),
    agent: r.agent as InboxItem["agent"],
    type: r.type as InboxItem["type"],
    title: str(r.title),
    summary: str(r.summary),
    payload: r.payload as InboxItem["payload"],
    status: r.status as InboxItem["status"],
    priority: (r.priority as InboxItem["priority"]) ?? "normal",
    sourceCount: Number(r.source_count ?? 0),
    agentRunId: (r.agent_run_id as string | null) ?? null,
    createdAt: iso(r.created_at),
    resolvedAt: r.resolved_at ? iso(r.resolved_at) : null,
    rejectionReason: (r.rejection_reason as string | null) ?? null,
  }),
  run: (r: Row): AgentRun => ({
    id: str(r.id),
    orgId: str(r.org_id),
    agent: r.agent as AgentRun["agent"],
    trigger: r.trigger as AgentRun["trigger"],
    title: str(r.title),
    status: r.status as AgentRun["status"],
    toolsCalled: (r.tools_called as AgentRun["toolsCalled"]) ?? [],
    sourcesUsed: (r.sources_used as AgentRun["sourcesUsed"]) ?? [],
    outputSummary: str(r.output_summary),
    costUsd: Number(r.cost_usd ?? 0),
    tokensIn: Number(r.tokens_in ?? 0),
    tokensOut: Number(r.tokens_out ?? 0),
    startedAt: iso(r.started_at),
    finishedAt: r.finished_at ? iso(r.finished_at) : null,
    inboxItemId: (r.inbox_item_id as string | null) ?? null,
  }),
  runRow: (run: Partial<AgentRun>, extra: { models?: string[] } = {}): Row => {
    const out: Row = {};
    if (run.orgId !== undefined) out.org_id = run.orgId;
    if (run.agent !== undefined) out.agent = run.agent;
    if (run.trigger !== undefined) out.trigger = run.trigger;
    if (run.title !== undefined) out.title = run.title;
    if (run.status !== undefined) out.status = run.status;
    if (run.toolsCalled !== undefined) out.tools_called = run.toolsCalled;
    if (run.sourcesUsed !== undefined) out.sources_used = run.sourcesUsed;
    if (run.outputSummary !== undefined) out.output_summary = run.outputSummary;
    if (run.costUsd !== undefined) out.cost_usd = run.costUsd;
    if (run.tokensIn !== undefined) out.tokens_in = run.tokensIn;
    if (run.tokensOut !== undefined) out.tokens_out = run.tokensOut;
    if (run.startedAt !== undefined) out.started_at = run.startedAt;
    if (run.finishedAt !== undefined) out.finished_at = run.finishedAt;
    if (run.inboxItemId !== undefined) out.inbox_item_id = run.inboxItemId;
    if (extra.models) out.models = extra.models;
    return out;
  },
  subscription: (r: Row | null, orgId: string): Subscription => ({
    id: str(r?.id, "sub"),
    orgId,
    plan: (r?.plan as Subscription["plan"]) ?? "free",
    status: (r?.status as Subscription["status"]) ?? "active",
    currentPeriodEnd: r?.current_period_end ? iso(r.current_period_end) : new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString(),
    seats: Number(r?.seats ?? 1),
    usage: { proposalsThisMonth: 0, proposalLimit: (r?.plan ?? "free") === "free" ? 1 : (r?.plan ?? "free") === "starter" ? 3 : null, matchesThisMonth: 0, matchLimit: (r?.plan ?? "free") === "free" ? 5 : null },
  }),
  notifications: (r: Row | null): NotificationSettings => ({ weeklyDigest: r?.weekly_digest == null ? true : Boolean(r.weekly_digest), milestoneReminders: r?.milestone_reminders == null ? true : Boolean(r.milestone_reminders), inboxAlerts: r?.inbox_alerts == null ? true : Boolean(r.inbox_alerts), reminderDaysBefore: Number(r?.reminder_days_before ?? 3) }),
};

// ---------- Shared loaders ----------
async function loadOpportunity(db: SupabaseClient, id: string): Promise<{ opportunity: Opportunity; funder: Funder } | null> {
  const { data: o } = await db.from("opportunities").select("*").eq("id", id).maybeSingle();
  if (!o) return null;
  const f = must(await db.from("funders").select("*").eq("id", o.funder_id).single(), "funder");
  return { opportunity: map.opportunity(o), funder: map.funder(f) };
}

async function loadOpportunities(db: SupabaseClient, ids: string[]): Promise<Map<string, { opportunity: Opportunity; funder: Funder }>> {
  const out = new Map<string, { opportunity: Opportunity; funder: Funder }>();
  if (!ids.length) return out;
  const opps = many(await db.from("opportunities").select("*").in("id", ids), "opportunities");
  const funderIds = [...new Set(opps.map((o) => o.funder_id as string))];
  const funders = funderIds.length ? many(await db.from("funders").select("*").in("id", funderIds), "funders") : [];
  const fmap = new Map(funders.map((f) => [f.id as string, map.funder(f)]));
  for (const o of opps) {
    const funder = fmap.get(o.funder_id as string);
    if (funder) out.set(o.id as string, { opportunity: map.opportunity(o), funder });
  }
  return out;
}

async function toApplicationViews(db: SupabaseClient, apps: Application[]): Promise<ApplicationView[]> {
  if (!apps.length) return [];
  const ids = apps.map((a) => a.id);
  const opps = await loadOpportunities(db, [...new Set(apps.map((a) => a.opportunityId))]);
  const [milestones, sections, outcomes] = await Promise.all([
    db.from("milestones").select("*").in("application_id", ids).eq("done", false).order("due_date"),
    db.from("sections").select("id, application_id, status").in("application_id", ids),
    db.from("outcomes").select("*").in("application_id", ids),
  ]);
  return apps.flatMap((a) => {
    const o = opps.get(a.opportunityId);
    if (!o) return [];
    const ms = (milestones.data ?? []).filter((m) => m.application_id === a.id);
    const secs = (sections.data ?? []).filter((s) => s.application_id === a.id);
    const done = secs.filter((s) => s.status === "approved" || s.status === "edited" || s.status === "drafted").length;
    const out = (outcomes.data ?? []).find((x) => x.application_id === a.id);
    return [{ ...a, opportunity: o.opportunity, funder: o.funder, nextMilestone: ms[0] ? map.milestone(ms[0]) : null, sectionProgress: { done, total: secs.length }, outcome: out ? map.outcome(out) : null }];
  });
}

async function toMatchViews(db: SupabaseClient, matches: Match[]): Promise<MatchView[]> {
  const opps = await loadOpportunities(db, [...new Set(matches.map((m) => m.opportunityId))]);
  return matches.flatMap((m) => {
    const o = opps.get(m.opportunityId);
    return o ? [{ ...m, opportunity: o.opportunity, funder: o.funder }] : [];
  });
}

async function recomputeSectionChecks(db: SupabaseClient, section: Section) {
  const words = wordCount(section.bodyHtml.replace(/<[^>]+>/g, " "));
  const checks = many(await db.from("compliance_checks").select("*").eq("section_id", section.id), "checks");
  for (const c of checks) {
    const rule = String(c.rule).toLowerCase();
    if (rule.includes("within") && section.wordLimit) {
      await db.from("compliance_checks").update({ status: words > section.wordLimit ? "fail" : "pass", detail: words > section.wordLimit ? `Currently ${words} words, ${words - section.wordLimit} over.` : `Currently ${words} words.` }).eq("id", c.id);
    }
  }
  if (section.requirementId) await db.from("requirements").update({ satisfied: words > 0 }).eq("id", section.requirementId);
}

// ---------- The adapter ----------
export function makeSupabaseServices(): Services {
  const db = adminClient();
  const ctx = (): Promise<SessionContext> => requireSession();

  const org = {
    async get() {
      const s = await ctx();
      return map.org(must(await db.from("organizations").select("*").eq("id", s.orgId).single(), "organization"));
    },
    async update(patch: Partial<Organization>) {
      const s = await ctx();
      return map.org(must(await db.from("organizations").update(map.orgPatch(patch)).eq("id", s.orgId).select("*").single(), "organization"));
    },
    async listMembers() {
      const s = await ctx();
      const rows = many(await db.from("org_members").select("id, org_id, user_id, invited_email, role, status, profiles(full_name, email)").eq("org_id", s.orgId), "members");
      return rows.map((r): Member => {
        const p = (Array.isArray(r.profiles) ? r.profiles[0] : r.profiles) as { full_name?: string; email?: string } | null;
        return { id: String(r.user_id ?? r.id), orgId: String(r.org_id), fullName: p?.full_name ?? "", email: p?.email ?? String(r.invited_email ?? ""), role: r.role as Member["role"], status: r.status as Member["status"] };
      });
    },
    async inviteMember(email: string, role: Member["role"]) {
      const s = await ctx();
      const r = must(await db.from("org_members").insert({ org_id: s.orgId, invited_email: email, role, status: "invited" }).select("*").single(), "invite");
      return { id: String(r.id), orgId: s.orgId, fullName: "", email, role, status: "invited" as const };
    },
    async currentUser() {
      const s = await ctx();
      const { data: m } = await db.from("org_members").select("role").eq("org_id", s.orgId).eq("user_id", s.userId).maybeSingle();
      return { id: s.userId, orgId: s.orgId, fullName: s.fullName, email: s.email, role: (m?.role as Member["role"]) ?? "owner", status: "active" as const };
    },
  };

  const knowledge = {
    async listFacts() {
      const s = await ctx();
      return many(await db.from("facts").select("*").eq("org_id", s.orgId).order("created_at"), "facts").map(map.fact);
    },
    async updateFact(id: string, patch: Partial<Fact>) {
      const s = await ctx();
      return map.fact(must(await db.from("facts").update(map.factPatch(patch)).eq("id", id).eq("org_id", s.orgId).select("*").single(), "fact"));
    },
    async confirmFact(id: string) {
      return knowledge.updateFact(id, { status: "confirmed", lastConfirmedAt: new Date().toISOString() });
    },
    async listBoilerplates() {
      const s = await ctx();
      return many(await db.from("boilerplates").select("*").eq("org_id", s.orgId).order("updated_at", { ascending: false }), "boilerplates").map(map.boilerplate);
    },
    async updateBoilerplate(id: string, body: string) {
      const s = await ctx();
      const cur = must(await db.from("boilerplates").select("*").eq("id", id).eq("org_id", s.orgId).single(), "boilerplate");
      return map.boilerplate(must(await db.from("boilerplates").update({ body, version: Number(cur.version ?? 1) + 1 }).eq("id", id).select("*").single(), "boilerplate"));
    },
    async listDocuments() {
      const s = await ctx();
      const docs = many(await db.from("documents").select("*").eq("org_id", s.orgId).order("uploaded_at", { ascending: false }), "documents");
      const facts = many(await db.from("facts").select("source_document_id").eq("org_id", s.orgId).not("source_document_id", "is", null), "facts");
      return docs.map((d) => map.document(d, facts.filter((f) => f.source_document_id === d.id).length));
    },
    async addDocument(file: { name: string; size: number; type: string }) {
      // Upload and extraction are not part of the real loop yet: the row is recorded so the user sees it, marked as not read.
      const s = await ctx();
      const r = must(
        await db.from("documents").insert({ org_id: s.orgId, type: "other", title: file.name.replace(/\.[^.]+$/, ""), file_name: file.name, storage_path: `${s.orgId}/${Date.now()}-${file.name}`, mime_type: file.type || "application/octet-stream", size_bytes: file.size, status: "failed" }).select("*").single(),
        "document",
      );
      return map.document(r);
    },
    async removeDocument(id: string) {
      const s = await ctx();
      await db.from("documents").delete().eq("id", id).eq("org_id", s.orgId);
    },
  };

  const opportunities = {
    async listMatches() {
      const s = await ctx();
      const rows = many(await db.from("matches").select("*").eq("org_id", s.orgId).neq("status", "dismissed").order("fit_score", { ascending: false }), "matches");
      return toMatchViews(db, rows.map(map.match));
    },
    async getMatch(id: string) {
      const s = await ctx();
      const { data } = await db.from("matches").select("*").eq("id", id).eq("org_id", s.orgId).maybeSingle();
      if (!data) return null;
      return (await toMatchViews(db, [map.match(data)]))[0] ?? null;
    },
    async getMatchByOpportunity(opportunityId: string) {
      const s = await ctx();
      const { data } = await db.from("matches").select("*").eq("opportunity_id", opportunityId).eq("org_id", s.orgId).maybeSingle();
      if (!data) return null;
      return (await toMatchViews(db, [map.match(data)]))[0] ?? null;
    },
    async getOpportunity(id: string) {
      await ctx();
      const o = await loadOpportunity(db, id);
      if (!o) return null;
      const contacts = many(await db.from("contacts").select("*").eq("funder_id", o.funder.id), "contacts").map(map.contact);
      return { ...o, contacts };
    },
    async setMatchStatus(id: string, status: MatchView["status"]) {
      const s = await ctx();
      const r = must(await db.from("matches").update({ status }).eq("id", id).eq("org_id", s.orgId).select("*").single(), "match");
      return (await toMatchViews(db, [map.match(r)]))[0];
    },
    async startApplication(opportunityId: string) {
      const s = await ctx();
      const { data: existing } = await db.from("applications").select("*").eq("org_id", s.orgId).eq("opportunity_id", opportunityId).maybeSingle();
      if (existing) return map.application(existing);
      const { data: match } = await db.from("matches").select("id").eq("org_id", s.orgId).eq("opportunity_id", opportunityId).maybeSingle();
      if (match) await db.from("matches").update({ status: "applying" }).eq("id", match.id);
      const r = must(await db.from("applications").insert({ org_id: s.orgId, opportunity_id: opportunityId, match_id: match?.id ?? null, stage: "researching", owner_id: s.userId }).select("*").single(), "application");
      return map.application(r);
    },
  };

  const applications = {
    async list() {
      const s = await ctx();
      const rows = many(await db.from("applications").select("*").eq("org_id", s.orgId).order("updated_at", { ascending: false }), "applications");
      return toApplicationViews(db, rows.map(map.application));
    },
    async get(id: string) {
      const s = await ctx();
      const { data } = await db.from("applications").select("*").eq("id", id).eq("org_id", s.orgId).maybeSingle();
      if (!data) return null;
      return (await toApplicationViews(db, [map.application(data)]))[0] ?? null;
    },
    async getWorkspace(id: string) {
      const app = await applications.get(id);
      if (!app) return null;
      const s = await ctx();
      const [reqs, secs, mfs, checks, facts, docs] = await Promise.all([
        db.from("requirements").select("*").eq("application_id", id).order("order"),
        db.from("sections").select("*").eq("application_id", id).order("order"),
        db.from("missing_facts").select("*").eq("application_id", id).order("created_at"),
        db.from("compliance_checks").select("*").eq("application_id", id),
        db.from("facts").select("*").eq("org_id", s.orgId),
        knowledge.listDocuments(),
      ]);
      return {
        application: app,
        requirements: (reqs.data ?? []).map(map.requirement),
        sections: (secs.data ?? []).map(map.section),
        missingFacts: (mfs.data ?? []).map(map.missingFact),
        complianceChecks: (checks.data ?? []).map(map.check),
        facts: (facts.data ?? []).map(map.fact),
        documents: docs,
      };
    },
    async updateSection(id: string, bodyHtml: string) {
      await ctx();
      const cur = map.section(must(await db.from("sections").select("*").eq("id", id).single(), "section"));
      const hasText = Boolean(bodyHtml.replace(/<[^>]+>/g, "").trim());
      const status = cur.status === "empty" && hasText ? "edited" : cur.status === "drafted" ? "edited" : cur.status;
      const r = map.section(must(await db.from("sections").update({ body_html: bodyHtml, status }).eq("id", id).select("*").single(), "section"));
      await recomputeSectionChecks(db, r);
      return r;
    },
    async setSectionStatus(id: string, status: Section["status"]) {
      await ctx();
      return map.section(must(await db.from("sections").update({ status }).eq("id", id).select("*").single(), "section"));
    },
    async answerMissingFact(id: string, answer: string) {
      const s = await ctx();
      const { answerAndRedraft } = await import("@/lib/loop");
      const { makeSupabaseStore } = await import("@/lib/loop/supabase-store");
      const r = await answerAndRedraft(makeSupabaseStore(s), id, answer);
      if (!r.ok) throw new Error(r.error);
      return map.missingFact(must(await db.from("missing_facts").select("*").eq("id", id).single(), "missing fact"));
    },
    async skipMissingFact(id: string) {
      await ctx();
      return map.missingFact(must(await db.from("missing_facts").update({ status: "skipped" }).eq("id", id).select("*").single(), "missing fact"));
    },
    async moveStage(id: string, stage: Application["stage"]) {
      const s = await ctx();
      const patch: Row = { stage };
      if (stage === "submitted") patch.submitted_at = new Date().toISOString();
      const r = must(await db.from("applications").update(patch).eq("id", id).eq("org_id", s.orgId).select("*").single(), "application");
      return (await toApplicationViews(db, [map.application(r)]))[0];
    },
    async logOutcome(id: string, result: Outcome["result"], awardAmount: number | null, feedback: string | null) {
      const s = await ctx();
      await db.from("outcomes").upsert({ application_id: id, result, award_amount: awardAmount, feedback, decided_at: new Date().toISOString() }, { onConflict: "application_id" });
      const r = must(await db.from("applications").update({ stage: result === "won" ? "won" : "lost" }).eq("id", id).eq("org_id", s.orgId).select("*").single(), "application");
      return (await toApplicationViews(db, [map.application(r)]))[0];
    },
  };

  const inbox = {
    async list() {
      const s = await ctx();
      return many(await db.from("inbox_items").select("*").eq("org_id", s.orgId).order("created_at", { ascending: false }), "inbox").map(map.inbox);
    },
    async pendingCount() {
      const s = await ctx();
      const { count } = await db.from("inbox_items").select("id", { count: "exact", head: true }).eq("org_id", s.orgId).eq("status", "pending");
      return count ?? 0;
    },
    async approve(id: string) {
      const s = await ctx();
      return map.inbox(must(await db.from("inbox_items").update({ status: "approved", resolved_at: new Date().toISOString() }).eq("id", id).eq("org_id", s.orgId).select("*").single(), "inbox item"));
    },
    async reject(id: string, reason: string | null) {
      const s = await ctx();
      return map.inbox(must(await db.from("inbox_items").update({ status: "rejected", resolved_at: new Date().toISOString(), rejection_reason: reason }).eq("id", id).eq("org_id", s.orgId).select("*").single(), "inbox item"));
    },
    async markEdited(id: string) {
      const s = await ctx();
      return map.inbox(must(await db.from("inbox_items").update({ status: "edited", resolved_at: new Date().toISOString() }).eq("id", id).eq("org_id", s.orgId).select("*").single(), "inbox item"));
    },
    async restore(id: string) {
      const s = await ctx();
      return map.inbox(must(await db.from("inbox_items").update({ status: "pending", resolved_at: null, rejection_reason: null }).eq("id", id).eq("org_id", s.orgId).select("*").single(), "inbox item"));
    },
    async getPlan(id: string) {
      const s = await ctx();
      const { data } = await db.from("monthly_plans").select("*").eq("id", id).eq("org_id", s.orgId).maybeSingle();
      return data ? map.plan(data) : null;
    },
    async setPlanDecision(planId: string, opportunityId: string, decision: MonthlyPlan["items"][number]["decision"]) {
      const s = await ctx();
      const p = map.plan(must(await db.from("monthly_plans").select("*").eq("id", planId).eq("org_id", s.orgId).single(), "plan"));
      const items = p.items.map((i) => (i.opportunityId === opportunityId ? { ...i, decision } : i));
      return map.plan(must(await db.from("monthly_plans").update({ items }).eq("id", planId).select("*").single(), "plan"));
    },
    async getEmailDraft(id: string) {
      const s = await ctx();
      const { data } = await db.from("email_drafts").select("*").eq("id", id).eq("org_id", s.orgId).maybeSingle();
      return data ? map.emailDraft(data) : null;
    },
    async updateEmailDraft(id: string, patch: Partial<Pick<EmailDraft, "subject" | "body">>) {
      const s = await ctx();
      return map.emailDraft(must(await db.from("email_drafts").update(patch).eq("id", id).eq("org_id", s.orgId).select("*").single(), "email draft"));
    },
  };

  const calendar = {
    async listEvents() {
      const s = await ctx();
      const ms = many(await db.from("milestones").select("*").eq("org_id", s.orgId).order("due_date"), "milestones").map(map.milestone);
      const apps = many(await db.from("applications").select("id, opportunity_id").eq("org_id", s.orgId), "applications");
      const opps = await loadOpportunities(db, [...new Set(apps.map((a) => a.opportunity_id as string))]);
      return ms.map((m): CalendarEvent => {
        const a = apps.find((x) => x.id === m.applicationId);
        const o = a ? opps.get(a.opportunity_id as string) : null;
        return { id: m.id, date: m.dueDate, title: m.title, kind: m.kind, applicationId: m.applicationId, funderName: o?.funder.name ?? "", done: m.done };
      });
    },
    async listMilestones(applicationId?: string) {
      const s = await ctx();
      let q = db.from("milestones").select("*").eq("org_id", s.orgId).order("due_date");
      if (applicationId) q = q.eq("application_id", applicationId);
      return many(await q, "milestones").map(map.milestone);
    },
    async toggleMilestone(id: string, done: boolean) {
      const s = await ctx();
      return map.milestone(must(await db.from("milestones").update({ done, done_at: done ? new Date().toISOString() : null }).eq("id", id).eq("org_id", s.orgId).select("*").single(), "milestone"));
    },
  };

  const activity = {
    async listRuns() {
      const s = await ctx();
      return many(await db.from("agent_runs").select("*").eq("org_id", s.orgId).order("started_at", { ascending: false }).limit(100), "runs").map(map.run);
    },
    async getRun(id: string) {
      const s = await ctx();
      const { data } = await db.from("agent_runs").select("*").eq("id", id).eq("org_id", s.orgId).maybeSingle();
      return data ? map.run(data) : null;
    },
  };

  const billing = {
    async getSubscription() {
      const s = await ctx();
      const { data } = await db.from("subscriptions").select("*").eq("org_id", s.orgId).maybeSingle();
      return map.subscription(data, s.orgId);
    },
    async listInvoices() {
      await ctx();
      return [];
    },
    async changePlan(plan: Subscription["plan"]) {
      const s = await ctx();
      const { data } = await db.from("subscriptions").upsert({ org_id: s.orgId, plan }, { onConflict: "org_id" }).select("*").single();
      return map.subscription(data, s.orgId);
    },
    async getNotificationSettings() {
      const s = await ctx();
      const { data } = await db.from("notification_settings").select("*").eq("org_id", s.orgId).maybeSingle();
      return map.notifications(data);
    },
    async updateNotificationSettings(patch: Partial<NotificationSettings>) {
      const s = await ctx();
      const row: Row = { org_id: s.orgId };
      if (patch.weeklyDigest !== undefined) row.weekly_digest = patch.weeklyDigest;
      if (patch.milestoneReminders !== undefined) row.milestone_reminders = patch.milestoneReminders;
      if (patch.inboxAlerts !== undefined) row.inbox_alerts = patch.inboxAlerts;
      if (patch.reminderDaysBefore !== undefined) row.reminder_days_before = patch.reminderDaysBefore;
      const { data } = await db.from("notification_settings").upsert(row, { onConflict: "org_id" }).select("*").single();
      return map.notifications(data);
    },
  };

  const auth = {
    async signIn(email: string) {
      const supa = await createUserClient();
      const base = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ?? "http://localhost:3000";
      const { error } = await supa.auth.signInWithOtp({ email: email.trim(), options: { emailRedirectTo: `${base}/auth/callback?next=/inbox`, shouldCreateUser: false } });
      if (error) return { ok: false as const, error: /signups not allowed|not found/i.test(error.message) ? "We do not have a workspace for that email yet. Create one first." : error.message };
      return { ok: true as const, next: "check_email" as const };
    },
    async signUp(input: { fullName: string; email: string; password: string; orgName: string }) {
      const supa = await createUserClient();
      const base = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ?? "http://localhost:3000";
      const { error } = await supa.auth.signInWithOtp({
        email: input.email.trim(),
        options: { emailRedirectTo: `${base}/auth/callback?next=/onboarding`, shouldCreateUser: true, data: { full_name: input.fullName.trim(), org_name: input.orgName.trim() } },
      });
      if (error) return { ok: false as const, error: error.message };
      return { ok: true as const, next: "check_email" as const };
    },
    async signOut() {
      const supa = await createUserClient();
      await supa.auth.signOut();
    },
  };

  const loop = {
    async runtime() {
      return runtimeMode();
    },
    async buildProfile(input: { websiteUrl: string; ein: string | null }) {
      const s = await ctx();
      const { buildProfile } = await import("@/lib/loop");
      const { makeSupabaseStore } = await import("@/lib/loop/supabase-store");
      return buildProfile(makeSupabaseStore(s), input);
    },
    async confirmProfile(input: { keptFactIds: string[]; factEdits: Record<string, string>; org: { mission?: string; serviceArea?: string; name?: string } }) {
      const s = await ctx();
      const { confirmProfile } = await import("@/lib/loop");
      const { makeSupabaseStore } = await import("@/lib/loop/supabase-store");
      return confirmProfile(makeSupabaseStore(s), input);
    },
    async findMatches() {
      const s = await ctx();
      const { findMatches } = await import("@/lib/loop");
      const { makeSupabaseStore } = await import("@/lib/loop/supabase-store");
      return findMatches(makeSupabaseStore(s));
    },
    async draftLetter(applicationId: string) {
      const s = await ctx();
      const { draftLetterFor } = await import("@/lib/loop");
      const { makeSupabaseStore } = await import("@/lib/loop/supabase-store");
      return draftLetterFor(makeSupabaseStore(s), applicationId);
    },
  };

  return { org, knowledge, opportunities, applications, inbox, calendar, activity, billing, auth, loop };
}

export { getSession };
