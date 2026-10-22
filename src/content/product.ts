import { PRODUCT_NAME } from "@/lib/brand";

/**
 * Copy for /product and the six capability pages. Plain text only. Every
 * claim here has to match what the product does today; anything not built
 * yet belongs on /roadmap instead.
 */

export type Shot = { name: string; alt: string; caption: string };
export type Step = { title: string; body: string };
export type Spec = { label: string; body: string };

export type Capability = {
  slug: "matching" | "drafting" | "deadlines" | "outreach" | "connections" | "analytics";
  /** Short name for links and the overview list. */
  name: string;
  /** The page headline. */
  title: string;
  lead: string;
  /** One sentence for the overview page and the meta description. */
  summary: string;
  metaDescription: string;
  steps: Step[];
  shots: Shot[];
  specs: Spec[];
  never: string[];
};

export const capabilities: Capability[] = [
  {
    slug: "matching",
    name: "Matching",
    title: "Grants you can apply for, with the reasons.",
    lead: `${PRODUCT_NAME} searches federal notices on Grants.gov and the public filings of a few hundred private foundations in Ohio, Kentucky, and North Carolina. Each match comes with a fit score and the plain reasons behind it.`,
    summary: "Federal notices from Grants.gov and private foundations from IRS 990-PF filings, each scored against your facts with reasons you can check.",
    metaDescription: `How ${PRODUCT_NAME} finds federal grants on Grants.gov and private foundations in Ohio, Kentucky, and North Carolina from IRS 990-PF filings, and explains every fit score.`,
    steps: [
      {
        title: "It starts from your confirmed facts",
        body: "The search uses the facts you checked on your profile: what you do, where you work, who you serve, and your budget size. A fact you have not confirmed is not used.",
      },
      {
        title: "Federal notices from Grants.gov",
        body: "It searches open and forecast notices that list nonprofits as eligible applicants. Then it reads the most promising ones in full: who can apply, the award range, the deadline, and what the agency wants to fund.",
      },
      {
        title: "Private foundations from their tax filings",
        body: "Private foundations file Form 990-PF with the IRS each year, and the filings are public. For a few hundred foundations in Ohio, Kentucky, and North Carolina, the filing shows what they gave to, how much, where their grantees are, and whether they take applications from organizations they have not invited.",
      },
      {
        title: "A score, and the reasons for it",
        body: "Each match gets a fit score from 0 to 100. Every reason names one of your facts and the line of the notice or filing it relies on. A foundation that only gives to organizations it picks is marked that way, so you do not write to it cold.",
      },
      {
        title: "You choose what to pursue",
        body: "Matches wait in the Inbox. You save one, dismiss it, or open its page to read the eligibility checks and the source. A dismissal tells the next search what to leave out.",
      },
    ],
    shots: [
      {
        name: "opportunities",
        alt: "The opportunities list: matches ranked by fit, each with a score, a deadline, an award range, and its reasons.",
        caption: "Opportunities, on demo data. Federal notices and foundations in one list, ranked by fit.",
      },
      {
        name: "funder",
        alt: "A foundation page built from its 990-PF filing: giving focus, typical grant size, where grantees are, and past grantees.",
        caption: "A foundation page, built from its most recent 990-PF filing. Demo data.",
      },
    ],
    specs: [
      { label: "Where funders come from", body: "Grants.gov notices, open and forecast. IRS Form 990-PF filings for private foundations in Ohio, Kentucky, and North Carolina, from each foundation's most recent electronic filing." },
      { label: "What a foundation page shows", body: "Giving focus, typical grant size, where grantees are located, past grantees, the trustees listed on the filing, whether it accepts unsolicited applications, and its application instructions as filed." },
      { label: "Eligibility checks", body: "Applicant type, location, and budget limits are checked against your profile. When a rule cannot be checked automatically, the page says so instead of guessing. A pass reads \"Looks eligible\", because automated checks can be wrong." },
      { label: "How current it is", body: "Every notice shows its link and the date we last checked it. Every foundation figure shows the tax year it covers. A foundation can change its priorities after it files, so read its current guidelines before you apply." },
      { label: "Cost", body: "Matching reads the opportunity database, which never counts against the monthly allowance." },
    ],
    never: [
      "Name a funder that is not in Grants.gov or the IRS filings.",
      "Rank a notice whose eligibility rules leave you out.",
      "Describe a foundation's interests beyond what it filed.",
      "Contact a funder or start an application for you.",
      "Share your profile with funders, or sell it to anyone.",
    ],
  },
  {
    slug: "drafting",
    name: "Drafting with sources",
    title: "Drafts that show where every claim came from.",
    lead: `${PRODUCT_NAME} writes one-page letters of inquiry and full proposals from the facts you confirmed and the funder's own text. When a fact is missing, the draft asks you for it.`,
    summary: "Letters of inquiry and full proposals where every claim cites a confirmed fact, and every missing fact becomes a question for you.",
    metaDescription: `How ${PRODUCT_NAME} drafts letters of inquiry and proposals with a citation on every claim, turns missing facts into questions, checks the result, and exports DOCX or PDF.`,
    steps: [
      {
        title: "Pick a match and a format",
        body: "Choose a one-page letter of inquiry or a full proposal. When the notice lists required sections, the draft follows them in order.",
      },
      {
        title: "It reads your sources first",
        body: "Your confirmed facts, the documents you uploaded (an annual report, an old proposal, a budget), and the funder's notice or filing. The reading view shows each passage it used, so you can see what the draft is built on.",
      },
      {
        title: "Every claim carries a citation",
        body: "A small marker beside each sentence opens the fact it relies on and the passage where that fact came from. You can check any line in two clicks.",
      },
      {
        title: "Gaps become questions",
        body: "If a section needs a number you have not given, such as how many students you served last year, the draft leaves a marked gap and adds a question to the side panel. Answer it once and it becomes a confirmed fact for every later draft.",
      },
      {
        title: "Checks run before you see it",
        body: "Code checks each citation against its source and each number against your facts. Compliance checks look for page and word limits, required sections, and listed attachments. A reviewer pass reads the draft as a program officer might and lists what is weak.",
      },
      {
        title: "Budget, then export",
        body: "The budget builder lays out line items and a short budget narrative from your numbers. When you are done, export the application as DOCX or PDF and upload it to the funder's portal yourself.",
      },
    ],
    shots: [
      {
        name: "workspace",
        alt: "The proposal workspace: a drafted letter with citation markers, a checklist, and open questions on the right.",
        caption: "The proposal workspace, on demo data. Citations inline, questions on the right.",
      },
      {
        name: "reading",
        alt: "Setup reading a website: each page read, then each fact written down with the passage it came from, and the ones the source check set aside.",
        caption: "Reading a website: every fact keeps the passage it came from. Demo data.",
      },
    ],
    specs: [
      { label: "Formats", body: "One-page letter of inquiry. Full proposal with the sections the funder asks for. Budget table with a budget narrative." },
      { label: "What a draft may use", body: "Facts you confirmed, documents you uploaded, and the funder's notice or 990-PF filing. Nothing else. Your profile can hold a short note about your voice." },
      { label: "Checks", body: "Citation check, number check, compliance check for limits and required sections, and reviewer notes. A failed check becomes a marked gap, not a silent fix." },
      { label: "Export", body: "DOCX and PDF. An unanswered gap is printed as a clear NEED marker so it cannot slip through to a funder." },
      { label: "Cost", body: "Free. Each workspace can draft 50 letters, proposals, or bid responses a month." },
    ],
    never: [
      "Invent a number, a quote, an outcome, or a partner.",
      "Fill a gap with a plausible guess. It asks you.",
      "Use a fact you have not confirmed.",
      "Submit an application. You upload the file and click submit on the funder's portal.",
    ],
  },
  {
    slug: "deadlines",
    name: "Deadlines and calendar",
    title: "Every deadline, with the work planned backward.",
    lead: "Each application you pursue gets milestones counted back from the funder's deadline. You approve the schedule, and it goes on one calendar you can subscribe to from your own.",
    summary: "Milestones planned backward from each deadline, a year plan, a calendar feed, and a push to Google Calendar when it is connected.",
    metaDescription: `How ${PRODUCT_NAME} plans milestones backward from each grant deadline, shows a year plan, and shares it as a calendar feed or to Google Calendar.`,
    steps: [
      {
        title: "The deadline comes from the source",
        body: "When you save a match, its deadline is taken from the notice, with the link. Rolling or unstated deadlines are shown that way, not given a made-up date.",
      },
      {
        title: "Milestones counted back",
        body: "It proposes dates for the steps before submission: first draft, board review, budget sign-off, letters of support, and submit. You can move any of them.",
      },
      {
        title: "The schedule waits for you",
        body: "The proposed schedule arrives in the Inbox as a schedule to approve. Nothing lands on the calendar until you approve it.",
      },
      {
        title: "The month and the year",
        body: "The calendar shows deadlines and milestones by month. The year plan shows when each funder's cycle falls, so a busy spring is visible in January.",
      },
      {
        title: "On the calendar you already use",
        body: "Subscribe to a private calendar feed from Apple Calendar, Outlook, or Google Calendar. Where the Google connection is set up, you can push events straight to a Google calendar instead.",
      },
    ],
    shots: [
      {
        name: "calendar",
        alt: "The calendar with deadlines and milestones across a month.",
        caption: "The calendar, on demo data. Deadlines and the milestones before them.",
      },
      {
        name: "year-plan",
        alt: "The year plan: application cycles and deadlines across twelve months.",
        caption: "The year plan: which funders come due in which months.",
      },
    ],
    specs: [
      { label: "Calendar feed", body: "A private ICS link that any calendar app able to subscribe to a URL can show. How often it refreshes depends on your calendar app." },
      { label: "Google Calendar", body: "A direct push to a calendar you choose. It needs Google keys set up by whoever runs the service, so it is not connected on the demo." },
      { label: "Weekly digest", body: "An email with new matches and the next two weeks of deadlines. You can turn it off." },
      { label: "Reminder emails", body: "A reminder a few days before each milestone, on the schedule in your notification settings. They send once email is set up by whoever runs the service; until then the calendar shows exactly what would go out and when." },
    ],
    never: [
      "Put a date on your calendar before you approve the schedule.",
      "Invent a deadline. Each one comes from the notice, with its link.",
      "Submit anything when a deadline arrives.",
      "Write to your Google Calendar unless you connect it.",
    ],
  },
  {
    slug: "outreach",
    name: "Outreach",
    title: "Emails to funders, drafted for you to send.",
    lead: `Questions for a program officer, cover notes, thank-you notes, and follow-ups. ${PRODUCT_NAME} drafts them from the notice and your facts. You read them and send them from your own address.`,
    summary: "Drafts of the emails around an application, from a question before you apply to a thank-you after. You send each one yourself.",
    metaDescription: `How ${PRODUCT_NAME} drafts emails to funders and program officers that you review and send from your own address. Nothing is sent without your click.`,
    steps: [
      {
        title: "A draft when one would help",
        body: "A question about eligibility before you apply. A cover note when you submit. A thank-you after an award. A short note after a decline asking what would make the next application stronger.",
      },
      {
        title: "Addressed from public sources",
        body: "The recipient is the contact the funder published in its notice, program listing, or filing. If no contact is published, the draft says so and leaves the address blank.",
      },
      {
        title: "In your words, then yours to edit",
        body: "Drafts use your confirmed facts and the voice note on your profile. They are short. Edit anything before it goes.",
      },
      {
        title: "You send it",
        body: "Copy the text, or open it in your mail app. If you connect Gmail or Outlook, a Send button sends it from your account, and only when you press it.",
      },
    ],
    shots: [
      {
        name: "outreach",
        alt: "The outreach screen: a drafted email to a program officer with the recipient, subject, and body, and buttons to copy or open it in a mail app.",
        caption: "Outreach, on demo data. Each draft waits for you to copy it or send it.",
      },
    ],
    specs: [
      { label: "Kinds of email", body: "Pre-application questions, inquiry cover notes, submission notes, thank-you notes, and follow-ups after a decision." },
      { label: "Where addresses come from", body: "Contacts the funder published in a Grants.gov notice, a program page, or a 990-PF filing. We keep to published professional details." },
      { label: "Sending", body: "Copy, or open in your own mail app. With Gmail or Outlook connected, we hold a send-only token and use it only when you press Send. We do not read your mail." },
      { label: "Replies", body: "Replies arrive in your own inbox as usual. Tracking replies inside the product is on the roadmap." },
    ],
    never: [
      "Send an email on its own. Every send is a click by you.",
      "Read your inbox. Connecting Gmail or Outlook allows sending only.",
      "Write to anyone you did not approve.",
      "Scrape personal contact details or buy contact lists.",
    ],
  },
  {
    slug: "connections",
    name: "Connections",
    title: "The people you know who know a funder.",
    lead: `Import your board and contacts, and ${PRODUCT_NAME} shows where they overlap with the trustees foundations list on their tax filings. It drafts the introduction request. You decide whether to ask.`,
    summary: "Board and contact import, overlap with foundation trustees from 990-PF filings, peer organizations that share your funders, and intro request drafts.",
    metaDescription: `How ${PRODUCT_NAME} compares your board and contacts with foundation trustees listed on IRS 990-PF filings, finds peer organizations, and drafts introduction requests you send yourself.`,
    steps: [
      {
        title: "Bring in your people",
        body: "Upload a CSV of board members and contacts with names, organizations, and roles. Add a note on each relationship: who knows them, and how well.",
      },
      {
        title: "Compare with foundation trustees",
        body: "Each 990-PF filing lists the foundation's officers, directors, and trustees. Connections compares those names with your contacts and shows where they may overlap. A matching name is a lead to check, not a confirmed relationship.",
      },
      {
        title: "See who else a funder supports",
        body: "Past grantee lists in the filings show peer organizations that share funders with you. That tells you who a foundation already backs, and who you might ask about it.",
      },
      {
        title: "A request, drafted for you",
        body: "When a board member may know a trustee, it drafts a short note asking them for an introduction, with the reason this funder fits. You or your board member send it.",
      },
    ],
    shots: [
      {
        name: "connections",
        alt: "The connections screen: imported board members, the foundation trustees whose names match, and a drafted introduction request.",
        caption: "Connections, on demo data. Possible overlaps, each with the filing it came from.",
      },
    ],
    specs: [
      { label: "Import", body: "A CSV with one person per row. Name is required. Organization, role, email, and notes are optional." },
      { label: "Trustee data", body: "Names and titles of officers, directors, and trustees as listed on each foundation's 990-PF. Compensation is not stored." },
      { label: "Peer organizations", body: "Nonprofits that received grants from the same foundations as the funders on your list, from the grantee lists in the filings." },
      { label: "Who can see it", body: "Your contacts stay in your workspace. They are not shared with other customers or used to build anyone else's list." },
    ],
    never: [
      "Contact anyone on your list.",
      "Treat a shared name as proof that two people know each other.",
      "Share your contacts with funders or other customers.",
      "Buy or sell contact data.",
    ],
  },
  {
    slug: "analytics",
    name: "Win analytics",
    title: "What your funded applications have in common.",
    lead: `Log the outcome of each application, and ${PRODUCT_NAME} shows which funders, ask sizes, and proposal sections go with the ones that were funded. When there are only a few outcomes, it says so.`,
    summary: "Patterns in your own logged outcomes: which funders, ask sizes, and sections go with wins. Plain about how little a few outcomes can show.",
    metaDescription: `How ${PRODUCT_NAME} turns your logged grant outcomes into plain patterns about funders, ask sizes, and proposal sections, and says when there are too few to tell.`,
    steps: [
      {
        title: "Log what happened",
        body: "On the pipeline board, move an application to Won or Lost. Add the amount and anything the funder said. It takes a minute.",
      },
      {
        title: "See your own patterns",
        body: "Analytics reads only your logged outcomes. It shows results by funder, federal or foundation, by ask size, and by which proposal sections were included.",
      },
      {
        title: "Plain about small numbers",
        body: "Most small organizations submit a handful of applications a year. When there are only a few outcomes, analytics shows the counts and says the pattern could be chance, instead of a percentage that looks more certain than it is.",
      },
      {
        title: "Next month's plan uses it",
        body: "The monthly plan in the Inbox takes your outcomes into account: which kinds of funders have said yes to you, and which funders have funded you before. You still approve the plan.",
      },
    ],
    shots: [
      {
        name: "analytics",
        alt: "The analytics screen: outcomes by funder and by ask size, with a note on how many outcomes the patterns are based on.",
        caption: "Win analytics, on demo data. Every chart says how many outcomes it is based on.",
      },
    ],
    specs: [
      { label: "What it reads", body: "Outcomes you logged: the stage, the award amount, the funder, the ask size, and the sections in the submitted draft." },
      { label: "What it shows", body: "Funded and declined by funder and funder type, ask sizes compared with awards, and the sections most often present in funded applications." },
      { label: "Small numbers", body: "Every figure shows how many outcomes it rests on. With only a few, it shows counts and a plain caution." },
      { label: "Whose data", body: "Your workspace only. It does not compare you with other organizations." },
    ],
    never: [
      "Use other organizations' results to judge yours.",
      "Present a few outcomes as a trend.",
      "Promise a win rate.",
      "Share your outcomes with funders or other customers.",
    ],
  },
];

export function capability(slug: Capability["slug"]): Capability {
  const c = capabilities.find((x) => x.slug === slug);
  if (!c) throw new Error(`No capability called ${slug}`);
  return c;
}

/** The parts of the product that do not have a page of their own. */
export const alsoIncluded: Spec[] = [
  { label: "The Inbox", body: "Every draft, schedule, email, and question an agent prepares waits here until you approve it, edit it, or set it aside. A monthly plan is one click away." },
  { label: "Your profile", body: "Facts read from your website and documents. Each one keeps the quoted passage it came from, and only facts whose passage is on the page are kept." },
  { label: "Pipeline board", body: "Every application from Discovered to Won or Lost, with what the funder said." },
  { label: "Funder pages", body: "A deep dive on each foundation from its 990-PF: giving by focus, grant sizes, grantee locations, trustees, and how to apply as filed." },
  { label: "Social post drafts", body: "Short posts about a new grant or a milestone, to copy or export. It never posts for you." },
  { label: "Activity log", body: "Each step an agent took, each page it read, and what the run cost." },
];
