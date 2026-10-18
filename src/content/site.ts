import { PRODUCT_NAME } from "@/lib/brand";

/**
 * Site copy: FAQ, founder note, security page, legal drafts, and pricing.
 * Plain text only. Square brackets mark details the founders fill in.
 */

export type FaqItem = { q: string; a: string };
export type Section = { heading: string; body: string[] };
export type PricingTier = {
  name: string;
  price: string;
  period: string;
  who: string;
  includes: string[];
  cta: string;
  note?: string;
};

export const faq: FaqItem[] = [
  {
    q: "Does it make things up?",
    a: `It is built not to. ${PRODUCT_NAME} only names funders found in Grants.gov records or on a page it fetched. Each claim in a draft links to the sentence it came from on your website or in your documents. If a fact is missing, the draft leaves a placeholder and asks you. A model can still misread a source. Check the citations before sending.`,
  },
  {
    q: "Will funders know AI helped, and do we have to disclose it?",
    a: "It depends on the funder. Some ask you to disclose AI use. Federal agencies differ, and policies change. We show a funder's AI policy when we have it and flag when disclosure looks required. You are still responsible for reading the guidelines. You edit and approve the draft, so you are the author.",
  },
  {
    q: "Does it submit or send anything for us?",
    a: `No. ${PRODUCT_NAME} drafts and you send. Letters and proposals export as files for you to upload to the funder's portal. Funder emails open in your mail app or copy to your clipboard. Nothing leaves your workspace until you approve it. Every action the assistant takes is written to a log you can read.`,
  },
  {
    q: "Who sees our data, and does anyone train on it?",
    a: "The people you invite. Data lives in a Supabase-hosted Postgres database in the United States. Drafting uses Google's Gemini API through one key set up by whoever runs the service. Google's terms for that key decide whether prompts may improve its products: not on the paid tier, possibly on the free tier. The app does not yet say which.",
  },
  {
    q: "What sources does it search?",
    a: `Federal funding notices from Grants.gov. That covers federal agencies, not private foundations or corporate giving. Foundation data is next, likely starting from public IRS Form 990 filings. If most of your funding comes from local foundations, ${PRODUCT_NAME} will be more useful for drafting than for discovery until then.`,
  },
  {
    q: "How much time does it really save?",
    a: "We do not have measured numbers yet. What it removes is the blank page and the hunt for your own facts. You still read the funder's guidelines, check each citation, edit the draft, and submit. Expect to spend real time reviewing. A solid draft in an afternoon is the goal.",
  },
  {
    q: "What does it cost, and what happens if we cannot pay?",
    a: "Free is $0 and includes your profile, five matches a month, and one drafted letter of inquiry. Starter is $29 a month and Growth is $79 a month. If you stop paying, your workspace drops to Free and you keep your data. We are also looking at a plan for organizations with no cash, described on the pricing page.",
  },
  {
    q: "What if the draft is wrong or sounds nothing like us?",
    a: "Edit it, or tell the assistant what is off and ask for another pass. Drafts are built from your own website and documents, so more material gets you closer. You can keep a short note about your voice in your profile. A wrong fact is a bug. Send it with the citation so we can fix the extraction.",
  },
];

export const founderNote: {
  heading: string;
  paragraphs: string[];
  signoff: string;
} = {
  heading: "Why we built it",
  paragraphs: [
    "I spent [a period of time] volunteering with [the organization where I volunteered] in [city]. The person running it did programs, finance, and every grant application alone, mostly after hours. There was money to apply for. There were no hours to apply for it.",
    "Grant writers cost more than most small organizations can spend. The research tools are priced for development offices. The AI tools we tried wrote confident drafts with invented numbers. When a funder is reading, that is worse than no draft.",
    `So we built ${PRODUCT_NAME} around one rule: every fact comes from your own documents or a real funding notice, with a link to where it came from. Nothing goes out until you approve it. It writes a draft and keeps a calendar. It does not speak for you.`,
    "It is early. The federal listings are in. Foundation data is next. We are building it with [number] organizations who tell us what is wrong every week. If you run a small nonprofit and want to be one of them, write to us at [founders@yourdomain].",
  ],
  signoff: `[Name] and [Name], founders of ${PRODUCT_NAME}`,
};

