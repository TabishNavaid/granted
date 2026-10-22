import { PRODUCT_NAME } from "@/lib/brand";
import { renderEmail, type Block, type RenderedEmail } from "./render";

/**
 * Every email FundFellows sends, as plain functions of their data. Sign-in, invites, and security mail are
 * essential and carry no unsubscribe link; digests, reminders, and draft notices do.
 */
export interface OutgoingTemplate extends RenderedEmail {
  subject: string;
  essential: boolean;
}

const day = (iso: string) => new Date(`${iso.slice(0, 10)}T12:00:00Z`).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", timeZone: "UTC" });
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** The sign-in link. Supabase sends it through our SMTP settings; scripts/email-templates.ts fills in its template variables. */
export function signInEmail(input: { link: string; code?: string | null; firstTime?: boolean }): OutgoingTemplate {
  const blocks: Block[] = [
    { kind: "p", text: input.firstTime ? `Confirm your email to finish creating your ${PRODUCT_NAME} workspace.` : `Use this link to sign in to ${PRODUCT_NAME}. It works once and expires in one hour.` },
    { kind: "button", label: input.firstTime ? "Confirm and continue" : "Sign in", url: input.link },
  ];
  if (input.code) blocks.push({ kind: "p", text: "Or enter this code on the sign-in page:" }, { kind: "code", text: input.code });
  blocks.push({ kind: "note", text: "If you did not ask for this, you can ignore this email. Nobody can sign in without the link." });
  const subject = input.firstTime ? `Confirm your email for ${PRODUCT_NAME}` : `Your ${PRODUCT_NAME} sign-in link`;
  return { subject, essential: true, ...renderEmail({ preheader: input.firstTime ? "One click to finish setting up." : "One click to sign in. The link expires in an hour.", heading: input.firstTime ? "Confirm your email" : "Sign in", blocks, reason: "You get this because someone entered this address on the sign-in page." }) };
}

export function inviteEmail(input: { inviterName: string; workspaceName: string; role: "owner" | "editor" | "reviewer"; link: string }): OutgoingTemplate {
  const roleWords = input.role === "reviewer" ? "a reviewer, who can read everything and approve or comment on drafts" : input.role === "editor" ? "an editor, who can work on drafts, records, and applications" : "an owner";
  const who = input.inviterName.trim() || "A teammate";
  return {
    subject: `${who} invited you to ${input.workspaceName} on ${PRODUCT_NAME}`,
    essential: true,
    ...renderEmail({
      preheader: `Join ${input.workspaceName} as ${input.role}.`,
      heading: `Join ${input.workspaceName}`,
      blocks: [
        { kind: "p", text: `${who} invited you to the ${input.workspaceName} workspace on ${PRODUCT_NAME} as ${roleWords}.` },
        { kind: "p", text: `${PRODUCT_NAME} finds grants, bids, and other funding, drafts applications from the workspace's own documents, and keeps the deadlines. Nothing is sent or submitted without a person approving it.` },
        { kind: "button", label: "Accept the invitation", url: input.link },
        { kind: "note", text: "The link signs you in and works once. If it has expired, sign in with this email address and the invitation will be waiting." },
      ],
      reason: `You get this because ${who} entered this address in ${input.workspaceName}'s team settings.`,
    }),
  };
}

export interface ReminderItem {
  title: string;
  application: string;
  date: string;
  url: string;
}

export function deadlineReminderEmail(input: { workspaceName: string; items: ReminderItem[]; calendarUrl: string; unsubscribeUrl: string | null }): OutgoingTemplate {
  const first = input.items[0];
  const subject = input.items.length === 1 ? `${first.title} is due ${day(first.date)}` : `${plural(input.items.length, "deadline")} coming up for ${input.workspaceName}`;
  return {
    subject,
    essential: false,
    ...renderEmail({
      preheader: input.items.map((i) => `${i.title}, ${day(i.date)}`).join("; "),
      heading: input.items.length === 1 ? "A deadline is coming up" : "Deadlines coming up",
      blocks: [
        { kind: "list", items: input.items.map((i) => ({ title: i.title, url: i.url, meta: `${i.application}. Due ${day(i.date)}.` })) },
        { kind: "button", label: "Open the calendar", url: input.calendarUrl },
      ],
      reason: `You get this because deadline reminders are on for ${input.workspaceName}.`,
      unsubscribeUrl: input.unsubscribeUrl,
    }),
  };
}

