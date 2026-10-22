import { EMAIL, PRODUCT_NAME } from "@/lib/brand";

/**
 * Site copy: FAQ, founder note, security page, legal drafts, and the free page.
 * Plain text only. Square brackets mark details the founders fill in.
 */

export type FaqItem = { q: string; a: string };
export type Section = { heading: string; body: string[] };

export const faq: FaqItem[] = [
  {
    q: "Where do the opportunities come from?",
    a: `Only from official public sources, each linked: Grants.gov, SAM.gov contract opportunities and assistance listings, the Federal Register, NIH, NSF, SBIR.gov, bid portals published as open data by states and cities (New York City, Los Angeles, San Francisco, Texas DOT, Delaware, Montgomery County, Illinois), IRS filings for private foundations in every state, international public tenders, and a list of national scholarships checked by hand on each sponsor's page. The Data page lists every source, its license, and how often we refresh it.`,
  },
  {
    q: "Does it make things up?",
    a: `It is built not to. ${PRODUCT_NAME} never names a funder, deadline, or amount from memory: each one comes from a source record with a link and the date we last checked it. Each claim in a draft links to the sentence it came from in your documents. When a fact is missing, the draft asks you instead. A model can still misread a source, so check the citations before you submit.`,
  },
  {
    q: "Does it submit or send anything for us?",
    a: `No. ${PRODUCT_NAME} drafts and you decide. Proposals and the SF 330 export as Word files for you to submit through the funder's or agency's portal. Emails open in your own mail app, or send from your connected account only when you press Send. Every step the assistant takes is written to a log you can read.`,
  },
  {
    q: "We are a construction or design firm. Will it find our bids?",
    a: "It finds federal solicitations on SAM.gov by your NAICS codes, set-asides, and place of performance, and open bids from the state and city portals that publish them as open data. Many state portals do not allow automated reading, so coverage is uneven by state and growing. Any RFP you find elsewhere can be uploaded or linked, and it gets the same compliance matrix, go/no-go, and SF 330.",
  },
  {
    q: "Who sees our data, and does anyone train on it?",
    a: "The people you invite. Data is stored in a Postgres database in the United States, with database rules that keep one workspace from reading another. Drafting uses Google's Gemini API on its paid tier, where Google does not use prompts or outputs to train its models. We do not train models on your documents.",
  },
  {
    q: "Will funders know AI helped, and do we have to disclose it?",
    a: "It depends on the funder. NIH and some foundations ask about AI use; others say nothing. We show a funder's AI rule on the checklist when we have it, with its source. You edit and approve the draft, so you are the author.",
  },
  {
    q: "What does it cost?",
    a: "Nothing during early access. There is no paid plan and no card. Each workspace has a monthly allowance of AI work, which covers what the model costs us. Searching the opportunity database never counts against it.",
  },
  {
    q: "What if the draft is wrong or sounds nothing like us?",
    a: "Edit it, or say what is off and ask for another pass. Drafts are built from your own documents, so more material gets you closer. A wrong fact is a bug: send it with the citation and we will fix the reading.",
  },
];

export const founderNote: {
  heading: string;
  paragraphs: string[];
  signoff: string;
} = {
  heading: "Why we built it",
  paragraphs: [
    "[One or two sentences about the moment you saw the problem: who was doing the applications, and what it cost them.]",
    "Most money that organizations and people can win sits behind an application: a grant, a public bid, a research award, a scholarship. The information is public but scattered across dozens of portals. The writing takes hours nobody has. And the AI tools we tried wrote confident drafts with invented numbers, which is worse than no draft when a reviewer is reading.",
    `So we built ${PRODUCT_NAME} around two rules. Every opportunity comes from an official source with a link. Every claim in a draft comes from your own records, and when something is missing it asks you. Nothing leaves without a person approving it.`,
    `It is early, and it is free while we learn whether it is truly useful. We are building it with [number] early users, starting with [the design partner, described the way they agree to be described]. If you want to be one of them, write to us at ${EMAIL.hello}.`,
  ],
  signoff: `[Name] and [Name], founders of ${PRODUCT_NAME}`,
};

