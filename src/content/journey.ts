import { PRODUCT_NAME } from "@/lib/brand";

/**
 * The full journey on /how-it-works, from a website to a logged outcome.
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
    title: "Paste your website",
    does: `${PRODUCT_NAME} reads your public pages and writes down the facts a funder asks for: your mission, programs, who you serve, where, and what changed for them. It keeps a fact only when the passage it quotes is really on the page. You can add documents too, such as an annual report or an old proposal.`,
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
    does: "It asks what your website did not say and funders will want: your annual budget, your EIN, the counties you serve, how many people you reached last year.",
    you: "Answer what you know now. Anything you skip comes back later as a question, never as a guess.",
  },
  {
    title: "See your matches",
    does: "It searches federal notices on Grants.gov and the 990-PF filings of a few hundred private foundations in Ohio, Kentucky, and North Carolina. Each match has a fit score and reasons tied to one of your facts and a line of the notice or filing.",
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
    does: "It drafts a one-page letter of inquiry or a full proposal. Every claim cites a confirmed fact. A missing fact becomes a marked gap and a question in the side panel.",
    you: "Answer the questions, edit anything that does not sound like you, and approve each section when it is right.",
    shot: { name: "workspace", alt: "The proposal workspace: a drafted letter with citation markers, a checklist, and open questions.", caption: "A draft, on demo data. Citations inline, questions on the right." },
  },
  {
    title: "Run the checks",
    does: "Code checks each citation and each number. Compliance checks look for page and word limits, required sections, and attachments. A reviewer pass lists what a program officer might find weak. The budget builder lays out line items from your numbers.",
    you: "Decide which notes to act on. The checks advise. You choose what the funder reads.",
  },
  {
    title: "Approve the milestones",
    does: "It proposes dates counted back from the deadline: first draft, board review, budget sign-off, letters of support, submit. The weekly digest lists the next two weeks.",
    you: "Move any date, then approve the schedule. It goes on your calendar only after that, by feed or by Google Calendar if you connect it.",
    shot: { name: "calendar", alt: "The calendar with deadlines and milestones across a month.", caption: "The calendar, on demo data." },
  },
  {
    title: "Export and submit it yourself",
    does: "It exports the application as DOCX or PDF, and Outreach drafts a short cover note to the program officer when you want one.",
    you: "Upload the file and click submit on the funder's portal. Send the note from your own address. We never do either for you.",
  },
  {
    title: "Log the outcome",
    does: "When you hear back, it drafts a thank-you or a follow-up asking what would make the next application stronger.",
    you: "Move the application to Won or Lost on the pipeline board, add the amount and what the funder said, and send the note if you want to.",
    shot: { name: "pipeline", alt: "The pipeline board with applications from Discovered to Won and Lost.", caption: "The pipeline board, on demo data." },
  },
  {
    title: "Learn from it next month",
    does: "Win analytics shows which funders, ask sizes, and sections go with your funded applications, and says plainly when there are too few outcomes to tell. Next month's plan takes your outcomes into account.",
    you: "Read it, and approve or change next month's plan. The loop starts again.",
    shot: { name: "analytics", alt: "Win analytics: outcomes by funder and ask size, with how many outcomes each figure rests on.", caption: "Win analytics, on demo data." },
  },
];
