/**
 * What major research funders say about AI in proposals, checked
 * 2026-10-18. Each entry says only what its sources say, and links them.
 * Shown on every research proposal for that funder, and in plain words on
 * the drafting screen, because the rules differ: NIH does not treat a
 * substantially AI-written application as original, NASA wants AI use
 * cited, DOE asks for disclosure in at least one current notice, and the
 * Department of Education allows it with a certification.
 */
export interface FunderAiPolicy {
  key: string;
  agency: string;
  /** Matches an agency name or code in a notice. */
  match: RegExp;
  /** "strict": the funder may reject or sanction AI-written content. "disclose": it asks you to say how AI was used. "allowed": it allows AI help with a certification. "unknown": no policy found. */
  level: "strict" | "disclose" | "allowed" | "unknown";
  summary: string;
  whatToDo: string;
  sources: { label: string; url: string; date: string }[];
}

export const FUNDER_AI_POLICIES: FunderAiPolicy[] = [
  {
    key: "nih",
    agency: "National Institutes of Health",
    match: /\b(NIH|National Institutes? of Health|HHS-NIH|NIEHS|NCI|NIAID|NHLBI|NIGMS|NIDDK|NIMH|NINDS|NICHD|NIA|NIBIB)\b/,
    level: "strict",
    summary: "NIH does not consider applications, or sections of them, substantially developed by AI to be the applicant's original ideas, uses detection tools, and may act on AI-generated content it finds after award. Each PD/PI may submit at most six applications per calendar year. Reviewers may not use generative AI. A May 2026 reminder asks applicants to describe any AI tool they used.",
    whatToDo: "Treat this draft as notes. Rewrite every section in your own words, describe any AI tool use in the application, and keep your own drafts as a record.",
    sources: [
      { label: "NOT-OD-25-132, Supporting Fairness and Originality in NIH Research Applications", url: "https://grants.nih.gov/grants/guide/notice-files/NOT-OD-25-132.html", date: "July 17, 2025" },
      { label: "NOT-OD-23-149, generative AI prohibited in NIH peer review", url: "https://grants.nih.gov/grants/guide/notice-files/NOT-OD-23-149.html", date: "June 23, 2023" },
      { label: "NIH Extramural Nexus, reminders on using AI", url: "https://www.grants.nih.gov/news-events/nih-extramural-nexus-news/2026/05/helpful-reminders-to-ensure-integrity-of-nih-supported-research-when-using-artificial-intelligence", date: "May 14, 2026" },
    ],
  },
  {
    key: "nsf",
    agency: "National Science Foundation",
    match: /\b(NSF|National Science Foundation)\b/,
    level: "disclose",
    summary: "NSF encourages, but does not require, proposers to say in the Project Description how much generative AI was used and how. Proposers are responsible for the accuracy and authenticity of the proposal. Reviewers may not upload proposal content to non-approved AI tools.",
    whatToDo: "Add a sentence to the Project Description on how AI was used, and check every claim before you submit.",
    sources: [{ label: "Notice to the research community on generative AI in merit review", url: "https://www.nsf.gov/news/notice-to-the-research-community-on-ai", date: "December 14, 2023, updated May 21, 2026" }],
  },
  {
    key: "doe",
    agency: "Department of Energy, Office of Science",
    match: /\b(DOE|Department of Energy|Office of Science)\b/,
    level: "disclose",
    summary: "No Office of Science policy was found, but the current Genesis Mission notice (DE-FOA-0003673) requires applicants to disclose any AI tool use beyond editing an original draft and says a machine-generated Project Narrative may be misconduct. Check each notice for this clause.",
    whatToDo: "Search the notice for its AI clause. If it has one, disclose AI use beyond editing, and write the Project Narrative yourself.",
    sources: [{ label: "DE-FOA-0003673, Genesis Mission Graduate Fellowship Pilot", url: "https://science.osti.gov/-/media/grants/pdf/foas/2027/DE-FOA-0003673.pdf", date: "October 8, 2026" }],
  },
  {
    key: "nasa",
    agency: "NASA Science Mission Directorate",
    match: /\b(NASA|National Aeronautics)\b/,
    level: "disclose",
    summary: "NASA SMD does not prohibit AI tools, but any material not produced by the team must be cited: the tool, its version, the date and time, and how it was used. At least one ROSES element now asks about AI use on the NSPIRES cover page.",
    whatToDo: "Cite the tool, version, date, and how it was used wherever AI text remains, and answer the cover page question.",
    sources: [
      { label: "ROSES frequently asked questions", url: "https://science.nasa.gov/researchers/sara/faqs/", date: "ROSES-2025" },
      { label: "ROSES-2025 Amendment 74", url: "https://science.nasa.gov/researchers/solicitations/roses-2025/amendment-74-a-14-atmosphere-research-program-due-date-delay-and-clarification-regarding-the-use-of-generative-ai/", date: "October 8, 2026" },
    ],
  },
  {
    key: "nifa",
    agency: "USDA National Institute of Food and Agriculture",
    match: /\b(NIFA|USDA|Department of Agriculture)\b/,
    level: "unknown",
    summary: "NIFA prohibits public generative AI tools in its peer review to protect confidentiality. We found no rule for applicants. (Read from search excerpts of NIFA's 2026 peer review document, which did not load in full.)",
    whatToDo: "Check the notice for an AI clause, and keep the narrative in your own words.",
    sources: [{ label: "NIFA Peer Review Process for Competitive Grant Applications (2026)", url: "https://www.usda.gov/sites/default/files/guidance-documents/NIFA%20Peer%20Review%20Process%20for%20Competitive%20Grant%20Applications%202026.pdf", date: "2026" }],
  },
  {
    key: "ed",
    agency: "Department of Education",
    match: /\b(Department of Education|ED-GRANTS)\b/,
    level: "allowed",
    summary: "The Department of Education allows AI in developing application materials. Applicants certify that everything in the application is true, complete, and accurate, however it was written.",
    whatToDo: "Check every statement before you certify.",
    sources: [{ label: "Common Instructions for Applicants, 90 FR 42234", url: "https://www.federalregister.gov/documents/2025/08/29/2025-16571/common-instructions-and-information-for-applicants-to-department-of-education-discretionary-grant", date: "August 29, 2025" }],
  },
  {
    key: "dod",
    agency: "Department of Defense",
    match: /\b(DOD|Department of Defense|Department of War|AFOSR|ONR|ARO|DARPA|CDMRP)\b/,
    level: "unknown",
    summary: "We found no department-wide policy on AI in proposals. Individual announcements may have their own.",
    whatToDo: "Search the announcement for an AI clause before you use any drafted text.",
    sources: [],
  },
];

export function aiPolicyFor(agencyText: string): FunderAiPolicy | null {
  return FUNDER_AI_POLICIES.find((p) => p.match.test(agencyText)) ?? null;
}
