import { PRODUCT_NAME } from "@/lib/brand";

/**
 * Copy for /who-its-for. Each audience: the problem, how it helps, what is
 * limited today, and the /for page that covers it step by step.
 */

export type Audience = {
  id: string;
  name: string;
  heading: string;
  problem: string[];
  helps: string[];
  limits: string[];
  /** The audience page with the steps, screenshots, and what it needs. */
  page: { href: string; label: string };
};

const forNonprofits = { href: "/for/nonprofits", label: "What it does for nonprofits, step by step" };

export const audiences: Audience[] = [
  {
    id: "firms",
    name: "Architecture and construction firms",
    heading: "For the firm that wins its work by proposal.",
    problem: [
      "Architecture, engineering, and construction firms win most of their public work through proposals. The solicitations are spread across SAM.gov, state portals, and city bid pages. Each one spreads its requirements across sections, attachments, and forms, and the people who know the projects are busy on them. The same résumés and project sheets get rebuilt for every SF 330.",
    ],
    helps: [
      "One search covers federal solicitations from SAM.gov, bids from state and city portals that publish open data, and international public tenders. Save a search by NAICS code, region, and set-aside.",
      "Upload or link any RFP. Every requirement becomes a compliance-matrix row with the sentence and page it came from.",
      "A go/no-go score gives plain reasons: capacity, bonding, past work, and set-aside fit. A stopper turns it to no-go. The decision is yours.",
      "The proposal and the SF 330, Part I and Part II, are built from your own projects, people, registrations, bonding, insurance, and safety record. The SF 330 exports to Word.",
      "Addenda are tracked. A changed due date replans the milestones.",
    ],
    limits: [
      "State and local coverage is uneven. Many state portals do not allow automated reading or publish no open feed. Seven portals are covered today, and any RFP can be uploaded or linked.",
      "The SF 330 is a Word working copy to move into the official form.",
      "It never fills in hours or a price, and never signs or submits a bid.",
      "Grants a for-profit firm can get are rare, and it says so.",
    ],
    page: { href: "/for/architecture-and-construction", label: "What it does for architecture and construction firms, step by step" },
  },
  {
    id: "nonprofits",
    name: "Small nonprofits",
    heading: "For the director who writes grants after hours.",
    problem: [
      "A food pantry, a youth program, or a rural clinic with a budget under half a million dollars rarely has anyone whose job is grants. The director does programs, payroll, and the board packet, then writes proposals at night.",
      "The funder list is a spreadsheet from three years ago. The facts a funder asks for are spread across the website, last year's annual report, and someone's memory. Half the deadlines on the list may have moved.",
    ],
    helps: [
      "It reads your website, annual report, and 990 once and keeps the facts you confirm, so you stop retyping your mission and your numbers.",
      "It finds federal grants and private foundations in every state, with whether each foundation accepts unsolicited applications, its typical grant size, and where it gives.",
      "It drafts the letter of inquiry or the full proposal with a citation on every claim, and asks you for what is missing.",
      "It plans the milestones back from each deadline and puts them on the calendar you already use.",
      "It is free during early access. There is no paid plan and no card.",
    ],
    limits: [
      "Foundation details such as how to apply and past grantees come from IRS filings that are one to two years old. Check each foundation's current guidelines.",
      "Corporate giving programs and community foundation rounds are not covered yet.",
      "Drafts are in English.",
    ],
    page: forNonprofits,
  },
  {
    id: "research",
    name: "Research teams",
    heading: "For the lab writing proposals between classes and experiments.",
    problem: [
      "University labs and small research companies repeat the same pieces in every proposal: biosketches, facilities, a data management plan. Finding the right program means working out who funds this kind of work, and each funder now has its own rule about AI in applications.",
    ],
    helps: [
      "It finds funding notices from the NIH Guide, NSF, SBIR.gov, and Grants.gov, each with plain reasons.",
      "It shows funded projects like yours from NSF and NIH award data: which programs fund this work and which program officers manage it.",
      "It drafts in the standard sections, with biosketches and facilities built from your records.",
      "Each funder's rule on AI is on the checklist, with its source.",
    ],
    limits: [
      "NASA's own solicitation site has no feed. NASA notices posted to Grants.gov still appear.",
      "The profile is read from your lab page, and your team has to check it.",
      "Funders change their rules on AI. Read the current notice before you submit.",
    ],
    page: { href: "/for/research", label: "What it does for research teams, step by step" },
  },
  {
    id: "scholarships",
    name: "Students and individuals",
    heading: "For students looking past the same national scholarships.",
    problem: [
      "Students and their families hear about the same few national scholarships, and so does everyone else applying. Small local foundations that give scholarships rarely advertise. Many only take applications from one county or one high school.",
    ],
    helps: [
      "A résumé becomes a profile you check before anything uses it.",
      "It matches you to about 80 national scholarships and fellowships, checked by hand on each sponsor's page, and to foundations in every state whose filings show grants to individuals.",
      "Essays are drafted in your own voice from your own experiences. When a detail is missing, it asks instead of inventing.",
      "The deadline calendar and milestones work the same way as for organizations.",
    ],
    limits: [
      "Some sponsors have not posted this year's deadline yet. Check the sponsor's page when a date is missing.",
      "Foundation instructions come from IRS filings that are one to two years old, and many local scholarships are limited to one school or county. Check with the foundation before you apply.",
      "College, employer, and federal student aid are not included.",
      "We never store the names of past individual recipients from the filings.",
    ],
    page: { href: "/for/students", label: "What it does for students, step by step" },
  },
  {
    id: "consultants",
    name: "Grant consultants",
    heading: "For the consultant with six clients and one week.",
    problem: [
      "A freelance grant writer serving several small organizations spends the first hours of every engagement on the same work: collecting each client's facts, rebuilding a funder list, and checking which deadlines are real.",
      "Those hours are hard to bill to a small client and easy to get wrong when one client's numbers end up in another's draft.",
    ],
    helps: [
      `One ${PRODUCT_NAME} login switches between organizations. Each client is its own workspace with its own facts, matches, pipeline, and calendar.`,
      "Drafts cite only the facts of the organization you are working in, so one client's numbers cannot end up in another's proposal.",
      "Your client confirms their own facts if you invite them, which saves a round of email.",
      "Word export lets you finish in your own template.",
    ],
    limits: [
      "You switch between clients one at a time.",
      "Each workspace has its own monthly allowance of AI work.",
      "It does not replace your judgment about which funders are worth a client's time. It gives you a faster first pass.",
    ],
    page: forNonprofits,
  },
  {
    id: "fiscal-sponsors",
    name: "Fiscal sponsors",
    heading: "For the sponsor holding the paperwork for a dozen projects.",
    problem: [
      "A fiscal sponsor lends its 501(c)(3) status to projects that are too small or too new to have their own. Each project needs grants. Most have nobody who has written one, and the sponsor's staff cannot write for all of them.",
    ],
    helps: [
      "Each sponsored project can have its own workspace with its own facts, so drafts describe the project and not the sponsor.",
      "Sponsor staff can switch between projects from one login to see what each one is applying for and when.",
      "Every draft and email waits for approval, so a sponsor can review before anything goes to a funder under its name.",
    ],
    limits: [
      "Each project is set up as its own organization. There is no single view across all your projects yet.",
      "Eligibility checks read the project's facts. When a funder requires the sponsor to be the applicant, check that rule yourself.",
      "To set up a cohort of projects at once, write to us.",
    ],
    page: forNonprofits,
  },
];
