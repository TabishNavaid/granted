import type { Application, ImpactMetric, Opportunity, Outcome, Section } from "@/lib/types";

/**
 * Riverbend's earlier applications, two years of them, so win analytics and
 * "reuse a past winning proposal" have something real to work with. Like the
 * rest of the sample history, every funder here is fictional. Dates are
 * written against SEED_DAY and move forward with it.
 */
const ORG = "org_riverbend";
const DANA = "user_dana";
const cite = (id: string, label: string) => `<span data-citation="${id}" data-label="${label}"></span>`;

const past = (id: string, funderId: string, title: string, deadline: string, min: number, max: number): Opportunity => ({
  id,
  funderId,
  title,
  summary: "A past cycle, kept for the application history.",
  deadline,
  deadlineType: "fixed",
  amountMin: min,
  amountMax: max,
  eligibility: [{ label: "501(c)(3) public charity", required: true }],
  guidelinesUrl: "https://example.org/archived-guidelines",
  sourceUrl: "https://example.org/archived-guidelines",
  lastVerifiedAt: `${deadline}T09:00:00Z`,
  effort: "medium",
  forecasted: false,
});

export const pastOpportunities: Opportunity[] = [
  past("opp_meridian_2024", "funder_meridian", "Youth Development Grants 2024", "2024-11-15", 10000, 50000),
  past("opp_mvct_spring_2025", "funder_mvct", "Spring Responsive Grants 2025", "2025-03-14", 5000, 25000),
  past("opp_mvct_fall_2025", "funder_mvct", "Fall Responsive Grants 2025", "2025-11-07", 5000, 25000),
  past("opp_hollis_2025", "funder_hollis", "Mentoring and Tutoring Grants 2025", "2025-06-13", 5000, 15000),
  past("opp_cedar_2025", "funder_cedar", "Community Grants, Spring 2025", "2025-04-04", 2500, 10000),
  past("opp_pemberton_2025", "funder_pemberton", "Youth Work Experience Grants 2025", "2025-02-07", 25000, 100000),
  past("opp_brightwater_2025", "funder_brightwater", "STEM Futures Grant 2025", "2025-12-12", 15000, 75000),
  past("opp_larkspur_2025", "funder_larkspur", "Education Equity Letter of Inquiry 2025", "2025-01-17", 50000, 150000),
  past("opp_threerivers_2025", "funder_threerivers", "Community Health Partners Grant 2025", "2025-12-05", 10000, 40000),
];

const app = (id: string, opportunityId: string, stage: "won" | "lost", ask: number, submitted: string, decided: string): Application => ({
  id,
  orgId: ORG,
  opportunityId,
  matchId: null,
  stage,
  mode: "proposal",
  askAmount: ask,
  ownerId: DANA,
  submittedAt: `${submitted}T15:00:00Z`,
  createdAt: `${submitted}T10:00:00Z`,
  updatedAt: `${decided}T10:00:00Z`,
});

export const pastApplications: Application[] = [
  app("app_meridian_2024", "opp_meridian_2024", "won", 35000, "2024-11-12", "2025-02-20"),
  app("app_mvct_spring_2025", "opp_mvct_spring_2025", "won", 15000, "2025-03-10", "2025-05-02"),
  app("app_mvct_fall_2025", "opp_mvct_fall_2025", "lost", 25000, "2025-11-05", "2026-01-23"),
  app("app_hollis_2025", "opp_hollis_2025", "won", 10000, "2025-06-10", "2025-08-08"),
  app("app_cedar_2025", "opp_cedar_2025", "won", 5000, "2025-04-01", "2025-05-30"),
  app("app_pemberton_2025", "opp_pemberton_2025", "lost", 80000, "2025-02-05", "2025-04-18"),
  app("app_brightwater_2025", "opp_brightwater_2025", "lost", 50000, "2025-12-10", "2026-04-15"),
  app("app_larkspur_2025", "opp_larkspur_2025", "lost", 100000, "2025-01-15", "2025-03-28"),
  app("app_threerivers_2025", "opp_threerivers_2025", "won", 20000, "2025-12-03", "2026-02-27"),
];

export const pastOutcomes: Outcome[] = [
  { id: "out_meridian_2024", applicationId: "app_meridian_2024", result: "won", awardAmount: 35000, feedback: "Strong attendance data. Please reapply next cycle.", decidedAt: "2025-02-20T10:00:00Z", lossReasons: [], lessons: "Leading with attendance and graduation numbers worked. Keep the evaluation section." },
  { id: "out_mvct_spring_2025", applicationId: "app_mvct_spring_2025", result: "won", awardAmount: 15000, feedback: null, decidedAt: "2025-05-02T10:00:00Z", lossReasons: [], lessons: null },
  { id: "out_mvct_fall_2025", applicationId: "app_mvct_fall_2025", result: "lost", awardAmount: null, feedback: "Many strong requests this round. Funds went to first-time grantees.", decidedAt: "2026-01-23T10:00:00Z", lossReasons: ["competition"], lessons: "Asking the same funder twice in one year at a higher amount did not work. Space requests out and keep the ask steady." },
  { id: "out_hollis_2025", applicationId: "app_hollis_2025", result: "won", awardAmount: 10000, feedback: null, decidedAt: "2025-08-08T10:00:00Z", lossReasons: [], lessons: null },
  { id: "out_cedar_2025", applicationId: "app_cedar_2025", result: "won", awardAmount: 5000, feedback: null, decidedAt: "2025-05-30T10:00:00Z", lossReasons: [], lessons: null },
  { id: "out_pemberton_2025", applicationId: "app_pemberton_2025", result: "lost", awardAmount: null, feedback: "They prefer programs serving 100 or more youth a year in paid work experience.", decidedAt: "2025-04-18T10:00:00Z", lossReasons: ["budget_size", "fit"], lessons: "Summer Launch is too small for Pemberton's scale. Do not reapply until it serves 100 teens." },
  { id: "out_brightwater_2025", applicationId: "app_brightwater_2025", result: "no_response", awardAmount: null, feedback: null, decidedAt: "2026-04-15T10:00:00Z", lossReasons: ["relationship"], lessons: "A cold application to a corporate funder went nowhere. Ask a board member for an introduction first." },
  { id: "out_larkspur_2025", applicationId: "app_larkspur_2025", result: "lost", awardAmount: null, feedback: "Encouraged to apply again with two years of college enrollment data.", decidedAt: "2025-03-28T10:00:00Z", lossReasons: ["outcomes_data"], lessons: "National funders want college enrollment data we do not track yet." },
  { id: "out_threerivers_2025", applicationId: "app_threerivers_2025", result: "won", awardAmount: 20000, feedback: "Family Navigators was a fresh angle for a health funder.", decidedAt: "2026-02-27T10:00:00Z", lossReasons: [], lessons: "Framing Family Navigators as family stability opened a health funder." },
];

