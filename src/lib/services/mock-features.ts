import type {
  AgentAutonomy,
  AgentName,
  Application,
  ApplicationView,
  BoilerplateVersion,
  EmailDraft,
  Fact,
  FunderProfile,
  FunderSummary,
  ImpactMetric,
  InboxItem,
  LossReason,
  MatchView,
  Member,
  MonthlyPlan,
  OutcomeResult,
  ReviewCriterion,
  ScholarshipProfile,
  Section,
  SocialCampaign,
} from "@/lib/types";
import type { DemoState } from "./mock";
import type { AnalyticsService, ApplicationService, CalendarService, ContactsService, CopilotService, FunderService, InboxService, IntegrationsService, KnowledgeService, OrgService, ScholarshipService, SocialService } from "./contracts";
import { computeWinAnalytics } from "@/lib/features/analytics";
import { planMonth } from "@/lib/features/planner";
import { analyzeVoice, answerByRules, buildLogicModel, conceptNoteSections, credibilityPosts, feedbackRequestEmail, followUpEmail, logicModelHtml, recomputeCompliance, reminderOutbox, winKit } from "@/lib/features";
import { allFoundations, foundationByFunderId, fundersLikeYou, irsPageUrl, matchFoundations, matchScholarships, noticeTextFor, peerOrganizations, recommendAsk, stateCode, toFunder, toOpportunity, loadFoundations } from "@/lib/foundations";
import { seedToday } from "@/lib/mock/dates";
import { wordCount } from "@/lib/format";

/**
 * The demo adapter's newer features: analytics, funders, the planner, the
 * copilot, knowledge extras, and what happens after a decision. Same rules as
 * mock.ts: plain code over the visitor's own workspace, cloned on the way out.
 */
export interface Deps {
  state: DemoState;
  newId: (prefix: string) => string;
  now: () => string;
  currentUserId: string;
  toApplicationView: (a: Application) => ApplicationView;
  toMatchView: (m: DemoState["matches"][number]) => MatchView;
}

const clone = <T>(v: T): T => structuredClone(v);
const today = () => new Date().toISOString().slice(0, 10);

export const DEFAULT_AUTONOMY: Record<AgentName, AgentAutonomy> = { profile: "draft", discovery: "draft", planner: "draft", proposal: "draft", outreach: "draft", calendar: "schedule" };

