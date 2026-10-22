import type { SupabaseClient } from "@supabase/supabase-js";
import type { AgentAutonomy, AgentName, Application, ApplicationView, EmailDraft, Fact, FunderProfile, FunderSummary, ImpactMetric, LossReason, Member, MonthlyPlan, OutcomeResult, ReviewCriterion, ScholarshipProfile, Section } from "@/lib/types";
import type { SessionContext } from "@/lib/supabase/session";
import type { Services } from "./contracts";
import { computeWinAnalytics } from "@/lib/features/analytics";
import { planMonth } from "@/lib/features/planner";
import { analyzeVoice, answerByRules, buildLogicModel, conceptNoteSections, credibilityPosts, feedbackRequestEmail, followUpEmail, logicModelHtml, recomputeCompliance, reminderOutbox, winKit } from "@/lib/features";
import { allFoundations, foundationByFunderId, fundersLikeYou, irsPageUrl, matchFoundations, matchScholarships, noticeTextFor, peerOrganizations, recommendAsk, stateCode, toFunder, toOpportunity } from "@/lib/foundations";
import { map, many, must, toMatchViews } from "./supabase";

/**
 * The Supabase adapter's newer features. Reads build a snapshot of the
 * workspace from its own tables and run the same plain-code features the demo
 * runs; writes go to the tables in migration 0004.
 */
type Row = Record<string, unknown>;
type Base = Pick<Services, "org" | "knowledge" | "opportunities" | "applications" | "inbox" | "calendar" | "outreach" | "contacts" | "social" | "integrations" | "account">;

const DEFAULT_AUTONOMY: Record<AgentName, AgentAutonomy> = { profile: "draft", discovery: "draft", planner: "draft", proposal: "draft", outreach: "draft", calendar: "schedule" };
const today = () => new Date().toISOString().slice(0, 10);

