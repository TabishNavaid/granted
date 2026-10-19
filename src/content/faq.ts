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
        a: `Three places. Federal funding notices come from Grants.gov. Private foundations come from the Form 990-PF filings they make to the IRS each year, which are public; ${PRODUCT_NAME} reads them for a few hundred foundations in Ohio, Kentucky, and North Carolina. Facts about your organization come only from your website and the documents you upload, and you confirm each one.`,
      },
      {
        q: "How current is the funder information?",
        a: "Each federal notice shows its link and the date we last checked it. Each foundation figure shows the tax year of the filing it came from, which is often a year or two old. Foundations can change their priorities after they file, so read a foundation's current guidelines before you apply.",
      },
      {
        q: "We are not in Ohio, Kentucky, or North Carolina. Is it still useful?",
        a: "For federal grants, drafting, checks, and deadlines, yes. Grants.gov covers the whole country. For private foundations, not yet: you will see few foundation matches. More states are on the roadmap. If most of your money comes from local foundations outside these states, our foundation matches will be thin for now.",
      },
    ],
  },
  {
    group: "Accuracy and AI",
    items: [
      {
        q: "Does it make things up?",
        a: "It is built not to. It only names funders that appear in Grants.gov or the IRS filings. It keeps a fact about you only when the passage it quotes is on your page, and every claim in a draft cites one of those facts. A missing fact becomes a question for you, not a plausible number. Code checks every citation and number after drafting. A model can still misread a source, so check the citations before you send anything.",
      },
      {
        q: "Will funders know AI helped, and do we have to say so?",
        a: "It depends on the funder. Some ask you to disclose AI use, federal agencies differ, and policies change. We show a funder's AI policy when we have it and flag when disclosure looks required. You are responsible for reading the guidelines. You edit and approve every draft, so you are the author.",
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
        a: "No. It drafts and you act. Applications export as DOCX or PDF for you to upload and submit on the funder's portal. Emails are copied or opened in your own mail app. If you connect Gmail or Outlook, an email goes out only when you press Send. Social posts are drafts you copy. It never posts.",
      },
      {
        q: "What is the demo, and what is it not?",
        a: `The demo runs on fictional sample organizations with recorded runs, and every screen is labelled Demo data. You can click through setup, matches, drafts, and the calendar without signing up. It is not your organization, its facts and numbers are examples, and nothing you do there is sent anywhere. Start it from any demo button on this site.`,
      },
      {
        q: "Does it help with scholarships?",
        a: "Yes, for individuals in a limited way. Scholarship mode matches a student to private foundations in Ohio, Kentucky, and North Carolina whose 990-PF filings show scholarship grants, with the application instructions as filed. College, employer, and federal aid are not included.",
      },
      {
        q: "Can a grant consultant use it for several clients?",
        a: "Yes. Consultant mode switches between organizations from one login. Each client is its own workspace with its own facts, so one client's numbers never appear in another's draft.",
      },
      {
        q: "Does it work for fiscal sponsors?",
        a: "Each sponsored project can be set up as its own organization, and sponsor staff can switch between them. When a funder requires the sponsor to be the applicant, check that rule yourself. For seats across a cohort of projects, write to us.",
      },
    ],
  },
  {
    group: "Data, price, and the people behind it",
    items: [
      {
        q: "Who sees our data, and does anyone train on it?",
        a: "The people you invite. Data is stored in a Supabase-hosted Postgres database in the United States. Drafting uses Google's Gemini API through one key set up by whoever runs the service. Google's terms for that key decide whether prompts may improve its products: not on the paid tier, possibly on the free tier. We do not train models of our own on your data, and we do not sell it. The Security page has the details.",
      },
      {
        q: "What does it cost, and what happens if we stop paying?",
        a: "Free is $0 and includes your profile, five matches a month, and one letter of inquiry. Starter is $29 a month and Growth is $79 a month. If you stop paying, your workspace moves to Free and your data stays.",
      },
      {
        q: "How do we cancel, and can we take our work with us?",
        a: "Cancel from settings at any time. You keep paid features until the end of the period you paid for. Drafts export as DOCX or PDF, and your calendar feed works in any calendar app. Deleting your workspace removes your profile, documents, drafts, matches, and logs.",
      },
      {
        q: "Who is behind it?",
        a: `${PRODUCT_NAME} is built by [Name] and [Name], [one line on their background]. We are building it with [number] early organizations. You can write to us at [founders@yourdomain].`,
      },
    ],
  },
];
