/**
 * Mock data for the UI. Everything here is fictional: the organization,
 * the funders, the people, and the numbers. Names were chosen to sound
 * plausible without matching real entities.
 */
import type {
  AgentRun,
  Budget,
  ContactNote,
  OrgContact,
  SavedSearch,
  SocialCampaign,
  Application,
  Boilerplate,
  ComplianceCheck,
  Contact,
  Document,
  EmailDraft,
  Fact,
  Funder,
  InboxItem,
  Match,
  Member,
  Milestone,
  MissingFact,
  MonthlyPlan,
  NotificationSettings,
  Opportunity,
  Organization,
  Outcome,
  Requirement,
  Section,
} from "@/lib/types";

import * as history from "./history";
export { impactMetrics, voiceNote } from "./history";

export const ORG_ID = "org_riverbend";
export const CURRENT_USER_ID = "user_dana";

export const organization: Organization = {
  id: ORG_ID,
  orgType: "nonprofit",
  name: "Riverbend Youth Collective",
  ein: "47-3382911",
  websiteUrl: "https://riverbendyouth.org",
  mission:
    "Riverbend Youth Collective helps middle and high school students in East Dayton stay in school, find out what they are good at, and build a path to a paying future.",
  annualBudget: 342000,
  fiscalYearEnd: "June 30",
  foundedYear: 2016,
  city: "Dayton",
  state: "Ohio",
  serviceArea: "East Dayton (ZIP codes 45403, 45404, 45410)",
  causes: ["Youth development", "Education", "Workforce readiness", "Family stability"],
  populations: ["Middle and high school students", "Low-income families", "First-generation college aspirants"],
  staffCount: 4,
  volunteerCount: 23,
  onboardingStep: "done",
  calendarToken: "demo-calendar-token",
  createdAt: "2026-09-02T14:12:00Z",
};

export const members: Member[] = [
  { id: CURRENT_USER_ID, orgId: ORG_ID, fullName: "Dana Okafor", email: "dana@riverbendyouth.org", role: "owner", status: "active" },
  { id: "user_priya", orgId: ORG_ID, fullName: "Priya Natarajan", email: "priya@riverbendyouth.org", role: "editor", status: "active" },
  { id: "user_marcus", orgId: ORG_ID, fullName: "Marcus Bell", email: "marcus.bell@example.com", role: "reviewer", status: "active" },
  { id: "user_invite", orgId: ORG_ID, fullName: "", email: "treasurer@riverbendyouth.org", role: "reviewer", status: "invited" },
];

export const documents: Document[] = [
  {
    id: "doc_annual_2025",
    orgId: ORG_ID,
    type: "annual_report",
    title: "2025 Annual Report",
    fileName: "Riverbend-Annual-Report-2025.pdf",
    mimeType: "application/pdf",
    sizeBytes: 2_840_000,
    status: "ready",
    pageCount: 16,
    factCount: 9,
    uploadedAt: "2026-09-02T14:30:00Z",
  },
  {
    id: "doc_990_2024",
    orgId: ORG_ID,
    type: "form_990",
    title: "IRS Form 990 (FY2025)",
    fileName: "Form-990-FY2025.pdf",
    mimeType: "application/pdf",
    sizeBytes: 1_120_000,
    status: "ready",
    pageCount: 28,
    factCount: 4,
    uploadedAt: "2026-09-02T14:31:00Z",
  },
  {
    id: "doc_meridian_2024",
    orgId: ORG_ID,
    type: "past_proposal",
    title: "Meridian Family Foundation proposal (2024)",
    fileName: "Meridian-Proposal-2024.docx",
    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    sizeBytes: 184_000,
    status: "ready",
    pageCount: 7,
    factCount: 3,
    uploadedAt: "2026-09-02T14:33:00Z",
  },
  {
    id: "doc_outcomes_2025",
    orgId: ORG_ID,
    type: "other",
    title: "Program outcomes summary, 2025-26",
    fileName: "Outcomes-Summary-2025-26.xlsx",
    mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    sizeBytes: 62_000,
    status: "extracting",
    pageCount: null,
    factCount: 0,
    uploadedAt: "2026-10-16T19:05:00Z",
  },
];

export const facts: Fact[] = [
  { id: "fact_students_2025", orgId: ORG_ID, label: "Students served in 2025", value: "214", category: "reach", sourceDocumentId: "doc_annual_2025", sourceUrl: null, sourceLabel: null, sourceExcerpt: "In 2025 we served 214 young people across our three programs, up from 181 the year before.", sourcePage: 4, confidence: 0.98, status: "confirmed", lastConfirmedAt: "2026-09-03T10:00:00Z" },
  { id: "fact_budget", orgId: ORG_ID, label: "Annual budget (FY2025)", value: "$342,000", category: "finance", sourceDocumentId: "doc_990_2024", sourceUrl: null, sourceLabel: null, sourceExcerpt: "Total expenses: 342,118", sourcePage: 1, confidence: 0.99, status: "confirmed", lastConfirmedAt: "2026-09-03T10:00:00Z" },
  { id: "fact_founded", orgId: ORG_ID, label: "Year founded", value: "2016", category: "organization", sourceDocumentId: "doc_annual_2025", sourceUrl: null, sourceLabel: null, sourceExcerpt: "Founded in 2016 by two former teachers at Belmont High School.", sourcePage: 2, confidence: 0.97, status: "confirmed", lastConfirmedAt: "2026-09-03T10:00:00Z" },
  { id: "fact_grad_rate", orgId: ORG_ID, label: "Graduation rate of enrolled seniors", value: "94%", category: "outcomes", sourceDocumentId: "doc_annual_2025", sourceUrl: null, sourceLabel: null, sourceExcerpt: "94% of seniors enrolled in After-School Studio graduated on time, compared with 81% district-wide.", sourcePage: 6, confidence: 0.95, status: "confirmed", lastConfirmedAt: "2026-09-03T10:00:00Z" },
  { id: "fact_district_grad", orgId: ORG_ID, label: "District graduation rate (comparison)", value: "81%", category: "outcomes", sourceDocumentId: "doc_annual_2025", sourceUrl: null, sourceLabel: null, sourceExcerpt: "compared with 81% district-wide", sourcePage: 6, confidence: 0.9, status: "confirmed", lastConfirmedAt: "2026-09-03T10:00:00Z" },
  { id: "fact_studio_enrollment", orgId: ORG_ID, label: "After-School Studio enrollment", value: "140 students", category: "reach", sourceDocumentId: "doc_annual_2025", sourceUrl: null, sourceLabel: null, sourceExcerpt: "After-School Studio enrolled 140 students across Belmont and Stivers.", sourcePage: 7, confidence: 0.96, status: "confirmed", lastConfirmedAt: "2026-09-03T10:00:00Z" },
  { id: "fact_summer_launch", orgId: ORG_ID, label: "Summer Launch participants", value: "60 teens", category: "reach", sourceDocumentId: "doc_annual_2025", sourceUrl: null, sourceLabel: null, sourceExcerpt: "Sixty teens completed Summer Launch, our six-week STEM and first-job program.", sourcePage: 9, confidence: 0.96, status: "confirmed", lastConfirmedAt: "2026-09-03T10:00:00Z" },
  { id: "fact_families", orgId: ORG_ID, label: "Families served by Family Navigators", value: "85 families", category: "reach", sourceDocumentId: "doc_annual_2025", sourceUrl: null, sourceLabel: null, sourceExcerpt: "Family Navigators worked with 85 families on housing, benefits, and school enrollment.", sourcePage: 11, confidence: 0.94, status: "confirmed", lastConfirmedAt: "2026-09-03T10:00:00Z" },
  { id: "fact_staff", orgId: ORG_ID, label: "Full-time staff", value: "4", category: "people", sourceDocumentId: "doc_990_2024", sourceUrl: null, sourceLabel: null, sourceExcerpt: "Number of individuals employed in calendar year: 6 (4 full-time)", sourcePage: 1, confidence: 0.92, status: "confirmed", lastConfirmedAt: "2026-09-03T10:00:00Z" },
  { id: "fact_volunteers", orgId: ORG_ID, label: "Active volunteers", value: "23", category: "people", sourceDocumentId: "doc_annual_2025", sourceUrl: null, sourceLabel: null, sourceExcerpt: "23 trained volunteer tutors gave more than 1,900 hours.", sourcePage: 12, confidence: 0.93, status: "confirmed", lastConfirmedAt: "2026-09-03T10:00:00Z" },
  { id: "fact_trusted_adult", orgId: ORG_ID, label: "Youth reporting a trusted adult at Riverbend", value: "88%", category: "outcomes", sourceDocumentId: "doc_annual_2025", sourceUrl: null, sourceLabel: null, sourceExcerpt: "88% of surveyed students said they have at least one adult at Riverbend they can go to with a problem.", sourcePage: 6, confidence: 0.9, status: "confirmed", lastConfirmedAt: "2026-09-03T10:00:00Z" },
  { id: "fact_attendance", orgId: ORG_ID, label: "Average program attendance", value: "87%", category: "outcomes", sourceDocumentId: "doc_meridian_2024", sourceUrl: null, sourceLabel: null, sourceExcerpt: "Average weekly attendance held at 87% through the school year.", sourcePage: 3, confidence: 0.8, status: "stale", lastConfirmedAt: "2025-10-01T10:00:00Z" },
  { id: "fact_cost_per_student", orgId: ORG_ID, label: "Cost per student per year", value: "$1,120", category: "finance", sourceDocumentId: "doc_meridian_2024", sourceUrl: null, sourceLabel: null, sourceExcerpt: "Our all-in cost is $1,120 per student per year.", sourcePage: 5, confidence: 0.75, status: "needs_review", lastConfirmedAt: "2025-10-01T10:00:00Z" },
  { id: "fact_board", orgId: ORG_ID, label: "Board members", value: "9", category: "people", sourceDocumentId: "doc_990_2024", sourceUrl: null, sourceLabel: null, sourceExcerpt: "Number of voting members of the governing body: 9", sourcePage: 1, confidence: 0.99, status: "confirmed", lastConfirmedAt: "2026-09-03T10:00:00Z" },
  { id: "fact_schools", orgId: ORG_ID, label: "Partner schools", value: "Belmont High School, Stivers School for the Arts, Wright Brothers Middle", category: "geography", sourceDocumentId: "doc_annual_2025", sourceUrl: null, sourceLabel: null, sourceExcerpt: "We run programs inside three Dayton Public Schools buildings.", sourcePage: 3, confidence: 0.9, status: "confirmed", lastConfirmedAt: "2026-09-03T10:00:00Z" },
];

