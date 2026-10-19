/** Copy for /roadmap. No dates on purpose. */

export type RoadmapItem = { title: string; body: string };

export const now: RoadmapItem[] = [
  { title: "Facts from your website", body: "Read your pages and documents, keep only facts whose quoted passage is on the page, and let you confirm each one." },
  { title: "Federal and foundation matching", body: "Grants.gov notices, and IRS 990-PF filings for a few hundred private foundations in Ohio, Kentucky, and North Carolina, with fit scores and reasons." },
  { title: "Drafts with citations", body: "Letters of inquiry and full proposals where every claim cites a confirmed fact and missing facts become questions." },
  { title: "Checks and budgets", body: "Citation and number checks, compliance and reviewer notes, a budget builder, and DOCX and PDF export." },
  { title: "Deadlines", body: "Milestones planned backward, a deadline calendar and year plan, a calendar feed, and Google Calendar push where it is connected." },
  { title: "Outreach and connections", body: "Funder email drafts you send yourself, board and contact import, overlap with foundation trustees, and introduction request drafts." },
  { title: "Pipeline and analytics", body: "A pipeline board with outcomes, and win analytics from the outcomes you log." },
  { title: "Inbox and activity log", body: "Every agent output waits for approval. Every step, page read, and cost is logged." },
  { title: "Reminders and the weekly digest", body: "An email a few days before each milestone and a weekly summary, sent once email is set up. Until then the calendar shows exactly what would go out." },
  { title: "Several organizations, one login", body: "Consultants and fiscal sponsors switch between the organizations they manage, each with its own profile, drafts, and calendar." },
];

export const next: RoadmapItem[] = [
  { title: "Foundation data for more states", body: "The same 990-PF reading for foundations beyond Ohio, Kentucky, and North Carolina, one state at a time." },
  { title: "Corporate and community foundation programs", body: "Giving programs that do not appear in 990-PF filings or on Grants.gov, such as company giving and community foundation rounds." },
  { title: "Reply tracking", body: "Seeing in the product when a funder replies to an email you sent, so the follow-up is not forgotten." },
  { title: "Portal autofill", body: "A browser extension that fills a funder's application form from your approved draft. You review the form and click submit." },
  { title: "Translation", body: "Drafts and the app in languages other than English." },
];

export const never: RoadmapItem[] = [
  { title: "Submitting applications for you", body: "You click submit on every application. Portal autofill, if we build it, stops before that click." },
  { title: "Sending or posting without your approval", body: "No email, social post, or calendar invite goes out unless you press the button." },
  { title: "Post-award compliance reporting", body: "Tracking spending against an award and writing the funder's reports is its own kind of software. Others do it well." },
  { title: "A donor database", body: "No donor CRM, individual giving, or payment processing. We stay with grants." },
  { title: "Tools for large universities", body: "Research institutions have sponsored programs offices and different needs. We build for small organizations." },
  { title: "Buying or selling data", body: "We do not sell your data, buy contact lists, or share one customer's information with another." },
];