export function makeSupabaseFeatures(db: SupabaseClient, ctx: () => Promise<SessionContext>, base: Base) {
  async function snapshot() {
    const s = await ctx();
    const [orgRow, apps, matches, facts, contacts, orgContacts, members] = await Promise.all([
      db.from("organizations").select("*").eq("id", s.orgId).single(),
      base.applications.list(),
      base.opportunities.listMatches(),
      base.knowledge.listFacts(),
      db.from("contacts").select("*"),
      base.contacts.list(),
      base.org.listMembers(),
    ]);
    const appIds = apps.map((a) => a.id);
    const [sections, outcomes, milestones] = await Promise.all([
      appIds.length ? db.from("sections").select("*").in("application_id", appIds) : Promise.resolve({ data: [] as Row[] }),
      appIds.length ? db.from("outcomes").select("*").in("application_id", appIds) : Promise.resolve({ data: [] as Row[] }),
      base.calendar.listMilestones(),
    ]);
    const org = map.org(must(orgRow, "organization"));
    const opportunities = [...new Map([...apps.map((a) => [a.opportunity.id, a.opportunity] as const), ...matches.map((m) => [m.opportunity.id, m.opportunity] as const)]).values()];
    const funders = [...new Map([...apps.map((a) => [a.funder.id, a.funder] as const), ...matches.map((m) => [m.funder.id, m.funder] as const)]).values()];
    return { s, orgRow: orgRow.data as Row, org, apps, matches, facts, opportunities, funders, sections: ((sections.data ?? []) as Row[]).map(map.section), outcomes: ((outcomes.data ?? []) as Row[]).map(map.outcome), milestones, contacts: ((contacts.data ?? []) as Row[]).map(map.contact), orgContacts, members };
  }
  type Snap = Awaited<ReturnType<typeof snapshot>>;
  const analytics = (x: Snap) => computeWinAnalytics({ applications: x.apps, opportunities: x.opportunities, funders: x.funders, outcomes: x.outcomes, sections: x.sections });
  const signer = (x: Snap) => x.s.fullName || x.org.name;
  const appView = (x: Snap, id: string) => x.apps.find((a) => a.id === id) ?? (() => { throw new Error(`application ${id} not found`); })();
  const requireEditor = async () => {
    if ((await base.org.currentUser()).role === "reviewer") throw new Error("Board reviewers can read and approve sections but cannot change this.");
  };

  async function addEmail(x: Snap, e: Pick<EmailDraft, "applicationId" | "funderId" | "kind" | "subject" | "body">) {
    const row = must(await db.from("email_drafts").insert({ org_id: x.s.orgId, application_id: e.applicationId, funder_id: e.funderId, kind: e.kind, subject: e.subject, body: e.body, status: "draft" }).select("*").single(), "email draft");
    await db.from("inbox_items").insert({ org_id: x.s.orgId, agent: "outreach", type: "email_draft", title: e.subject, summary: `A ${e.kind.replace(/_/g, " ")} for you to read, edit, and send yourself.`, payload: { type: "email_draft", emailDraftId: row.id }, status: "pending", priority: "normal", source_count: 0 });
  }

  const requireOwner = async () => {
    if ((await base.org.currentUser()).role !== "owner") throw new Error("Only the workspace owner can change the team or the workspace itself.");
  };
  const org = {
    async inviteMember(email: string, role: Member["role"]) {
      await requireOwner();
      return base.org.inviteMember(email, role);
    },
    async updateMemberRole(id: string, role: Member["role"]) {
      await requireOwner();
      return base.org.updateMemberRole(id, role);
    },
    async removeMember(id: string) {
      await requireOwner();
      return base.org.removeMember(id);
    },
    async deleteWorkspace() {
      await requireOwner();
      return base.org.deleteWorkspace();
    },
    async getAutonomy() {
      const s = await ctx();
      const { data } = await db.from("organizations").select("agent_autonomy").eq("id", s.orgId).single();
      return { ...DEFAULT_AUTONOMY, ...((data?.agent_autonomy as Record<AgentName, AgentAutonomy>) ?? {}) };
    },
    async setAutonomy(agent: AgentName, level: AgentAutonomy) {
      const s = await ctx();
      if ((await base.org.currentUser()).role !== "owner") throw new Error("Only the workspace owner can change this.");
      const next = { ...(await org.getAutonomy()), [agent]: level };
      await db.from("organizations").update({ agent_autonomy: next }).eq("id", s.orgId);
      return next;
    },
    async previewRole(): Promise<Member> {
      // Real roles change on the Team tab; previewing is a demo convenience.
      return base.org.currentUser();
    },
  };

  const knowledge = {
    async updateBoilerplate(id: string, body: string) {
      await requireEditor();
      const s = await ctx();
      const cur = must(await db.from("boilerplates").select("*").eq("id", id).eq("org_id", s.orgId).single(), "boilerplate");
      await db.from("boilerplate_versions").insert({ org_id: s.orgId, boilerplate_id: id, version: Number(cur.version ?? 1), body: cur.body, saved_at: cur.updated_at ?? new Date().toISOString() });
      return map.boilerplate(must(await db.from("boilerplates").update({ body, version: Number(cur.version ?? 1) + 1, updated_at: new Date().toISOString() }).eq("id", id).select("*").single(), "boilerplate"));
    },
    async listBoilerplateVersions(id: string) {
      const s = await ctx();
      return many(await db.from("boilerplate_versions").select("*").eq("org_id", s.orgId).eq("boilerplate_id", id).order("saved_at", { ascending: false }), "versions").map((r) => ({ id: String(r.id), boilerplateId: String(r.boilerplate_id), version: Number(r.version), body: String(r.body), savedAt: new Date(String(r.saved_at)).toISOString() }));
    },
    async restoreBoilerplateVersion(versionId: string) {
      const s = await ctx();
      const v = must(await db.from("boilerplate_versions").select("*").eq("id", versionId).eq("org_id", s.orgId).single(), "version");
      return knowledge.updateBoilerplate(String(v.boilerplate_id), String(v.body));
    },
    async listMetrics(): Promise<ImpactMetric[]> {
      const s = await ctx();
      return many(await db.from("impact_metrics").select("*").eq("org_id", s.orgId).order("created_at"), "metrics").map((r) => ({ id: String(r.id), orgId: String(r.org_id), label: String(r.label), unit: String(r.unit ?? ""), program: (r.program as string | null) ?? null, entries: (r.entries as ImpactMetric["entries"]) ?? [], factId: (r.fact_id as string | null) ?? null }));
    },
    async addMetric(input: { label: string; unit: string; program: string | null }) {
      await requireEditor();
      const s = await ctx();
      const r = must(await db.from("impact_metrics").insert({ org_id: s.orgId, label: input.label.trim(), unit: input.unit.trim(), program: input.program }).select("*").single(), "metric");
      return (await knowledge.listMetrics()).find((m) => m.id === r.id)!;
    },
    async logMetric(id: string, month: string, value: number, note: string | null) {
      await requireEditor();
      const s = await ctx();
      const m = (await knowledge.listMetrics()).find((x) => x.id === id);
      if (!m) throw new Error("metric not found");
      const entries = [...m.entries.filter((e) => e.month !== month), { month, value, note }].sort((a, b) => a.month.localeCompare(b.month));
      const latest = entries[entries.length - 1];
      const label = `${m.label}, ${new Date(`${latest.month}-15T12:00:00Z`).toLocaleDateString("en-US", { month: "long", year: "numeric" })}`;
      const factRow = { org_id: s.orgId, label, value: `${latest.value.toLocaleString("en-US")}${m.unit ? ` ${m.unit}` : ""}`, category: "outcomes", source_label: "You", source_excerpt: `Logged by ${s.fullName || s.email} in the impact tracker${latest.note ? `: ${latest.note}` : "."}`, confidence: 1, status: "confirmed", last_confirmed_at: new Date().toISOString() };
      let factId = m.factId;
      if (factId) await db.from("facts").update(factRow).eq("id", factId);
      else factId = String(must(await db.from("facts").insert(factRow).select("id").single(), "fact").id);
      await db.from("impact_metrics").update({ entries, fact_id: factId }).eq("id", id);
      return (await knowledge.listMetrics()).find((x) => x.id === id)!;
    },
    async getVoice() {
      const s = await ctx();
      const [bps, orgRow] = await Promise.all([base.knowledge.listBoilerplates(), db.from("organizations").select("voice_note").eq("id", s.orgId).single()]);
      return analyzeVoice(bps.map((b) => ({ label: b.title, text: b.body })), String(orgRow.data?.voice_note ?? ""));
    },
    async setVoiceNote(note: string) {
      await requireEditor();
      const s = await ctx();
      await db.from("organizations").update({ voice_note: note.trim() }).eq("id", s.orgId);
      return knowledge.getVoice();
    },
  };

  async function ruleReviewFor(id: string): Promise<{ overall: number; criteria: ReviewCriterion[]; summary: string }> {
    const ws = await base.applications.getWorkspace(id);
    const secs = ws?.sections ?? [];
    const text = (re: RegExp) => secs.filter((s) => re.test(s.title)).map((s) => s.bodyHtml).join(" ");
    const crit = (criterion: string, html: string, fix: string): ReviewCriterion => {
      const w = html.replace(/<[^>]+>/g, " ").trim().split(/\s+/).filter(Boolean).length;
      const c = (html.match(/data-citation=/g) ?? []).length;
      const g = (html.match(/data-gap=/g) ?? []).length;
      return { criterion, score: !w ? 1 : Math.max(1, Math.min(5, 2 + Math.min(2, c) + (w > 80 ? 1 : 0) - Math.min(2, g))), evidence: w ? `${w} words, ${c} citations${g ? `, ${g} open questions` : ""}.` : "This part is missing.", fix: !w ? fix : g ? "Answer the open questions so every claim has a source." : "Add one more cited number from your facts." };
    };
    const criteria = [crit("Statement of need", text(/need|problem/i), "Add a paragraph on the need, with one number."), crit("Program design", text(/plan|approach|program|activities/i), "Describe what you will do."), crit("Evaluation", text(/evaluat|result|outcome|measur/i), "Say how you will measure results."), crit("Fit with the funder", text(/fit|why this|opening|request/i), "Name the funder's own priority you meet.")];
    return { overall: Math.round((criteria.reduce((n, c) => n + c.score, 0) / 20) * 100), criteria, summary: "Rule-based review: words, citations, and open questions in each part of the draft." };
  }

  const applications = {
    async moveStage(id: string, stage: Application["stage"]) {
      const view = await base.applications.moveStage(id, stage);
      if (stage === "submitted") {
        const x = await snapshot();
        const due = new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10);
        await db.from("milestones").insert({ org_id: x.s.orgId, application_id: id, title: "Follow up with the funder", due_date: due, kind: "follow_up", assignee_id: view.ownerId, done: false });
        const e = followUpEmail({ org: x.org, funderName: view.funder.name, opportunityTitle: view.opportunity.title, signer: signer(x), submittedOn: new Date().toLocaleDateString("en-US", { month: "long", day: "numeric" }) });
        await addEmail(x, { applicationId: id, funderId: view.funder.id, kind: "follow_up", subject: e.subject, body: e.body });
      }
      return view;
    },
    async logOutcome(id: string, result: OutcomeResult, awardAmount: number | null, feedback: string | null, details?: { lossReasons?: LossReason[]; lessons?: string | null }): Promise<ApplicationView> {
      const s = await ctx();
      await db.from("outcomes").upsert({ application_id: id, result, award_amount: awardAmount, feedback, decided_at: new Date().toISOString(), loss_reasons: details?.lossReasons ?? [], lessons: details?.lessons ?? null }, { onConflict: "application_id" });
      must(await db.from("applications").update({ stage: result === "won" ? "won" : "lost" }).eq("id", id).eq("org_id", s.orgId).select("*").single(), "application");
      const x = await snapshot();
      const view = appView(x, id);
      if (result === "won") {
        const kit = winKit({ org: x.org, funderName: view.funder.name, opportunityTitle: view.opportunity.title, award: awardAmount, facts: x.facts, signer: signer(x) });
        await addEmail(x, { applicationId: id, funderId: view.funder.id, kind: "thank_you", subject: kit.thankYou.subject, body: kit.thankYou.body });
        await db.from("milestones").insert({ org_id: s.orgId, application_id: id, title: "Report to the funder (check the date in your award letter)", due_date: new Date(Date.now() + 365 * 86_400_000).toISOString().slice(0, 10), kind: "report_due", assignee_id: view.ownerId, done: false });
      } else if (result === "lost") {
        const e = feedbackRequestEmail({ org: x.org, funderName: view.funder.name, opportunityTitle: view.opportunity.title, signer: signer(x) });
        await addEmail(x, { applicationId: id, funderId: view.funder.id, kind: "feedback_request", subject: e.subject, body: e.body });
        if (details?.lessons || details?.lossReasons?.length) await db.from("matches").update({ dismiss_reason: details?.lessons || details?.lossReasons?.join(", ") }).eq("org_id", s.orgId).eq("opportunity_id", view.opportunityId);
      }
      return view;
    },
    async recommendAsk(id: string) {
      const x = await snapshot();
      const a = appView(x, id);
      const f = foundationByFunderId(a.funder.id);
      const past = x.apps.filter((o) => o.funder.id === a.funder.id && o.outcome?.result === "won").map((o) => o.outcome?.awardAmount ?? 0);
      const median = f?.grantMedian ?? (a.funder.givingMin && a.funder.givingMax ? (a.funder.givingMin + a.funder.givingMax) / 2 : null);
      return recommendAsk({ median, min: a.opportunity.amountMin ?? a.funder.givingMin, max: a.opportunity.amountMax ?? a.funder.givingMax, budget: x.org.annualBudget, past: past.length ? Math.max(...past) : null });
    },
    async logicModel() {
      const x = await snapshot();
      return buildLogicModel(x.org, x.facts);
    },
    async addLogicModelSection(id: string): Promise<Section> {
      await requireEditor();
      const x = await snapshot();
      const order = Math.max(0, ...x.sections.filter((s) => s.applicationId === id).map((s) => s.order)) + 1;
      return map.section(must(await db.from("sections").insert({ application_id: id, title: "Logic model", body_html: logicModelHtml(buildLogicModel(x.org, x.facts), x.facts), status: "drafted", order }).select("*").single(), "section"));
    },
    async draftConceptNote(id: string) {
      await requireEditor();
      const x = await snapshot();
      const a = appView(x, id);
      const parts = conceptNoteSections({ org: x.org, facts: x.facts, funderName: a.funder.name, opportunityTitle: a.opportunity.title, askAmount: a.askAmount });
      await db.from("sections").delete().eq("application_id", id);
      await db.from("missing_facts").delete().eq("application_id", id);
      let open = 0;
      for (const [i, p] of parts.entries()) {
        const sec = must(await db.from("sections").insert({ application_id: id, title: p.title, body_html: p.bodyHtml, status: p.gaps.length ? "needs_facts" : "drafted", order: i + 1 }).select("id").single(), "section");
        for (const g of p.gaps) {
          const mf = must(await db.from("missing_facts").insert({ application_id: id, section_id: sec.id, question: g.question, why_it_matters: "A concept note is short, so every line has to carry a fact the funder can trust.", suggested_label: g.label, status: "open" }).select("id").single(), "question");
          await db.from("sections").update({ body_html: p.bodyHtml.replace(`data-gap="${g.key}"`, `data-gap="${mf.id}"`) }).eq("id", sec.id);
          open++;
        }
      }
      await db.from("applications").update({ mode: "concept_note", stage: a.stage === "discovered" || a.stage === "researching" ? "drafting" : a.stage }).eq("id", id);
      return { ok: true as const, data: { sectionCount: parts.length, openQuestions: open } };
    },
    async listReusable() {
      const x = await snapshot();
      return x.apps.filter((a) => a.stage === "won" && x.sections.some((s) => s.applicationId === a.id)).map((a) => ({ id: a.id, title: a.opportunity.title, funder: a.funder.name, awardAmount: a.outcome?.awardAmount ?? null, sectionCount: x.sections.filter((s) => s.applicationId === a.id).length }));
    },
    async reuseFrom(id: string, sourceId: string) {
      await requireEditor();
      const x = await snapshot();
      const src = x.sections.filter((s) => s.applicationId === sourceId).sort((p, q) => p.order - q.order);
      if (!src.length) return { ok: false as const, code: "not_found" as const, error: "That application has no sections to reuse." };
      const from = appView(x, sourceId).funder.name;
      await db.from("sections").delete().eq("application_id", id);
      for (const s of src) await db.from("sections").insert({ application_id: id, title: s.title, body_html: s.bodyHtml.split(from).join("[the funder's name]"), status: "edited", order: s.order, word_limit: s.wordLimit });
      return { ok: true as const, data: { sectionCount: src.length } };
    },
    async runChecks(id: string) {
      const ws = await base.applications.getWorkspace(id);
      if (!ws) return [];
      const checks = recomputeCompliance({ applicationId: id, requirements: ws.requirements, sections: ws.sections, documents: ws.documents, missingFacts: ws.missingFacts });
      await db.from("compliance_checks").delete().eq("application_id", id).or("rule.ilike.%within%,rule.ilike.%present%,rule.ilike.Attachment:%,rule.ilike.%cites a confirmed fact%,rule.ilike.%open questions%");
      if (checks.length) await db.from("compliance_checks").insert(checks.map((c) => ({ application_id: id, section_id: c.sectionId, rule: c.rule, status: c.status, detail: c.detail })));
      return (await base.applications.getWorkspace(id))?.complianceChecks ?? [];
    },
    async winKit(id: string) {
      const x = await snapshot();
      const a = appView(x, id);
      if (a.stage !== "won") return null;
      return winKit({ org: x.org, funderName: a.funder.name, opportunityTitle: a.opportunity.title, award: a.outcome?.awardAmount ?? a.askAmount, facts: x.facts, signer: signer(x) });
    },
  };

  const inbox = {
    async planNextMonth(): Promise<MonthlyPlan> {
      const x = await snapshot();
      const now = new Date();
      const next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
      const month = next.toISOString().slice(0, 7);
      const { items, summary } = planMonth({ month, today: today(), matches: x.matches, applications: x.apps, outcomes: x.outcomes, analytics: analytics(x), budget: x.org.annualBudget });
      const { data: old } = await db.from("monthly_plans").select("id").eq("org_id", x.s.orgId).eq("month", `${month}-01`).maybeSingle();
      if (old?.id) await db.from("inbox_items").update({ status: "rejected", resolved_at: new Date().toISOString(), rejection_reason: "Replaced by a newer plan." }).eq("org_id", x.s.orgId).eq("type", "monthly_plan").eq("status", "pending").eq("payload->>planId", String(old.id));
      const row = must(await db.from("monthly_plans").upsert({ org_id: x.s.orgId, month: `${month}-01`, summary, items, status: "proposed" }, { onConflict: "org_id,month" }).select("*").single(), "plan");
      await db.from("inbox_items").insert({ org_id: x.s.orgId, agent: "planner", type: "monthly_plan", title: `Your plan for ${next.toLocaleDateString("en-US", { month: "long", timeZone: "UTC" })}`, summary, payload: { type: "monthly_plan", planId: row.id }, status: "pending", priority: "high", source_count: 0 });
      return map.plan(row);
    },
  };

  const calendar = {
    async reminderOutbox() {
      const x = await snapshot();
      const settings = await base.account.getNotificationSettings();
      const reminders = reminderOutbox({ milestones: x.milestones, settings, today: today(), to: x.s.email, titleFor: (m) => x.apps.find((a) => a.id === m.applicationId)?.opportunity.title ?? "an application" });
      return { reminders, canSend: Boolean(process.env.RESEND_API_KEY && process.env.CRON_SECRET) };
    },
  };

  const integrations = {
    async digestPreview() {
      const x = await snapshot();
      const weekAgo = new Date(Date.now() - 7 * 86_400_000).toISOString();
      const fresh = x.matches.filter((m) => m.createdAt >= weekAgo && m.status === "new").sort((a, b) => b.fitScore - a.fitScore);
      const horizon = new Date(Date.now() + 14 * 86_400_000).toISOString().slice(0, 10);
      const soon = x.milestones.filter((m) => !m.done && m.dueDate >= today() && m.dueDate <= horizon);
      const body = [`Hi ${(x.s.fullName || "").split(" ")[0] || "there"},`, "", fresh.length ? `${fresh.length} new matches this week:` : "No new matches this week.", ...fresh.slice(0, 5).map((m) => `- ${m.opportunity.title} (${m.funder.name}), fit ${m.fitScore}`), "", soon.length ? "Due in the next two weeks:" : "Nothing is due in the next two weeks.", ...soon.map((m) => `- ${m.dueDate}: ${m.title}`)].join("\n");
      return { subject: fresh.length ? `${fresh.length} new matches and what is due` : "Your week in grants", body, to: x.s.email, canSend: Boolean(process.env.RESEND_API_KEY) };
    },
  };

  const social = {
    async planCredibility(applicationId: string) {
      const x = await snapshot();
      const a = appView(x, applicationId);
      const deadline = a.opportunity.deadline ?? new Date(Date.now() + 28 * 86_400_000).toISOString().slice(0, 10);
      const posts = credibilityPosts({ org: x.org, facts: x.facts, deadline, applicationId, label: a.opportunity.title });
      return map.campaign(must(await db.from("social_campaigns").insert({ org_id: x.s.orgId, month: deadline.slice(0, 7), theme: `Before the ${a.funder.name} deadline: three posts that show recent, true work.`, posts, status: "draft" }).select("*").single(), "campaign"));
    },
  };

  const contacts = {
    async overlaps() {
      const x = await snapshot();
      const norm = (s: string) => s.toLowerCase().replace(/[^a-z]+/g, " ").trim();
      const out: { contact: (typeof x.orgContacts)[number]; funderId: string; funderName: string; how: string }[] = [];
      for (const c of x.orgContacts) {
        if (c.funderId) {
          const f = x.funders.find((y) => y.id === c.funderId);
          if (f) out.push({ contact: c, funderId: f.id, funderName: f.name, how: c.relationship || `Linked to ${f.name} in your contacts.` });
        }
        for (const f of allFoundations()) {
          const hit = (f.officers ?? []).find((o) => norm(o.name) === norm(c.name));
          if (hit) out.push({ contact: c, funderId: `pf_${f.ein}`, funderName: f.name, how: `${hit.name} is listed as ${hit.title.toLowerCase()} on its ${f.taxYear} IRS filing. Confirm it is the same person before you ask.` });
        }
      }
      return out;
    },
  };

  const summaryOf = (x: Snap, f: (typeof x.funders)[number], relation: FunderSummary["relation"]): FunderSummary => {
    const apps = x.apps.filter((a) => a.funder.id === f.id);
    const wins = apps.filter((a) => a.stage === "won");
    return { funder: f, relation, applications: apps.length, won: wins.length, dollarsWon: wins.reduce((n, a) => n + (a.outcome?.awardAmount ?? 0), 0), fitScore: x.matches.find((m) => m.funder.id === f.id)?.fitScore ?? null, acceptsUnsolicited: foundationByFunderId(f.id)?.acceptsUnsolicited ?? null };
  };
  const funderSvc: Services["funders"] = {
    async list() {
      const x = await snapshot();
      const applied = new Set(x.apps.map((a) => a.funder.id));
      return x.funders.map((f) => summaryOf(x, f, applied.has(f.id) ? "applied" : "matched")).sort((a, b) => b.applications - a.applications || (b.fitScore ?? 0) - (a.fitScore ?? 0));
    },
    async get(id) {
      const x = await snapshot();
      const rec = foundationByFunderId(id);
      const funder = x.funders.find((f) => f.id === id) ?? (rec ? toFunder(rec) : null);
      if (!funder) return null;
      const officerNames = new Set((rec?.officers ?? []).map((o) => o.name.toLowerCase()));
      const profile: FunderProfile = {
        funder,
        filing: rec ? { taxYear: rec.taxYear, ein: rec.ein, city: rec.city, state: rec.state, assets: rec.assets, totalGiving: rec.totalGiving, grantCount: rec.grantCount, grantMedian: rec.grantMedian, grantMin: rec.grantMin, grantMax: rec.grantMax, acceptsUnsolicited: rec.acceptsUnsolicited, application: rec.application, granteeStates: rec.granteeStates, granteeCities: rec.granteeCities, grantees: rec.grantees, officers: rec.officers ?? [], irsUrl: irsPageUrl(rec) } : null,
        opportunities: x.opportunities.filter((o) => o.funderId === id).length ? x.opportunities.filter((o) => o.funderId === id) : rec ? [toOpportunity(rec)] : [],
        match: x.matches.find((m) => m.funder.id === id) ?? null,
        history: x.apps.filter((a) => a.funder.id === id).map((a) => ({ application: a as Application, opportunityTitle: a.opportunity.title, outcome: a.outcome })),
        contacts: x.contacts.filter((c) => c.funderId === id),
        connections: x.orgContacts.filter((c) => c.funderId === id || officerNames.has(c.name.toLowerCase())).map((c) => ({ contactId: c.id, name: c.name, role: c.role, how: c.funderId === id ? c.relationship || "Linked to this funder in your contacts." : "Listed among its officers on its IRS filing." })),
        peers: rec ? peerOrganizations({ org: x.org, funderIds: [id], limit: 8 }) : [],
        recommendedAsk: rec ? recommendAsk({ median: rec.grantMedian, min: rec.grantMin, max: rec.grantMax, budget: x.org.annualBudget }) : null,
      };
      return profile;
    },
    async directory(query, st) {
      const x = await snapshot();
      const q = query.trim().toLowerCase();
      const want = st ? stateCode(st) : null;
      return allFoundations()
        .filter((f) => (!want || f.state === want) && (!q || `${f.name} ${f.city} ${f.focus.join(" ")} ${f.grantees.map((g) => `${g.name} ${g.purpose}`).join(" ")}`.toLowerCase().includes(q)))
        .slice(0, 40)
        .map((f) => summaryOf(x, x.funders.find((y) => y.id === `pf_${f.ein}`) ?? toFunder(f), x.funders.some((y) => y.id === `pf_${f.ein}`) ? "matched" : "directory"));
    },
    async fundersLikeYou() {
      const x = await snapshot();
      const mine = [...new Set(x.matches.map((m) => m.funder.id).filter((id) => id.startsWith("pf_")))];
      const peers = peerOrganizations({ org: x.org, funderIds: mine, limit: 25 });
      return fundersLikeYou({ org: x.org, peers, exclude: mine, limit: 8 }).map((r) => ({ funder: toFunder(r.foundation), peers: r.peers.slice(0, 4) }));
    },
    async peers() {
      const x = await snapshot();
      return peerOrganizations({ org: x.org, funderIds: [...new Set([...x.matches.map((m) => m.funder.id), ...x.apps.map((a) => a.funder.id)].filter((id) => id.startsWith("pf_")))], limit: 16 });
    },
    async addToMatches(funderId) {
      const rec = foundationByFunderId(funderId);
      if (!rec) return null;
      const x = await snapshot();
      const { makeSupabaseStore } = await import("@/lib/loop/supabase-store");
      const st = makeSupabaseStore(x.s);
      const scored = matchFoundations({ org: x.org, facts: x.facts.filter((f: Fact) => f.status === "confirmed"), limit: 400 }).matches.find((m) => m.foundation.ein === rec.ein);
      const stored = await st.upsertOpportunity(toOpportunity(rec), toFunder(rec), noticeTextFor(rec));
      const m = await st.upsertMatch({ opportunityId: stored.opportunity.id, fitScore: scored?.fitScore ?? 45, reasons: scored?.reasons ?? [`Added from the foundation directory. It gives in ${rec.state}.`], cautions: scored?.cautions ?? [`Based on its ${rec.taxYear} filing with the IRS.`], eligibilityChecks: scored?.eligibilityChecks ?? [], status: "saved", dismissReason: null });
      return (await toMatchViews(db, [m]))[0] ?? null;
    },
  };

  const copilot: Services["copilot"] = {
    async ask(question) {
      const x = await snapshot();
      const pending = await base.inbox.list();
      return answerByRules(question, {
        org: x.org,
        facts: x.facts,
        matches: x.matches,
        applications: x.apps.map((a) => ({ id: a.id, title: a.opportunity.title, funder: a.funder.name, stage: a.stage, deadline: a.opportunity.deadline, ask: a.askAmount })),
        milestones: x.milestones.map((m) => ({ title: m.title, dueDate: m.dueDate, done: m.done, application: x.apps.find((a) => a.id === m.applicationId)?.opportunity.title ?? "" })),
        analytics: analytics(x),
        pendingInbox: pending.filter((i) => i.status === "pending").map((i) => ({ title: i.title })),
        emails: [],
        today: today(),
      });
    },
  };

  const scholarships: Services["scholarships"] = {
    async getProfile() {
      const s = await ctx();
      const { data } = await db.from("organizations").select("scholarship_profile").eq("id", s.orgId).single();
      return (data?.scholarship_profile as ScholarshipProfile | null) ?? null;
    },
    async saveProfile(p) {
      const s = await ctx();
      await db.from("organizations").update({ scholarship_profile: p }).eq("id", s.orgId);
      return p;
    },
    async matches() {
      const p = await scholarships.getProfile();
      return p ? matchScholarships(p) : [];
    },
  };

  const analyticsSvc: Services["analytics"] = {
    async summary() {
      return analytics(await snapshot());
    },
  };

  return { org, knowledge, applications, ruleReviewFor, inbox, calendar, integrations, social, contacts, analytics: analyticsSvc, funders: funderSvc, copilot, scholarships };
}