const section = (id: string, applicationId: string, order: number, title: string, bodyHtml: string): Section => ({ id, applicationId, requirementId: null, title, bodyHtml, wordLimit: null, status: "approved", order, updatedAt: "2025-02-20T10:00:00Z" });

export const pastSections: Section[] = [
  section("psec_m24_need", "app_meridian_2024", 1, "Statement of need", `<p>Dayton Public Schools graduates 81% of its seniors on time ${cite("fact_district_grad", "Annual report, p.6")}. Our students live in East Dayton, where the hours between the last bell and dinner decide a lot.</p>`),
  section("psec_m24_program", "app_meridian_2024", 2, "Program description", `<p>After-School Studio runs four afternoons a week at Belmont High School and Stivers School for the Arts ${cite("fact_schools", "Annual report, p.3")}. Each afternoon brings a hot meal, an hour of small-group tutoring with trained volunteers, and an hour in a studio track.</p>`),
  section("psec_m24_eval", "app_meridian_2024", 3, "Evaluation plan", `<p>We track attendance daily and pull grades and credits from Dayton Public Schools each quarter under a data-sharing agreement. Twice a year students answer a short survey on belonging.</p>`),
  section("psec_m24_budget", "app_meridian_2024", 4, "Budget narrative", `<p>The grant pays lead tutor stipends, meals, and bus passes, the three costs that decide whether a student can stay until six.</p>`),
  section("psec_mvs25_need", "app_mvct_spring_2025", 1, "Statement of need", `<p>East Dayton families need a safe, staffed place for teenagers after school.</p>`),
  section("psec_mvs25_eval", "app_mvct_spring_2025", 2, "Evaluation plan", `<p>Attendance, grades, and on-time graduation, reported each semester.</p>`),
  section("psec_mvf25_need", "app_mvct_fall_2025", 1, "Statement of need", `<p>Demand for After-School Studio has grown faster than our space.</p>`),
  section("psec_h25_program", "app_hollis_2025", 1, "Program description", `<p>Volunteer tutors meet students in groups of one to four, four afternoons a week.</p>`),
  section("psec_h25_eval", "app_hollis_2025", 2, "Evaluation plan", `<p>We report attendance and grades each quarter.</p>`),
  section("psec_c25_program", "app_cedar_2025", 1, "Program description", `<p>Summer Launch pairs STEM projects with a paid first job at a neighborhood business.</p>`),
  section("psec_p25_program", "app_pemberton_2025", 1, "Program description", `<p>Summer Launch places teens in paid jobs with neighborhood employers.</p>`),
  section("psec_p25_budget", "app_pemberton_2025", 2, "Budget narrative", `<p>Wages for teens, a coordinator, and transportation.</p>`),
  section("psec_l25_need", "app_larkspur_2025", 1, "Statement of need", `<p>Students in our neighborhoods graduate at lower rates than the district.</p>`),
  section("psec_tr25_need", "app_threerivers_2025", 1, "Statement of need", `<p>Housing and benefits problems pull students out of school.</p>`),
  section("psec_tr25_program", "app_threerivers_2025", 2, "Program description", `<p>Family Navigators sit with families through the paperwork and follow up until the problem is solved.</p>`),
  section("psec_tr25_eval", "app_threerivers_2025", 3, "Evaluation plan", `<p>We count cases resolved and whether the student stayed enrolled through June.</p>`),
];

const months = ["2026-04", "2026-05", "2026-06", "2026-07", "2026-08", "2026-09"];
export const impactMetrics: ImpactMetric[] = [
  { id: "metric_studio_attendance", orgId: ORG, label: "After-School Studio average daily attendance", unit: "students", program: "After-School Studio", entries: months.map((month, i) => ({ month, value: [96, 101, 0, 0, 88, 104][i], note: i === 2 || i === 3 ? "Summer break" : null })).filter((e) => e.value > 0), factId: null },
  { id: "metric_tutor_hours", orgId: ORG, label: "Volunteer tutoring hours", unit: "hours", program: "After-School Studio", entries: months.map((month, i) => ({ month, value: [176, 182, 40, 32, 150, 190][i], note: null })), factId: null },
  { id: "metric_nav_cases", orgId: ORG, label: "Family Navigator cases closed", unit: "cases", program: "Family Navigators", entries: months.map((month, i) => ({ month, value: [9, 11, 7, 6, 10, 12][i], note: null })), factId: null },
];

export const voiceNote = "Plain and warm. We say \"students\" or \"young people\", never \"at-risk youth\". Short sentences. We name the school or the street when we can.";
