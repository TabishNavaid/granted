import type { ComplianceCheck, CopilotAnswer, Document, EmailDraft, Fact, LogicModelRow, MatchView, Milestone, MissingFact, NotificationSettings, Organization, Requirement, Section, SocialPost, VoiceProfile, WinAnalytics, WinKit } from "@/lib/types";
import { citeSpan, gapSpan } from "@/lib/loop/letter";
import { wordCount } from "@/lib/format";

/**
 * Features that need no model: each is plain code over the workspace's own
 * records, so it works the same in the demo and in production, and costs
 * nothing to run. Anything written for a funder cites the fact it uses.
 */

const money = (n: number | null | undefined) => (n == null ? "" : `$${Math.round(n).toLocaleString("en-US")}`);
const plain = (html: string) => html.replace(/<span data-(citation|gap)="[^"]*" data-label="[^"]*"><\/span>/g, "").replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();
const factLabel = (f: Fact) => f.sourceLabel ?? (f.sourceUrl ? new URL(f.sourceUrl).hostname.replace(/^www\./, "") : "Source");
const confirmed = (facts: Fact[]) => facts.filter((f) => f.status === "confirmed");
const firstFact = (facts: Fact[], re: RegExp) => confirmed(facts).find((f) => re.test(f.label));

// ---------- Voice ----------

/** Measures how the organization already writes, from its boilerplate and approved drafts. */
export function analyzeVoice(texts: { label: string; text: string }[], note: string): VoiceProfile {
  const all = texts.map((t) => t.text).join(" ");
  const sentences = all.split(/(?<=[.!?])\s+/).filter((s) => s.trim().split(/\s+/).length > 2);
  const words = all.split(/\s+/).filter(Boolean);
  const syllables = words.reduce((n, w) => n + Math.max(1, (w.toLowerCase().replace(/[^a-z]/g, "").match(/[aeiouy]+/g) ?? []).length), 0);
  const avg = sentences.length ? words.length / sentences.length : 0;
  // Flesch-Kincaid grade level.
  const grade = words.length ? Math.max(1, Math.round(0.39 * avg + 11.8 * (syllables / words.length) - 15.59)) : 0;
  const lower = all.toLowerCase();
  const grams = new Map<string, number>();
  const toks = lower.replace(/[^a-z\s-]/g, " ").split(/\s+/).filter(Boolean);
  const STOP = /^(the|a|an|and|or|of|to|in|for|on|with|at|by|is|are|was|were|be|it|that|this|as|from|our|we|their|they)$/;
  for (let i = 0; i < toks.length - 2; i++) {
    const g = toks.slice(i, i + 3);
    if (STOP.test(g[0]) || STOP.test(g[2]) || /^(and|or|to|of|the)$/.test(g[1])) continue;
    const k = g.join(" ");
    grams.set(k, (grams.get(k) ?? 0) + 1);
  }
  return {
    note,
    sampleWords: words.length,
    avgSentenceWords: Math.round(avg),
    usesWe: /\bwe\b|\bour\b/.test(lower),
    contractions: /\b\w+'(s|re|ve|ll|t|d)\b/.test(lower),
    readingGrade: grade,
    commonPhrases: [...grams.entries()].filter(([, n]) => n >= 2).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([k]) => k),
    sources: [...new Set(texts.map((t) => t.label))],
  };
}

/** The voice note as an instruction a drafting prompt can follow. Empty when there is nothing to say. */
export function voiceInstruction(v: VoiceProfile | null): string {
  if (!v || !v.sampleWords) return "";
  const parts = [`Match the organization's own writing: sentences of about ${v.avgSentenceWords} words, reading level near grade ${v.readingGrade}`, v.usesWe ? "written as \"we\"" : "", v.contractions ? "contractions are fine" : "no contractions"].filter(Boolean);
  return `${parts.join(", ")}.${v.note.trim() ? ` In the director's words: ${v.note.trim()}` : ""}`;
}

