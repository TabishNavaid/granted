import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  AgentRun,
  Budget,
  ContactNote,
  OrgContact,
  ReviewerCheck,
  SavedSearch,
  SectionVersion,
  SocialCampaign,
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
import type { LoopResult, Services } from "./contracts";
import { checkUse, exportCampaign, icsUrlFor, usageThisMonth, withUsage } from "./shared";
import { planMilestones as planFromDeadline } from "@/lib/loop/milestones";
import { BUDGET_CATEGORY_LABEL, budgetTotal } from "@/lib/loop/budget";

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
    onboardingStep: (r.onboarding_step as Organization["onboardingStep"]) ?? "start",
    calendarToken: str(r.calendar_token),
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
    if (p.onboardingStep !== undefined) out.onboarding_step = p.onboardingStep;
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
    factCount: factCount || Number(r.fact_count ?? 0),
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
      dismissReason: (r.dismiss_reason as string | null) ?? null,
      createdAt,
    };
  },
  application: (r: Row): Application => ({
    id: str(r.id),
    orgId: str(r.org_id),
    opportunityId: str(r.opportunity_id),
    matchId: (r.match_id as string | null) ?? null,
    stage: r.stage as Application["stage"],
    mode: (r.mode as Application["mode"]) ?? "letter",
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
  emailDraft: (r: Row): EmailDraft => ({
    id: str(r.id),
    orgId: str(r.org_id),
    applicationId: (r.application_id as string | null) ?? null,
    funderId: str(r.funder_id),
    contactId: (r.contact_id as string | null) ?? null,
    kind: r.kind as EmailDraft["kind"],
    subject: str(r.subject),
    body: str(r.body),
    to: (r.to as string | null) ?? null,
    toName: (r.to_name as string | null) ?? null,
    status: (r.status as EmailDraft["status"]) ?? "draft",
    sentAt: r.sent_at ? iso(r.sent_at) : null,
    sentVia: (r.sent_via as EmailDraft["sentVia"]) ?? null,
    followUpAt: r.follow_up_at ? iso(r.follow_up_at) : null,
    createdAt: iso(r.created_at),
  }),
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
  version: (r: Row): SectionVersion => ({ id: str(r.id), sectionId: str(r.section_id), bodyHtml: str(r.body_html), note: str(r.note), byName: str(r.by_name), createdAt: iso(r.created_at) }),
  review: (r: Row): ReviewerCheck => ({ id: str(r.id), applicationId: str(r.application_id), overall: Number(r.overall ?? 0), criteria: (r.criteria as ReviewerCheck["criteria"]) ?? [], summary: str(r.summary), createdAt: iso(r.created_at) }),
  budget: (r: Row): Budget => ({ id: str(r.id), orgId: str(r.org_id), applicationId: str(r.application_id), lines: (r.lines as Budget["lines"]) ?? [], justification: str(r.justification), updatedAt: iso(r.updated_at) }),
  orgContact: (r: Row): OrgContact => ({ id: str(r.id), orgId: str(r.org_id), name: str(r.name), organization: str(r.organization), role: str(r.role), email: (r.email as string | null) ?? null, phone: (r.phone as string | null) ?? null, kind: (r.kind as OrgContact["kind"]) ?? "other", relationship: str(r.relationship), funderId: (r.funder_id as string | null) ?? null, source: (r.source as OrgContact["source"]) ?? "manual", lastTouchAt: r.last_touch_at ? iso(r.last_touch_at) : null, createdAt: iso(r.created_at) }),
  contactNote: (r: Row): ContactNote => ({ id: str(r.id), orgId: str(r.org_id), contactId: str(r.contact_id), kind: (r.kind as ContactNote["kind"]) ?? "note", note: str(r.note), nextStep: (r.next_step as string | null) ?? null, happenedAt: iso(r.happened_at) }),
  campaign: (r: Row): SocialCampaign => ({ id: str(r.id), orgId: str(r.org_id), month: str(r.month), theme: str(r.theme), posts: (r.posts as SocialCampaign["posts"]) ?? [], status: (r.status as SocialCampaign["status"]) ?? "draft", createdAt: iso(r.created_at) }),
  savedSearch: (r: Row): SavedSearch => ({ id: str(r.id), orgId: str(r.org_id), name: str(r.name), keyword: str(r.keyword), fundingCategories: (r.funding_categories as string[]) ?? [], createdAt: iso(r.created_at), lastRunAt: r.last_run_at ? iso(r.last_run_at) : null }),
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
  const loopStore = async () => {
    const s = await ctx();
    const { makeSupabaseStore } = await import("@/lib/loop/supabase-store");
    return { s, st: makeSupabaseStore(s) };
  };

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
    async updateMemberRole(id: string, role: Member["role"]) {
      const s = await ctx();
      // id is the user id for active members and the row id for invites.
      await db.from("org_members").update({ role }).eq("org_id", s.orgId).or(`user_id.eq.${id},id.eq.${id}`);
      return (await org.listMembers()).find((m) => m.id === id) ?? { id, orgId: s.orgId, fullName: "", email: "", role, status: "invited" as const };
    },
    async removeMember(id: string) {
      const s = await ctx();
      if (id === s.userId) return;
      await db.from("org_members").delete().eq("org_id", s.orgId).or(`user_id.eq.${id},id.eq.${id}`);
    },
    async deleteWorkspace() {
      const s = await ctx();
      await db.from("organizations").delete().eq("id", s.orgId);
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
    async extractDocument(id: string) {
      const { st } = await loopStore();
      const { extractDocumentFacts } = await import("@/lib/loop/features");
      return extractDocumentFacts(st, id);
    },
    async addBoilerplate(input: { type: Boilerplate["type"]; title: string; body: string }) {
      const s = await ctx();
      return map.boilerplate(must(await db.from("boilerplates").insert({ org_id: s.orgId, type: input.type, title: input.title, body: input.body }).select("*").single(), "boilerplate"));
    },
    async removeBoilerplate(id: string) {
      const s = await ctx();
      await db.from("boilerplates").delete().eq("id", id).eq("org_id", s.orgId);
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
    async dismiss(id: string, reason: string) {
      const s = await ctx();
      const r = must(await db.from("matches").update({ status: "dismissed", dismiss_reason: reason.trim() || null }).eq("id", id).eq("org_id", s.orgId).select("*").single(), "match");
      return (await toMatchViews(db, [map.match(r)]))[0];
    },
    async listSavedSearches() {
      const s = await ctx();
      return many(await db.from("saved_searches").select("*").eq("org_id", s.orgId).order("created_at", { ascending: false }), "saved searches").map(map.savedSearch);
    },
    async saveSearch(input: { name: string; keyword: string; fundingCategories: string[] }) {
      const s = await ctx();
      return map.savedSearch(must(await db.from("saved_searches").insert({ org_id: s.orgId, name: input.name.trim() || input.keyword, keyword: input.keyword.trim(), funding_categories: input.fundingCategories }).select("*").single(), "saved search"));
    },
    async deleteSavedSearch(id: string) {
      const s = await ctx();
      await db.from("saved_searches").delete().eq("id", id).eq("org_id", s.orgId);
    },
    async runSearch(input: { keyword: string; fundingCategories: string[]; savedSearchId?: string }) {
      const { s, st } = await loopStore();
      const { customSearch } = await import("@/lib/loop/features");
      const r = await customSearch(st, { keyword: input.keyword, fundingCategories: input.fundingCategories });
      if (r.ok && input.savedSearchId) await db.from("saved_searches").update({ last_run_at: new Date().toISOString() }).eq("id", input.savedSearchId).eq("org_id", s.orgId);
      return r;
    },
    async scoreCandidates(externalIds: string[]) {
      const { st } = await loopStore();
      const { scoreSelected } = await import("@/lib/loop/features");
      return scoreSelected(st, externalIds);
    },
    async startApplication(opportunityId: string, mode?: Application["mode"]) {
      const s = await ctx();
      const { data: existing } = await db.from("applications").select("*").eq("org_id", s.orgId).eq("opportunity_id", opportunityId).maybeSingle();
      if (existing) return map.application(existing);
      const { data: match } = await db.from("matches").select("id").eq("org_id", s.orgId).eq("opportunity_id", opportunityId).maybeSingle();
      if (match) await db.from("matches").update({ status: "applying" }).eq("id", match.id);
      const r = must(await db.from("applications").insert({ org_id: s.orgId, opportunity_id: opportunityId, match_id: match?.id ?? null, stage: "researching", mode: mode ?? "letter", owner_id: s.userId }).select("*").single(), "application");
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
    async setMode(id: string, mode: Application["mode"]) {
      const s = await ctx();
      const r = must(await db.from("applications").update({ mode }).eq("id", id).eq("org_id", s.orgId).select("*").single(), "application");
      return (await toApplicationViews(db, [map.application(r)]))[0];
    },
    async setAskAmount(id: string, askAmount: number | null) {
      const s = await ctx();
      const r = must(await db.from("applications").update({ ask_amount: askAmount }).eq("id", id).eq("org_id", s.orgId).select("*").single(), "application");
      return (await toApplicationViews(db, [map.application(r)]))[0];
    },
    async listVersions(sectionId: string) {
      await ctx();
      return many(await db.from("section_versions").select("*").eq("section_id", sectionId).order("created_at", { ascending: false }).limit(30), "versions").map(map.version);
    },
    async restoreVersion(versionId: string) {
      const s = await ctx();
      const v = map.version(must(await db.from("section_versions").select("*").eq("id", versionId).single(), "version"));
      const cur = map.section(must(await db.from("sections").select("*").eq("id", v.sectionId).single(), "section"));
      await db.from("section_versions").insert({ section_id: cur.id, body_html: cur.bodyHtml, note: "Before restoring an earlier version", by_name: s.fullName || s.email });
      const r = map.section(must(await db.from("sections").update({ body_html: v.bodyHtml, status: "edited" }).eq("id", cur.id).select("*").single(), "section"));
      await recomputeSectionChecks(db, r);
      return r;
    },
    async revise(input: { sectionId: string; html: string; action: "rewrite" | "shorten" | "expand" | "tone"; tone?: "plain" | "warm" | "formal" | "confident"; wordLimit?: number | null }) {
      const { st } = await loopStore();
      const { reviseSection } = await import("@/lib/loop/features");
      return reviseSection(st, input);
    },
    async runReviewerCheck(id: string) {
      const { st } = await loopStore();
      const { runReviewer } = await import("@/lib/loop/features");
      return runReviewer(st, id);
    },
    async getReviewerCheck(id: string) {
      await ctx();
      const { data } = await db.from("reviewer_checks").select("*").eq("application_id", id).order("created_at", { ascending: false }).limit(1).maybeSingle();
      return data ? map.review(data) : null;
    },
    async getBudget(id: string) {
      const { st } = await loopStore();
      return st.getBudget(id);
    },
    async saveBudget(id: string, lines: Budget["lines"], justification: string) {
      const { st } = await loopStore();
      return st.saveBudget(id, lines, justification);
    },
    async writeBudgetJustification(id: string) {
      const { st } = await loopStore();
      const { budgetJustification } = await import("@/lib/loop/features");
      return budgetJustification(st, id);
    },
    async addBudgetSection(id: string) {
      const { st } = await loopStore();
      const b = await st.getBudget(id);
      if (!b) throw new Error("No budget yet");
      const rows = b.lines.map((l) => `<li>${BUDGET_CATEGORY_LABEL[l.category]}: ${l.item}, $${l.amount.toLocaleString("en-US")}</li>`).join("");
      const html = `<ul>${rows}</ul><p>Total request: $${budgetTotal(b.lines).toLocaleString("en-US")}.</p>${b.justification ? b.justification.split(/\n\n+/).map((p) => `<p>${p.replace(/&/g, "&amp;").replace(/</g, "&lt;")}</p>`).join("") : ""}`;
      const sections = await st.listSections(id);
      const existing = sections.find((x) => x.title === "Budget and justification");
      if (existing) {
        await st.updateSection(existing.id, { bodyHtml: html, status: "edited" });
        return { ...existing, bodyHtml: html, status: "edited" as const };
      }
      return st.addSection(id, { requirementId: null, title: "Budget and justification", bodyHtml: html, wordLimit: null, status: "edited", order: sections.length + 1 });
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
        return { id: m.id, date: m.dueDate, title: m.title, kind: m.kind, applicationId: m.applicationId, funderName: o?.funder.name ?? "", done: m.done, assigneeId: m.assigneeId };
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
    async assignMilestone(id: string, assigneeId: string | null) {
      const s = await ctx();
      return map.milestone(must(await db.from("milestones").update({ assignee_id: assigneeId }).eq("id", id).eq("org_id", s.orgId).select("*").single(), "milestone"));
    },
    async planMilestones(applicationId: string, options?: { boardReview?: boolean; hours?: number }) {
      const { s, st } = await loopStore();
      const ctxApp = await st.getApplication(applicationId);
      if (!ctxApp || !ctxApp.opportunity.deadline) return [];
      await db.from("milestones").delete().eq("application_id", applicationId).eq("done", false);
      const planned = planFromDeadline(ctxApp.opportunity.deadline, { boardReview: options?.boardReview, effort: ctxApp.opportunity.effort, mode: ctxApp.application.mode });
      const rows = planned.map((p) => ({ org_id: s.orgId, application_id: applicationId, title: p.title, due_date: p.dueDate, kind: p.kind, assignee_id: ctxApp.application.ownerId }));
      return many(await db.from("milestones").insert(rows).select("*"), "milestones").map(map.milestone);
    },
    async icsUrl() {
      const o = await org.get();
      return icsUrlFor(o.calendarToken);
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
      const [apps, matches] = await Promise.all([db.from("applications").select("*").eq("org_id", s.orgId), db.from("matches").select("*").eq("org_id", s.orgId)]);
      return withUsage(map.subscription(data, s.orgId), usageThisMonth((apps.data ?? []).map(map.application), (matches.data ?? []).map(map.match)));
    },
    async checkoutUrl(plan: "starter" | "growth") {
      const s = await ctx();
      const { createCheckoutSession, stripeConnected } = await import("@/lib/integrations/stripe");
      if (!stripeConnected()) return { ok: false as const, code: "no_ai" as const, error: "Stripe is not connected on this server yet. The Integrations page says how to add it." };
      const { data } = await db.from("subscriptions").select("stripe_customer_id").eq("org_id", s.orgId).maybeSingle();
      const base = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
      const r = await createCheckoutSession({ orgId: s.orgId, email: s.email, plan, customerId: (data?.stripe_customer_id as string | null) ?? null, successUrl: `${base}/settings?tab=billing&checkout=success`, cancelUrl: `${base}/settings?tab=billing&checkout=canceled` });
      return r.ok ? { ok: true as const, data: { url: r.url } } : { ok: false as const, code: "failed" as const, error: r.message };
    },
    async portalUrl() {
      const s = await ctx();
      const { createPortalSession, stripeConnected } = await import("@/lib/integrations/stripe");
      if (!stripeConnected()) return { ok: false as const, code: "no_ai" as const, error: "Stripe is not connected on this server yet." };
      const { data } = await db.from("subscriptions").select("stripe_customer_id").eq("org_id", s.orgId).maybeSingle();
      if (!data?.stripe_customer_id) return { ok: false as const, code: "failed" as const, error: "No billing account yet. Start a paid plan first." };
      const base = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
      const r = await createPortalSession({ customerId: String(data.stripe_customer_id), returnUrl: `${base}/settings?tab=billing` });
      return r.ok ? { ok: true as const, data: { url: r.url } } : { ok: false as const, code: "failed" as const, error: r.message };
    },
    async canUse(what: "proposal" | "match") {
      return checkUse(await billing.getSubscription(), what);
    },
    async listInvoices() {
      await ctx();
      return [];
    },
    async changePlan(plan: Subscription["plan"]) {
      const s = await ctx();
      const { stripeConnected } = await import("@/lib/integrations/stripe");
      // With Stripe connected, paid plans go through Checkout; only a downgrade to Free is switched here.
      if (stripeConnected() && plan !== "free") return billing.getSubscription();
      const { data } = await db.from("subscriptions").upsert({ org_id: s.orgId, plan, status: "active" }, { onConflict: "org_id" }).select("*").single();
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
    async signInWithGoogle(next: string) {
      const { isConnected } = await import("@/lib/integrations");
      if (!isConnected("google_auth")) return { ok: false as const, error: "Google sign-in is not set up on this server yet. Use the email link instead." };
      const supa = await createUserClient();
      const base = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ?? "http://localhost:3000";
      const safe = next.startsWith("/") && !next.startsWith("//") ? next : "/inbox";
      const { data, error } = await supa.auth.signInWithOAuth({ provider: "google", options: { redirectTo: `${base}/auth/callback?next=${encodeURIComponent(safe)}`, skipBrowserRedirect: true } });
      if (error || !data.url) return { ok: false as const, error: error?.message ?? "Google did not answer. Try the email link." };
      return { ok: true as const, url: data.url };
    },
  };

  const loop = {
    async runtime() {
      return runtimeMode();
    },
    async buildProfile(input: { websiteUrl: string; ein: string | null; jobId?: string }) {
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
    async findMatches(jobId?: string) {
      const s = await ctx();
      const { findMatches } = await import("@/lib/loop");
      const { makeSupabaseStore } = await import("@/lib/loop/supabase-store");
      return findMatches(makeSupabaseStore(s), jobId);
    },
    async answerGaps(answers: { budgetRange?: string; peopleServed?: string; location?: string }) {
      const s = await ctx();
      const { answerGaps } = await import("@/lib/loop");
      const { makeSupabaseStore } = await import("@/lib/loop/supabase-store");
      return answerGaps(makeSupabaseStore(s), answers);
    },
    async progress(jobId: string) {
      const { readJob } = await import("@/lib/loop/progress");
      return readJob(jobId);
    },
    async draftLetter(applicationId: string) {
      const s = await ctx();
      const { draftLetterFor } = await import("@/lib/loop");
      const { makeSupabaseStore } = await import("@/lib/loop/supabase-store");
      return draftLetterFor(makeSupabaseStore(s), applicationId);
    },
    async draftProposal(applicationId: string, jobId?: string) {
      const { st } = await loopStore();
      const { draftProposalFor } = await import("@/lib/loop/features");
      return draftProposalFor(st, applicationId, jobId);
    },
  };

  const outreach = {
    async list() {
      const s = await ctx();
      return many(await db.from("email_drafts").select("*").eq("org_id", s.orgId).order("created_at", { ascending: false }), "email drafts").map(map.emailDraft);
    },
    async get(id: string) {
      const s = await ctx();
      const { data } = await db.from("email_drafts").select("*").eq("id", id).eq("org_id", s.orgId).maybeSingle();
      return data ? map.emailDraft(data) : null;
    },
    async draft(input: { kind: EmailDraft["kind"]; applicationId: string | null; funderId: string | null; contactId: string | null; to: string | null; toName: string | null; notes: string }) {
      const { st } = await loopStore();
      const { draftOutreach } = await import("@/lib/loop/features");
      return draftOutreach(st, input);
    },
    async update(id: string, patch: Partial<Pick<EmailDraft, "subject" | "body" | "to" | "toName" | "status" | "followUpAt">>) {
      const s = await ctx();
      const row: Row = {};
      if (patch.subject !== undefined) row.subject = patch.subject;
      if (patch.body !== undefined) row.body = patch.body;
      if (patch.to !== undefined) row.to = patch.to;
      if (patch.toName !== undefined) row.to_name = patch.toName;
      if (patch.status !== undefined) row.status = patch.status;
      if (patch.followUpAt !== undefined) row.follow_up_at = patch.followUpAt;
      return map.emailDraft(must(await db.from("email_drafts").update(row).eq("id", id).eq("org_id", s.orgId).select("*").single(), "email draft"));
    },
    async markSent(id: string, via: "manual", followUpDays: number | null) {
      return markSentVia(id, via, followUpDays);
    },
    async send(id: string, via: "gmail" | "outlook", followUpDays: number | null): Promise<LoopResult<EmailDraft>> {
      const s = await ctx();
      const e = await outreach.get(id);
      if (!e) return { ok: false, code: "not_found", error: "We could not find that email." };
      if (!e.to) return { ok: false, code: "failed", error: "Add a recipient address first." };
      const { sendGmail } = await import("@/lib/integrations/gmail");
      const { sendOutlook } = await import("@/lib/integrations/outlook");
      const r = via === "gmail" ? await sendGmail(s.orgId, { to: e.to, subject: e.subject, text: e.body }) : await sendOutlook(s.orgId, { to: e.to, subject: e.subject, text: e.body });
      if (!r.ok) return { ok: false, code: r.reason === "not_connected" ? "no_ai" : "failed", error: r.message };
      return { ok: true, data: await markSentVia(id, via, followUpDays) };
    },
    async remove(id: string) {
      const s = await ctx();
      await db.from("email_drafts").delete().eq("id", id).eq("org_id", s.orgId);
    },
  };
  async function markSentVia(id: string, via: "manual" | "gmail" | "outlook", followUpDays: number | null) {
    const s = await ctx();
    const e = await outreach.get(id);
    if (!e) throw new Error("email draft not found");
    let followUpAt: string | null = null;
    if (followUpDays && e.applicationId) {
      followUpAt = new Date(Date.now() + followUpDays * 864e5).toISOString().slice(0, 10);
      await db.from("milestones").insert({ org_id: s.orgId, application_id: e.applicationId, title: `Follow up on "${e.subject}"`, due_date: followUpAt, kind: "follow_up", assignee_id: s.userId });
    }
    return map.emailDraft(must(await db.from("email_drafts").update({ status: "sent", sent_at: new Date().toISOString(), sent_via: via, follow_up_at: followUpAt }).eq("id", id).eq("org_id", s.orgId).select("*").single(), "email draft"));
  }

  const contacts = {
    async list() {
      const s = await ctx();
      return many(await db.from("org_contacts").select("*").eq("org_id", s.orgId).order("name"), "contacts").map(map.orgContact);
    },
    async add(input: Omit<OrgContact, "id" | "orgId" | "createdAt" | "lastTouchAt" | "source">) {
      const s = await ctx();
      return map.orgContact(must(await db.from("org_contacts").insert({ org_id: s.orgId, name: input.name, organization: input.organization, role: input.role, email: input.email, phone: input.phone, kind: input.kind, relationship: input.relationship, funder_id: input.funderId, source: "manual" }).select("*").single(), "contact"));
    },
    async update(id: string, patch: Partial<Omit<OrgContact, "id" | "orgId" | "createdAt">>) {
      const s = await ctx();
      const row: Row = {};
      const m: Record<string, string> = { name: "name", organization: "organization", role: "role", email: "email", phone: "phone", kind: "kind", relationship: "relationship", funderId: "funder_id", lastTouchAt: "last_touch_at" };
      for (const [k, col] of Object.entries(m)) if ((patch as Record<string, unknown>)[k] !== undefined) row[col] = (patch as Record<string, unknown>)[k];
      return map.orgContact(must(await db.from("org_contacts").update(row).eq("id", id).eq("org_id", s.orgId).select("*").single(), "contact"));
    },
    async remove(id: string) {
      const s = await ctx();
      await db.from("org_contacts").delete().eq("id", id).eq("org_id", s.orgId);
    },
    async importRows(rows: { name: string; organization?: string; role?: string; email?: string; phone?: string; kind?: OrgContact["kind"]; relationship?: string }[]) {
      const s = await ctx();
      const existing = await contacts.list();
      const fresh = rows.filter((r) => r.name?.trim() && !existing.some((c) => c.name.toLowerCase() === r.name.trim().toLowerCase() && (c.email ?? "") === (r.email ?? "")));
      if (fresh.length) await db.from("org_contacts").insert(fresh.map((r) => ({ org_id: s.orgId, name: r.name.trim(), organization: r.organization ?? "", role: r.role ?? "", email: r.email || null, phone: r.phone || null, kind: r.kind ?? "other", relationship: r.relationship ?? "", source: "csv" })));
      return { added: fresh.length, skipped: rows.length - fresh.length };
    },
    async listNotes(contactId: string) {
      const s = await ctx();
      return many(await db.from("contact_notes").select("*").eq("org_id", s.orgId).eq("contact_id", contactId).order("happened_at", { ascending: false }), "notes").map(map.contactNote);
    },
    async addNote(contactId: string, input: Pick<ContactNote, "kind" | "note" | "nextStep">) {
      const s = await ctx();
      const n = map.contactNote(must(await db.from("contact_notes").insert({ org_id: s.orgId, contact_id: contactId, kind: input.kind, note: input.note, next_step: input.nextStep }).select("*").single(), "note"));
      await db.from("org_contacts").update({ last_touch_at: n.happenedAt }).eq("id", contactId);
      return n;
    },
    async draftIntroRequest(contactId: string, applicationId: string | null) {
      const { st } = await loopStore();
      const { draftIntro } = await import("@/lib/loop/features");
      return draftIntro(st, contactId, applicationId);
    },
  };

  const social = {
    async listCampaigns() {
      const s = await ctx();
      return many(await db.from("social_campaigns").select("*").eq("org_id", s.orgId).order("month", { ascending: false }), "campaigns").map(map.campaign);
    },
    async getCampaign(id: string) {
      const s = await ctx();
      const { data } = await db.from("social_campaigns").select("*").eq("id", id).eq("org_id", s.orgId).maybeSingle();
      return data ? map.campaign(data) : null;
    },
    async generate(month: string) {
      const { st } = await loopStore();
      const { generateMonth } = await import("@/lib/loop/features");
      return generateMonth(st, month);
    },
    async updatePost(campaignId: string, postId: string, patch: Partial<Pick<SocialCampaign["posts"][number], "text" | "date" | "status" | "platform">>) {
      const c = await social.getCampaign(campaignId);
      if (!c) throw new Error("campaign not found");
      const posts = c.posts.map((p) => (p.id === postId ? { ...p, ...patch } : p));
      return map.campaign(must(await db.from("social_campaigns").update({ posts }).eq("id", campaignId).select("*").single(), "campaign"));
    },
    async approve(campaignId: string) {
      const c = await social.getCampaign(campaignId);
      if (!c) throw new Error("campaign not found");
      const posts = c.posts.map((p) => (p.status === "draft" ? { ...p, status: "approved" as const } : p));
      return map.campaign(must(await db.from("social_campaigns").update({ posts, status: "approved" }).eq("id", campaignId).select("*").single(), "campaign"));
    },
    async exportCampaign(id: string, format: "text" | "csv") {
      const c = await social.getCampaign(id);
      if (!c) throw new Error("campaign not found");
      return exportCampaign(c, format);
    },
  };

  const integrations = {
    async status() {
      await ctx();
      const { integrationStatus } = await import("@/lib/integrations");
      return integrationStatus();
    },
    async connections() {
      const s = await ctx();
      const { connectionStore, publicView } = await import("@/lib/integrations/store");
      return (await connectionStore().list(s.orgId)).map(publicView);
    },
    async connectUrl(provider: "google" | "microsoft", purpose: "gmail" | "calendar" | "outlook") {
      await ctx();
      const { providerConnected } = await import("@/lib/integrations/oauth");
      if (!providerConnected(provider)) return { ok: false as const, code: "no_ai" as const, error: `${provider === "google" ? "Google" : "Microsoft"} keys are not set on this server yet. The Integrations page says how to add them.` };
      return { ok: true as const, data: { url: `/api/integrations/${provider}/connect?purpose=${purpose}` } };
    },
    async disconnect(provider: "google" | "microsoft") {
      const s = await ctx();
      const { connectionStore } = await import("@/lib/integrations/store");
      await connectionStore().remove(s.orgId, provider);
    },
    async syncCalendar() {
      const s = await ctx();
      const { pushEvents } = await import("@/lib/integrations/google-calendar");
      const ms = await calendar.listMilestones();
      const apps = await applications.list();
      const events = ms.filter((m) => !m.done).map((m) => {
        const a = apps.find((x) => x.id === m.applicationId);
        return { id: m.id, title: `${m.title}${a ? `: ${a.opportunity.title}` : ""}`, date: m.dueDate, description: a ? `${a.opportunity.title}. ${a.opportunity.sourceUrl}` : "" };
      });
      const r = await pushEvents(s.orgId, events);
      if (!r.ok) return { ok: false as const, code: r.reason === "not_connected" ? ("no_ai" as const) : ("failed" as const), error: r.message };
      return { ok: true as const, data: { pushed: r.pushed } };
    },
  };

  return { org, knowledge, opportunities, applications, inbox, calendar, activity, billing, auth, loop, outreach, contacts, social, integrations };
}

export { getSession };
