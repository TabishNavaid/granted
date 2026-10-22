import { PRODUCT_NAME } from "@/lib/brand";

/**
 * The full journey on /how-it-works, from setup to a logged outcome.
 * `does` is what the product does; `you` is where a person decides.
 */

export type JourneyStep = {
  title: string;
  does: string;
  you: string;
  shot?: { name: string; alt: string; caption: string };
};

export const journey: JourneyStep[] = [
  {
    title: "Say who is applying",
    does: `Setup asks first: a nonprofit, a firm, a research team, or a person. Every later step follows from it. A firm gets bids, the compliance matrix, and the SF 330. A lab gets research notices and funders' AI rules. A student gets scholarships and essays.`,
    you: "Pick one. A consultant or a fiscal sponsor can add more organizations later.",
  },
  {
    title: "Add your website and documents",
    does: `${PRODUCT_NAME} reads your public pages and the documents you add: an annual report and a 990, project sheets and résumés, a lab page, or a student's résumé. It writes down the facts an application asks for, and keeps a fact only when the passage it quotes is really in the source.`,
    you: "Which website and which documents it may read.",
  },
  {
    title: "Check the facts",
    does: "Each fact is shown beside the sentence it came from, with a link to the page.",
    you: "Confirm, edit, or reject each fact. Only confirmed facts are ever used in a match or a draft.",
    shot: { name: "profile", alt: "The confirm screen: facts about the organization, each with the passage and link it came from.", caption: "Checking facts, on demo data. Each one shows where it came from." },
  },
  {
    title: "Answer a few questions",
    does: "It asks what your sources did not say and an application will need: your annual budget, your EIN, the counties you serve, your bonding limit, how many people you reached last year.",
    you: "Answer what you know now. Anything you skip comes back later as a question, never as a guess.",
  },
  {
    title: "See your matches",
    does: "It searches the opportunity database, built from official public sources: federal grants, public bids and contract solicitations, research funding, private foundations in every state, and scholarships. Each match has a fit score and reasons tied to one of your facts and a line of the notice or filing. You can also upload or link an RFP or notice from anywhere.",
    you: "Save the ones worth pursuing and dismiss the rest. A dismissal shapes the next search.",
    shot: { name: "opportunities", alt: "The opportunities list: matches ranked by fit, each with a score, deadline, award range, and reasons.", caption: "Matches, on demo data. Federal notices and foundations together." },
  },
  {
    title: "Get a plan for the month",
    does: "Ask for next month's plan and the Inbox gets a short one: which applications to work on, when each is due, and roughly how much work each one is. Every draft, email, and schedule it prepares waits in the same place.",
    you: "Approve the plan, change it, or set it aside. Nothing in the Inbox moves until you act on it.",
    shot: { name: "inbox", alt: "The Inbox: this month's plan, and the drafts, emails, and questions waiting for approval.", caption: "The Inbox, on demo data. Everything waits here for you." },
  },
  {
    title: "Read a draft with its sources",
    does: "It drafts the letter, proposal, bid response, or essay. Every claim cites a confirmed fact or record. A missing fact becomes a marked gap and a question in the side panel.",
    you: "Answer the questions, edit anything that does not sound like you, and approve each section when it is right.",
    shot: { name: "workspace", alt: "The proposal workspace: a drafted letter with citation markers, a checklist, and open questions.", caption: "A draft, on demo data. Citations inline, questions on the right." },
  },
  {
    title: "Run the checks",
    does: "Code checks each citation and each number. Compliance checks look for page and word limits, required sections, and attachments, and for a bid, every row of the compliance matrix. A reviewer check lists what a program officer or selection board might find weak. The budget builder lays out line items from your numbers.",
    you: "Decide which notes to act on. The checks advise. You choose what the reader sees.",
  },
  {
    title: "Approve the milestones",
    does: "It proposes dates counted back from the deadline: first draft, reviews, sign-offs, submit. When an addendum moves a due date, the milestones move with it. The weekly digest lists the next two weeks.",
    you: "Move any date, then approve the schedule. It goes on your calendar only after that, by feed or by Google Calendar if you connect it.",
    shot: { name: "calendar", alt: "The calendar with deadlines and milestones across a month.", caption: "The calendar, on demo data." },
  },
  {
    title: "Export and submit it yourself",
    does: "It exports the application to Word or PDF, and the SF 330 to Word. Outreach drafts a short cover note when you want one.",
    you: "Upload the file and click submit on the funder's or agency's portal. Send the note from your own address. We never do either for you.",
  },
  {
    title: "Log the outcome",
    does: "When you hear back, it drafts a thank-you or a follow-up asking what would make the next application stronger.",
    you: "Move the application or bid to Won or Lost on the pipeline board, add the amount and what you were told, and send the note if you want to.",
    shot: { name: "pipeline", alt: "The pipeline board with applications from Discovered to Won and Lost.", caption: "The pipeline board, on demo data." },
  },
  {
    title: "Learn from it next month",
    does: "Win analytics shows which funders, clients, sectors, and sizes go with your wins, and says plainly when there are too few outcomes to tell. Next month's plan takes your outcomes into account.",
    you: "Read it, and approve or change next month's plan. The loop starts again.",
    shot: { name: "analytics", alt: "Win analytics: outcomes by funder and ask size, with how many outcomes each figure rests on.", caption: "Win analytics, on demo data." },
  },
];