export const securitySections: Section[] = [
  {
    heading: "Where your data lives",
    body: [
      "Your profile, documents, matches, drafts, and calendar are stored in a Postgres database hosted by Supabase in a United States region. Each organization has its own workspace, and database rules keep one workspace from reading or changing another. We test those rules on every change.",
      "Files you upload go straight from your browser to private storage under your workspace's own folder. Nobody outside the workspace can read them.",
    ],
  },
  {
    heading: "Who can see it",
    body: [
      "The people you invite, in the role you give them. Owners manage the team; editors work on drafts and records; reviewers read, comment, and approve but cannot change records.",
      `A small number of ${PRODUCT_NAME} staff can reach production systems to fix problems. That access is limited to what the task needs. We will tell you if we need to open your workspace to resolve a support request.`,
    ],
  },
  {
    heading: "AI and training",
    body: [
      `${PRODUCT_NAME} uses Google's Gemini API, on its paid tier, to read your documents, score matches, and write drafts. Google's terms for the paid tier say it does not use prompts or outputs to train its models.`,
      "We do not train models of our own on your data, and we never share one customer's data with another.",
    ],
  },
  {
    heading: "Connected accounts",
    body: [
      "If you connect Gmail, Outlook, or Google Calendar, we store the access token encrypted with a key the database never sees, and no one can read it through the app's API. We use it only to send an email when you press Send or to add your deadlines to your calendar. We do not read your mail.",
    ],
  },
  {
    heading: "You approve everything",
    body: [
      "Nothing is sent, posted, or submitted on your behalf. Drafts stay drafts until a person approves them, and you submit through the funder's or agency's own portal.",
      "Every step the assistant takes, and every source it used, is written to a log you can open from your workspace.",
    ],
  },
  {
    heading: "A source on every fact",
    body: [
      "Every opportunity, funder, deadline, and amount comes from a named public source with a link and the date we last checked it. The assistant never names a funder from memory.",
      "Claims in a draft link to the sentence in your document they came from. When a fact is missing, the draft asks you. It does not fill in a plausible number.",
    ],
  },
  {
    heading: "Signing in and deleting",
    body: [
      "You sign in with a one-time link sent to your email, or with Google. There is no password to steal.",
      "You can delete your workspace from settings. That removes your profile, documents, drafts, matches, and logs. Backups expire within [7] days. Deleting does not take back anything you already exported or sent.",
    ],
  },
  {
    heading: "Reporting a problem",
    body: [
      `If you find a security issue, or a fact in a draft that does not match its source, write to ${EMAIL.security}. We read every report and will reply within [two business days].`,
      "Please do not test against other customers' workspaces. If you need a safe place to look, ask and we will set one up.",
    ],
  },
];

export const privacySections: Section[] = [
  {
    heading: "What this policy covers",
    body: [
      `This policy explains what ${PRODUCT_NAME} collects when you use the service, what we do with it, and the choices you have. It applies to the website and the app. If something is unclear, ask us.`,
    ],
  },
  {
    heading: "What we collect",
    body: [
      "Account details: your email address and name, and your Google account identifier if you sign in with Google.",
      "Workspace content: your organization's profile, the website pages and documents you give us, the drafts and matches we create, and your calendar entries.",
      "Usage data: pages visited, features used, browser type, and approximate location from your IP address, through Vercel Analytics, which does not use cookies. We use it to run and improve the service.",
    ],
  },
  {
    heading: "How we use it",
    body: [
      "To run the service: find opportunities you qualify for, draft applications from your documents, and keep your deadlines.",
      "To support you: answer questions, fix problems, and send account emails such as sign-in links and the weekly digest.",
      "To improve the product: see which features are used and where drafts go wrong. We do not sell your data. We do not show advertising.",
    ],
  },
  {
    heading: "AI processing",
    body: [
      "Your website text and documents are sent to Google's Gemini API to produce matches and drafts. Google's terms for the paid API tier apply. We use the paid tier, where Google does not use prompts or outputs to train its models.",
      "We do not train models of our own on your content. Cross-customer learning, if we ever offer it, will be opt-in and anonymized.",
    ],
  },
  {
    heading: "Sharing with providers",
    body: [
      "We share data only with the providers needed to run the service: Supabase for hosting and the database, Vercel for serving the website, Google for AI processing, and Resend for sign-in links and notifications. Each is bound by its own terms and acts on our instructions.",
      "We may disclose data when the law requires it, or to protect the rights and safety of users. We will tell you when we are allowed to.",
    ],
  },
  {
    heading: "How long we keep it",
    body: [
      "Your workspace content stays as long as your account exists. Deleted workspaces are removed from live systems at once and from backups within [30] days.",
      "Usage logs are kept for [12 months].",
    ],
  },
  {
    heading: "Your rights and choices",
    body: [
      "You can see, edit, export, and delete your workspace content yourself in the app. You can delete your whole account from settings.",
      `Depending on where you live, you may have rights to access, correct, or delete personal data, or to object to how it is used. Email ${EMAIL.privacy} and we will respond within [30 days].`,
      "You can turn off the digest and other reminder emails at any time. Sign-in and security emails are part of running your account.",
    ],
  },
  {
    heading: "Children",
    body: [
      `${PRODUCT_NAME} is for organizations and the adults who work with them. It is not directed at children under 13, and we do not knowingly collect their data. If you believe a child has given us data, write to us and we will delete it.`,
    ],
  },
  {
    heading: "Changes to this policy",
    body: [
      "We will post changes here and update the date at the top. If a change affects how we use your content, we will email you before it takes effect.",
    ],
  },
  {
    heading: "Contact",
    body: [
      `Questions about privacy go to ${EMAIL.privacy}. Our mailing address is [address].`,
    ],
  },
];

