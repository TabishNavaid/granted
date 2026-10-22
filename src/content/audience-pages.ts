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
  /** One small watercolor plant beside the headline. */
  plant: string;
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
    slug: "nonprofits",
    name: "Nonprofits",
    linkLabel: "What it does for nonprofits",
    title: "Grants for the director who writes them after hours.",
    lead: `${PRODUCT_NAME} reads your website once, finds grants you can apply for, drafts the letter or proposal from facts you confirmed, and plans every deadline. You approve each step. Nothing is sent or submitted without you.`,
    summary: "Federal grants and private foundations you can apply for, drafts with a source on every claim, and deadlines planned backward.",
    metaTitle: "For nonprofits",
    metaDescription: `How ${PRODUCT_NAME} helps a small nonprofit: grants from Grants.gov and foundation filings, drafts that cite your own facts, deadlines planned backward, and nothing sent without you.`,
    plant: "harebell",
    problem: {
      heading: "There is money to apply for, and no hours to apply for it.",
      body: [
        "A food pantry, a youth program, or a rural clinic with a budget under half a million dollars rarely has anyone whose job is grants. The director runs programs, payroll, and the board packet, then writes proposals at night.",
        "The funder list is a spreadsheet from three years ago. The facts a funder asks for are spread across the website, last year's annual report, and someone's memory. A grant writer costs more each month than most small organizations can spare.",
      ],
    },
    steps: [
      {
        title: "Paste your website",
        body: "It reads your public pages and writes down the facts a funder asks for: your mission, programs, who you serve, where, and what changed for them. It keeps a fact only when the passage it quotes is really on the page. You can add an annual report, an old proposal, or a budget.",
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
        body: "It searches open and forecast notices on Grants.gov that list nonprofits as eligible, and the 990-PF filings of a few hundred private foundations in Ohio, Kentucky, and North Carolina. Each match gets a fit score from 0 to 100, and every reason names one of your facts and the line it relies on.",
        shot: {
          name: "opportunities",
          alt: "The opportunities list: matches ranked by fit, each with a score, a deadline, an award range, and its reasons.",
          caption: "Matches, on demo data. Federal notices and foundations in one list.",
        },
      },
      {
        title: "Read a draft with its sources",
        body: "Choose a one-page letter of inquiry or a full proposal. Every claim cites a fact you confirmed. A missing fact becomes a marked gap and a question in the side panel. Code checks each citation and each number before you see it, and you export DOCX or PDF when it is right.",
        shot: {
          name: "workspace",
          alt: "The proposal workspace: a drafted letter with citation markers, a checklist, and open questions on the right.",
          caption: "A draft, on demo data. Citations inline, questions on the right.",
        },
      },
      {
        title: "Approve the milestones",
        body: "It proposes dates counted back from the deadline: first draft, budget sign-off, board review, submit. They go on your calendar only after you approve them, through a private calendar feed, or Google Calendar where that connection is set up.",
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
      "Name a funder that is not in Grants.gov or the IRS filings.",
      "Invent a number, a quote, an outcome, or a partner. A missing fact becomes a question.",
      "Put a date on your calendar before you approve the schedule.",
      "Share your profile with funders, or sell it to anyone.",
    ],
    needs: [
      { label: "Your website", body: "The address of your public site. Add documents if you have them: an annual report, an old proposal, a budget." },
      { label: "A check of each fact", body: "Confirm, edit, or reject what it read. Only confirmed facts are used." },
      { label: "What it cannot find", body: "Your annual budget, your EIN, the counties you serve, how many people you reached last year. Skip one and it comes back later as a question, never as a guess." },
      { label: "Your review", body: "Read the funder's guidelines, check the citations, and edit the draft until it sounds like you." },
      { label: "The last step", body: "Upload the file and click submit on the funder's portal. Send each email from your own address." },
    ],
    goodToKnow: [
      "Foundation data covers Ohio, Kentucky, and North Carolina for now. Elsewhere you get federal matches, drafting, and deadlines, but few foundation matches.",
      "Grant consultants can switch between client organizations from one login, and each client keeps its own facts.",
      "Drafts are in English.",
    ],
    demo: `The demo runs on three fictional nonprofits and replays recorded runs. The Grants.gov notices and the foundation filings in it are real. ${demoFree}`,
    signUpLabel: "Find my first grants",
    demoLabel: "Try the demo with a sample nonprofit",
    closing: {
      title: "Try it on a sample nonprofit first.",
      lead: "It is free during early access: no paid plan and no card.",
      note: "Free to start, with no card.",
    },
  },
  {
    slug: "architecture-and-construction",
    name: "Architecture and construction",
    linkLabel: "What it does for architecture and construction firms",
    title: "Proposals for firms that win their work by bidding.",
    lead: `For architecture, engineering, and construction firms. ${PRODUCT_NAME} reads the solicitation, builds the compliance matrix, scores go or no-go with plain reasons, and drafts the proposal and the SF 330 from your own projects and people. You decide, price, sign, and submit.`,
    summary: "RFPs read page by page, a compliance matrix, a go/no-go score with reasons, and proposals and SF 330s built from your own projects and people.",
    metaTitle: "For architecture and construction firms",
    metaDescription: `How ${PRODUCT_NAME} helps architecture, engineering, and construction firms: RFPs read page by page, a compliance matrix, go/no-go with reasons, SF 330 and proposals from your own records. It never prices, signs, or submits.`,
    plant: "yarrow",
    problem: {
      heading: "The requirements are scattered, and the people who know the projects are billing.",
      body: [
        "A firm wins most of its work through proposals. Each solicitation spreads its requirements across sections, attachments, and forms. Miss one and the bid can be set aside before anyone reads the approach.",
        "The marketing lead rebuilds the same résumés and project sheets for every SF 330. The decision to pursue is made late, on a hunch, because nobody had time to read the whole thing. Then an addendum moves the date.",
      ],
    },
    steps: [
      {
        title: "Keep your firm's records once",
        body: "The company profile (NAICS codes, sectors, states, UEI, bonding, insurance, safety record, staff by discipline, hourly rates), the project portfolio, key personnel with their registrations, and the certifications you hold: small business, SDVOSB, WOSB, 8(a), HUBZone, MBE, WBE, DBE, and your licenses and registrations. Every proposal is built from these.",
        shot: {
          name: "firm-records",
          alt: "The firm's records, open on the list of portfolio projects.",
          caption: "Firm records, on demo data. Projects, people, and credentials in one place.",
        },
      },
      {
        title: "Add the RFP you have, or find one",
        body: "Paste a link, upload the PDF, or paste the text. A PDF is read page by page, so every requirement cites its page. Reading needs no AI: plain rules find the requirements (shall, must, submit, include), evaluation factors, dates, forms such as the SF 330, SF 1442, and bid bond, page limits, set-aside, NAICS, and bonding. With your own free SAM.gov key, it also lists contract opportunities for your NAICS codes with a plain fit score.",
        shot: {
          name: "firm-opportunities",
          alt: "The bids tab: the firm's own bids, and SAM.gov contract notices for its NAICS codes, each with a fit score.",
          caption: "Bids, on demo data. The SAM.gov notices are real.",
        },
      },
      {
        title: "Go or no-go, with the reasons",
        body: "The score weighs fit with your past projects, key people for the roles named, required certifications and state licenses, location, capacity, competition signals (set-aside, multiple awards, an incumbent), time to respond, and bonding. A stopper, such as a set-aside you do not hold, bonding above your limit, or a passed deadline, turns it to no-go. The decision is yours.",
        shot: {
          name: "bid-decide",
          alt: "The go/no-go screen: a score of 98, with a bar for each factor.",
          caption: "Go/no-go, on demo data. The decision stays with the firm.",
        },
      },
      {
        title: "A compliance matrix that stays current",
        body: "Every requirement, the sentence it comes from, where it is set (section and page), which proposal section answers it, and its status: met, partly, open, or a step for you when you assemble the package. It is rechecked from the draft each time. Add each addendum and it reads what changed. A new due date moves the deadline and replans the calendar, and the matrix tracks acknowledging each addendum.",
        shot: {
          name: "bid-matrix",
          alt: "The compliance matrix: each requirement, where it is set in the solicitation, the proposal section that answers it, and its status.",
          caption: "The compliance matrix, on demo data.",
        },
      },
      {
        title: "A draft built from your records",
        body: "Relevant past projects chosen from your portfolio, key personnel résumés, references, a schedule from the solicitation's dates, and quality and safety from your own plan and safety record. The cover letter, firm qualifications, and approach are written from them with a model key. Without one, the approach is an outline of what the solicitation asks. Every claim cites a record. Anything missing becomes a question.",
        shot: {
          name: "bid-draft",
          alt: "The bid proposal editor: drafted sections with citation chips that point to the firm's records.",
          caption: "A bid draft, on demo data. Each chip opens the record it cites.",
        },
      },
      {
        title: "The SF 330 from the same records",
        body: "Part I, sections A to I, and Part II, built from your records and previewed on screen. Download it as a Word working copy to move into the official form. It lists what you still have to supply.",
        shot: {
          name: "bid-sf330",
          alt: "The SF 330 preview: key personnel résumés, example projects, the participation matrix, and a button to download a Word copy.",
          caption: "The SF 330 preview, on demo data.",
        },
      },
      {
        title: "A fee proposal with your numbers",
        body: "The structure: phases, roles, expenses, and what the solicitation says about price, with the arithmetic done on the numbers you enter. It never makes up hours, rates, or prices; the only numbers filled in are the hourly rates from your own records. For SF 330 work under the Brooks Act, it says price is negotiated after selection.",
        shot: {
          name: "bid-fee",
          alt: "The fee proposal table, with phases and roles and the hours and rates for the firm to fill in.",
          caption: "The fee proposal, on demo data. The numbers are the firm's to enter.",
        },
      },
      {
        title: "Deadlines and the pipeline",
        body: "The solicitation's dates go on the calendar with a plan worked back from the due date: decide go or no-go, send questions, draft, principal review, sign forms, submit. Bids move through Found, Go/no-go, Preparing, Submitted, Shortlisted, Interview, Won, and Lost. Win analytics shows results by client, sector, and project size, and leaves a no-go out of the win rate.",
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
      "Set a price, or fill in hours or rates.",
      "Invent a project, a person, a license, or a number. A missing record becomes a question.",
      "Make the go or no-go decision. It gives a score and the reasons, and the call is yours.",
    ],
    needs: [
      { label: "Your company profile", body: "NAICS codes, sectors, states, UEI, bonding, insurance, safety record, staff by discipline, and hourly rates." },
      { label: "Projects and people", body: "The project portfolio, key personnel with their registrations, and the certifications and licenses you hold." },
      { label: "The solicitation", body: "A link, the PDF, or the text. Add each addendum as it comes in." },
      { label: "Your numbers", body: "Hours, rates, and prices on the fee proposal. It does the arithmetic, not the pricing." },
      { label: "A free SAM.gov key, for notices", body: "SAM.gov's public API is free with your own key. Without it, SAM.gov shows as not connected. Adding an RFP needs no key." },
      { label: "The decision and the signatures", body: "You decide go or no-go, sign the forms, and submit the bid." },
    ],
    goodToKnow: [
      "The cover letter, firm qualifications, and approach need a model key. Without one, the approach is an outline of what the solicitation asks, and the sections built from records still work.",
      "The SF 330 download is a Word working copy. Move it into the official form before you submit.",
      "Grants and incentives a for-profit firm can get, such as energy efficiency, workforce training, and small business innovation, are on a separate tab from bids. They are rare, and it says so.",
    ],
    demo: `The demo includes a fictional architecture and engineering firm in San Antonio and replays recorded runs. The SAM.gov notices and the sample VA solicitation are real. ${demoFree}`,
    signUpLabel: "Set up my firm",
    demoLabel: "Try the demo with a sample firm",
    closing: {
      title: "Try it on a sample firm and a real solicitation.",
      lead: "Add the sample VA solicitation, see the matrix and the go/no-go score, and open the SF 330 preview.",
    },
  },
  {
    slug: "research",
    name: "Research teams",
    linkLabel: "What it does for research teams",
    title: "Research funding, and proposals that follow each funder's rules.",
    lead: `For university labs and small research companies. ${PRODUCT_NAME} finds research funding notices you can apply for, shows which programs fund work like yours, and drafts the proposal in the standard sections with each funder's rule on AI on the checklist.`,
    summary: "Grants.gov research notices with reasons, funded projects like yours from NSF and NIH, and proposals with each funder's AI rule on the checklist.",
    metaTitle: "For research teams",
    metaDescription: `How ${PRODUCT_NAME} helps university labs and small research companies: research notices from Grants.gov, funded work like yours from NSF and NIH, and proposals with each funder's rule on AI on the checklist.`,
    plant: "camas",
    problem: {
      heading: "The proposal gets written between teaching, the lab, and everything else.",
      body: [
        "A principal investigator writes proposals between classes, students, and the research itself. Finding the right program means reading notices and working out which program funds this kind of work, and who manages it.",
        "Every proposal repeats the same pieces: biosketches, facilities, a data management plan. And funders now have their own rules about AI in applications, and the rules do not agree.",
      ],
    },
    steps: [
      {
        title: "A profile of the team",
        body: "It reads your lab page for investigators, publications, prior awards, facilities, and capabilities. Your team checks the profile before anything uses it.",
      },
      {
        title: "Notices you can apply for",
        body: "Research funding notices from Grants.gov that are open to universities, each with plain reasons for the fit. SBIR and STTR notices come through Grants.gov too.",
      },
      {
        title: "Who funds work like yours",
        body: "Funded projects like yours from the NSF Award Search and NIH RePORTER, both free and public. They show which programs fund this work and which program officers manage it.",
      },
      {
        title: "A draft in the standard sections",
        body: "Project summary, specific aims or objectives, research plan, broader impacts, biosketches, budget justification, data management and sharing plan, and facilities. Biosketches and facilities are built from your records.",
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
      "SBIR and STTR notices come through Grants.gov. There is no direct SBIR.gov feed.",
      "The NSF Award Search and NIH RePORTER are free and need no key.",
      "Funders change their rules on AI. Read the current notice before you submit.",
    ],
    demo: `The demo includes a fictional university research lab in Toledo and replays recorded runs. The Grants.gov notices in it are real. ${demoFree}`,
    signUpLabel: "Find funding for my lab",
    demoLabel: "Try the demo with a sample lab",
    closing: {
      title: "Try it on a sample research lab first.",
      lead: "See the notices it finds, the funded work like the lab's, and a draft with the funder's AI rule on the checklist.",
    },
  },
  {
    slug: "students",
    name: "Students",
    linkLabel: "What it does for students",
    title: "Scholarships close to home, and essays in your own words.",
    lead: `For students and anyone else applying on their own. ${PRODUCT_NAME} turns your résumé into a profile you check, matches you to scholarship funds from local foundations' public tax filings, and drafts each essay from your own experiences.`,
    summary: "Your résumé becomes a profile, scholarship funds are matched from foundations' 990-PF filings, and each essay is drafted from your own experiences.",
    metaTitle: "For students",
    metaDescription: `How ${PRODUCT_NAME} helps students: a profile from your résumé, scholarship funds matched from foundations' 990-PF filings in Ohio, Kentucky, and North Carolina, and essays drafted from your own experiences.`,
    plant: "aster",
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
        title: "Scholarship funds near you",
        body: "It matches you to scholarship funds from private foundations' IRS 990-PF filings in Ohio, Kentucky, and North Carolina, for now. It skips funds limited to another county, educational loans, and foundations that mostly fund organizations.",
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
        body: "When you start an essay, the fund's deadline as filed and the steps before it (asking recommenders, a draft to reread, submitting) go on your calendar.",
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
      { label: "The application", body: "Check each foundation's rules, then apply the way it asks." },
    ],
    goodToKnow: [
      "It covers foundations in Ohio, Kentucky, and North Carolina only, for now.",
      "It finds only foundations that report scholarship grants on their filings. College, employer, and federal aid are not included.",
      "Many of these scholarships are limited to one school or county, and filed instructions can be out of date. Check with the foundation before applying.",
    ],
    demo: `The demo includes a fictional high school senior in Dayton and replays recorded runs. The foundation filings in it are real. ${demoFree}`,
    signUpLabel: "Find my first scholarships",
    demoLabel: "Try the demo with a sample student",
    closing: {
      title: "Try it with a sample student first.",
      lead: "See the scholarship funds it finds for a senior in Dayton, and an essay drafted from the senior's résumé.",
    },
  },
];

export function audiencePage(slug: AudienceSlug): AudiencePage {
  const a = audiencePages.find((x) => x.slug === slug);
  if (!a) throw new Error(`No audience page called ${slug}`);
  return a;
}