// ---------- Logic model ----------

export function buildLogicModel(org: Organization, facts: Fact[]): LogicModelRow[] {
  const c = confirmed(facts);
  const rows: LogicModelRow[] = [];
  const add = (column: LogicModelRow["column"], text: string, f: Fact | null) => rows.push({ column, text, factId: f?.id ?? null });
  for (const f of c.filter((x) => x.category === "people" || /budget|expense/i.test(x.label)).slice(0, 4)) add("inputs", `${f.label}: ${f.value}`, f);
  for (const f of c.filter((x) => x.label === "Program").slice(0, 5)) add("activities", f.value, f);
  for (const f of c.filter((x) => x.category === "reach").slice(0, 5)) add("outputs", `${f.label}: ${f.value}`, f);
  for (const f of c.filter((x) => x.category === "outcomes").slice(0, 5)) add("outcomes", `${f.label}: ${f.value}`, f);
  if (!rows.some((r) => r.column === "activities")) for (const p of org.causes.slice(0, 3)) add("activities", p, null);
  return rows;
}

export function logicModelHtml(rows: LogicModelRow[], facts: Fact[]): string {
  const byId = new Map(facts.map((f) => [f.id, f]));
  const cols: [LogicModelRow["column"], string][] = [
    ["inputs", "Inputs"],
    ["activities", "Activities"],
    ["outputs", "Outputs"],
    ["outcomes", "Outcomes"],
  ];
  return cols
    .map(([k, title]) => {
      const items = rows.filter((r) => r.column === k);
      const lis = items.length ? items.map((r) => `<li>${escape(r.text)}${r.factId && byId.get(r.factId) ? citeSpan(r.factId, factLabel(byId.get(r.factId)!)) : ""}</li>`).join("") : `<li>${gapSpan(`logic_${k}`, `${title} to add`)}</li>`;
      return `<p><strong>${title}</strong></p><ul>${lis}</ul>`;
    })
    .join("");
}

const escape = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// ---------- Concept note ----------

/**
 * A two-page concept note assembled from confirmed facts and boilerplate,
 * with no model: each sentence is a fact the director confirmed, cited, or a
 * question where one is missing.
 */
export function conceptNoteSections(input: { org: Organization; facts: Fact[]; funderName: string; opportunityTitle: string; askAmount: number | null }): { title: string; bodyHtml: string; gaps: { key: string; question: string; label: string }[] }[] {
  const c = confirmed(input.facts);
  const cite = (f: Fact | undefined) => (f ? citeSpan(f.id, factLabel(f)) : "");
  const gaps: Record<string, { key: string; question: string; label: string }[]> = {};
  const gap = (section: string, key: string, label: string, question: string) => {
    (gaps[section] ??= []).push({ key, question, label });
    return gapSpan(key, label);
  };
  const place = firstFact(input.facts, /zip|service area|counties|county|geograph|grocery|location/i);
  const reach = c.filter((f) => f.category === "reach").slice(0, 2);
  const outcomes = c.filter((f) => f.category === "outcomes").slice(0, 3);
  const programs = c.filter((f) => f.label === "Program").slice(0, 3);
  const founded = firstFact(input.facts, /founded/i);
  const sections = [
    {
      title: "The problem",
      bodyHtml: `<p>${escape(input.org.name)} works in ${escape(input.org.serviceArea || [input.org.city, input.org.state].filter(Boolean).join(", ") || "its community")}${place ? `, where ${escape(place.label.toLowerCase())}: ${escape(place.value)}${cite(place)}` : ""}. ${gap("The problem", "concept_need", "The need in one number", "What one number best shows the need you address, and where does it come from?")}</p>`,
    },
    {
      title: "Our approach",
      bodyHtml: `<p>${programs.length ? `We run ${programs.map((p) => `${escape(p.value)}${cite(p)}`).join(", ")}.` : gap("Our approach", "concept_programs", "Programs", "Which programs would this request support?")} ${founded ? `We have done this work since ${escape(founded.value)}${cite(founded)}.` : ""}</p>${reach.length ? `<ul>${reach.map((f) => `<li>${escape(f.label)}: ${escape(f.value)}${cite(f)}</li>`).join("")}</ul>` : ""}`,
    },
    {
      title: "Expected results",
      bodyHtml: outcomes.length ? `<p>Results we already measure:</p><ul>${outcomes.map((f) => `<li>${escape(f.label)}: ${escape(f.value)}${cite(f)}</li>`).join("")}</ul>` : `<p>${gap("Expected results", "concept_outcomes", "A result you measure", "What result do you measure today, with a number?")}</p>`,
    },
    {
      title: "The request",
      bodyHtml: `<p>We are asking ${escape(input.funderName)} for ${input.askAmount ? escape(money(input.askAmount)) : gap("The request", "concept_ask", "Ask amount", `How much will you ask ${input.funderName} for?`)} through ${escape(input.opportunityTitle)}. ${gap("The request", "concept_use", "Use of funds", "What would the money pay for?")}</p>`,
    },
  ];
  return sections.map((s) => ({ ...s, gaps: gaps[s.title] ?? [] }));
}