export const boilerplates: Boilerplate[] = [
  { id: "bp_mission", orgId: ORG_ID, type: "mission", title: "Mission statement", version: 3, wordCount: 38, updatedAt: "2026-09-04T16:00:00Z", sourceDocumentIds: ["doc_annual_2025"], body: organization.mission + " We do this with after-school tutoring and arts, a summer STEM and first-job program, and navigators who help families stay stable enough for school to come first." },
  { id: "bp_history", orgId: ORG_ID, type: "history", title: "Organization history", version: 2, wordCount: 142, updatedAt: "2026-09-04T16:00:00Z", sourceDocumentIds: ["doc_annual_2025", "doc_meridian_2024"], body: "Riverbend Youth Collective began in 2016 when two Belmont High School teachers started an after-school homework room with twelve students and a borrowed classroom. Within two years the room had a waiting list and the founders left teaching to run it full time. Today Riverbend operates inside three Dayton Public Schools buildings and serves more than 200 students a year through three programs: After-School Studio, Summer Launch, and Family Navigators. We have stayed deliberately small and local. Every staff member lives in the neighborhoods we serve, and our board is made up of parents, alumni, and East Dayton business owners." },
  { id: "bp_studio", orgId: ORG_ID, type: "program", title: "After-School Studio", version: 4, wordCount: 168, updatedAt: "2026-09-10T11:20:00Z", sourceDocumentIds: ["doc_annual_2025"], body: "After-School Studio runs four afternoons a week at Belmont High School and Stivers School for the Arts. Students get a hot meal, an hour of tutoring in small groups led by trained volunteers, and an hour in a studio of their choice: music production, screen printing, coding, or culinary arts. The structure is simple on purpose. Students come because the studios are fun, and the tutoring happens because it is the price of admission. In 2025, 140 students enrolled, average attendance was 87%, and 94% of enrolled seniors graduated on time against a district rate of 81%." },
  { id: "bp_summer", orgId: ORG_ID, type: "program", title: "Summer Launch", version: 2, wordCount: 121, updatedAt: "2026-09-04T16:00:00Z", sourceDocumentIds: ["doc_annual_2025"], body: "Summer Launch is a six-week paid program for rising juniors and seniors. Mornings are hands-on STEM projects with engineers from local employers. Afternoons are a first job: students are placed with a neighborhood business or a Riverbend studio and paid $12 an hour. Sixty teens completed the program in 2025, and 41 of them were offered continued part-time work by their placement site." },
  { id: "bp_navigators", orgId: ORG_ID, type: "program", title: "Family Navigators", version: 1, wordCount: 96, updatedAt: "2026-09-04T16:00:00Z", sourceDocumentIds: ["doc_annual_2025"], body: "Family Navigators pairs two bilingual staff with families whose students are at risk of leaving school because of housing, benefits, or enrollment problems. Navigators sit with families through the paperwork, make the calls, and stay in touch until the problem is solved. In 2025 we worked with 85 families, and 79 of their students stayed enrolled through the school year." },
  { id: "bp_evaluation", orgId: ORG_ID, type: "evaluation", title: "How we measure results", version: 2, wordCount: 110, updatedAt: "2026-09-04T16:00:00Z", sourceDocumentIds: ["doc_meridian_2024"], body: "We track attendance daily and pull grades and credits from Dayton Public Schools each quarter under a data-sharing agreement. Twice a year students complete a short survey on belonging, confidence, and whether they have a trusted adult at Riverbend. Graduation is confirmed through the National Student Clearinghouse. Results are reviewed by staff each quarter and by the board twice a year, and we publish them in our annual report." },
  { id: "bp_budget_narrative", orgId: ORG_ID, type: "budget_narrative", title: "Budget narrative (general)", version: 1, wordCount: 88, updatedAt: "2026-09-04T16:00:00Z", sourceDocumentIds: ["doc_990_2024"], body: "Our annual budget is $342,000. Roughly 68% goes to program staff and stipends, 14% to student meals, materials, and transportation, 10% to administration, and 8% to fundraising. Our all-in cost is about $1,120 per student per year. Revenue comes from foundation grants (54%), individual donors (28%), school district contracts (12%), and events (6%)." },
];

export const funders: Funder[] = [
  { id: "funder_meridian", name: "The Meridian Family Foundation", ein: "31-1744920", type: "private_foundation", description: "A Cincinnati-based family foundation that funds youth development and education programs across southwest Ohio. Prefers multi-year relationships with organizations it has funded before.", focusAreas: ["Youth development", "Education", "Mentoring"], geography: "Southwest Ohio", givingMin: 10000, givingMax: 50000, websiteUrl: "https://meridianfamilyfdn.org", sourceUrl: "https://meridianfamilyfdn.org/grants/youth-development", aiPolicy: null, lastVerifiedAt: "2026-10-14T08:00:00Z", recentGrantees: [{ name: "Riverbend Youth Collective", amount: 25000, year: 2024 }, { name: "Dayton Boys Chorus", amount: 15000, year: 2025 }, { name: "Miami Valley Reads", amount: 40000, year: 2025 }] },
  { id: "funder_mvct", name: "Miami Valley Community Trust", ein: "31-0923144", type: "community_foundation", description: "The community foundation for the Dayton region. Runs two responsive grant rounds a year for organizations serving Montgomery County residents.", focusAreas: ["Basic needs", "Education", "Community vitality"], geography: "Montgomery County, Ohio", givingMin: 5000, givingMax: 25000, websiteUrl: "https://mvctrust.org", sourceUrl: "https://mvctrust.org/apply/responsive-grants", aiPolicy: null, lastVerifiedAt: "2026-10-15T08:00:00Z", recentGrantees: [{ name: "East End Community Services", amount: 20000, year: 2025 }, { name: "Dayton Food Project", amount: 15000, year: 2025 }] },
  { id: "funder_brightwater", name: "Brightwater Industries Giving Program", ein: null, type: "corporate", description: "The community giving arm of Brightwater Industries, an aerospace supplier headquartered in Dayton. Funds STEM education and workforce programs near its facilities.", focusAreas: ["STEM education", "Workforce readiness"], geography: "Dayton metro and Columbus", givingMin: 15000, givingMax: 75000, websiteUrl: "https://brightwaterindustries.com/community", sourceUrl: "https://brightwaterindustries.com/community/grants", aiPolicy: "Applicants must disclose use of AI writing tools in the cover letter.", lastVerifiedAt: "2026-10-12T08:00:00Z", recentGrantees: [{ name: "Sinclair STEM Pathways", amount: 50000, year: 2025 }, { name: "Dayton Robotics Alliance", amount: 30000, year: 2025 }] },
  { id: "funder_larkspur", name: "Larkspur Foundation", ein: "13-4027731", type: "private_foundation", description: "A national foundation focused on education equity for students in under-resourced schools. Accepts letters of inquiry year-round and invites full proposals twice a year.", focusAreas: ["Education equity", "College access", "Youth development"], geography: "United States", givingMin: 50000, givingMax: 150000, websiteUrl: "https://larkspurfoundation.org", sourceUrl: "https://larkspurfoundation.org/how-to-apply", aiPolicy: null, lastVerifiedAt: "2026-10-10T08:00:00Z", recentGrantees: [{ name: "Bridge to College Memphis", amount: 100000, year: 2025 }, { name: "Northside Scholars", amount: 75000, year: 2025 }] },
  { id: "funder_nyoo", name: "National Youth Opportunity Office", ein: null, type: "federal", description: "A federal program office that funds community learning centers offering academic enrichment outside school hours. Awards run three years and require a school district partner.", focusAreas: ["Afterschool learning", "Academic enrichment", "Family engagement"], geography: "United States", givingMin: 200000, givingMax: 500000, websiteUrl: "https://nyoo.example.gov", sourceUrl: "https://nyoo.example.gov/funding/afterschool-pathways", aiPolicy: "No restriction stated. Applicants certify the accuracy of all content.", lastVerifiedAt: "2026-10-09T08:00:00Z", recentGrantees: [{ name: "Toledo Learning Collaborative", amount: 450000, year: 2025 }] },
  { id: "funder_hollis", name: "Hollis & Marsh Charitable Fund", ein: "31-1588206", type: "family_fund", description: "A small donor-advised fund held at Miami Valley Community Trust. Gives to mentoring and tutoring programs in Dayton. Prefers short applications.", focusAreas: ["Mentoring", "Tutoring"], geography: "Dayton, Ohio", givingMin: 5000, givingMax: 15000, websiteUrl: "https://mvctrust.org/funds/hollis-marsh", sourceUrl: "https://mvctrust.org/funds/hollis-marsh", aiPolicy: null, lastVerifiedAt: "2026-10-15T08:00:00Z", recentGrantees: [{ name: "Riverbend Youth Collective", amount: 12000, year: 2026 }] },
  { id: "funder_cedar", name: "Cedar Ridge Bank Foundation", ein: "34-1902277", type: "corporate", description: "The foundation of a regional bank with branches across Ohio and Indiana. Funds financial literacy and youth employment programs in branch communities.", focusAreas: ["Financial literacy", "Youth employment"], geography: "Ohio and Indiana", givingMin: 2500, givingMax: 10000, websiteUrl: "https://cedarridgebank.com/foundation", sourceUrl: "https://cedarridgebank.com/foundation/apply", aiPolicy: null, lastVerifiedAt: "2026-10-13T08:00:00Z", recentGrantees: [{ name: "Junior Achievement of Dayton", amount: 10000, year: 2025 }] },
  { id: "funder_oalc", name: "Ohio Arts & Learning Council", ein: null, type: "state", description: "A state council that funds arts education in and out of school. Requires a teaching artist on staff or under contract.", focusAreas: ["Arts education", "Creative youth development"], geography: "Ohio", givingMin: 10000, givingMax: 30000, websiteUrl: "https://oalc.example.gov", sourceUrl: "https://oalc.example.gov/grants/creative-youth", aiPolicy: null, lastVerifiedAt: "2026-10-08T08:00:00Z", recentGrantees: [{ name: "Stivers Arts Boosters", amount: 20000, year: 2025 }] },
  { id: "funder_pemberton", name: "The Pemberton Trust", ein: "36-2210945", type: "private_foundation", description: "A Chicago-based trust that funds workforce readiness programs for teens and young adults in the Midwest. Likes paid work experience and employer partnerships.", focusAreas: ["Workforce readiness", "Youth employment", "Career exploration"], geography: "Midwest", givingMin: 25000, givingMax: 100000, websiteUrl: "https://pembertontrust.org", sourceUrl: "https://pembertontrust.org/grantseekers", aiPolicy: null, lastVerifiedAt: "2026-10-11T08:00:00Z", recentGrantees: [{ name: "Milwaukee Career Bridge", amount: 60000, year: 2025 }, { name: "Indy Summer Works", amount: 80000, year: 2025 }] },
  { id: "funder_threerivers", name: "Three Rivers Health Partners Fund", ein: "31-0847712", type: "corporate", description: "The community benefit fund of a Dayton health system. Funds programs that address social drivers of health, including housing and family stability.", focusAreas: ["Family stability", "Housing", "Social drivers of health"], geography: "Dayton metro", givingMin: 10000, givingMax: 40000, websiteUrl: "https://threerivershealth.org/community", sourceUrl: "https://threerivershealth.org/community/fund", aiPolicy: null, lastVerifiedAt: "2026-10-14T08:00:00Z", recentGrantees: [{ name: "Homefull", amount: 40000, year: 2025 }] },
];

