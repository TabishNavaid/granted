import { PRODUCT_NAME } from "@/lib/brand";
import type { Shot, Spec } from "./product";

/**
 * Copy for the four audience pages under /for. Plain text only. Every claim
 * has to match what the product does today for that kind of applicant;
 * anything not built yet belongs on /roadmap instead.
 */

export type AudienceSlug = "nonprofits" | "architecture-and-construction" | "research" | "students";

export type AudienceStep = { title: string; body: string; shot?: Shot };

export type AudiencePage = {
  slug: AudienceSlug;
  /** Short name for breadcrumbs, nav, and lists. */
  name: string;
  /** Link text that says where the link goes. */
  linkLabel: string;
  /** The page headline. */
  title: string;
  lead: string;
  /** One or two sentences for the home page and lists of audiences. */
  summary: string;
  metaTitle: string;
  metaDescription: string;
  problem: { heading: string; body: string[] };
  steps: AudienceStep[];
  never: string[];
  needs: Spec[];
  /** Short notes on coverage and limits, shown under what it needs. */
  goodToKnow: string[];
  /** What the demo shows for this kind of applicant. */
  demo: string;
  signUpLabel: string;
  demoLabel: string;
  closing: { title: string; lead: string; note?: string };
};

const demoFree = "It costs nothing and needs no account.";