// ---------- After a decision ----------

export function winKit(input: { org: Organization; funderName: string; opportunityTitle: string; award: number | null; facts: Fact[]; signer: string }): WinKit {
  const reach = firstFact(input.facts, /served|people|students|households|patients|families/i);
  const amount = input.award ? `${money(input.award)} ` : "";
  return {
    post: `We are grateful to ${input.funderName} for a ${amount}grant to ${input.org.name}.${reach ? ` Last year we reached ${reach.value.toLowerCase()} (${reach.label.toLowerCase()}), and this support helps us keep going.` : ""} Thank you to everyone who makes this work possible.`,
    newsletter: `Good news: ${input.funderName} has awarded ${input.org.name} ${input.award ? `a ${money(input.award)} grant` : "a grant"} through ${input.opportunityTitle}. ${reach ? `It builds on a year in which ${reach.label.toLowerCase()} reached ${reach.value}. ` : ""}We will share what it makes possible in our next update.`,
    thankYou: {
      subject: `Thank you from ${input.org.name}`,
      body: `Dear ${input.funderName} team,\n\nThank you for your ${input.award ? `${money(input.award)} ` : ""}grant to ${input.org.name} through ${input.opportunityTitle}. We know how many requests you weigh, and we do not take your trust lightly.\n\nWe will send the report on the date in our agreement, and we would be glad to show you the work in person before then.\n\nWith thanks,\n${input.signer}`,
    },
  };
}

export function feedbackRequestEmail(input: { org: Organization; funderName: string; opportunityTitle: string; signer: string }): { subject: string; body: string } {
  return {
    subject: `${input.opportunityTitle}: thank you, and one question`,
    body: `Dear ${input.funderName} team,\n\nThank you for reviewing our application to ${input.opportunityTitle}. We understand you had to make hard choices.\n\nIf you are able to share any feedback on what would make a future request from ${input.org.name} stronger, we would be grateful. Even a sentence or two helps us.\n\nWith thanks,\n${input.signer}`,
  };
}

export function followUpEmail(input: { org: Organization; funderName: string; opportunityTitle: string; signer: string; submittedOn: string }): { subject: string; body: string } {
  return {
    subject: `Following up on our application to ${input.opportunityTitle}`,
    body: `Dear ${input.funderName} team,\n\nWe submitted an application to ${input.opportunityTitle} on ${input.submittedOn} and wanted to confirm it arrived complete. Is there anything else you need from ${input.org.name} for your review?\n\nThank you,\n${input.signer}`,
  };
}

// ---------- Credibility campaign ----------