export const contacts: Contact[] = [
  { id: "contact_meridian_po", funderId: "funder_meridian", name: "Elaine Marsh-Whitfield", role: "Program Officer, Youth", email: "grants@meridianfamilyfdn.org", publicSourceUrl: "https://meridianfamilyfdn.org/staff" },
  { id: "contact_brightwater", funderId: "funder_brightwater", name: "Tomas Reyes", role: "Community Giving Manager", email: "community@brightwaterindustries.com", publicSourceUrl: "https://brightwaterindustries.com/community/contact" },
  { id: "contact_hollis", funderId: "funder_hollis", name: "Fund advisor (via MVCT)", role: "Donor services", email: "donorservices@mvctrust.org", publicSourceUrl: "https://mvctrust.org/funds/hollis-marsh" },
  { id: "contact_larkspur", funderId: "funder_larkspur", name: "Grants team", role: "Letters of inquiry", email: "loi@larkspurfoundation.org", publicSourceUrl: "https://larkspurfoundation.org/how-to-apply" },
];

export const opportunities: Opportunity[] = [
  { id: "opp_meridian_2027", funderId: "funder_meridian", title: "Youth Development Grants 2027", summary: "General operating or program support for organizations serving young people ages 10 to 18 in southwest Ohio. Past grantees are encouraged to reapply.", deadline: "2026-11-20", deadlineType: "fixed", amountMin: 10000, amountMax: 50000, eligibility: [{ label: "501(c)(3) public charity", required: true }, { label: "Serves Butler, Hamilton, Montgomery, or Warren County", required: true }, { label: "Annual budget under $2M", required: true }, { label: "At least two years of operations", required: true }], guidelinesUrl: "https://meridianfamilyfdn.org/grants/youth-development/guidelines", sourceUrl: "https://meridianfamilyfdn.org/grants/youth-development", lastVerifiedAt: "2026-10-14T08:00:00Z", effort: "medium", forecasted: false },
  { id: "opp_mvct_fall", funderId: "funder_mvct", title: "Fall Responsive Grants", summary: "Flexible grants for Montgomery County nonprofits. Short online application with four narrative questions.", deadline: "2026-11-06", deadlineType: "fixed", amountMin: 5000, amountMax: 25000, eligibility: [{ label: "501(c)(3) public charity", required: true }, { label: "Serves Montgomery County residents", required: true }], guidelinesUrl: "https://mvctrust.org/apply/responsive-grants/guidelines", sourceUrl: "https://mvctrust.org/apply/responsive-grants", lastVerifiedAt: "2026-10-15T08:00:00Z", effort: "low", forecasted: false },
  { id: "opp_brightwater_stem", funderId: "funder_brightwater", title: "STEM Futures Grant", summary: "Program grants for hands-on STEM learning that connects students to engineering and manufacturing careers near Brightwater sites.", deadline: "2026-12-15", deadlineType: "fixed", amountMin: 15000, amountMax: 75000, eligibility: [{ label: "501(c)(3) public charity", required: true }, { label: "Program within 50 miles of a Brightwater facility", required: true }, { label: "Majority of participants ages 13 to 19", required: true }], guidelinesUrl: "https://brightwaterindustries.com/community/grants/stem-futures", sourceUrl: "https://brightwaterindustries.com/community/grants", lastVerifiedAt: "2026-10-12T08:00:00Z", effort: "medium", forecasted: false },
  { id: "opp_larkspur_loi", funderId: "funder_larkspur", title: "Education Equity Letter of Inquiry", summary: "Two-page letter of inquiry. Invited proposals receive one to three years of support for programs that raise graduation and college enrollment.", deadline: "2027-01-15", deadlineType: "loi", amountMin: 50000, amountMax: 150000, eligibility: [{ label: "501(c)(3) public charity", required: true }, { label: "Majority of students qualify for free or reduced lunch", required: true }, { label: "Annual budget between $250K and $5M", required: true }], guidelinesUrl: "https://larkspurfoundation.org/how-to-apply/loi", sourceUrl: "https://larkspurfoundation.org/how-to-apply", lastVerifiedAt: "2026-10-10T08:00:00Z", effort: "low", forecasted: false },
  { id: "opp_pemberton", funderId: "funder_pemberton", title: "Youth Work Experience Grants", summary: "Supports paid summer and after-school work experiences for teens with employer partners. Two-stage process with a concept note first.", deadline: "2027-02-01", deadlineType: "fixed", amountMin: 25000, amountMax: 100000, eligibility: [{ label: "501(c)(3) public charity", required: true }, { label: "Located in IL, IN, MI, OH, or WI", required: true }, { label: "Pays participants directly", required: true }], guidelinesUrl: "https://pembertontrust.org/grantseekers/youth-work", sourceUrl: "https://pembertontrust.org/grantseekers", lastVerifiedAt: "2026-10-11T08:00:00Z", effort: "high", forecasted: false },
  { id: "opp_threerivers", funderId: "funder_threerivers", title: "Community Health Partners Grant", summary: "Funds programs that address housing, food, and family stability as drivers of health in the Dayton metro.", deadline: "2026-12-04", deadlineType: "fixed", amountMin: 10000, amountMax: 40000, eligibility: [{ label: "501(c)(3) public charity", required: true }, { label: "Serves Dayton metro residents", required: true }, { label: "Addresses a named social driver of health", required: true }], guidelinesUrl: "https://threerivershealth.org/community/fund/guidelines", sourceUrl: "https://threerivershealth.org/community/fund", lastVerifiedAt: "2026-10-14T08:00:00Z", effort: "medium", forecasted: false },
  { id: "opp_cedar_fall", funderId: "funder_cedar", title: "Community Grants, Fall Cycle", summary: "Small grants for financial literacy and youth employment programs in Cedar Ridge branch communities.", deadline: "2026-09-30", deadlineType: "fixed", amountMin: 2500, amountMax: 10000, eligibility: [{ label: "501(c)(3) public charity", required: true }, { label: "Program in a Cedar Ridge branch community", required: true }], guidelinesUrl: "https://cedarridgebank.com/foundation/apply", sourceUrl: "https://cedarridgebank.com/foundation/apply", lastVerifiedAt: "2026-10-13T08:00:00Z", effort: "low", forecasted: false },
  { id: "opp_hollis_2026", funderId: "funder_hollis", title: "Mentoring and Tutoring Grants 2026", summary: "One-page application for Dayton mentoring and tutoring programs.", deadline: "2026-06-15", deadlineType: "fixed", amountMin: 5000, amountMax: 15000, eligibility: [{ label: "501(c)(3) public charity", required: true }, { label: "Serves Dayton youth", required: true }], guidelinesUrl: "https://mvctrust.org/funds/hollis-marsh", sourceUrl: "https://mvctrust.org/funds/hollis-marsh", lastVerifiedAt: "2026-10-15T08:00:00Z", effort: "low", forecasted: false },
  { id: "opp_oalc_2026", funderId: "funder_oalc", title: "Creative Youth Development 2026", summary: "Arts education grants for out-of-school programs with a teaching artist.", deadline: "2026-05-01", deadlineType: "fixed", amountMin: 10000, amountMax: 30000, eligibility: [{ label: "501(c)(3) or public school", required: true }, { label: "Teaching artist on staff or contract", required: true }], guidelinesUrl: "https://oalc.example.gov/grants/creative-youth", sourceUrl: "https://oalc.example.gov/grants/creative-youth", lastVerifiedAt: "2026-10-08T08:00:00Z", effort: "medium", forecasted: false },
  { id: "opp_nyoo_pathways", funderId: "funder_nyoo", title: "Afterschool Pathways Program, FY2027", summary: "Three-year awards for community learning centers. Requires a formal partnership with a school district and a 20% match in year three.", deadline: "2027-03-12", deadlineType: "fixed", amountMin: 200000, amountMax: 500000, eligibility: [{ label: "501(c)(3) or local education agency", required: true }, { label: "Formal school district partnership", required: true }, { label: "Serves a Title I school", required: true }, { label: "Can provide 20% match by year three", required: true }], guidelinesUrl: "https://nyoo.example.gov/funding/afterschool-pathways/nofo", sourceUrl: "https://nyoo.example.gov/funding/afterschool-pathways", lastVerifiedAt: "2026-10-09T08:00:00Z", effort: "high", forecasted: false },
  { id: "opp_oalc_2027", funderId: "funder_oalc", title: "Creative Youth Development 2027", summary: "Arts education grants for out-of-school programs with a teaching artist. Guidelines updated for 2027.", deadline: "2027-05-01", deadlineType: "fixed", amountMin: 10000, amountMax: 30000, eligibility: [{ label: "501(c)(3) or public school", required: true }, { label: "Teaching artist on staff or contract", required: true }], guidelinesUrl: "https://oalc.example.gov/grants/creative-youth", sourceUrl: "https://oalc.example.gov/grants/creative-youth", lastVerifiedAt: "2026-10-08T08:00:00Z", effort: "medium", forecasted: false },
  { id: "opp_mvct_spring", funderId: "funder_mvct", title: "Spring Responsive Grants", summary: "Second responsive round of the year. Same four-question application.", deadline: null, deadlineType: "rolling", amountMin: 5000, amountMax: 25000, eligibility: [{ label: "501(c)(3) public charity", required: true }, { label: "Serves Montgomery County residents", required: true }], guidelinesUrl: "https://mvctrust.org/apply/responsive-grants/guidelines", sourceUrl: "https://mvctrust.org/apply/responsive-grants", lastVerifiedAt: "2026-10-15T08:00:00Z", effort: "low", forecasted: false },
  ...history.pastOpportunities,
];