export interface DigestMatch {
  title: string;
  funder: string;
  url: string;
  deadline: string | null;
  amount?: string | null;
  source: string;
  fit?: number | null;
}

export function weeklyDigestEmail(input: { workspaceName: string; matches: DigestMatch[]; databaseNew: DigestMatch[]; deadlines: ReminderItem[]; inboxUrl: string; unsubscribeUrl: string | null }): OutgoingTemplate {
  const n = input.matches.length + input.databaseNew.length;
  const blocks: Block[] = [];
  const meta = (m: DigestMatch) => [m.funder, m.amount ?? "", m.deadline ? `due ${day(m.deadline)}` : "no fixed deadline", m.fit != null ? `fit ${m.fit}` : "", `from ${m.source}`].filter(Boolean).join(". ");
  if (input.matches.length) blocks.push({ kind: "list", heading: "New matches in your workspace", items: input.matches.map((m) => ({ title: m.title, url: m.url, meta: meta(m) })) });
  if (input.databaseNew.length) blocks.push({ kind: "list", heading: "Newly posted and open to you", items: input.databaseNew.map((m) => ({ title: m.title, url: m.url, meta: meta(m) })) });
  if (input.deadlines.length) blocks.push({ kind: "list", heading: "Due in the next two weeks", items: input.deadlines.map((d) => ({ title: d.title, url: d.url, meta: `${d.application}. Due ${day(d.date)}.` })) });
  if (!blocks.length) blocks.push({ kind: "p", text: "Nothing new this week, and nothing due in the next two weeks." });
  blocks.push({ kind: "button", label: "Open your Inbox", url: input.inboxUrl });
  blocks.push({ kind: "note", text: "Every opportunity links to the official page it came from. Check the notice before you apply." });
  return {
    subject: n ? `${plural(n, "new opportunity", "new opportunities")} for ${input.workspaceName}${input.deadlines.length ? `, ${plural(input.deadlines.length, "deadline")} soon` : ""}` : `Your week at ${input.workspaceName}`,
    essential: false,
    ...renderEmail({ preheader: n ? `${plural(n, "new opportunity", "new opportunities")} and ${plural(input.deadlines.length, "deadline")} in the next two weeks.` : "A quiet week.", heading: `Your week at ${input.workspaceName}`, blocks, reason: `You get this every Monday because the weekly digest is on for ${input.workspaceName}.`, unsubscribeUrl: input.unsubscribeUrl }),
  };
}

export function draftReadyEmail(input: { title: string; kind: string; url: string; openQuestions: number; workspaceName: string; unsubscribeUrl: string | null }): OutgoingTemplate {
  return {
    subject: `Your ${input.kind} for ${input.title} is ready to review`,
    essential: false,
    ...renderEmail({
      preheader: input.openQuestions ? `${plural(input.openQuestions, "question")} for you inside.` : "Every claim cites its source.",
      heading: "Your draft is ready",
      blocks: [
        { kind: "p", text: `The ${input.kind} for ${input.title} is written. Every claim links to the document or page it came from.` },
        ...(input.openQuestions ? [{ kind: "p" as const, text: `It has ${plural(input.openQuestions, "question")} where a fact was missing. Answer them and the paragraphs are rewritten with your answers.` }] : []),
        { kind: "button", label: "Review the draft", url: input.url },
        { kind: "note", text: "Nothing is sent or submitted until you approve it." },
      ],
      reason: `You get this because you started this draft in ${input.workspaceName} and draft emails are on.`,
      unsubscribeUrl: input.unsubscribeUrl,
    }),
  };
}