/** Three posts timed before a deadline, so a funder who looks the organization up sees recent, true work. */
export function credibilityPosts(input: { org: Organization; facts: Fact[]; deadline: string; applicationId: string; label: string }): SocialPost[] {
  const c = confirmed(input.facts);
  const outcome = c.find((f) => f.category === "outcomes");
  const reach = c.find((f) => f.category === "reach");
  const program = c.find((f) => f.label === "Program");
  const day = (n: number) => new Date(Date.parse(`${input.deadline}T12:00:00Z`) - n * 86_400_000).toISOString().slice(0, 10);
  const tied = { kind: "application" as const, id: input.applicationId, label: input.label };
  const posts: Omit<SocialPost, "id">[] = [
    { platform: "linkedin", date: day(21), text: reach ? `${reach.label}: ${reach.value}. Behind that number are the staff and volunteers of ${input.org.name}. Here is what a typical week looks like.` : `A look inside a typical week at ${input.org.name}.`, status: "draft", tiedTo: tied },
    { platform: "instagram", date: day(14), text: program ? `This is ${program.value}. One photo, one sentence from someone it serves, with their permission.` : `One photo, one sentence from someone we serve, with their permission.`, status: "draft", tiedTo: tied },
    { platform: "facebook", date: day(7), text: outcome ? `${outcome.label}: ${outcome.value}. We measure it so we know the work is working. Thank you to everyone who makes it possible.` : `Thank you to the volunteers and partners who make this work possible.`, status: "draft", tiedTo: tied },
  ];
  return posts.map((p, i) => ({ ...p, id: `cred_${i + 1}` }));
}

// ---------- Reminders ----------

export function reminderOutbox(input: { milestones: Milestone[]; settings: NotificationSettings; today: string; to: string; titleFor: (m: Milestone) => string; sentIds?: string[] }): import("@/lib/types").ReminderPreview[] {
  if (!input.settings.milestoneReminders) return [];
  const out: import("@/lib/types").ReminderPreview[] = [];
  for (const m of input.milestones.filter((x) => !x.done && x.dueDate >= input.today).sort((a, b) => a.dueDate.localeCompare(b.dueDate)).slice(0, 12)) {
    const send = new Date(Date.parse(`${m.dueDate}T12:00:00Z`) - input.settings.reminderDaysBefore * 86_400_000).toISOString().slice(0, 10);
    const title = input.titleFor(m);
    out.push({
      milestoneId: m.id,
      sendOn: send < input.today ? input.today : send,
      to: input.to,
      subject: `${m.title} in ${input.settings.reminderDaysBefore} days: ${title}`,
      body: `${m.title} for ${title} is due ${new Date(`${m.dueDate}T12:00:00Z`).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}.\n\nOpen it in your workspace to see what is left.`,
      status: input.sentIds?.includes(m.id) ? "sent" : send <= input.today ? "due" : "scheduled",
    });
  }
  return out;
}

// ---------- Compliance ----------

const ATTACHMENT_DOC: [RegExp, Document["type"][]][] = [
  [/determination|501\(c\)|irs letter/i, ["determination_letter"]],
  [/board/i, ["board_list"]],
  [/budget/i, ["budget"]],
  [/audit|financial statement/i, ["audit", "form_990"]],
  [/w-?9/i, ["w9"]],
  [/annual report/i, ["annual_report"]],
];