export const audiencePages: AudiencePage[] = [
  {
    slug: "architecture-and-construction",
    name: "Architecture and construction",
    linkLabel: "What it does for architecture and construction firms",
    title: "Public bids, read line by line and drafted from your records.",
    lead: `For architecture, engineering, and construction firms. ${PRODUCT_NAME} finds solicitations that fit your NAICS codes and region, turns each RFP into a compliance matrix with the page behind every requirement, gives a go/no-go with reasons, and drafts the proposal and the SF 330 from your own projects and people. You price it, sign it, and submit it.`,
    summary: "Federal, state, and city solicitations in one search, a compliance matrix with the page behind every requirement, go/no-go with reasons, and proposals and SF 330s built from your own records.",
    metaTitle: "For architecture and construction firms",
    metaDescription: `How ${PRODUCT_NAME} helps architecture, engineering, and construction firms: solicitations from SAM.gov and public bid portals, a compliance matrix with sources, go/no-go with reasons, and the SF 330 and proposals from your own records. It never prices, signs, or submits.`,
    problem: {
      heading: "The requirements are scattered, and the people who know the projects are on site.",
      body: [
        "A firm wins most of its public work through proposals. The solicitations sit on SAM.gov, a state portal, a city's bid page, and the agency's own site. Each one spreads its requirements across sections, attachments, and forms, and a missed one can sink the bid before anyone reads the approach.",
        "The marketing lead rebuilds the same résumés and project sheets for every SF 330. The decision to pursue gets made late, because nobody had time to read the whole package. Then an addendum moves the date.",
      ],
    },
    steps: [
      {
        title: "Keep your firm's records once",
        body: "The company profile (NAICS codes, sectors, states, UEI, bonding, insurance, safety record, staff by discipline, hourly rates), the project portfolio, key personnel with their registrations, and the certifications you hold: small business, SDVOSB, WOSB, 8(a), HUBZone, MBE, WBE, DBE, and your licenses. Every proposal is built from these.",
        shot: {
          name: "firm-records",
          alt: "The firm's records, open on the list of portfolio projects.",
          caption: "Firm records, on demo data. Projects, people, and credentials in one place.",
        },
      },
      {
        title: "Find solicitations that fit",
        body: "One search covers federal contract opportunities from SAM.gov, open bids from state and city portals that publish open data (New York City, Los Angeles, San Francisco, Texas DOT highway lettings, Delaware, Montgomery County in Maryland, and the Illinois Capital Development Board), and international public tenders. Save a search by NAICS code, region, and set-aside. Each result has a fit score with plain reasons, and a link to the official notice.",
        shot: {
          name: "firm-opportunities",
          alt: "The bids tab: the firm's own bids, and SAM.gov contract notices for its NAICS codes, each with a fit score.",
          caption: "Bids, on demo data. The SAM.gov notices are real.",
        },
      },
      {
        title: "Add any RFP, from anywhere",
        body: "Pick one from the search, upload the PDF, or paste a link or the text. A PDF is read page by page. Plain rules, not a model, find the requirements (shall, must, submit, include), evaluation factors, dates, forms such as the SF 330, SF 1442, and bid bond, page limits, set-aside, NAICS, and bonding.",
      },
      {
        title: "Go or no-go, with the reasons",
        body: "The score weighs fit with your past projects, key people for the roles named, required certifications and licenses, location, capacity, bonding, set-aside fit, competition signals such as an incumbent, and time to respond. A stopper, such as a set-aside you do not hold, bonding above your limit, or a passed deadline, turns it to no-go. The call is yours.",
        shot: {
          name: "bid-decide",
          alt: "The go/no-go screen: a score of 98, with a bar for each factor.",
          caption: "Go/no-go, on demo data. The decision stays with the firm.",
        },
      },
      {
        title: "A compliance matrix that stays current",
        body: "Every requirement becomes a row: the sentence it comes from, the section and page, the proposal section that answers it, and its status. The matrix is rechecked from the draft each time. Add an addendum and it reads what changed. A new due date moves the deadline and replans the milestones, and the matrix tracks acknowledging each addendum.",
        shot: {
          name: "bid-matrix",
          alt: "The compliance matrix: each requirement, where it is set in the solicitation, the proposal section that answers it, and its status.",
          caption: "The compliance matrix, on demo data.",
        },
      },
      {
        title: "A draft built from your records",
        body: "Relevant past projects chosen from your portfolio, key personnel résumés, references, a schedule from the solicitation's dates, and quality and safety from your own plan and safety record. The cover letter, firm qualifications, and approach are written from the same records. Every claim cites a record. Anything missing becomes a question.",
        shot: {
          name: "bid-draft",
          alt: "The bid proposal editor: drafted sections with citation chips that point to the firm's records.",
          caption: "A bid draft, on demo data. Each chip opens the record it cites.",
        },
      },
      {
        title: "The SF 330 from the same records",
        body: "Part I, sections A to I, and Part II, built from your records and previewed on screen. Export it to Word and move it into the official form. It lists what you still have to supply.",
        shot: {
          name: "bid-sf330",
          alt: "The SF 330 preview: key personnel résumés, example projects, the participation matrix, and a button to download a Word copy.",
          caption: "The SF 330 preview, on demo data.",
        },
      },
      {
        title: "A fee proposal with your numbers",
        body: "The structure: phases, roles, expenses, and what the solicitation says about price, with the arithmetic done on the numbers you enter. It never fills in hours or a price. The only numbers it fills in are the hourly rates from your own records. For SF 330 work under the Brooks Act, it notes that price is negotiated after selection.",
        shot: {
          name: "bid-fee",
          alt: "The fee proposal table, with phases and roles and the hours and rates for the firm to fill in.",
          caption: "The fee proposal, on demo data. The numbers are the firm's to enter.",
        },
      },
      {
        title: "Deadlines, the pipeline, and what you win",
        body: "The solicitation's dates go on the calendar with a plan worked back from the due date: go/no-go, questions to the contracting officer, draft, principal review, sign forms, submit. Bids move through Found, Go/no-go, Preparing, Submitted, Shortlisted, Interview, Won, and Lost. Win analytics shows results by client, sector, and project size, and leaves a no-go out of the win rate.",
        shot: {
          name: "firm-pipeline",
          alt: "The bid pipeline board, with columns for each stage from Found to Won and Lost.",
          caption: "The bid pipeline, on demo data.",
        },
      },
    ],
    never: [
      "Submit a bid. You submit it.",
      "Sign anything. Forms, certifications, and the bid are signed by you.",
      "Set a price, or fill in hours.",
      "Invent a project, a person, a license, or a number. A missing record becomes a question.",
      "Make the go or no-go decision. It gives a score and the reasons, and the call is yours.",
      "Contact an agency, an owner, or a contracting officer for you.",
    ],
    needs: [
      { label: "Your company profile", body: "NAICS codes, sectors, states, UEI, bonding, insurance, safety record, staff by discipline, and hourly rates." },
      { label: "Projects and people", body: "The project portfolio, key personnel with their registrations, and the certifications and licenses you hold." },
      { label: "The solicitation", body: "Pick it from the search, or add a link, the PDF, or the text. Add each addendum as it comes in." },
      { label: "Your numbers", body: "Hours and prices on the fee proposal. It does the arithmetic, not the pricing." },
      { label: "The decision and the signatures", body: "You decide go or no-go, sign the forms, and submit the bid." },
    ],
    goodToKnow: [
      "State and local coverage is uneven. Many state e-procurement portals do not allow automated reading or publish no open feed, so seven portals are covered today, with more added where their terms allow. Any RFP can be uploaded or linked.",
      "SAM.gov notices update at least once a day. Confirm the latest amendment on SAM.gov before you submit.",
      "The SF 330 export is a Word working copy. Move it into the official form before you submit.",
      "Grants a for-profit firm can get are rare. They sit on a separate tab from bids, and it says when there are few.",
    ],
    demo: `The demo includes a fictional architecture and engineering firm in San Antonio, clearly labeled, and replays recorded runs. The SAM.gov notices and the sample VA solicitation are real. ${demoFree}`,
    signUpLabel: "Set up my firm",
    demoLabel: "Try the demo with a sample firm",
    closing: {
      title: "Try it on a sample firm and a real solicitation.",
      lead: "Add the sample VA solicitation, read the matrix and the go/no-go score, and open the SF 330 preview.",
      note: "Free during early access, with no card.",
    },
  },
  {
    slug: "nonprofits",
    name: "Nonprofits",
    linkLabel: "What it does for nonprofits",
    title: "Grants for the director who writes them after hours.",
    lead: `${PRODUCT_NAME} reads your website and documents, finds federal grants and private foundations you can apply to, drafts the letter or proposal from facts you confirmed, and plans every deadline backward. You approve each step. Nothing is sent or submitted without you.`,
    summary: "Federal grants and private foundations in every state, drafts with a source on every claim, and deadlines planned backward.",
    metaTitle: "For nonprofits",
    metaDescription: `How ${PRODUCT_NAME} helps a small nonprofit: federal grants from Grants.gov, private foundations in every state from IRS filings, drafts that cite your own documents, deadlines planned backward, and nothing sent without you.`,
    problem: {
      heading: "There is money to apply for, and no hours to apply for it.",
      body: [
        "A food pantry, a youth program, or a rural clinic with a budget under half a million dollars rarely has anyone whose job is grants. The director runs programs, payroll, and the board packet, then writes proposals at night.",
        "The funder list is a spreadsheet from three years ago. The facts a funder asks for are spread across the website, last year's annual report, the 990, and someone's memory. Half the deadlines on the list may have moved.",
      ],
    },
    steps: [
      {
        title: "Paste your website, add your documents",
        body: "It reads your public pages and the documents you add, such as the annual report, your 990, an old proposal, or a budget. It writes down the facts a funder asks for: your mission, programs, who you serve, where, and what changed for them. It keeps a fact only when the passage it quotes is really in the source.",
        shot: {
          name: "reading",
          alt: "Setup reading a website: each page read, then each fact written down with the passage it came from, and the ones the source check set aside.",
          caption: "Reading a website, on demo data. Every fact keeps the passage it came from.",
        },
      },
      {
        title: "Check each fact",
        body: "Each fact sits beside the sentence it came from, with a link to the page. Confirm it, edit it, or reject it. Only confirmed facts are used in a match or a draft.",
        shot: {
          name: "profile",
          alt: "The confirm screen: facts about the organization, each with the passage and link it came from.",
          caption: "Checking facts, on demo data.",
        },
      },
      {
        title: "See grants you can apply for",
        body: "It searches federal grant notices and forecasts from Grants.gov, and the IRS 990-PF filings of private foundations in every state that paid grants. A foundation match shows whether it accepts unsolicited applications, its typical grant size, and where it gives. Each match gets a fit score from 0 to 100, and every reason names one of your facts and the line it relies on.",
        shot: {
          name: "opportunities",
          alt: "The opportunities list: matches ranked by fit, each with a score, a deadline, an award range, and its reasons.",
          caption: "Matches, on demo data. Federal notices and foundations in one list.",
        },
      },
      {
        title: "Read a draft with its sources",
        body: "Choose a letter of inquiry or a full proposal. Every claim cites a fact you confirmed. A missing fact becomes a marked gap and a question in the side panel. Code checks each citation and each number, a reviewer check lists what a program officer might find weak, and the budget builder lays out line items from your numbers. Export to Word or PDF when it is right.",
        shot: {
          name: "workspace",
          alt: "The proposal workspace: a drafted letter with citation markers, a checklist, and open questions on the right.",
          caption: "A draft, on demo data. Citations inline, questions on the right.",
        },
      },
      {
        title: "Approve the milestones",
        body: "It proposes dates counted back from the deadline: first draft, budget sign-off, board review, submit. They go on your calendar only after you approve them, through a private calendar feed or a connected Google Calendar.",
        shot: {
          name: "calendar",
          alt: "The calendar with deadlines and milestones across a month.",
          caption: "The calendar, on demo data. Deadlines and the milestones before them.",
        },
      },
      {
        title: "Send the emails, then log what happened",
        body: "Outreach drafts questions for a program officer, cover notes, and thank-you notes for you to send from your own address. When you hear back, move the application to Won or Lost on the pipeline board. Win analytics shows what your funded applications have in common, and says when there are too few to tell.",
        shot: {
          name: "pipeline",
          alt: "The pipeline board with applications from Discovered to Won and Lost.",
          caption: "The pipeline board, on demo data.",
        },
      },
    ],
    never: [
      "Submit an application. You upload the file and click submit on the funder's portal.",
      "Send an email on its own. Every send is a click by you.",
      "Name a funder that is not in a public source.",
      "Invent a number, a quote, an outcome, or a partner. A missing fact becomes a question.",
      "Put a date on your calendar before you approve the schedule.",
      "Share your profile with funders, or sell it to anyone.",
    ],
    needs: [
      { label: "Your website", body: "The address of your public site. Add documents if you have them: an annual report, your 990, an old proposal, a budget." },
      { label: "A check of each fact", body: "Confirm, edit, or reject what it read. Only confirmed facts are used." },
      { label: "What it cannot find", body: "Your annual budget, your EIN, the counties you serve, how many people you reached last year. Skip one and it comes back later as a question, never as a guess." },
      { label: "Your review", body: "Read the funder's guidelines, check the citations, and edit the draft until it sounds like you." },
      { label: "The last step", body: "Upload the file and click submit on the funder's portal. Send each email from your own address." },
    ],
    goodToKnow: [
      "Foundation details such as how to apply and past grantees come from IRS filings that are one to two years old. Read each foundation's current guidelines before you apply.",
      "Those details are read first for the larger foundations. More smaller ones are filled in each day.",
      "Corporate giving programs and community foundation rounds are not covered yet.",
      "Grant consultants and fiscal sponsors can switch between organizations from one login, and each keeps its own facts.",
      "Drafts are in English.",
    ],
    demo: `The demo runs on three fictional nonprofits, clearly labeled, and replays recorded runs. The Grants.gov notices and the foundation filings in it are real. ${demoFree}`,
    signUpLabel: "Find my first grants",
    demoLabel: "Try the demo with a sample nonprofit",
    closing: {
      title: "Try it on a sample nonprofit first.",
      lead: "It is free during early access. There is no paid plan and no card.",
      note: "Free during early access, with no card.",
    },
  },
  {
    slug: "research",
    name: "Research teams",
    linkLabel: "What it does for research teams",
    title: "Research funding, and proposals that follow each funder's rules.",
    lead: `For university labs and small research companies. ${PRODUCT_NAME} finds NIH, NSF, and SBIR funding you can apply for, shows funded projects like yours, and drafts the proposal in the standard sections with each funder's rule on AI on the checklist.`,
    summary: "NIH, NSF, and SBIR notices with reasons, funded projects like yours, and proposals with each funder's AI rule on the checklist.",
    metaTitle: "For research teams",
    metaDescription: `How ${PRODUCT_NAME} helps university labs and small research companies: notices from the NIH Guide, NSF, SBIR.gov, and Grants.gov, funded work like yours from NSF and NIH award data, and proposals with each funder's rule on AI on the checklist.`,
    problem: {
      heading: "The proposal gets written between teaching, the lab, and everything else.",
      body: [
        "A principal investigator writes proposals between classes, students, and the research itself. Finding the right program means reading notices across several agencies and working out which program funds this kind of work, and who manages it.",
        "Every proposal repeats the same pieces: biosketches, facilities, a data management plan. And each funder now has its own rule about AI in applications, and the rules do not agree.",
      ],
    },
    steps: [
      {
        title: "A profile of the team",
        body: "It reads your lab page for investigators, publications, prior awards, facilities, and capabilities. Your team checks the profile before anything uses it.",
      },
      {
        title: "Notices you can apply for",
        body: "Funding notices from the NIH Guide, NSF, SBIR.gov, Grants.gov, and the Federal Register, each with a fit score, plain reasons, and a link to the official notice.",
      },
      {
        title: "Who funds work like yours",
        body: "Funded projects like yours from NSF and NIH award data. They show which programs fund this work, how much they awarded, and which program officers manage it.",
      },
      {
        title: "A draft in the standard sections",
        body: "Project summary, specific aims or objectives, research plan, broader impacts, biosketches, budget justification, data management and sharing plan, and facilities. Biosketches and facilities are built from your records, and every claim cites one.",
        shot: {
          name: "research-draft",
          alt: "The research proposal editor: drafted sections, with the funder's rule on AI listed on the checklist beside them.",
          caption: "A research proposal, on demo data. The funder's AI rule is on the checklist.",
        },
      },
      {
        title: "Each funder's rule on AI, with its source",
        body: "The rule sits on the checklist with a link to where it is stated. NIH does not consider applications substantially developed by AI to be original, and caps each PI at six applications a year. NSF encourages disclosure of AI use. NASA SMD wants AI use cited. At least one current DOE Office of Science notice requires disclosure. The Department of Education allows AI with a certification.",
      },
    ],
    never: [
      "Submit a proposal. You submit it, through your institution or your company.",
      "Invent a publication, a prior award, or a result. A missing detail becomes a question.",
      "Contact a program officer or a funder for you.",
      "Decide for you whether your use of AI is allowed. It shows the rule and its source, and you decide.",
    ],
    needs: [
      { label: "Your lab page", body: "The address of the page that lists your people, publications, and facilities." },
      { label: "A check of the profile", body: "Investigators, publications, prior awards, facilities, and capabilities, confirmed by someone on the team." },
      { label: "The science", body: "The aims and the plan are yours. Answer its questions and edit every section." },
      { label: "A decision on AI", body: "Read each funder's rule on the checklist, and disclose or certify the way the funder asks." },
      { label: "Submission", body: "You submit, through your institution or your company." },
    ],
    goodToKnow: [
      "NASA's own solicitation site has no feed. NASA notices posted to Grants.gov still appear.",
      "The profile is read from your lab page, and your team has to check it.",
      "Funders change their rules on AI. Read the current notice before you submit.",
    ],
    demo: `The demo includes a fictional university research lab in Toledo, clearly labeled, and replays recorded runs. The Grants.gov notices and the NSF and NIH funded projects in it are real. ${demoFree}`,
    signUpLabel: "Find funding for my lab",
    demoLabel: "Try the demo with a sample lab",
    closing: {
      title: "Try it on a sample research lab first.",
      lead: "See the notices it finds, the funded work like the lab's, and a draft with the funder's AI rule on the checklist.",
      note: "Free during early access, with no card.",
    },
  },
  {
    slug: "students",
    name: "Students",
    linkLabel: "What it does for students",
    title: "Scholarships and fellowships, and essays in your own words.",
    lead: `For students and anyone else applying on their own. ${PRODUCT_NAME} turns your résumé into a profile you check, matches you to national scholarships and fellowships and to foundations that give to individuals, and drafts each essay from your own experiences.`,
    summary: "Your résumé becomes a profile, scholarships and fellowships are matched to it, and each essay is drafted from your own experiences.",
    metaTitle: "For students",
    metaDescription: `How ${PRODUCT_NAME} helps students: a profile from your résumé, national scholarships and fellowships checked on each sponsor's page, foundations that give to individuals from IRS filings, and essays drafted from your own experiences.`,
    problem: {
      heading: "The scholarships nearby do not advertise.",
      body: [
        "Students and their families hear about the same few national scholarships, and so does everyone else applying. Small local foundations that give scholarships rarely advertise. Many take applications from only one county or one high school.",
        "Then each one asks for an essay. The details that would make it good (a job, a team, a summer project) are already on a résumé, and the deadline is next week.",
      ],
    },
    steps: [
      {
        title: "Start from your résumé",
        body: "Paste it or upload it. It becomes a profile that you check before anything uses it.",
      },
      {
        title: "Scholarships you can apply for",
        body: "About 80 national scholarships and fellowships, each checked by hand on the sponsor's own page, and private foundations in every state whose IRS 990-PF filings show grants to individuals. It skips funds limited to another county, educational loans, and foundations that mostly fund organizations.",
      },
      {
        title: "An essay in your voice",
        body: "Paste the sponsor's essay prompt. The draft is built from your own experiences, in your voice. When a detail is missing, it asks you instead of inventing one.",
        shot: {
          name: "student-essay",
          alt: "A scholarship essay drafted from a résumé, with a question where a detail is missing.",
          caption: "An essay, on demo data. A missing detail becomes a question for the student.",
        },
      },
      {
        title: "Every deadline on a calendar",
        body: "When you start an essay, the deadline and the steps before it (asking recommenders, a draft to reread, submitting) go on your calendar.",
      },
    ],
    never: [
      "Invent an experience, an award, or a number. It asks you.",
      "Submit an application or send an essay for you.",
      "Match you to a fund limited to another county, an educational loan, or a foundation that mostly funds organizations.",
      "Store the names of past individual recipients from the filings.",
    ],
    needs: [
      { label: "Your résumé", body: "Pasted or uploaded. It is where your essays start." },
      { label: "A check of your profile", body: "Fix anything it read wrong before it is used." },
      { label: "Each essay prompt", body: "Paste the sponsor's prompt for each essay you write." },
      { label: "Your answers", body: "When a detail is missing, it asks. Answer in your own words." },
      { label: "The application", body: "Check each sponsor's rules, then apply the way it asks." },
    ],
    goodToKnow: [
      "Scholarship deadlines come from each sponsor's page, and some sponsors have not posted this year's date yet. When a date is missing, check the sponsor's page.",
      "Foundation instructions come from IRS filings that are one to two years old, and many local scholarships are limited to one school or county. Check with the foundation before you apply.",
      "College, employer, and federal student aid are not included.",
    ],
    demo: `The demo includes a fictional high school senior in Dayton, clearly labeled, and replays recorded runs. The foundation filings in it are real. ${demoFree}`,
    signUpLabel: "Find my first scholarships",
    demoLabel: "Try the demo with a sample student",
    closing: {
      title: "Try it with a sample student first.",
      lead: "See the scholarships it finds for a senior in Dayton, and an essay drafted from the senior's résumé.",
      note: "Free during early access, with no card.",
    },
  },
];

export function audiencePage(slug: AudienceSlug): AudiencePage {
  const a = audiencePages.find((x) => x.slug === slug);
  if (!a) throw new Error(`No audience page called ${slug}`);
  return a;
}