export const securitySections: Section[] = [
  {
    heading: "Where your data lives",
    body: [
      "Your profile, uploaded documents, matches, drafts, and calendar are stored in a Postgres database hosted by Supabase in a United States region. Each organization has its own workspace. Database rules keep one workspace from reading another.",
      "Files you upload are stored in the same account, under your workspace. We do not copy your data to other regions.",
    ],
  },
  {
    heading: "Who can see it",
    body: [
      "The people you invite to your workspace. Nobody else by default.",
      `A small number of ${PRODUCT_NAME} staff can reach production systems to fix problems. That access is logged and limited to what the task needs. We will tell you if we need to open your workspace to resolve a support request.`,
    ],
  },
  {
    heading: "AI providers and training",
    body: [
      `${PRODUCT_NAME} uses Google's Gemini API to read your documents, find matches, and write drafts. Your text is sent to Google for processing and returned to your workspace.`,
      "Every workspace uses one Gemini API key set up by whoever runs the service. Google's terms for that key decide what happens to prompts. On the paid API tier, Google does not use customer prompts or outputs to train its models. On the free tier, it may use them to improve its products.",
      "The product does not yet show which tier its key is on. Ask whoever runs your service, or read the key's billing status in Google AI Studio.",
      "We do not train models of our own on your data. We do not share one customer's data with another.",
    ],
  },
  {
    heading: "You approve everything",
    body: [
      "Nothing is sent or submitted on your behalf. Drafts stay drafts until you review them. Proposals export as files that you upload to the funder's portal yourself. Funder emails are handed to you to send from your own address.",
      "Every action the assistant takes, and every source it used, is written to a log you can open from your workspace.",
    ],
  },
  {
    heading: "A source on every fact",
    body: [
      "Funders come only from Grants.gov records or a page the assistant fetched, each with a link and a last-checked date. The assistant does not name a funder from memory.",
      "Claims in a draft link to the sentence in your website or document they came from. When a fact is missing, the draft shows a placeholder and asks you. It does not fill in a plausible number.",
    ],
  },
  {
    heading: "Email and sending",
    body: [
      `${PRODUCT_NAME} writes drafts. You send them. By default you copy a draft or open it in your own mail app. If you connect Gmail or Outlook, we hold a send-only token for that account. We use it only when you press Send on a draft. We do not read your mail.`,
      "We do not scrape personal contact details. Funder contacts come from public program listings, and we keep to published professional information.",
    ],
  },
  {
    heading: "Account access and deletion",
    body: [
      "You sign in with a magic link sent to your email address. There is no password to store. We may offer sign-in with Google as well.",
      "You can delete your workspace from settings. That removes your profile, documents, drafts, matches, and logs. Backups expire within [30] days. Deleting does not take back anything you already exported or sent.",
    ],
  },
  {
    heading: "Reporting a problem",
    body: [
      "If you find a security issue, or a fact in a draft that does not match its source, write to [security@yourdomain]. We read every report and will reply within [two business days].",
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
      "Usage data: pages visited, features used, browser type, and approximate location from your IP address. We use it to run and improve the service.",
      "Payment details on paid plans are collected by Stripe. We never see your full card number.",
    ],
  },
  {
    heading: "How we use it",
    body: [
      "To run the service: find matching grants, draft letters and proposals from your documents, and keep your deadlines.",
      "To support you: answer questions, fix problems, and send account emails such as sign-in links and the weekly digest.",
      "To improve the product: see which features are used and where drafts go wrong. We do not sell your data. We do not show advertising.",
    ],
  },
  {
    heading: "AI processing",
    body: [
      "Your website text and documents are sent to Google's Gemini API to produce matches and drafts, through one API key configured by whoever runs the service. Google's terms for that key apply. On the paid API tier Google does not train on customer data. On the free tier it may use data to improve its products.",
      "We do not train models of our own on your content. Cross-customer learning, if we ever offer it, will be opt-in and anonymized.",
    ],
  },
  {
    heading: "Sharing with providers",
    body: [
      "We share data only with the providers needed to run the service: Supabase for hosting and database, Google for AI processing, Stripe for payments, and an email provider for sign-in links and notifications. Each is bound by its own terms and acts on our instructions.",
      "We may disclose data when the law requires it, or to protect the rights and safety of users. We will tell you when we are allowed to.",
    ],
  },
  {
    heading: "How long we keep it",
    body: [
      "Your workspace content stays as long as your account exists. Deleted workspaces are removed from live systems at once and from backups within [30] days.",
      "Usage logs are kept for [12 months]. Billing records are kept as long as tax law requires.",
    ],
  },
  {
    heading: "Your rights and choices",
    body: [
      "You can see, edit, export, and delete your workspace content yourself in the app. You can delete your whole account from settings.",
      "Depending on where you live, you may have rights to access, correct, or delete personal data, or to object to how it is used. Email [privacy@yourdomain] and we will respond within [30 days].",
      "You can turn off the digest and other reminder emails at any time. Sign-in and billing emails are part of running your account.",
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
      "Questions about privacy go to [privacy@yourdomain]. Our mailing address is [address].",
    ],
  },
];