/** Checks the draft against its requirements again, for real: word limits, sections present, attachments in the vault, open questions. */
export function recomputeCompliance(input: { applicationId: string; requirements: Requirement[]; sections: Section[]; documents: Document[]; missingFacts: MissingFact[] }): Omit<ComplianceCheck, "id">[] {
  const checks: Omit<ComplianceCheck, "id">[] = [];
  for (const s of input.sections) {
    const words = wordCount(plain(s.bodyHtml));
    if (s.wordLimit) checks.push({ applicationId: input.applicationId, sectionId: s.id, rule: `"${s.title}" within ${s.wordLimit} words`, status: words > s.wordLimit ? "fail" : "pass", detail: words > s.wordLimit ? `Currently ${words} words, ${words - s.wordLimit} over.` : `Currently ${words} words.` });
    if (!words) checks.push({ applicationId: input.applicationId, sectionId: s.id, rule: `"${s.title}" is present`, status: "fail", detail: "This section is empty." });
  }
  for (const r of input.requirements.filter((x) => x.kind === "attachment")) {
    const types = ATTACHMENT_DOC.find(([re]) => re.test(r.title))?.[1] ?? [];
    const doc = input.documents.find((d) => types.includes(d.type) && d.status === "ready");
    checks.push({ applicationId: input.applicationId, sectionId: null, rule: `Attachment: ${r.title}`, status: doc ? "pass" : r.required ? "fail" : "warn", detail: doc ? `Ready in your documents: ${doc.title}.` : types.length ? "Not in your documents yet. Upload it on Profile, Documents." : "Check this one by hand." });
  }
  const html = input.sections.map((s) => s.bodyHtml).join("");
  const unverified = (html.match(/data-label="Unverified claim"/g) ?? []).length;
  checks.push({ applicationId: input.applicationId, sectionId: null, rule: "Every claim cites a confirmed fact", status: unverified ? "fail" : "pass", detail: unverified ? `${unverified} claim${unverified === 1 ? "" : "s"} still unverified.` : "Every citation points to a fact you confirmed." });
  const open = input.missingFacts.filter((m) => m.status === "open").length;
  checks.push({ applicationId: input.applicationId, sectionId: null, rule: "No open questions", status: open ? "warn" : "pass", detail: open ? `${open} question${open === 1 ? "" : "s"} waiting on you.` : "Nothing is waiting on you." });
  return checks;
}

// ---------- Ask: answers from the workspace ----------

export interface CopilotContext {
  org: Organization;
  facts: Fact[];
  matches: MatchView[];
  applications: { id: string; title: string; funder: string; stage: string; deadline: string | null; ask: number | null }[];
  milestones: { title: string; dueDate: string; application: string; done: boolean }[];
  analytics: WinAnalytics;
  pendingInbox: { title: string }[];
  emails: EmailDraft[];
  today: string;
}

const fmtDate = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString("en-US", { month: "long", day: "numeric" });

/**
 * Answers questions about the workspace from its own records: deadlines,
 * money, matches, facts, funders, and what to do next. Without a model key
 * this is the whole copilot, and it says when a question is beyond it.
 */
