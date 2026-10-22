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
    id: "nonprofits",
    name: "Small nonprofits",
    heading: "For the director who writes grants after hours.",
    problem: [
      "A food pantry, a youth program, or a rural clinic with a budget under half a million dollars rarely has anyone whose job is grants. The director does programs, payroll, and the board packet, then writes proposals at night.",
      "The funder list is a spreadsheet from three years ago. The facts a funder asks for are spread across the website, last year's annual report, and someone's memory. Half the deadlines on the list may have changed.",
    ],
    helps: [
      "It reads your website and documents once and keeps the facts you confirm, so you stop retyping your mission and your numbers.",
      "It finds federal notices you can apply for and, in Ohio, Kentucky, and North Carolina, private foundations that give to work like yours.",
      "It drafts the letter or proposal with a citation on every claim, and asks you for what is missing.",
      "It plans the milestones back from each deadline and puts them on the calendar you already use.",
      "It is free during early access: no paid plan and no card.",
    ],
    limits: [
      "Foundation data covers Ohio, Kentucky, and North Carolina only. Elsewhere you get federal matches, drafting, and deadlines, but few foundation matches.",
      "Corporate giving programs and community foundation portals are not covered yet.",
      "Reminder emails and the weekly digest send once email is set up by whoever runs the service. The demo shows what would go out instead.",
      "Drafts are in English.",
    ],
    page: forNonprofits,
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
      `Consultant mode switches between organizations from one ${PRODUCT_NAME} login. Each client is its own workspace with its own facts, matches, pipeline, and calendar.`,
      "Drafts cite only the facts of the organization you are working in, so one client's numbers cannot end up in another's proposal.",
      "Your client confirms their own facts if you invite them, which saves a round of email.",
      "DOCX export lets you finish in your own template.",
    ],
    limits: [
      "Clients outside Ohio, Kentucky, and North Carolina get federal matches and drafting, but few foundation matches.",
      "You switch between clients one at a time.",
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
      "Seats for a cohort of projects are arranged by writing to us.",
    ],
    page: forNonprofits,
  },
  {
    id: "firms",
    name: "Architecture and construction firms",
    heading: "For the firm that wins its work by proposal.",
    problem: [
      "Architecture, engineering, and construction firms win most of their work through proposals. Each solicitation spreads its requirements across sections, attachments, and forms, and the people who know the projects are busy billing on them. The same résumés and project sheets get rebuilt for every SF 330.",
    ],
    helps: [
      "It reads an RFP from a link, a PDF, or pasted text, and finds the requirements, evaluation factors, dates, forms, page limits, set-aside, NAICS, and bonding. A PDF is read page by page, so every requirement cites its page.",
      "A compliance matrix shows every requirement, where it is set, which section answers it, and its status. It is rechecked from the draft each time.",
      "A go/no-go score gives plain reasons, and a stopper such as a set-aside you do not hold turns it to no-go. The decision is yours.",
      "The proposal and the SF 330 are built from your own projects, people, and credentials. Every claim cites a record, and anything missing becomes a question.",
    ],
    limits: [
      "SAM.gov notices need your own free SAM.gov key. Without it, SAM.gov shows as not connected. Adding an RFP needs no key.",
      "The cover letter, firm qualifications, and approach need a model key. Without one, the approach is an outline of what the solicitation asks.",
      "The SF 330 is a Word working copy to move into the official form.",
      "It never makes up hours, rates, or prices, and never signs or submits a bid.",
      "Grants a for-profit firm can get are rare, and it says so.",
    ],
    page: { href: "/for/architecture-and-construction", label: "What it does for architecture and construction firms, step by step" },
  },
  {
    id: "research",
    name: "Research teams",
    heading: "For the lab writing proposals between classes and experiments.",
    problem: [
      "University labs and small research companies repeat the same pieces in every proposal: biosketches, facilities, a data management plan. Finding the right program means working out who funds this kind of work, and each funder now has its own rule about AI in applications.",
    ],
    helps: [
      "It finds research funding notices on Grants.gov that are open to universities, with plain reasons.",
      "It shows funded projects like yours from the NSF Award Search and NIH RePORTER: which programs fund this work and which program officers manage it.",
      "It drafts in the standard sections, with biosketches and facilities built from your records.",
      "Each funder's rule on AI is on the checklist, with its source.",
    ],
    limits: [
      "SBIR and STTR notices come through Grants.gov. There is no direct SBIR.gov feed.",
      "The profile is read from your lab page, and your team has to check it.",
      "Funders change their rules on AI. Read the current notice before you submit.",
    ],
    page: { href: "/for/research", label: "What it does for research teams, step by step" },
  },
  {
    id: "scholarships",
    name: "Scholarship seekers",
    heading: "For students looking past the same national scholarships.",
    problem: [
      "Students and their families hear about the same few national scholarships, and so does everyone else applying. Small local foundations that give scholarships rarely advertise. Many only take applications from one county or one high school.",
    ],
    helps: [
      "Scholarship mode matches an individual to private foundations whose 990-PF filings show scholarship grants.",
      "Each match shows where past recipients were and the application instructions as the foundation filed them.",
      "The deadline calendar and milestones work the same way as for organizations.",
    ],
    limits: [
      "It covers foundations in Ohio, Kentucky, and North Carolina only, for now.",
      "It finds only foundations that report scholarship grants on their filings. College, employer, and federal aid are not included.",
      "Many of these scholarships are limited to one school or county, and filed instructions can be out of date. Check with the foundation before applying.",
      "We never store the names of past individual recipients from the filings.",
    ],
    page: { href: "/for/students", label: "What it does for students, step by step" },
  },
];