const okChecks = (extra: { label: string; detail: string; passed?: boolean }[] = []) => [
  { label: "501(c)(3) public charity", passed: true, detail: "IRS determination on file (2016)" },
  ...extra.map((e) => ({ label: e.label, passed: e.passed ?? true, detail: e.detail })),
];

export const matches: Match[] = [
  { id: "match_meridian", orgId: ORG_ID, opportunityId: "opp_meridian_2027", fitScore: 94, status: "applying", isNew: false, dismissReason: null, createdAt: "2026-09-05T09:00:00Z", reasons: ["Meridian funded you in 2024 and asks past grantees to reapply.", "Their focus on youth ages 10 to 18 in southwest Ohio covers all three of your programs.", "Typical award of $25K to $40K sits inside your usual ask."], cautions: ["They prefer a short update on 2024 outcomes early in the narrative."], eligibilityChecks: okChecks([{ label: "Montgomery County", detail: "All programs run in Dayton" }, { label: "Budget under $2M", detail: "$342K" }, { label: "Two years of operations", detail: "Founded 2016" }]) },
  { id: "match_mvct", orgId: ORG_ID, opportunityId: "opp_mvct_fall", fitScore: 89, status: "applying", isNew: false, dismissReason: null, createdAt: "2026-09-05T09:00:00Z", reasons: ["Your community foundation. They know East Dayton and fund basic needs and education.", "Four short questions, so this is about two hours of work.", "Family Navigators is a strong fit for their basic needs priority."], cautions: ["Awards rarely exceed $20K for first-time responsive grants."], eligibilityChecks: okChecks([{ label: "Montgomery County residents", detail: "100% of students live in Dayton" }]) },
  { id: "match_brightwater", orgId: ORG_ID, opportunityId: "opp_brightwater_stem", fitScore: 84, status: "applying", isNew: false, dismissReason: null, createdAt: "2026-09-12T09:00:00Z", reasons: ["Summer Launch pairs students with engineers, which is close to what Brightwater describes.", "Their Dayton plant is 6 miles from Belmont High School.", "They fund at $30K to $50K for programs of your size."], cautions: ["Brightwater requires AI disclosure in the cover letter.", "They want employer letters of support."], eligibilityChecks: okChecks([{ label: "Within 50 miles of a facility", detail: "Dayton plant, 6 miles" }, { label: "Majority ages 13 to 19", detail: "All participants are 14 to 18" }]) },
  { id: "match_larkspur", orgId: ORG_ID, opportunityId: "opp_larkspur_loi", fitScore: 78, status: "new", isNew: true, dismissReason: null, createdAt: "2026-10-15T09:00:00Z", reasons: ["Your 94% graduation rate against the 81% district rate is the kind of outcome they highlight.", "A two-page letter is low effort for a possible $75K or more.", "Budget of $342K clears their $250K floor."], cautions: ["Larkspur funds few first-time applicants. Treat this as relationship building.", "They look for college enrollment data, which you do not track yet."], eligibilityChecks: okChecks([{ label: "Majority free or reduced lunch", detail: "Partner schools are 100% CEP" }, { label: "Budget $250K to $5M", detail: "$342K" }]) },
  { id: "match_threerivers", orgId: ORG_ID, opportunityId: "opp_threerivers", fitScore: 76, status: "new", isNew: true, dismissReason: null, createdAt: "2026-10-15T09:00:00Z", reasons: ["Family Navigators directly addresses housing and family stability.", "Few youth programs apply to health funders, so a family stability program would stand out."], cautions: ["You will need to frame outcomes in health terms, which is new for you."], eligibilityChecks: okChecks([{ label: "Dayton metro", detail: "Yes" }, { label: "Named social driver of health", detail: "Housing stability and family income" }]) },
  { id: "match_pemberton", orgId: ORG_ID, opportunityId: "opp_pemberton", fitScore: 72, status: "saved", isNew: false, dismissReason: null, createdAt: "2026-09-20T09:00:00Z", reasons: ["Summer Launch pays teens directly, which Pemberton requires.", "Ohio is in their footprint."], cautions: ["Two-stage process and a heavier application.", "They prefer programs serving 100 or more youth a year; Summer Launch serves 60."], eligibilityChecks: okChecks([{ label: "Midwest state", detail: "Ohio" }, { label: "Pays participants directly", detail: "$12/hour stipends" }]) },
  { id: "match_nyoo", orgId: ORG_ID, opportunityId: "opp_nyoo_pathways", fitScore: 58, status: "new", isNew: true, dismissReason: null, createdAt: "2026-10-15T09:00:00Z", reasons: ["After-School Studio already runs inside district buildings.", "Award size would double your budget."], cautions: ["Requires a formal district partnership agreement and a 20% match in year three.", "Federal reporting is heavy for a four-person team. Consider it for next year."], eligibilityChecks: okChecks([{ label: "Formal district partnership", detail: "You have a data-sharing agreement, not a formal MOU", passed: false }, { label: "Title I school", detail: "Belmont and Stivers are Title I" }, { label: "20% match by year three", detail: "Not yet confirmed", passed: false }]) },
  { id: "match_oalc_2027", orgId: ORG_ID, opportunityId: "opp_oalc_2027", fitScore: 61, status: "new", isNew: false, dismissReason: null, createdAt: "2026-10-01T09:00:00Z", reasons: ["Studio programming in music and screen printing fits creative youth development."], cautions: ["Last year's application was declined because no teaching artist was under contract.", "Deadline is far out; revisit in March."], eligibilityChecks: okChecks([{ label: "Teaching artist on staff or contract", detail: "Not currently", passed: false }]) },
  { id: "match_mvct_spring", orgId: ORG_ID, opportunityId: "opp_mvct_spring", fitScore: 85, status: "new", isNew: false, dismissReason: null, createdAt: "2026-10-01T09:00:00Z", reasons: ["Same application as the fall round, so most of the work is reusable."], cautions: ["Rolling deadline. We will suggest timing after the fall decision."], eligibilityChecks: okChecks([{ label: "Montgomery County residents", detail: "Yes" }]) },
];

export const applications: Application[] = [
  { id: "app_meridian", orgId: ORG_ID, opportunityId: "opp_meridian_2027", matchId: "match_meridian", stage: "drafting", mode: "proposal", askAmount: 40000, ownerId: CURRENT_USER_ID, submittedAt: null, createdAt: "2026-09-08T10:00:00Z", updatedAt: "2026-10-16T17:40:00Z" },
  { id: "app_mvct", orgId: ORG_ID, opportunityId: "opp_mvct_fall", matchId: "match_mvct", stage: "review", mode: "proposal", askAmount: 20000, ownerId: "user_priya", submittedAt: null, createdAt: "2026-09-10T10:00:00Z", updatedAt: "2026-10-15T12:00:00Z" },
  { id: "app_brightwater", orgId: ORG_ID, opportunityId: "opp_brightwater_stem", matchId: "match_brightwater", stage: "researching", mode: "proposal", askAmount: 45000, ownerId: CURRENT_USER_ID, submittedAt: null, createdAt: "2026-09-28T10:00:00Z", updatedAt: "2026-10-14T09:00:00Z" },
  { id: "app_larkspur", orgId: ORG_ID, opportunityId: "opp_larkspur_loi", matchId: "match_larkspur", stage: "discovered", mode: "proposal", askAmount: 75000, ownerId: null, submittedAt: null, createdAt: "2026-10-15T10:00:00Z", updatedAt: "2026-10-15T10:00:00Z" },
  { id: "app_threerivers", orgId: ORG_ID, opportunityId: "opp_threerivers", matchId: "match_threerivers", stage: "discovered", mode: "proposal", askAmount: 30000, ownerId: null, submittedAt: null, createdAt: "2026-10-15T10:00:00Z", updatedAt: "2026-10-15T10:00:00Z" },
  { id: "app_cedar", orgId: ORG_ID, opportunityId: "opp_cedar_fall", matchId: null, stage: "submitted", mode: "proposal", askAmount: 10000, ownerId: "user_priya", submittedAt: "2026-09-28T15:20:00Z", createdAt: "2026-09-06T10:00:00Z", updatedAt: "2026-09-28T15:20:00Z" },
  { id: "app_hollis", orgId: ORG_ID, opportunityId: "opp_hollis_2026", matchId: null, stage: "won", mode: "proposal", askAmount: 12000, ownerId: CURRENT_USER_ID, submittedAt: "2026-06-10T15:20:00Z", createdAt: "2026-05-20T10:00:00Z", updatedAt: "2026-08-14T10:00:00Z" },
  { id: "app_oalc", orgId: ORG_ID, opportunityId: "opp_oalc_2026", matchId: null, stage: "lost", mode: "proposal", askAmount: 20000, ownerId: CURRENT_USER_ID, submittedAt: "2026-04-28T15:20:00Z", createdAt: "2026-03-15T10:00:00Z", updatedAt: "2026-07-20T10:00:00Z" },
  ...history.pastApplications,
];

