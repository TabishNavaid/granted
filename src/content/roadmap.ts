/** Copy for /roadmap. No dates on purpose. */

export type RoadmapItem = { title: string; body: string };

export const now: RoadmapItem[] = [
  { title: "One opportunity database", body: "Federal grants, SAM.gov solicitations, research funding, state and city bids from portals that publish open data, international tenders, private foundations in every state, and national scholarships. Each record links to its official source." },
  { title: "Facts from your own documents", body: "Your website, annual report, 990, project sheets, résumés, or lab page. Only facts whose quoted passage is in the source are kept, and you confirm each one." },
  { title: "Drafts with citations", body: "Letters of inquiry, full proposals, bid responses, research proposals, and essays where every claim cites your records and missing facts become questions." },
  { title: "Bid tools for firms", body: "A compliance matrix with the page behind every requirement, go/no-go with reasons, the SF 330 Part I and Part II exported to Word, a fee proposal structure for your numbers, and addenda tracking." },
  { title: "Research tools", body: "Funded projects like yours from NSF and NIH award data, biosketches and facilities from your records, and each funder's AI rule on the checklist." },
  { title: "Checks and budgets", body: "Citation and number checks, compliance and reviewer notes, a budget builder, and Word and PDF export." },
  { title: "Deadlines", body: "Milestones planned backward, replanned when an addendum moves a date, a calendar and year plan, a calendar feed, and Google Calendar when you connect it." },
  { title: "Reminders and the weekly digest", body: "An email a few days before each milestone and a weekly summary of new matches and deadlines. You can turn either off." },
  { title: "Outreach and connections", body: "Email drafts you send yourself, board and contact import, overlap with foundation trustees, and introduction request drafts." },
  { title: "Pipeline and analytics", body: "A pipeline board with outcomes, and win analytics from the outcomes you log." },
  { title: "Inbox and activity log", body: "Every agent output waits for approval. Every step and every page read is logged." },
  { title: "Several organizations, one login", body: "Consultants and fiscal sponsors switch between the organizations they manage, each with its own profile, drafts, and calendar." },
];

export const next: RoadmapItem[] = [
  { title: "More state and city bid portals", body: "Added one at a time where a portal publishes open data and its terms allow reuse." },
  { title: "More foundation detail", body: "Application instructions and past grantees for more of the smaller foundations, read from their filings." },
  { title: "Corporate and community foundation programs", body: "Giving programs that do not appear in 990-PF filings or on Grants.gov, such as company giving and community foundation rounds." },
  { title: "Reply tracking", body: "Seeing in the product when a funder replies to an email you sent, so the follow-up is not forgotten." },
  { title: "Portal autofill", body: "A browser extension that fills an application form from your approved draft. You review the form and click submit." },
  { title: "Translation", body: "Drafts and the app in languages other than English." },
];

export const never: RoadmapItem[] = [
  { title: "Submitting applications or bids for you", body: "You click submit on every application and every bid. Portal autofill, if we build it, stops before that click." },
  { title: "Sending or posting without your approval", body: "No email, social post, or calendar invite goes out unless you press the button." },
  { title: "Pricing a bid", body: "Hours, rates, and the price are the firm's. The fee proposal does the arithmetic on the numbers you enter." },
  { title: "Showing who won a contract", body: "Past award data is kept as totals and typical sizes only." },
  { title: "Post-award compliance reporting", body: "Tracking spending against an award and writing the funder's reports is its own kind of software." },
  { title: "A donor database", body: "No donor CRM, individual giving, or payment processing. We stay with applications and proposals." },
  { title: "A system for a sponsored programs office", body: "Routing, institutional approvals, and post-award accounting across a whole university are a different product. We build for the lab and the small research company." },
  { title: "Buying or selling data", body: "We do not sell your data, buy contact lists, or share one customer's information with another." },
];