export const termsSections: Section[] = [
  {
    heading: "The service",
    body: [
      `${PRODUCT_NAME} finds grants, public bids, research funding, and scholarships from public sources, drafts applications from the material you provide, drafts emails, and tracks deadlines. It is a drafting assistant for your organization. It does not submit applications, send email, or make decisions for you.`,
    ],
  },
  {
    heading: "Your account",
    body: [
      "You need an email address to sign in. You are responsible for who you invite to your workspace and for what they do there. Tell us if you think your account has been used without permission. You must be 18 or older to use the service.",
    ],
  },
  {
    heading: "Acceptable use",
    body: [
      "Use the service for your own organization's fundraising, or for organizations that have asked you to help them.",
      "Do not upload material you have no right to share, including stories or photos of beneficiaries without their consent. Do not use the service to mislead funders, to harass anyone, or to scrape or resell our data. Do not try to access another workspace.",
    ],
  },
  {
    heading: "Your content and ownership",
    body: [
      "Your website text, documents, and the drafts made from them belong to you. We do not claim ownership of anything you upload or anything the service produces for you.",
      `You give ${PRODUCT_NAME} permission to store, process, and send your content to our providers only as needed to run the service. You can withdraw this by deleting your content or your account.`,
    ],
  },
  {
    heading: "AI output and your responsibility to review",
    body: [
      "Drafts are produced by an AI model working from your material and public funding records. They can contain errors and claims that do not match the source. Every fact carries a citation so you can check it.",
      "You are responsible for reviewing, editing, and approving anything before you send or submit it, and for following each funder's rules, including any disclosure of AI use.",
    ],
  },
  {
    heading: "No guarantee of funding",
    body: [
      "We do not promise that you will find a suitable opportunity, that a draft will be accepted, or that you will win any award or contract. Decisions belong to funders and buyers. Opportunity data comes from public sources and can be out of date; check the official notice before you apply or bid. We do not give legal, tax, or accounting advice.",
    ],
  },
  {
    heading: "Cost",
    body: [
      `${PRODUCT_NAME} is free during early access. There are no paid plans and we collect no payment details. Each workspace has a monthly allowance of AI work, shown in settings.`,
      `If we ever introduce paid plans, we will email account holders at least 30 days before any charge applies. Nothing will be charged without your agreement, and you can export your work at any time.`,
    ],
  },
  {
    heading: "Termination",
    body: [
      "You can delete your account at any time from settings. We may suspend or close an account that breaks these terms or puts other users at risk. We will say why unless the law prevents it. After termination, you can export your content for [30 days] before it is deleted.",
    ],
  },
  {
    heading: "Liability",
    body: [
      `The service is provided as is, without warranties beyond those the law requires. To the extent the law allows, ${PRODUCT_NAME} is not liable for lost funding, lost revenue, or indirect damages arising from your use of the service. Because the service is free, our total liability is limited to [$100].`,
      "Nothing here limits liability that cannot be limited by law.",
    ],
  },
  {
    heading: "Governing law and contact",
    body: [
      `These terms are governed by the laws of [State]. Disputes will be handled in the courts of [County, State]. Questions about these terms go to ${EMAIL.hello}. We may update these terms. We will email account holders before material changes take effect.`,
    ],
  },
];

export const legalNotice =
  "Draft, needs legal review. This page is not yet a binding agreement.";