export const outcomes: Outcome[] = [
  { id: "out_hollis", applicationId: "app_hollis", result: "won", awardAmount: 12000, feedback: "Loved the attendance numbers. Asked for a short update in January.", decidedAt: "2026-08-14T10:00:00Z" },
  { id: "out_oalc", applicationId: "app_oalc", result: "lost", awardAmount: null, feedback: "Program did not include a credentialed teaching artist. Encouraged to reapply once one is under contract.", decidedAt: "2026-07-20T10:00:00Z" },
  ...history.pastOutcomes,
];

export const requirements: Requirement[] = [
  { id: "req_bg", applicationId: "app_meridian", title: "Organization background", kind: "section", detail: "Who you are, when you started, who you serve.", wordLimit: 250, required: true, order: 1, satisfied: true },
  { id: "req_need", applicationId: "app_meridian", title: "Statement of need", kind: "section", detail: "The problem in your community, with local data.", wordLimit: 500, required: true, order: 2, satisfied: true },
  { id: "req_program", applicationId: "app_meridian", title: "Program description", kind: "section", detail: "What you will do with the grant, for whom, and how often.", wordLimit: 750, required: true, order: 3, satisfied: true },
  { id: "req_outcomes", applicationId: "app_meridian", title: "Goals and outcomes", kind: "section", detail: "Two to four measurable outcomes for the grant year.", wordLimit: 400, required: true, order: 4, satisfied: true },
  { id: "req_eval", applicationId: "app_meridian", title: "Evaluation plan", kind: "section", detail: "How you will know it worked.", wordLimit: 300, required: true, order: 5, satisfied: true },
  { id: "req_budget", applicationId: "app_meridian", title: "Budget narrative", kind: "section", detail: "Explain the line items in the attached budget.", wordLimit: 300, required: true, order: 6, satisfied: true },
  { id: "req_sustain", applicationId: "app_meridian", title: "Sustainability", kind: "section", detail: "How the work continues after the grant.", wordLimit: 200, required: true, order: 7, satisfied: false },
  { id: "req_att_990", applicationId: "app_meridian", title: "Most recent Form 990", kind: "attachment", detail: "PDF", wordLimit: null, required: true, order: 8, satisfied: true },
  { id: "req_att_budget", applicationId: "app_meridian", title: "Project budget (their template)", kind: "attachment", detail: "Use the Meridian Excel template.", wordLimit: null, required: true, order: 9, satisfied: false },
  { id: "req_att_board", applicationId: "app_meridian", title: "Board list with affiliations", kind: "attachment", detail: "PDF or Word", wordLimit: null, required: true, order: 10, satisfied: false },
  { id: "req_att_letter", applicationId: "app_meridian", title: "IRS determination letter", kind: "attachment", detail: "PDF", wordLimit: null, required: true, order: 11, satisfied: true },
  { id: "req_fmt", applicationId: "app_meridian", title: "Formatting: 11pt font or larger, single PDF upload", kind: "format", detail: "From guidelines page 2.", wordLimit: null, required: true, order: 12, satisfied: true },
];

const cite = (id: string, label: string) => `<span data-citation="${id}" data-label="${label}"></span>`;
const gap = (id: string, label: string) => `<span data-gap="${id}" data-label="${label}"></span>`;

export const sections: Section[] = [
  { id: "sec_bg", applicationId: "app_meridian", requirementId: "req_bg", title: "Organization background", wordLimit: 250, status: "drafted", order: 1, updatedAt: "2026-10-16T17:40:00Z", bodyHtml: `<p>Riverbend Youth Collective began in 2016 ${cite("fact_founded", "Annual report, p.2")} when two Belmont High School teachers opened a homework room with twelve students and a borrowed classroom. Ten years later we run three programs inside three Dayton Public Schools buildings ${cite("fact_schools", "Annual report, p.3")} and served 214 young people last year ${cite("fact_students_2025", "Annual report, p.4")}, up from 181 the year before.</p><p>We are small on purpose. Four full-time staff ${cite("fact_staff", "Form 990, p.1")} and 23 trained volunteers ${cite("fact_volunteers", "Annual report, p.12")} live in the neighborhoods we serve, and our nine-member board ${cite("fact_board", "Form 990, p.1")} is made up of parents, alumni, and East Dayton business owners. Meridian's 2024 grant helped us add a second studio site at Stivers, and this request builds on that work.</p>` },
  { id: "sec_need", applicationId: "app_meridian", requirementId: "req_need", title: "Statement of need", wordLimit: 500, status: "drafted", order: 2, updatedAt: "2026-10-16T17:40:00Z", bodyHtml: `<p>Dayton Public Schools graduates 81% of its seniors on time ${cite("fact_district_grad", "Annual report, p.6")}. The three schools we partner with ${cite("fact_schools", "Annual report, p.3")} serve East Dayton neighborhoods where most families qualify for free lunch. For a lot of our students, the hard hours are 3 p.m. to 7 p.m. Many have no adult at home and no quiet place to do homework.</p><p>Students who come to Riverbend do better. Among seniors enrolled in After-School Studio, 94% graduated on time ${cite("fact_grad_rate", "Annual report, p.6")}. In our survey, 88% of students said they have at least one adult at Riverbend they can go to with a problem ${cite("fact_trusted_adult", "Annual report, p.6")}.</p><p>We cannot take everyone who wants to come. ${gap("gap_waitlist", "Current waitlist size")} students are on our waitlist at Belmont, and Summer Launch is capped at 60 ${cite("fact_summer_launch", "Annual report, p.9")}.</p>` },
  { id: "sec_program", applicationId: "app_meridian", requirementId: "req_program", title: "Program description", wordLimit: 750, status: "needs_facts", order: 3, updatedAt: "2026-10-16T17:40:00Z", bodyHtml: `<p>This request supports After-School Studio for the 2027 school year. The Studio runs four afternoons a week at Belmont High School and Stivers School for the Arts. Students get a hot meal, an hour of tutoring in small groups led by trained volunteers, and an hour in a studio of their choice: music production, screen printing, coding, or culinary arts.</p><p>The structure is simple on purpose. Students come because the studios are fun, and the tutoring happens because it is the price of admission. In 2025, 140 students enrolled ${cite("fact_studio_enrollment", "Annual report, p.7")} and average weekly attendance held at 87% ${cite("fact_attendance", "2024 proposal, p.3")}.</p><h3>What the grant will fund</h3><ul><li>A third studio track at Belmont (woodworking), opening in January 2027.</li><li>Stipends for ${gap("gap_tutor_count", "Number of tutors to be stipended")} lead tutors so we can hold small-group ratios at 1 to 4.</li><li>Meals and transportation for 160 students, up from 140.</li></ul><p>We will enroll ${gap("gap_2027_target", "2027 enrollment target")} students, with priority for students referred by school counselors for attendance or credit recovery.</p>` },
  { id: "sec_outcomes", applicationId: "app_meridian", requirementId: "req_outcomes", title: "Goals and outcomes", wordLimit: 400, status: "drafted", order: 4, updatedAt: "2026-10-16T17:40:00Z", bodyHtml: `<p>By the end of the 2027 school year:</p><ol><li>160 students will enroll in After-School Studio, up from 140 ${cite("fact_studio_enrollment", "Annual report, p.7")}.</li><li>Average weekly attendance will stay at or above 85% ${cite("fact_attendance", "2024 proposal, p.3")}.</li><li>At least 90% of enrolled seniors will graduate on time, against a district rate of 81% ${cite("fact_district_grad", "Annual report, p.6")}.</li><li>At least 85% of surveyed students will report having a trusted adult at Riverbend ${cite("fact_trusted_adult", "Annual report, p.6")}.</li></ol>` },
  { id: "sec_eval", applicationId: "app_meridian", requirementId: "req_eval", title: "Evaluation plan", wordLimit: 300, status: "edited", order: 5, updatedAt: "2026-10-16T17:40:00Z", bodyHtml: `<p>We track attendance daily and pull grades and credits from Dayton Public Schools each quarter under a data-sharing agreement. Twice a year students complete a short survey on belonging, confidence, and whether they have a trusted adult at Riverbend. Graduation is confirmed through the National Student Clearinghouse.</p><p>Results are reviewed by staff each quarter and by the board twice a year. We will send Meridian a mid-year update in March 2027 and a final report within 60 days of the grant period ending.</p>` },
  { id: "sec_budget", applicationId: "app_meridian", requirementId: "req_budget", title: "Budget narrative", wordLimit: 300, status: "drafted", order: 6, updatedAt: "2026-10-16T17:40:00Z", bodyHtml: `<p>We are requesting $40,000 toward a program budget of ${gap("gap_program_budget", "2027 After-School Studio budget")}. Our organization-wide budget is $342,000 ${cite("fact_budget", "Form 990, p.1")}, and our all-in cost is about $1,120 per student per year ${cite("fact_cost_per_student", "2024 proposal, p.5")}.</p><p>Of the request, $24,000 funds lead tutor stipends, $9,000 funds meals and transportation for the 20 additional students, and $7,000 equips the woodworking studio. No portion of the request funds administration.</p>` },
  { id: "sec_sustain", applicationId: "app_meridian", requirementId: "req_sustain", title: "Sustainability", wordLimit: 200, status: "empty", order: 7, updatedAt: "2026-10-16T17:40:00Z", bodyHtml: "" },
  ...history.pastSections,
];