export function answerByRules(question: string, ctx: CopilotContext): CopilotAnswer {
  const q = question.toLowerCase();
  const suggestions = ["What is due in the next two weeks?", "How much have we won this year?", "Which matches should I look at first?", "How many people did we serve?"];
  if (/due|deadline|next two weeks|this week|coming up|calendar/.test(q)) {
    const upcoming = ctx.milestones.filter((m) => !m.done && m.dueDate >= ctx.today).sort((a, b) => a.dueDate.localeCompare(b.dueDate)).slice(0, 5);
    return {
      answer: upcoming.length ? `Coming up:\n${upcoming.map((m) => `- ${fmtDate(m.dueDate)}: ${m.title}, ${m.application}`).join("\n")}` : "Nothing is due. Every milestone on your calendar is done.",
      sources: [{ label: "Calendar", href: "/calendar" }],
      engine: "rules",
      suggestions,
    };
  }
  if (/won|raised|awarded|money|dollars|how much/.test(q) && !/served|people|students|families|households|patients/.test(q)) {
    const a = ctx.analytics;
    if (/this year|in \d{4}/.test(q)) {
      const year = q.match(/in (\d{4})/)?.[1] ?? ctx.today.slice(0, 4);
      const months = a.timeline.filter((m) => m.month.startsWith(year));
      const won = months.reduce((n, m) => n + m.won, 0);
      const asked = months.reduce((n, m) => n + m.asked, 0);
      return {
        answer: months.length ? `In ${year}, decisions came back on requests totaling ${money(asked)}, and you won ${money(won)} of it. Across every year logged, you have won ${money(a.dollarsWon)}.` : `No decisions have been logged for ${year} yet. Across every year logged, you have won ${money(a.dollarsWon)}.`,
        sources: [{ label: "Analytics", href: "/analytics" }],
        engine: "rules",
        suggestions,
      };
    }
    return {
      answer: a.decided ? `In total you have won ${money(a.dollarsWon)} from ${a.won} of ${a.decided} decided applications${a.winRate != null ? `, a ${a.winRate}% win rate` : ""}. ${a.pending ? `${a.pending} more ${a.pending === 1 ? "is" : "are"} waiting on a decision, asking ${money(a.pendingAsk)}.` : ""}` : "No application has a decision logged yet. Mark outcomes on the Pipeline and this will add them up.",
      sources: [{ label: "Analytics", href: "/analytics" }, { label: "Pipeline", href: "/pipeline" }],
      engine: "rules",
      suggestions,
    };
  }
  if (/match|apply|opportunit|grants? for|look at first|best fit|funders? (should|to)/.test(q)) {
    const top = ctx.matches.filter((m) => m.status === "new" || m.status === "saved").sort((a, b) => b.fitScore - a.fitScore).slice(0, 3);
    return {
      answer: top.length ? `Your strongest open matches:\n${top.map((m) => `- ${m.opportunity.title} (${m.funder.name}), fit ${m.fitScore}. ${m.reasons[0] ?? ""}`).join("\n")}` : "No new matches right now. Run a search from Opportunities.",
      sources: top.map((m) => ({ label: m.opportunity.title, href: `/opportunities/${m.opportunity.id}` })),
      engine: "rules",
      suggestions,
    };
  }
  if (/what should i|what next|to do|waiting|inbox|today/.test(q)) {
    return {
      answer: ctx.pendingInbox.length ? `${ctx.pendingInbox.length} thing${ctx.pendingInbox.length === 1 ? " is" : "s are"} waiting on you:\n${ctx.pendingInbox.slice(0, 5).map((i) => `- ${i.title}`).join("\n")}` : "Nothing is waiting in your Inbox.",
      sources: [{ label: "Inbox", href: "/inbox" }],
      engine: "rules",
      suggestions,
    };
  }
  // A fact lookup: the confirmed fact whose label shares the most words with the question.
  const words = q.split(/[^a-z0-9]+/).filter((w) => w.length > 3);
  const scored = confirmed(ctx.facts)
    .map((f) => ({ f, n: words.filter((w) => `${f.label} ${f.value}`.toLowerCase().includes(w.replace(/s$/, ""))).length }))
    .filter((x) => x.n > 0)
    .sort((a, b) => b.n - a.n);
  if (scored.length) {
    const hits = scored.slice(0, 3).map((x) => x.f);
    return {
      answer: hits.map((f) => `${f.label}: ${f.value}. Source: ${factLabel(f)}${f.sourceExcerpt ? `, "${f.sourceExcerpt}"` : ""}`).join("\n"),
      sources: [{ label: "Profile and knowledge", href: "/profile" }],
      engine: "rules",
      suggestions,
    };
  }
  const app = ctx.applications.find((a) => words.some((w) => a.funder.toLowerCase().includes(w) || a.title.toLowerCase().includes(w)));
  if (app) {
    return {
      answer: `${app.title} (${app.funder}) is at ${app.stage}${app.deadline ? `, due ${fmtDate(app.deadline)}` : ""}${app.ask ? `, asking ${money(app.ask)}` : ""}.`,
      sources: [{ label: app.title, href: `/applications/${app.id}` }],
      engine: "rules",
      suggestions,
    };
  }
  return {
    answer: "Without a model key I can answer questions about your own records: deadlines, money won, matches, applications, and the facts in your profile. Try one of the questions below. With a model key set, I can answer anything about the account.",
    sources: [],
    engine: "rules",
    suggestions,
  };
}