export function makeFeatureServices(d: Deps) {
  const { state } = d;
  const me = () => state.members.find((m) => m.id === d.currentUserId) ?? state.members[0];
  const signer = () => me()?.fullName || state.org.name;
  const findApp = (id: string) => state.applications.find((a) => a.id === id) ?? (() => { throw new Error(`application ${id} not found`); })();
  const oppOf = (a: Application) => state.opportunities.find((o) => o.id === a.opportunityId)!;
  const funderOf = (a: Application) => state.funders.find((f) => f.id === oppOf(a).funderId)!;
  const inbox = (item: Pick<InboxItem, "agent" | "type" | "title" | "summary" | "payload" | "priority">) => {
    const row: InboxItem = { ...item, id: d.newId("inbox"), orgId: state.org.id, status: "pending", sourceCount: 0, agentRunId: null, createdAt: d.now(), resolvedAt: null, rejectionReason: null };
    state.inbox.unshift(row);
    return row;
  };
  const addEmail = (e: Omit<EmailDraft, "id" | "orgId" | "createdAt" | "status" | "sentAt" | "sentVia" | "followUpAt" | "to" | "toName"> & { to?: string | null; toName?: string | null }) => {
    const row: EmailDraft = { to: null, toName: null, ...e, id: d.newId("email"), orgId: state.org.id, status: "draft", sentAt: null, sentVia: null, followUpAt: null, createdAt: d.now() };
    state.emailDrafts.unshift(row);
    inbox({ agent: "outreach", type: "email_draft", title: e.subject, summary: `A ${e.kind.replace(/_/g, " ")} for you to read, edit, and send yourself.`, payload: { type: "email_draft", emailDraftId: row.id }, priority: "normal" });
    return row;
  };
  const analytics = () =>
    computeWinAnalytics({ applications: state.applications, opportunities: state.opportunities, funders: state.funders, outcomes: state.outcomes, sections: state.sections.map((s) => ({ applicationId: s.applicationId, title: s.title, bodyHtml: s.bodyHtml })) });
  const requireEditor = () => {
    if (me()?.role === "reviewer") throw new Error("Board reviewers can read and approve sections but cannot change this. Ask the owner or an editor.");
  };
  const requireOwner = () => {
    if (me()?.role !== "owner") throw new Error("Only the workspace owner can change this.");
  };

  // ---------- org ----------
  const org: Pick<OrgService, "getAutonomy" | "setAutonomy" | "previewRole"> = {
    async getAutonomy() {
      return clone(state.autonomy);
    },
    async setAutonomy(agent, level) {
      requireOwner();
      state.autonomy[agent] = level;
      return clone(state.autonomy);
    },
    async previewRole(role) {
      const m = me();
      m.role = role;
      return clone(m) as Member;
    },
  };

  // ---------- knowledge ----------
  const knowledge: Pick<KnowledgeService, "updateBoilerplate" | "listBoilerplateVersions" | "restoreBoilerplateVersion" | "listMetrics" | "addMetric" | "logMetric" | "getVoice" | "setVoiceNote"> = {
    async updateBoilerplate(id, body) {
      requireEditor();
      const b = state.boilerplates.find((x) => x.id === id) ?? (() => { throw new Error(`boilerplate ${id} not found`); })();
      // The text being replaced is kept, so an edit can always be undone.
      state.boilerplateVersions.unshift({ id: d.newId("bpv"), boilerplateId: id, version: b.version, body: b.body, savedAt: b.updatedAt });
      b.body = body;
      b.version += 1;
      b.wordCount = wordCount(body);
      b.updatedAt = d.now();
      return clone(b);
    },
    async listBoilerplateVersions(id) {
      return clone(state.boilerplateVersions.filter((v) => v.boilerplateId === id));
    },
    async restoreBoilerplateVersion(versionId) {
      const v = state.boilerplateVersions.find((x) => x.id === versionId) ?? (() => { throw new Error("version not found"); })();
      return knowledge.updateBoilerplate(v.boilerplateId, v.body);
    },
    async listMetrics() {
      return clone(state.metrics);
    },
    async addMetric(input) {
      requireEditor();
      const m: ImpactMetric = { id: d.newId("metric"), orgId: state.org.id, label: input.label.trim(), unit: input.unit.trim(), program: input.program, entries: [], factId: null };
      state.metrics.push(m);
      return clone(m);
    },
    async logMetric(id, month, value, note) {
      requireEditor();
      const m = state.metrics.find((x) => x.id === id) ?? (() => { throw new Error("metric not found"); })();
      m.entries = [...m.entries.filter((e) => e.month !== month), { month, value, note }].sort((a, b) => a.month.localeCompare(b.month));
      // The newest month becomes a confirmed fact, so the next draft cites a fresh number.
      const latest = m.entries[m.entries.length - 1];
      const label = `${m.label}, ${new Date(`${latest.month}-15T12:00:00Z`).toLocaleDateString("en-US", { month: "long", year: "numeric" })}`;
      const value_ = `${latest.value.toLocaleString("en-US")}${m.unit ? ` ${m.unit}` : ""}`;
      const excerpt = `Logged by ${signer()} in the impact tracker${latest.note ? `: ${latest.note}` : "."}`;
      const existing = m.factId ? state.facts.find((f) => f.id === m.factId) : null;
      if (existing) Object.assign(existing, { label, value: value_, sourceExcerpt: excerpt, lastConfirmedAt: d.now(), status: "confirmed" });
      else {
        const f: Fact = { id: d.newId("fact"), orgId: state.org.id, label, value: value_, category: "outcomes", sourceDocumentId: null, sourceUrl: null, sourceLabel: "You", sourceExcerpt: excerpt, sourcePage: null, confidence: 1, status: "confirmed", lastConfirmedAt: d.now() };
        state.facts.push(f);
        m.factId = f.id;
      }
      return clone(m);
    },
    async getVoice() {
      const texts = [
        ...state.boilerplates.map((b) => ({ label: b.title, text: b.body })),
        ...state.sections.filter((s) => s.status === "approved" || s.status === "edited").map((s) => ({ label: `Approved section: ${s.title}`, text: s.bodyHtml.replace(/<[^>]+>/g, " ") })),
      ];
      return analyzeVoice(texts, state.voiceNote);
    },
    async setVoiceNote(note) {
      requireEditor();
      state.voiceNote = note.trim();
      return knowledge.getVoice();
    },
  };

  // ---------- applications ----------
  const applications: Pick<ApplicationService, "moveStage" | "logOutcome" | "recommendAsk" | "logicModel" | "addLogicModelSection" | "draftConceptNote" | "listReusable" | "reuseFrom" | "runChecks" | "winKit" | "updateSection"> = {
    async updateSection(id, bodyHtml) {
      requireEditor();
      const s = state.sections.find((x) => x.id === id) ?? (() => { throw new Error(`section ${id} not found`); })();
      s.bodyHtml = bodyHtml;
      s.status = s.status === "drafted" || s.status === "needs_facts" ? "edited" : s.status;
      s.updatedAt = d.now();
      const checks = recomputeCompliance({ applicationId: s.applicationId, requirements: state.requirements.filter((r) => r.applicationId === s.applicationId), sections: state.sections.filter((x) => x.applicationId === s.applicationId), documents: state.documents, missingFacts: state.missingFacts.filter((m) => m.applicationId === s.applicationId) });
      const wordChecks = checks.filter((c) => c.sectionId === s.id);
      state.complianceChecks = state.complianceChecks.filter((c) => c.sectionId !== s.id || !/within|present/.test(c.rule));
      state.complianceChecks.push(...wordChecks.map((c) => ({ ...c, id: d.newId("cc") })));
      for (const r of state.requirements.filter((x) => x.id === s.requirementId)) r.satisfied = wordCount(bodyHtml.replace(/<[^>]+>/g, " ")) > 0;
      return clone(s);
    },
    async moveStage(id, stage) {
      const a = findApp(id);
      a.stage = stage;
      a.updatedAt = d.now();
      if (stage === "submitted" && !a.submittedAt) {
        a.submittedAt = d.now();
        // A follow-up reminder in 30 days and a drafted nudge, so the application does not go quiet.
        const due = new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10);
        state.milestones.push({ id: d.newId("ms"), orgId: state.org.id, applicationId: a.id, title: "Follow up with the funder", dueDate: due, kind: "follow_up", assigneeId: a.ownerId, done: false });
        const opp = oppOf(a);
        const e = followUpEmail({ org: state.org, funderName: funderOf(a).name, opportunityTitle: opp.title, signer: signer(), submittedOn: new Date().toLocaleDateString("en-US", { month: "long", day: "numeric" }) });
        addEmail({ applicationId: a.id, funderId: funderOf(a).id, contactId: null, kind: "follow_up", subject: e.subject, body: e.body });
      }
      return d.toApplicationView(a);
    },
    async logOutcome(id, result: OutcomeResult, awardAmount, feedback, details) {
      const a = findApp(id);
      a.stage = result === "won" ? "won" : "lost";
      a.updatedAt = d.now();
      const fields = { result, awardAmount, feedback, decidedAt: d.now(), lossReasons: (details?.lossReasons ?? []) as LossReason[], lessons: details?.lessons ?? null };
      const existing = state.outcomes.find((o) => o.applicationId === id);
      if (existing) Object.assign(existing, fields);
      else state.outcomes.push({ id: d.newId("out"), applicationId: id, ...fields });
      const opp = oppOf(a);
      const funder = funderOf(a);
      if (result === "won") {
        const kit = winKit({ org: state.org, funderName: funder.name, opportunityTitle: opp.title, award: awardAmount, facts: state.facts, signer: signer() });
        addEmail({ applicationId: a.id, funderId: funder.id, contactId: null, kind: "thank_you", subject: kit.thankYou.subject, body: kit.thankYou.body });
        // Most grants ask for a report about a year after the award.
        const reportDue = new Date(Date.now() + 365 * 86_400_000).toISOString().slice(0, 10);
        state.milestones.push({ id: d.newId("ms"), orgId: state.org.id, applicationId: a.id, title: "Report to the funder (check the date in your award letter)", dueDate: reportDue, kind: "report_due", assigneeId: a.ownerId, done: false });
      } else if (result === "lost") {
        const e = feedbackRequestEmail({ org: state.org, funderName: funder.name, opportunityTitle: opp.title, signer: signer() });
        addEmail({ applicationId: a.id, funderId: funder.id, contactId: null, kind: "feedback_request", subject: e.subject, body: e.body });
        // The reasons a match is set aside teach the scorer; a decline teaches it the same way.
        const m = state.matches.find((x) => x.opportunityId === a.opportunityId);
        if (m && (details?.lessons || details?.lossReasons?.length)) m.dismissReason = details?.lessons || details?.lossReasons?.join(", ") || null;
      }
      return d.toApplicationView(a);
    },
    async recommendAsk(id) {
      await loadFoundations();
      const a = findApp(id);
      const opp = oppOf(a);
      const funder = funderOf(a);
      const f = foundationByFunderId(funder.id);
      const past = state.outcomes.filter((o) => o.result === "won" && state.applications.some((x) => x.id === o.applicationId && oppOf(x).funderId === funder.id)).map((o) => o.awardAmount ?? 0);
      const median = f?.grantMedian ?? (funder.givingMin && funder.givingMax ? (funder.givingMin + funder.givingMax) / 2 : null);
      return recommendAsk({ median, min: opp.amountMin ?? funder.givingMin, max: opp.amountMax ?? funder.givingMax, budget: state.org.annualBudget, past: past.length ? Math.max(...past) : null });
    },
    async logicModel() {
      return buildLogicModel(state.org, state.facts);
    },
    async addLogicModelSection(id) {
      requireEditor();
      const rows = buildLogicModel(state.org, state.facts);
      const order = Math.max(0, ...state.sections.filter((s) => s.applicationId === id).map((s) => s.order)) + 1;
      const s: Section = { id: d.newId("sec"), applicationId: id, requirementId: null, title: "Logic model", bodyHtml: logicModelHtml(rows, state.facts), wordLimit: null, status: "drafted", order, updatedAt: d.now() };
      state.sections.push(s);
      return clone(s);
    },
    async draftConceptNote(id) {
      requireEditor();
      const a = findApp(id);
      const opp = oppOf(a);
      const parts = conceptNoteSections({ org: state.org, facts: state.facts, funderName: funderOf(a).name, opportunityTitle: opp.title, askAmount: a.askAmount });
      state.sections = state.sections.filter((s) => s.applicationId !== id);
      state.missingFacts = state.missingFacts.filter((m) => m.applicationId !== id);
      let open = 0;
      parts.forEach((p, i) => {
        const sid = d.newId("sec");
        const html = p.bodyHtml.replace(/data-gap="([^"]+)"/g, (_m, key: string) => `data-gap="${id}_${key}"`);
        state.sections.push({ id: sid, applicationId: id, requirementId: null, title: p.title, bodyHtml: html, wordLimit: null, status: p.gaps.length ? "needs_facts" : "drafted", order: i + 1, updatedAt: d.now() });
        for (const g of p.gaps) {
          state.missingFacts.push({ id: `${id}_${g.key}`, applicationId: id, sectionId: sid, question: g.question, whyItMatters: "A concept note is short, so every line has to carry a fact the funder can trust.", suggestedLabel: g.label, status: "open", answer: null, gapKey: null });
          open++;
        }
      });
      a.mode = "concept_note";
      a.stage = a.stage === "discovered" || a.stage === "researching" ? "drafting" : a.stage;
      state.complianceChecks = state.complianceChecks.filter((c) => c.applicationId !== id);
      state.complianceChecks.push(...recomputeCompliance({ applicationId: id, requirements: [], sections: state.sections.filter((s) => s.applicationId === id), documents: state.documents, missingFacts: state.missingFacts.filter((m) => m.applicationId === id) }).map((c) => ({ ...c, id: d.newId("cc") })));
      return { ok: true, data: { sectionCount: parts.length, openQuestions: open } };
    },
    async listReusable() {
      return state.applications
        .filter((a) => a.stage === "won" && state.sections.some((s) => s.applicationId === a.id))
        .map((a) => ({ id: a.id, title: oppOf(a).title, funder: funderOf(a).name, awardAmount: state.outcomes.find((o) => o.applicationId === a.id)?.awardAmount ?? null, sectionCount: state.sections.filter((s) => s.applicationId === a.id).length }));
    },
    async reuseFrom(id, sourceId) {
      requireEditor();
      const src = state.sections.filter((s) => s.applicationId === sourceId).sort((x, y) => x.order - y.order);
      if (!src.length) return { ok: false, code: "not_found", error: "That application has no sections to reuse." };
      const from = funderOf(findApp(sourceId)).name;
      const to = funderOf(findApp(id)).name;
      state.sections = state.sections.filter((s) => s.applicationId !== id);
      for (const s of src) {
        // Names of the old funder become a gap, so nothing addressed to them slips through.
        const body = s.bodyHtml.split(from).join(`<span data-gap="${id}_funder_name" data-label="Funder name"></span>`);
        state.sections.push({ ...clone(s), id: d.newId("sec"), applicationId: id, requirementId: null, bodyHtml: body, status: "edited", updatedAt: d.now() });
      }
      if (state.sections.some((s) => s.applicationId === id && s.bodyHtml.includes(`${id}_funder_name`)))
        state.missingFacts.push({ id: `${id}_funder_name`, applicationId: id, sectionId: state.sections.find((s) => s.applicationId === id && s.bodyHtml.includes(`${id}_funder_name`))!.id, question: `The reused draft named ${from}. Check each place now marked and write it for ${to}.`, whyItMatters: "Sending a funder another funder's name is the most common reuse mistake.", suggestedLabel: "Funder name", status: "open", answer: null, gapKey: null });
      const a = findApp(id);
      a.stage = a.stage === "discovered" || a.stage === "researching" ? "drafting" : a.stage;
      return { ok: true, data: { sectionCount: src.length } };
    },
    async runChecks(id) {
      const checks = recomputeCompliance({ applicationId: id, requirements: state.requirements.filter((r) => r.applicationId === id), sections: state.sections.filter((s) => s.applicationId === id), documents: state.documents, missingFacts: state.missingFacts.filter((m) => m.applicationId === id) });
      // Checks the agent wrote that this code does not cover (formatting rules from guidelines) stay.
      const covered = (rule: string) => /within|present|Attachment:|cites a confirmed fact|open questions/.test(rule);
      state.complianceChecks = [...state.complianceChecks.filter((c) => c.applicationId !== id || !covered(c.rule)), ...checks.map((c) => ({ ...c, id: d.newId("cc") }))];
      return clone(state.complianceChecks.filter((c) => c.applicationId === id));
    },
    async winKit(id) {
      const a = findApp(id);
      if (a.stage !== "won") return null;
      const o = state.outcomes.find((x) => x.applicationId === id);
      return winKit({ org: state.org, funderName: funderOf(a).name, opportunityTitle: oppOf(a).title, award: o?.awardAmount ?? a.askAmount, facts: state.facts, signer: signer() });
    },
  };

  // ---------- reviewer without a model ----------
  function ruleReview(applicationId: string) {
    const secs = state.sections.filter((s) => s.applicationId === applicationId);
    const text = (re: RegExp) => secs.filter((s) => re.test(s.title)).map((s) => s.bodyHtml).join(" ");
    const cites = (html: string) => (html.match(/data-citation=/g) ?? []).length;
    const gaps = (html: string) => (html.match(/data-gap=/g) ?? []).length;
    const words = (html: string) => wordCount(html.replace(/<[^>]+>/g, " "));
    const crit = (criterion: string, html: string, fixIfThin: string): ReviewCriterion => {
      const w = words(html);
      const c = cites(html);
      const g = gaps(html);
      const score = !w ? 1 : Math.max(1, Math.min(5, 2 + Math.min(2, c) + (w > 80 ? 1 : 0) - Math.min(2, g)));
      return { criterion, score, evidence: w ? `${w} words, ${c} citation${c === 1 ? "" : "s"}${g ? `, ${g} open question${g === 1 ? "" : "s"}` : ""}.` : "This part is missing.", fix: !w ? fixIfThin : g ? "Answer the open questions so every claim has a source." : c < 2 ? "Add one more cited number from your facts." : "Read it aloud once; cut any sentence a reviewer could skip." };
    };
    const criteria = [
      crit("Statement of need", text(/need|problem/i), "Add a paragraph on the need, with one number from your facts."),
      crit("Program design", text(/plan|approach|program|what we would do|activities/i), "Describe what you will do, week by week."),
      crit("Evaluation", text(/evaluat|result|outcome|measur/i), "Say how you will measure results, even if in-house."),
      crit("Fit with the funder", text(/fit|why this|opening|request/i), "Name the funder's own priority you meet, in their words."),
    ];
    const overall = Math.round((criteria.reduce((n, c) => n + c.score, 0) / (criteria.length * 5)) * 100);
    return { overall, criteria, summary: `Rule-based review: it counts words, citations, and open questions in each part of the draft. A model key adds a reviewer that reads the draft against the funder's criteria.` };
  }

  // ---------- inbox ----------
  const inboxSvc: Pick<InboxService, "planNextMonth"> = {
    async planNextMonth() {
      await loadFoundations();
      const now = new Date();
      const next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
      const month = next.toISOString().slice(0, 7);
      const { items, summary } = planMonth({ month, today: today(), matches: state.matches.map(d.toMatchView), applications: state.applications, outcomes: state.outcomes, analytics: analytics(), budget: state.org.annualBudget });
      const plan: MonthlyPlan = { id: d.newId("plan"), orgId: state.org.id, month, summary, items, status: "proposed" };
      // A new plan for a month replaces the one still waiting for that month, so the Inbox holds one per month.
      const replaced = new Set(state.plans.filter((p) => p.month === month).map((p) => p.id));
      for (const i of state.inbox) if (i.payload.type === "monthly_plan" && i.status === "pending" && replaced.has(i.payload.planId)) Object.assign(i, { status: "rejected", resolvedAt: d.now(), rejectionReason: "Replaced by a newer plan." });
      state.plans = [plan, ...state.plans.filter((p) => p.month !== month)];
      inbox({ agent: "planner", type: "monthly_plan", title: `Your plan for ${next.toLocaleDateString("en-US", { month: "long", timeZone: "UTC" })}`, summary, payload: { type: "monthly_plan", planId: plan.id }, priority: "high" });
      return clone(plan);
    },
  };

  // ---------- calendar ----------
  const calendar: Pick<CalendarService, "reminderOutbox"> = {
    async reminderOutbox() {
      const reminders = reminderOutbox({
        milestones: state.milestones,
        settings: state.notifications,
        today: today(),
        to: me()?.email ?? "",
        titleFor: (m) => {
          const a = state.applications.find((x) => x.id === m.applicationId);
          return a ? oppOf(a).title : "an application";
        },
      });
      return { reminders, canSend: Boolean(process.env.RESEND_API_KEY) && !Boolean(process.env.DEMO_MODE === "true") };
    },
  };

  // ---------- integrations ----------
  const integrations: Pick<IntegrationsService, "digestPreview"> = {
    async digestPreview() {
      const weekAgo = new Date(Date.now() - 7 * 86_400_000).toISOString();
      const fresh = state.matches.filter((m) => m.createdAt >= weekAgo && m.status === "new").map(d.toMatchView).sort((a, b) => b.fitScore - a.fitScore);
      const soon = state.milestones.filter((m) => !m.done && m.dueDate >= today() && m.dueDate <= new Date(Date.now() + 14 * 86_400_000).toISOString().slice(0, 10)).sort((a, b) => a.dueDate.localeCompare(b.dueDate));
      const lines = [
        `Hi ${(me()?.fullName ?? "").split(" ")[0] || "there"},`,
        "",
        fresh.length ? `${fresh.length} new match${fresh.length === 1 ? "" : "es"} this week:` : "No new matches this week.",
        ...fresh.slice(0, 5).map((m) => `- ${m.opportunity.title} (${m.funder.name}), fit ${m.fitScore}`),
        "",
        soon.length ? "Due in the next two weeks:" : "Nothing is due in the next two weeks.",
        ...soon.slice(0, 6).map((m) => `- ${m.dueDate}: ${m.title}`),
        "",
        `${state.inbox.filter((i) => i.status === "pending").length} item(s) are waiting in your Inbox.`,
      ];
      return { subject: fresh.length ? `${fresh.length} new match${fresh.length === 1 ? "" : "es"} and what is due` : "Your week in grants", body: lines.join("\n"), to: me()?.email ?? "", canSend: false };
    },
  };

  // ---------- social ----------
  const social: Pick<SocialService, "planCredibility"> = {
    async planCredibility(applicationId) {
      const a = findApp(applicationId);
      const opp = oppOf(a);
      const deadline = opp.deadline ?? new Date(Date.now() + 28 * 86_400_000).toISOString().slice(0, 10);
      const posts = credibilityPosts({ org: state.org, facts: state.facts, deadline, applicationId, label: opp.title });
      const c: SocialCampaign = { id: d.newId("camp"), orgId: state.org.id, month: deadline.slice(0, 7), theme: `Before the ${funderOf(a).name} deadline: three posts that show recent, true work to anyone who looks you up.`, status: "draft", createdAt: d.now(), posts };
      state.socialCampaigns.unshift(c);
      return clone(c);
    },
  };

  // ---------- contacts ----------
  const contacts: Pick<ContactsService, "overlaps"> = {
    async overlaps() {
      await loadFoundations();
      const norm = (s: string) => s.toLowerCase().replace(/[^a-z]+/g, " ").replace(/\b(jr|sr|ii|iii|dr|mr|mrs|ms)\b/g, "").trim();
      const out: Awaited<ReturnType<ContactsService["overlaps"]>> = [];
      for (const c of state.orgContacts) {
        if (c.funderId) {
          const f = state.funders.find((x) => x.id === c.funderId);
          if (f) out.push({ contact: clone(c), funderId: f.id, funderName: f.name, how: c.relationship || `Linked to ${f.name} in your contacts.` });
        }
        const n = norm(c.name);
        for (const f of allFoundations()) {
          const hit = (f.officers ?? []).find((o) => norm(o.name) === n);
          if (hit) out.push({ contact: clone(c), funderId: `pf_${f.ein}`, funderName: f.name, how: `${hit.name} is listed as ${hit.title.toLowerCase()} on its ${f.taxYear} IRS filing. Confirm it is the same person before you ask.` });
        }
      }
      return out;
    },
  };

  // ---------- analytics ----------
  const analyticsSvc: AnalyticsService = {
    async summary() {
      return analytics();
    },
  };

  // ---------- funders ----------
  const summaryOf = (f: DemoState["funders"][number], relation: FunderSummary["relation"]): FunderSummary => {
    const apps = state.applications.filter((a) => oppOf(a).funderId === f.id);
    const wins = apps.filter((a) => a.stage === "won");
    const m = state.matches.find((x) => state.opportunities.find((o) => o.id === x.opportunityId)?.funderId === f.id);
    return { funder: clone(f), relation, applications: apps.length, won: wins.length, dollarsWon: wins.reduce((n, a) => n + (state.outcomes.find((o) => o.applicationId === a.id)?.awardAmount ?? 0), 0), fitScore: m?.fitScore ?? null, acceptsUnsolicited: foundationByFunderId(f.id)?.acceptsUnsolicited ?? null };
  };
  const ensureFunder = (id: string) => {
    let f = state.funders.find((x) => x.id === id);
    if (!f) {
      const rec = foundationByFunderId(id);
      if (!rec) return null;
      f = toFunder(rec);
    }
    return f;
  };
  const funders: FunderService = {
    async list() {
      await loadFoundations();
      const applied = new Set(state.applications.map((a) => oppOf(a).funderId));
      const matched = new Set(state.matches.map((m) => state.opportunities.find((o) => o.id === m.opportunityId)?.funderId));
      return state.funders.filter((f) => applied.has(f.id) || matched.has(f.id)).map((f) => summaryOf(f, applied.has(f.id) ? "applied" : "matched")).sort((a, b) => b.applications - a.applications || (b.fitScore ?? 0) - (a.fitScore ?? 0));
    },
    async get(id) {
      await loadFoundations();
      const funder = ensureFunder(id);
      if (!funder) return null;
      const rec = foundationByFunderId(id);
      const opps = state.opportunities.filter((o) => o.funderId === id);
      const matchRow = state.matches.find((m) => opps.some((o) => o.id === m.opportunityId));
      const history = state.applications.filter((a) => oppOf(a).funderId === id).map((a) => ({ application: clone(a), opportunityTitle: oppOf(a).title, outcome: clone(state.outcomes.find((o) => o.applicationId === a.id) ?? null) }));
      const officerNames = new Set((rec?.officers ?? []).map((o) => o.name.toLowerCase()));
      const connections = state.orgContacts.filter((c) => c.funderId === id || officerNames.has(c.name.toLowerCase())).map((c) => ({ contactId: c.id, name: c.name, role: c.role, how: c.funderId === id ? c.relationship || "Linked to this funder in your contacts." : "Listed among its officers on its IRS filing." }));
      const peerIds = [id];
      const profile: FunderProfile = {
        funder: clone(funder),
        filing: rec
          ? { taxYear: rec.taxYear, ein: rec.ein, city: rec.city, state: rec.state, assets: rec.assets, totalGiving: rec.totalGiving, grantCount: rec.grantCount, grantMedian: rec.grantMedian, grantMin: rec.grantMin, grantMax: rec.grantMax, acceptsUnsolicited: rec.acceptsUnsolicited, application: rec.application, granteeStates: rec.granteeStates, granteeCities: rec.granteeCities, grantees: rec.grantees, officers: rec.officers ?? [], irsUrl: irsPageUrl(rec) }
          : null,
        opportunities: clone(opps.length ? opps : rec ? [toOpportunity(rec)] : []),
        match: matchRow ? d.toMatchView(matchRow) : null,
        history,
        contacts: clone(state.contacts.filter((c) => c.funderId === id)),
        connections,
        peers: rec ? peerOrganizations({ org: state.org, funderIds: peerIds, limit: 8 }) : [],
        recommendedAsk: rec ? recommendAsk({ median: rec.grantMedian, min: rec.grantMin, max: rec.grantMax, budget: state.org.annualBudget }) : funder.givingMin && funder.givingMax ? recommendAsk({ median: (funder.givingMin + funder.givingMax) / 2, min: funder.givingMin, max: funder.givingMax, budget: state.org.annualBudget }) : null,
      };
      return profile;
    },
    async directory(query, st) {
      await loadFoundations();
      const q = query.trim().toLowerCase();
      const want = st ? stateCode(st) : null;
      return allFoundations()
        .filter((f) => (!want || f.state === want) && (!q || `${f.name} ${f.city} ${f.focus.join(" ")} ${f.grantees.map((g) => `${g.name} ${g.purpose}`).join(" ")}`.toLowerCase().includes(q)))
        .slice(0, 40)
        .map((f) => {
          const existing = state.funders.find((x) => x.id === `pf_${f.ein}`);
          return summaryOf(existing ?? toFunder(f), existing && state.applications.some((a) => oppOf(a).funderId === existing.id) ? "applied" : existing ? "matched" : "directory");
        });
    },
    async fundersLikeYou() {
      await loadFoundations();
      const myFunders = [...new Set(state.matches.map((m) => state.opportunities.find((o) => o.id === m.opportunityId)?.funderId).filter((x): x is string => Boolean(x?.startsWith("pf_"))))];
      const peers = peerOrganizations({ org: state.org, funderIds: myFunders, limit: 25 });
      return fundersLikeYou({ org: state.org, peers, exclude: myFunders, limit: 8 }).map((x) => ({ funder: toFunder(x.foundation), peers: x.peers.slice(0, 4) }));
    },
    async peers() {
      await loadFoundations();
      const myFunders = [...new Set([...state.matches.map((m) => state.opportunities.find((o) => o.id === m.opportunityId)?.funderId), ...state.applications.map((a) => oppOf(a).funderId)].filter((x): x is string => Boolean(x?.startsWith("pf_"))))];
      return peerOrganizations({ org: state.org, funderIds: myFunders, limit: 16 });
    },
    async addToMatches(funderId) {
      await loadFoundations();
      const rec = foundationByFunderId(funderId);
      if (!rec) return null;
      const screen = matchFoundations({ org: state.org, facts: state.facts.filter((f) => f.status === "confirmed"), limit: 400 });
      const scored = screen.matches.find((m) => m.foundation.ein === rec.ein);
      const opp = toOpportunity(rec);
      const funder = toFunder(rec);
      if (!state.funders.some((f) => f.id === funder.id)) state.funders.push(funder);
      if (!state.opportunities.some((o) => o.id === opp.id)) state.opportunities.push(opp);
      const { memoryStore } = await import("@/lib/loop/memory-store");
      await memoryStore.upsertOpportunity(opp, funder, noticeTextFor(rec));
      const m = await memoryStore.upsertMatch({
        opportunityId: opp.id,
        fitScore: scored?.fitScore ?? 45,
        reasons: scored?.reasons ?? [`Added from foundation search. It gives in ${rec.state}; its typical grant is $${(rec.grantMedian ?? 0).toLocaleString("en-US")}.`],
        cautions: scored?.cautions ?? [rec.acceptsUnsolicited === false ? "Its filing says it gives only to organizations it chooses." : `Based on its ${rec.taxYear} filing with the IRS.`],
        eligibilityChecks: scored?.eligibilityChecks ?? [],
        status: "saved",
        dismissReason: null,
      });
      return d.toMatchView(state.matches.find((x) => x.id === m.id)!);
    },
  };

  // ---------- copilot ----------
  const copilot: CopilotService = {
    async ask(question) {
      const ctx = {
        org: state.org,
        facts: state.facts,
        matches: state.matches.map(d.toMatchView),
        applications: state.applications.map((a) => ({ id: a.id, title: oppOf(a).title, funder: funderOf(a).name, stage: a.stage, deadline: oppOf(a).deadline, ask: a.askAmount })),
        milestones: state.milestones.map((m) => ({ title: m.title, dueDate: m.dueDate, done: m.done, application: (() => { const a = state.applications.find((x) => x.id === m.applicationId); return a ? oppOf(a).title : ""; })() })),
        analytics: analytics(),
        pendingInbox: state.inbox.filter((i) => i.status === "pending").map((i) => ({ title: i.title })),
        emails: state.emailDrafts,
        today: today(),
      };
      return answerByRules(question, ctx);
    },
  };

  // ---------- scholarships ----------
  const scholarships: ScholarshipService = {
    async getProfile() {
      return clone(state.scholarshipProfile);
    },
    async saveProfile(p: ScholarshipProfile) {
      state.scholarshipProfile = { ...p };
      return clone(state.scholarshipProfile);
    },
    async matches() {
      await loadFoundations();
      const p = state.scholarshipProfile;
      if (!p) return [];
      return matchScholarships(p);
    },
  };

  return { org, knowledge, applications, ruleReview, inbox: inboxSvc, calendar, integrations, social, contacts, analytics: analyticsSvc, funders, copilot, scholarships };
}

export function seedTodayIso() {
  return seedToday();
}

export type { BoilerplateVersion };