export const missingFacts: MissingFact[] = [
  { id: "gap_waitlist", applicationId: "app_meridian", sectionId: "sec_need", question: "How many students are on the Belmont waitlist right now?", whyItMatters: "The need statement is stronger with a current number. The 2025 report does not include one.", suggestedLabel: "Belmont waitlist size (Oct 2026)", status: "open", answer: null },
  { id: "gap_tutor_count", applicationId: "app_meridian", sectionId: "sec_program", question: "How many lead tutors will receive stipends from this grant?", whyItMatters: "The budget narrative allocates $24,000 to stipends, so the count needs to match.", suggestedLabel: "Lead tutors stipended (2027)", status: "open", answer: null },
  { id: "gap_2027_target", applicationId: "app_meridian", sectionId: "sec_program", question: "What is the 2027 enrollment target for After-School Studio?", whyItMatters: "Goals section says 160. Confirm so both sections agree.", suggestedLabel: "After-School Studio target (2027)", status: "open", answer: null },
  { id: "gap_program_budget", applicationId: "app_meridian", sectionId: "sec_budget", question: "What is the total 2027 After-School Studio program budget?", whyItMatters: "Meridian asks what share of the program this grant covers.", suggestedLabel: "After-School Studio budget (2027)", status: "open", answer: null },
  { id: "gap_eval_partner", applicationId: "app_meridian", sectionId: "sec_eval", question: "Do you have an outside evaluation partner? If not, we will say evaluation is done in-house.", whyItMatters: "Optional. Some reviewers weight external evaluation.", suggestedLabel: "Evaluation partner", status: "answered", answer: "No outside partner. In-house, with the district data agreement." },
];

export const complianceChecks: ComplianceCheck[] = [
  { id: "cc_1", applicationId: "app_meridian", sectionId: "sec_program", rule: "Program description within 750 words", status: "pass", detail: "Currently 214 words." },
  { id: "cc_2", applicationId: "app_meridian", sectionId: "sec_need", rule: "Statement of need within 500 words", status: "pass", detail: "Currently 231 words." },
  { id: "cc_3", applicationId: "app_meridian", sectionId: "sec_sustain", rule: "Sustainability section present", status: "fail", detail: "Section is empty. Required by guidelines." },
  { id: "cc_4", applicationId: "app_meridian", sectionId: null, rule: "Board list attached", status: "fail", detail: "Not uploaded yet. Required attachment." },
  { id: "cc_5", applicationId: "app_meridian", sectionId: null, rule: "Project budget in Meridian template", status: "fail", detail: "Template not filled in. Download it from the guidelines page." },
  { id: "cc_6", applicationId: "app_meridian", sectionId: null, rule: "No unresolved missing facts", status: "warn", detail: "4 open questions remain across 3 sections." },
  { id: "cc_7", applicationId: "app_meridian", sectionId: "sec_bg", rule: "Organization background within 250 words", status: "warn", detail: "Currently 139 words. Fine, but Meridian likes a line on 2024 grant results." },
  { id: "cc_8", applicationId: "app_meridian", sectionId: null, rule: "Form 990 attached", status: "pass", detail: "FY2025 990 on file." },
  { id: "cc_9", applicationId: "app_meridian", sectionId: null, rule: "IRS determination letter attached", status: "pass", detail: "On file." },
  { id: "cc_10", applicationId: "app_meridian", sectionId: null, rule: "Every claim has a source", status: "pass", detail: "18 citations across 6 sections." },
];

export const milestones: Milestone[] = [
  { id: "ms_mer_draft", orgId: ORG_ID, applicationId: "app_meridian", title: "Full draft ready for review", dueDate: "2026-11-06", kind: "draft_due", assigneeId: CURRENT_USER_ID, done: false },
  { id: "ms_mer_budget", orgId: ORG_ID, applicationId: "app_meridian", title: "Budget sign-off from treasurer", dueDate: "2026-11-10", kind: "budget_signoff", assigneeId: "user_marcus", done: false },
  { id: "ms_mer_board", orgId: ORG_ID, applicationId: "app_meridian", title: "Board review", dueDate: "2026-11-13", kind: "board_review", assigneeId: "user_marcus", done: false },
  { id: "ms_mer_submit", orgId: ORG_ID, applicationId: "app_meridian", title: "Submit on Meridian portal", dueDate: "2026-11-18", kind: "submit", assigneeId: CURRENT_USER_ID, done: false },
  { id: "ms_mer_deadline", orgId: ORG_ID, applicationId: "app_meridian", title: "Meridian deadline", dueDate: "2026-11-20", kind: "deadline", assigneeId: null, done: false },
  { id: "ms_mvct_draft", orgId: ORG_ID, applicationId: "app_mvct", title: "Draft complete", dueDate: "2026-10-23", kind: "draft_due", assigneeId: "user_priya", done: true },
  { id: "ms_mvct_board", orgId: ORG_ID, applicationId: "app_mvct", title: "Board chair review", dueDate: "2026-10-30", kind: "board_review", assigneeId: "user_marcus", done: false },
  { id: "ms_mvct_submit", orgId: ORG_ID, applicationId: "app_mvct", title: "Submit online form", dueDate: "2026-11-04", kind: "submit", assigneeId: "user_priya", done: false },
  { id: "ms_mvct_deadline", orgId: ORG_ID, applicationId: "app_mvct", title: "Miami Valley Community Trust deadline", dueDate: "2026-11-06", kind: "deadline", assigneeId: null, done: false },
  { id: "ms_bw_draft", orgId: ORG_ID, applicationId: "app_brightwater", title: "Draft ready", dueDate: "2026-12-01", kind: "draft_due", assigneeId: CURRENT_USER_ID, done: false },
  { id: "ms_bw_letters", orgId: ORG_ID, applicationId: "app_brightwater", title: "Collect employer support letters", dueDate: "2026-11-25", kind: "draft_due", assigneeId: CURRENT_USER_ID, done: false },
  { id: "ms_bw_board", orgId: ORG_ID, applicationId: "app_brightwater", title: "Board review", dueDate: "2026-12-08", kind: "board_review", assigneeId: "user_marcus", done: false },
  { id: "ms_bw_submit", orgId: ORG_ID, applicationId: "app_brightwater", title: "Submit", dueDate: "2026-12-12", kind: "submit", assigneeId: CURRENT_USER_ID, done: false },
  { id: "ms_bw_deadline", orgId: ORG_ID, applicationId: "app_brightwater", title: "Brightwater deadline", dueDate: "2026-12-15", kind: "deadline", assigneeId: null, done: false },
  { id: "ms_tr_deadline", orgId: ORG_ID, applicationId: "app_threerivers", title: "Three Rivers deadline", dueDate: "2026-12-04", kind: "deadline", assigneeId: null, done: false },
  { id: "ms_lark_deadline", orgId: ORG_ID, applicationId: "app_larkspur", title: "Larkspur LOI deadline", dueDate: "2027-01-15", kind: "deadline", assigneeId: null, done: false },
  { id: "ms_cedar_follow", orgId: ORG_ID, applicationId: "app_cedar", title: "Follow up with Cedar Ridge if no decision", dueDate: "2026-11-12", kind: "follow_up", assigneeId: "user_priya", done: false },
  { id: "ms_hollis_update", orgId: ORG_ID, applicationId: "app_hollis", title: "Send January update to Hollis & Marsh", dueDate: "2027-01-15", kind: "follow_up", assigneeId: CURRENT_USER_ID, done: false },
];

export const emailDrafts: EmailDraft[] = [
  { id: "email_brightwater_intro", orgId: ORG_ID, applicationId: "app_brightwater", funderId: "funder_brightwater", contactId: "contact_brightwater", to: null, toName: null, status: "draft", sentAt: null, sentVia: null, followUpAt: null, createdAt: "2026-10-15T14:20:05Z", kind: "question", subject: "Question about STEM Futures eligibility for a summer program", body: `Hi Tomas,

I run Riverbend Youth Collective, a small nonprofit in East Dayton. Our Summer Launch program pairs 60 high school students with engineers from local employers for six weeks of hands-on projects and a paid first job.

We are planning to apply to STEM Futures by December 15 and want to make sure we are a fit before we ask employers for letters of support. Two quick questions:

1. Does a six-week summer program qualify, or do you prefer school-year programs?
2. Would a letter from a Brightwater engineer who volunteers with us be welcome, or should we keep letters to outside employers?

I can send our one-page program summary if that would help.

Thanks,

Dana Okafor
Executive Director, Riverbend Youth Collective
(937) 555-0142` },
  { id: "email_hollis_thanks", orgId: ORG_ID, applicationId: "app_hollis", funderId: "funder_hollis", contactId: "contact_hollis", to: null, toName: null, status: "draft", sentAt: null, sentVia: null, followUpAt: null, createdAt: "2026-10-15T14:20:05Z", kind: "thank_you", subject: "Thank you from Riverbend Youth Collective", body: `Dear friends at the Hollis & Marsh Charitable Fund,

Thank you for your $12,000 grant to After-School Studio. It arrived the week school started, and it is already paying stipends for our lead tutors at Belmont.

As you asked, we will send a short update in January with fall attendance and first-semester grades. If you would ever like to visit a studio afternoon, you are welcome any Tuesday or Thursday.

Thanks again,

Dana Okafor
Executive Director, Riverbend Youth Collective` },
];

