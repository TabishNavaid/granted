import { PRODUCT_NAME } from "@/lib/brand";
import type { FaqItem } from "./site";

/**
 * The longer FAQ on /about. The home page uses the shorter `faq` in
 * site.ts; keep the two consistent when either changes. Square brackets
 * mark details the founders fill in.
 */
export const fullFaq: { group: string; items: FaqItem[] }[] = [
  {
    group: "Where the information comes from",
    items: [
      {
        q: "Where does the data come from?",
        a: `Two places. Opportunities come only from official public sources, read on a schedule: Grants.gov, SAM.gov contract opportunities and assistance listings, the Federal Register, the NIH Guide, NSF, SBIR.gov, bid portals published as open data by states and cities, IRS Form 990-PF filings for private foundations in every state, international public tenders, and national scholarships checked by hand on each sponsor's page. The Data page lists every source with its license and a link. Facts about you come only from your website and the documents you add, and you confirm each one.`,
      },
      {
        q: "How current is it?",
        a: "Grants.gov and SAM.gov are read every day, and other sources on the schedule shown on the Data page. Each notice shows its link and the date we last checked it. Foundation details come from IRS filings that are one to two years old, and each figure shows the tax year it came from, so read a foundation's current guidelines before you apply. Scholarship deadlines come from sponsor pages, and some sponsors have not posted this year's date yet.",
      },
      {
        q: "We are a construction or design firm. Will it find our bids?",
        a: "It finds federal solicitations on SAM.gov by NAICS code, set-aside, and place of performance, and open bids from the state and city portals that publish them as open data: New York City, Los Angeles, San Francisco, Texas DOT highway lettings, Delaware, Montgomery County in Maryland, and the Illinois Capital Development Board. Many state portals do not allow automated reading, so coverage is uneven by state. Any RFP you find elsewhere can be uploaded or linked, and it gets the same compliance matrix, go/no-go, and SF 330.",
      },
      {
        q: "What is not covered?",
        a: "Many state and local e-procurement portals, because they do not allow automated reading or publish no open feed. NASA's own solicitation site, which has no feed, though NASA notices posted to Grants.gov still appear. Corporate giving programs and community foundation rounds. College, employer, and federal student aid.",
      },
    ],
  },
  {
    group: "Accuracy and AI",
    items: [
      {
        q: "Does it make things up?",
        a: `It is built not to. ${PRODUCT_NAME} never names a funder, a deadline, or an amount from memory: each one comes from a source record with a link. It keeps a fact about you only when the passage it quotes is in your source, and every claim in a draft cites one of those facts. A missing fact becomes a question for you, not a plausible number. Code checks every citation and number after drafting. A model can still misread a source, so check the citations before you submit anything.`,
      },
      {
        q: "Will funders know AI helped, and do we have to say so?",
        a: "It depends on the funder. NIH and some foundations ask about AI use, other agencies differ, and policies change. We show a funder's AI rule on the checklist when we have it, with its source. You are responsible for reading the guidelines. You edit and approve every draft, so you are the author.",
      },
      {
        q: "What if a draft is wrong or does not sound like us?",
        a: "Edit it, or say what is off and ask for another pass. More of your own material gets closer to your voice, and a short voice note in your profile helps. A wrong fact is a bug. Send it to us with the citation so we can fix how it was read.",
      },
    ],
  },
  {
    group: "What it does and does not do",
    items: [
      {
        q: "Does it send email or submit applications for us?",
        a: "No. It drafts and you act. Applications export to Word or PDF, and the SF 330 to Word, for you to submit on the funder's or agency's portal. Emails open in your own mail app. If you connect Gmail or Outlook, an email goes out only when you press Send. Social posts are drafts you copy. It never posts.",
      },
      {
        q: "Does it price a bid?",
        a: "No. The fee proposal lays out phases, roles, and expenses and does the arithmetic on the numbers you enter. The only numbers it fills in are the hourly rates from your own records. Hours and the price are yours.",
      },
      {
        q: "What is the demo, and what is it not?",
        a: "The demo runs on fictional sample workspaces (nonprofits, an architecture and engineering firm, a university lab, and a student) with recorded runs, and every screen is labeled as demo data. The public notices and filings in it are real. You can click through setup, matches, drafts, and the calendar with no account. Nothing you do there is sent anywhere.",
      },
      {
        q: "Does it help with scholarships?",
        a: "Yes. It matches a student to about 80 national scholarships and fellowships checked by hand on each sponsor's page, and to private foundations in every state whose filings show grants to individuals. Essays are drafted from the student's own experiences, and it asks instead of inventing.",
      },
      {
        q: "Can a grant consultant use it for several clients?",
        a: "Yes. One login switches between organizations. Each client is its own workspace with its own facts, so one client's numbers never appear in another's draft.",
      },
      {
        q: "Does it work for fiscal sponsors?",
        a: "Each sponsored project can be set up as its own organization, and sponsor staff can switch between them. When a funder requires the sponsor to be the applicant, check that rule yourself. To set up a cohort of projects at once, write to us.",
      },
    ],
  },
  {
    group: "Data, cost, and the people behind it",
    items: [
      {
        q: "Who sees our data, and does anyone train on it?",
        a: "The people you invite. Data is stored in a Postgres database in the United States, with database rules that keep one workspace from reading another. Drafting uses Google's Gemini API on its paid tier, where Google does not use prompts or outputs to train its models. We do not train models on your documents, and we do not sell your data. The Security page has the details.",
      },
      {
        q: "What does it cost?",
        a: "Nothing during early access. There is no paid plan and no card. Each workspace has a monthly allowance of AI work, 50 drafts and 400 other AI steps, which covers what the model costs us. Searching the opportunity database never counts.",
      },
      {
        q: "How do we leave, and can we take our work with us?",
        a: "Delete your workspace from settings at any time. Before you do, export drafts to Word or PDF, and your calendar feed works in any calendar app. Deleting your workspace removes your profile, documents, drafts, matches, and logs.",
      },
      {
        q: "Who is behind it?",
        a: `${PRODUCT_NAME} is built by [Name] and [Name], [one line on their background]. We are building it with [number] early users. You can write to us at [founders@yourdomain].`,
      },
    ],
  },
];