export const termsSections: Section[] = [
  {
    heading: "The service",
    body: [
      `${PRODUCT_NAME} finds grant opportunities, drafts letters and proposals from the material you provide, drafts emails to funders, and tracks deadlines. It is a drafting assistant for your organization. It does not submit applications, send email, or make decisions for you.`,
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
      "We do not promise that you will find a suitable grant, that a draft will be accepted, or that you will win any award. Funding decisions belong to funders. We do not give legal, tax, or accounting advice.",
    ],
  },
  {
    heading: "Payment and plans",
    body: [
      "The Free plan costs nothing and needs no card. Paid plans are billed monthly through Stripe at the price shown when you subscribe. You can cancel at any time and keep access until the end of the paid period.",
      "If a payment fails, we will try again and email you. After [14 days] your workspace moves to the Free plan. Your data stays. We will give at least 30 days' notice before changing a price.",
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
      `The service is provided as is, without warranties beyond those the law requires. To the extent the law allows, ${PRODUCT_NAME} is not liable for lost funding, lost revenue, or indirect damages arising from your use of the service. Our total liability is limited to the amount you paid us in the 12 months before the claim.`,
      "Nothing here limits liability that cannot be limited by law.",
    ],
  },
  {
    heading: "Governing law and contact",
    body: [
      "These terms are governed by the laws of [State]. Disputes will be handled in the courts of [County, State]. Questions about these terms go to [legal@yourdomain]. We may update these terms. We will email account holders before material changes take effect.",
    ],
  },
];

export const legalNotice =
  "This page is a draft. It needs review by a lawyer before launch and is not yet a binding agreement.";

export const pricingTiers: PricingTier[] = [
  {
    name: "Free",
    price: "$0",
    period: "no card needed",
    who: "Anyone, for as long as you like",
    includes: [
      "Organization profile built from your website",
      "5 grant matches a month",
      "1 drafted letter of inquiry",
      "Every fact cited to its source",
    ],
    cta: "Start free",
    note: "Drafting on every plan goes through the same Gemini API key. Whether Google may use prompts to improve its products depends on that key's tier. See the Security page.",
  },
  {
    name: "Starter",
    price: "$29",
    period: "a month",
    who: "Organizations under $250K a year",
    includes: [
      "Everything in Free",
      "Unlimited matches",
      "3 full proposals a month",
      "Deadline calendar",
      "Funder email drafts you send yourself",
    ],
    cta: "Choose Starter",
    note: "Paid prices are drafts we are testing with early users. They may change.",
  },
  {
    name: "Growth",
    price: "$79",
    period: "a month",
    who: "Organizations between $250K and $1M a year",
    includes: [
      "Everything in Starter",
      "Unlimited full proposals",
      "3 seats for your team",
      "Connections and social posts, as each one ships",
    ],
    cta: "Choose Growth",
  },
  {
    name: "Success plan",
    price: "Coming later",
    period: "",
    who: "Organizations with no cash on hand",
    includes: [
      "Everything in Growth",
      "A low monthly base",
      "A small share of awards, paid only on grants you win",
    ],
    cta: "Tell us you are interested",
    note: "We are still deciding on this plan. Many funders and fundraising ethics codes restrict paying a percentage of a grant. We are checking with an advisor and with early users before offering it.",
  },
];

export const pricingFaq: FaqItem[] = [
  {
    q: "Can we switch plans?",
    a: "Yes, at any time from settings. Moving up takes effect right away and is charged for the rest of the month. Moving down or cancelling takes effect at the end of the paid period. Your data stays on every plan.",
  },
  {
    q: "What counts as a proposal?",
    a: "A full proposal is a complete application draft for one funding opportunity, including the narrative sections the funder asks for. Each application you start counts once, whether it is a letter of inquiry or a full proposal. Re-drafting it does not count again. Funder emails do not count.",
  },
  {
    q: "Is there a nonprofit discount?",
    a: `No. Every plan is already priced for small nonprofits, so there is no separate discount. If a fiscal sponsor, community foundation, or incubator wants seats for a cohort, write to us at [hello@yourdomain] and we will work something out.`,
  },
  {
    q: "What if we cannot afford it?",
    a: "Start on Free. It is not a trial and it does not expire. If you need more than Free offers and have no budget, tell us at [hello@yourdomain]. We are looking at a plan with a low base and a small fee only on grants won. We want to hear from you before we set it.",
  },
];