export const monthlyPlan: MonthlyPlan = {
  id: "plan_2026_10",
  orgId: ORG_ID,
  month: "2026-10",
  status: "proposed",
  summary: "Three for October: two you can finish in about a week each, and a longer one with a December deadline. Together they could bring in $85,000 to $115,000.",
  items: [
    { opportunityId: "opp_mvct_fall", effort: "low", expectedAward: 20000, why: "Due November 6. The draft is done and in review, so you're nearly there.", decision: "keep" },
    { opportunityId: "opp_meridian_2027", effort: "medium", expectedAward: 40000, why: "Your strongest relationship, and they asked you to reapply. The draft is ready. I just need four facts from you.", decision: "keep" },
    { opportunityId: "opp_brightwater_stem", effort: "medium", expectedAward: 45000, why: "Due December 15. I'd start now, because employer letters always take longer than anyone expects.", decision: "keep" },
  ],
};

export const inboxItems: InboxItem[] = [
  { id: "inbox_plan", orgId: ORG_ID, agent: "planner", type: "monthly_plan", title: "Your October plan", summary: "Three applications, about 14 hours of your time, and $85K to $115K if they come through.", payload: { type: "monthly_plan", planId: "plan_2026_10" }, status: "pending", priority: "high", sourceCount: 6, agentRunId: "run_planner_oct", createdAt: "2026-10-01T06:00:00Z", resolvedAt: null, rejectionReason: null },
  { id: "inbox_meridian_draft", orgId: ORG_ID, agent: "proposal", type: "proposal_draft", title: "Draft ready: Meridian Family Foundation, Youth Development Grants 2027", summary: "I drafted six of seven sections from your annual report, your 990, and the 2024 Meridian proposal. Sustainability is still blank, and four facts are missing from the other sections.", payload: { type: "proposal_draft", applicationId: "app_meridian", sectionCount: 7, openQuestions: 4 }, status: "pending", priority: "high", sourceCount: 3, agentRunId: "run_proposal_meridian", createdAt: "2026-10-16T17:40:00Z", resolvedAt: null, rejectionReason: null },
  { id: "inbox_missing", orgId: ORG_ID, agent: "proposal", type: "missing_facts", title: "Four quick questions for the Meridian proposal", summary: "Waitlist size, tutor count, the 2027 enrollment target, and the program budget. None of them are in your documents, and each takes about a minute.", payload: { type: "missing_facts", applicationId: "app_meridian", missingFactIds: ["gap_waitlist", "gap_tutor_count", "gap_2027_target", "gap_program_budget"] }, status: "pending", priority: "normal", sourceCount: 0, agentRunId: "run_proposal_meridian", createdAt: "2026-10-16T17:41:00Z", resolvedAt: null, rejectionReason: null },
  { id: "inbox_email_brightwater", orgId: ORG_ID, agent: "outreach", type: "email_draft", title: "Email to Tomas Reyes at Brightwater about eligibility", summary: "Two questions worth asking before you go to employers for letters. Send it from your own email when it reads right.", payload: { type: "email_draft", emailDraftId: "email_brightwater_intro" }, status: "pending", priority: "normal", sourceCount: 2, agentRunId: "run_outreach_bw", createdAt: "2026-10-15T14:20:00Z", resolvedAt: null, rejectionReason: null },
  { id: "inbox_matches", orgId: ORG_ID, agent: "discovery", type: "new_matches", title: "Three new matches this week", summary: "Larkspur Foundation (78), Three Rivers Health Partners (76), and a federal program that's probably a next-year idea (58).", payload: { type: "new_matches", matchIds: ["match_larkspur", "match_threerivers", "match_nyoo"] }, status: "pending", priority: "normal", sourceCount: 3, agentRunId: "run_discovery_w42", createdAt: "2026-10-15T09:00:00Z", resolvedAt: null, rejectionReason: null },
  { id: "inbox_milestones_bw", orgId: ORG_ID, agent: "calendar", type: "milestones", title: "Proposed schedule for Brightwater STEM Futures", summary: "Four milestones working back from December 15. I put the employer letters first, on November 25, because they're the slow part.", payload: { type: "milestones", applicationId: "app_brightwater", milestoneIds: ["ms_bw_letters", "ms_bw_draft", "ms_bw_board", "ms_bw_submit"] }, status: "pending", priority: "normal", sourceCount: 1, agentRunId: "run_calendar_bw", createdAt: "2026-10-14T09:10:00Z", resolvedAt: null, rejectionReason: null },
  { id: "inbox_profile_update", orgId: ORG_ID, agent: "profile", type: "profile_update", title: "Update a fact: average attendance", summary: "Your profile says 87%, from the 2024 proposal. The outcomes summary you uploaded yesterday says 89% for 2025-26. Good news, if it's right.", payload: { type: "profile_update", factId: "fact_attendance", proposedValue: "89%", sourceDocumentId: "doc_outcomes_2025", sourceExcerpt: "Average attendance across all sites, 2025-26: 89%", sourcePage: null }, status: "pending", priority: "normal", sourceCount: 1, agentRunId: "run_profile_outcomes", createdAt: "2026-10-16T19:12:00Z", resolvedAt: null, rejectionReason: null },
  { id: "inbox_email_hollis", orgId: ORG_ID, agent: "outreach", type: "email_draft", title: "Thank-you note to Hollis & Marsh", summary: "A short thank-you that remembers the January update they asked for.", payload: { type: "email_draft", emailDraftId: "email_hollis_thanks" }, status: "approved", priority: "normal", sourceCount: 1, agentRunId: "run_outreach_hollis", createdAt: "2026-08-15T10:00:00Z", resolvedAt: "2026-08-15T16:30:00Z", rejectionReason: null },
  { id: "inbox_plan_sep", orgId: ORG_ID, agent: "planner", type: "monthly_plan", title: "Your September plan", summary: "Two applications: Cedar Ridge Bank and Miami Valley Community Trust.", payload: { type: "monthly_plan", planId: "plan_2026_09" }, status: "approved", priority: "normal", sourceCount: 4, agentRunId: null, createdAt: "2026-09-01T06:00:00Z", resolvedAt: "2026-09-02T09:15:00Z", rejectionReason: null },
  { id: "inbox_matches_sep", orgId: ORG_ID, agent: "discovery", type: "new_matches", title: "Two new matches", summary: "Pemberton Trust (72) and Ohio Arts & Learning Council 2027 (61).", payload: { type: "new_matches", matchIds: ["match_pemberton", "match_oalc_2027"] }, status: "rejected", priority: "normal", sourceCount: 2, agentRunId: null, createdAt: "2026-10-01T09:00:00Z", resolvedAt: "2026-10-02T11:00:00Z", rejectionReason: "Not this year. Too much work for the team right now." },
];

export const agentRuns: AgentRun[] = [
  { id: "run_profile_outcomes", orgId: ORG_ID, agent: "profile", trigger: "event", title: "Extract facts from Program outcomes summary, 2025-26", status: "running", toolsCalled: [{ name: "extract_document_text", summary: "Parsed 3 sheets, 212 rows", durationMs: 4200 }, { name: "get_facts", summary: "Loaded 15 existing facts for comparison", durationMs: 120 }, { name: "propose_fact_update", summary: "Attendance 87% to 89%", durationMs: 90 }], sourcesUsed: [{ label: "Program outcomes summary, 2025-26", url: null, documentId: "doc_outcomes_2025", kind: "document" }], outputSummary: "Proposed 1 fact update so far. Still reading sheet 3.", costUsd: 0.04, tokensIn: 0, tokensOut: 0, startedAt: "2026-10-16T19:06:00Z", finishedAt: null, inboxItemId: "inbox_profile_update" },
  { id: "run_proposal_meridian", orgId: ORG_ID, agent: "proposal", trigger: "user", title: "Draft proposal for Meridian Youth Development Grants 2027", status: "succeeded", toolsCalled: [{ name: "fetch_guidelines", summary: "Fetched guidelines PDF (4 pages)", durationMs: 2100 }, { name: "parse_requirements", summary: "12 requirements: 7 sections, 4 attachments, 1 format rule", durationMs: 6800 }, { name: "get_facts", summary: "15 facts loaded", durationMs: 80 }, { name: "get_boilerplate", summary: "7 boilerplate pieces loaded", durationMs: 70 }, { name: "search_knowledge", summary: "9 searches across 3 documents", durationMs: 1900 }, { name: "draft_section", summary: "6 sections drafted, 18 citations", durationMs: 41000 }, { name: "flag_missing_fact", summary: "5 questions raised", durationMs: 60 }, { name: "run_compliance_check", summary: "10 rules checked: 5 pass, 2 warn, 3 fail", durationMs: 900 }], sourcesUsed: [{ label: "Meridian guidelines (2027)", url: "https://meridianfamilyfdn.org/grants/youth-development/guidelines", documentId: null, kind: "web" }, { label: "2025 Annual Report", url: null, documentId: "doc_annual_2025", kind: "document" }, { label: "IRS Form 990 (FY2025)", url: null, documentId: "doc_990_2024", kind: "document" }, { label: "Meridian Family Foundation proposal (2024)", url: null, documentId: "doc_meridian_2024", kind: "document" }], outputSummary: "Drafted 6 of 7 sections. Left Sustainability empty and flagged 4 missing facts.", costUsd: 0.62, tokensIn: 0, tokensOut: 0, startedAt: "2026-10-16T17:38:10Z", finishedAt: "2026-10-16T17:40:02Z", inboxItemId: "inbox_meridian_draft" },
  { id: "run_discovery_w42", orgId: ORG_ID, agent: "discovery", trigger: "schedule", title: "Weekly match scan", status: "succeeded", toolsCalled: [{ name: "get_org_profile", summary: "Profile and 15 facts", durationMs: 90 }, { name: "search_opportunities", summary: "412 opportunities screened, 31 past hard filters", durationMs: 3100 }, { name: "check_eligibility", summary: "31 checked, 24 eligible", durationMs: 5400 }, { name: "fetch_url", summary: "Verified 24 source pages", durationMs: 18000 }, { name: "score_fit", summary: "24 scored, 3 above 55 and new", durationMs: 12000 }, { name: "create_match", summary: "3 matches created", durationMs: 120 }], sourcesUsed: [{ label: "Larkspur Foundation: How to apply", url: "https://larkspurfoundation.org/how-to-apply", documentId: null, kind: "web" }, { label: "Three Rivers Health Partners Fund", url: "https://threerivershealth.org/community/fund", documentId: null, kind: "web" }, { label: "Afterschool Pathways Program NOFO", url: "https://nyoo.example.gov/funding/afterschool-pathways", documentId: null, kind: "web" }, { label: "Opportunity database", url: null, documentId: null, kind: "database" }], outputSummary: "Found 3 new matches. Set aside 21 that you couldn't apply for or that didn't fit.", costUsd: 0.31, tokensIn: 0, tokensOut: 0, startedAt: "2026-10-15T08:58:00Z", finishedAt: "2026-10-15T09:00:40Z", inboxItemId: "inbox_matches" },
  { id: "run_outreach_bw", orgId: ORG_ID, agent: "outreach", trigger: "event", title: "Draft eligibility question to Brightwater", status: "succeeded", toolsCalled: [{ name: "get_funder", summary: "Brightwater profile and AI policy", durationMs: 60 }, { name: "get_contacts", summary: "1 public contact found", durationMs: 50 }, { name: "get_application_summary", summary: "Summer Launch summary", durationMs: 70 }, { name: "draft_email", summary: "Question email, 142 words", durationMs: 5100 }], sourcesUsed: [{ label: "Brightwater community contact page", url: "https://brightwaterindustries.com/community/contact", documentId: null, kind: "web" }, { label: "2025 Annual Report", url: null, documentId: "doc_annual_2025", kind: "document" }], outputSummary: "Drafted 1 email for you to look over.", costUsd: 0.03, tokensIn: 0, tokensOut: 0, startedAt: "2026-10-15T14:19:30Z", finishedAt: "2026-10-15T14:20:05Z", inboxItemId: "inbox_email_brightwater" },
  { id: "run_calendar_bw", orgId: ORG_ID, agent: "calendar", trigger: "event", title: "Plan milestones for Brightwater STEM Futures", status: "succeeded", toolsCalled: [{ name: "get_deadline", summary: "December 15, 2026", durationMs: 40 }, { name: "plan_milestones", summary: "4 milestones, letters first", durationMs: 2300 }, { name: "create_milestones", summary: "4 created (pending approval)", durationMs: 80 }], sourcesUsed: [{ label: "STEM Futures guidelines", url: "https://brightwaterindustries.com/community/grants/stem-futures", documentId: null, kind: "web" }], outputSummary: "Proposed 4 milestones for your calendar.", costUsd: 0.02, tokensIn: 0, tokensOut: 0, startedAt: "2026-10-14T09:09:40Z", finishedAt: "2026-10-14T09:10:02Z", inboxItemId: "inbox_milestones_bw" },
  { id: "run_planner_oct", orgId: ORG_ID, agent: "planner", trigger: "schedule", title: "Build October plan", status: "succeeded", toolsCalled: [{ name: "list_matches", summary: "9 matches reviewed", durationMs: 80 }, { name: "list_applications", summary: "8 applications, 2 in progress", durationMs: 60 }, { name: "estimate_effort", summary: "3 selected, 14 hours total", durationMs: 4100 }, { name: "create_inbox_item", summary: "Plan sent to Inbox", durationMs: 50 }], sourcesUsed: [{ label: "Opportunity database", url: null, documentId: null, kind: "database" }], outputSummary: "Picked 3 opportunities for October.", costUsd: 0.09, tokensIn: 0, tokensOut: 0, startedAt: "2026-10-01T05:59:10Z", finishedAt: "2026-10-01T06:00:01Z", inboxItemId: "inbox_plan" },
  { id: "run_profile_onboard", orgId: ORG_ID, agent: "profile", trigger: "user", title: "Build profile from website and 3 documents", status: "succeeded", toolsCalled: [{ name: "fetch_url", summary: "riverbendyouth.org, 6 pages", durationMs: 3800 }, { name: "extract_document_text", summary: "3 documents, 51 pages", durationMs: 9200 }, { name: "upsert_fact", summary: "15 facts with sources", durationMs: 140 }, { name: "upsert_boilerplate", summary: "7 pieces written", durationMs: 22000 }], sourcesUsed: [{ label: "riverbendyouth.org", url: "https://riverbendyouth.org", documentId: null, kind: "web" }, { label: "2025 Annual Report", url: null, documentId: "doc_annual_2025", kind: "document" }, { label: "IRS Form 990 (FY2025)", url: null, documentId: "doc_990_2024", kind: "document" }, { label: "Meridian Family Foundation proposal (2024)", url: null, documentId: "doc_meridian_2024", kind: "document" }], outputSummary: "Put together your profile, 15 facts, and 7 reusable paragraphs for you to check.", costUsd: 0.47, tokensIn: 0, tokensOut: 0, startedAt: "2026-09-02T14:35:00Z", finishedAt: "2026-09-02T14:36:10Z", inboxItemId: null },
  { id: "run_discovery_failed", orgId: ORG_ID, agent: "discovery", trigger: "schedule", title: "Weekly match scan", status: "failed", toolsCalled: [{ name: "get_org_profile", summary: "Profile and 15 facts", durationMs: 90 }, { name: "search_opportunities", summary: "Timed out after 30s", durationMs: 30000 }], sourcesUsed: [], outputSummary: "The opportunity database was down. Tried again 20 minutes later and it worked.", costUsd: 0.0, tokensIn: 0, tokensOut: 0, startedAt: "2026-10-08T08:58:00Z", finishedAt: "2026-10-08T08:58:31Z", inboxItemId: null },
];

export const notificationSettings: NotificationSettings = {
  weeklyDigest: true,
  milestoneReminders: true,
  inboxAlerts: true,
  reminderDaysBefore: 3,
};

export const savedSearches: SavedSearch[] = [
  { id: "search_mentoring", orgId: ORG_ID, name: "Youth mentoring", keyword: "mentoring", fundingCategories: ["ED"], createdAt: "2026-10-01T09:00:00Z", lastRunAt: "2026-10-15T09:00:00Z" },
  { id: "search_afterschool", orgId: ORG_ID, name: "After-school programs", keyword: "afterschool", fundingCategories: [], createdAt: "2026-10-01T09:00:00Z", lastRunAt: null },
];

export const orgContacts: OrgContact[] = [
  { id: "oc_marcus", orgId: ORG_ID, name: "Marcus Bell", organization: "Bell Hardware", role: "Owner and board member", email: "marcus.bell@example.com", phone: null, kind: "board", relationship: "On our board since 2019. Knows the Meridian family through the Dayton Chamber.", funderId: "funder_meridian", source: "manual", lastTouchAt: "2026-10-02T15:00:00Z", createdAt: "2026-09-05T10:00:00Z" },
  { id: "oc_lena", orgId: ORG_ID, name: "Lena Okoro", organization: "Dayton Public Schools", role: "Director of Family Engagement", email: null, phone: null, kind: "partner", relationship: "Our district partner for the data-sharing agreement.", funderId: null, source: "manual", lastTouchAt: "2026-09-20T15:00:00Z", createdAt: "2026-09-05T10:00:00Z" },
  { id: "oc_priya_board", orgId: ORG_ID, name: "Harold Finch", organization: "Miami Valley Community Trust", role: "Trustee", email: null, phone: null, kind: "board", relationship: "Priya's former colleague. Sits on the Trust's responsive grants committee.", funderId: "funder_mvct", source: "csv", lastTouchAt: null, createdAt: "2026-09-12T10:00:00Z" },
];

export const contactNotes: ContactNote[] = [
  { id: "cn_1", orgId: ORG_ID, contactId: "oc_marcus", kind: "meeting", note: "Coffee after the board meeting. He offered to mention us to Elaine at Meridian before we reapply.", nextStep: "Send him the one-page summary by Oct 20.", happenedAt: "2026-10-02T15:00:00Z" },
];

export const socialCampaigns: SocialCampaign[] = [
  {
    id: "camp_2026_11",
    orgId: ORG_ID,
    month: "2026-11",
    theme: "Show the work behind the Meridian and Miami Valley applications: studios, tutors, and one family story.",
    status: "draft",
    createdAt: "2026-10-28T09:00:00Z",
    posts: [
      { id: "post_1", platform: "instagram", date: "2026-11-03", text: "Four afternoons a week, 140 students, one hot meal each. After-School Studio is back at Belmont and Stivers. Here is what Tuesday looks like.", tiedTo: { kind: "application", id: "app_meridian", label: "Meridian Youth Development 2027" }, status: "draft" },
      { id: "post_2", platform: "linkedin", date: "2026-11-10", text: "94% of the seniors in After-School Studio graduated on time last year. The district rate was 81%. Credit goes to the students, and to the volunteer tutors who show up four afternoons a week.", tiedTo: { kind: "program", id: null, label: "After-School Studio" }, status: "draft" },
      { id: "post_3", platform: "facebook", date: "2026-11-17", text: "Family Navigators worked with 85 families this year on housing, benefits, and enrollment. 79 of their students stayed in school through June. Thank you to the two navigators who made every call.", tiedTo: { kind: "program", id: null, label: "Family Navigators" }, status: "draft" },
    ],
  },
];

export const budgets: Budget[] = [
  {
    id: "budget_meridian",
    orgId: ORG_ID,
    applicationId: "app_meridian",
    updatedAt: "2026-10-16T17:40:00Z",
    justification: "",
    lines: [
      { id: "bl_1", category: "personnel", item: "Lead tutor stipends", amount: 24000, note: "Stipends for lead tutors so small groups stay at one to four." },
      { id: "bl_2", category: "supplies", item: "Meals and transportation", amount: 9000, note: "Meals and bus passes for 20 additional students." },
      { id: "bl_3", category: "equipment", item: "Woodworking studio equipment", amount: 7000, note: "Benches, hand tools, and safety gear for the third studio track." },
    ],
  },
];
