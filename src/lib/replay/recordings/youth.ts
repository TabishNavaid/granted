import type { GrantsGovRecording, Recording } from "../types";
import grantsgov from "./youth.grantsgov.json";
import { youthLetters } from "./youth.letters";

/**
 * Riverbend Youth Collective, a fictional after-school and summer program in
 * East Dayton, Ohio. The website below does not exist; it is written to match
 * the sample workspace's history. The Grants.gov notices are real, fetched on
 * the day in `recordedOn`.
 */
const HOME = "https://riverbendyouth.org/";

export const recording: Recording = {
  id: "youth",
  recordedOn: "2026-10-18",
  site: {
    homepage: HOME,
    pages: [
      {
        url: HOME,
        title: "Riverbend Youth Collective",
        kind: "html",
        text: `Riverbend Youth Collective
After school, all summer, and alongside families in East Dayton.
Riverbend Youth Collective helps middle and high school students in East Dayton stay in school, find out what they are good at, and build a path to a paying future.
In 2025 we served 214 young people across our three programs, up from 181 the year before.
After-School Studio
Four afternoons a week at Belmont High School and Stivers School for the Arts. A hot meal, an hour of small-group tutoring, and an hour in a studio track.
Summer Launch
Six weeks of hands-on STEM in the morning and a paid first job in the afternoon.
Family Navigators
Help with housing, benefits, and school enrollment, so that school can come first.
Tutor with us
Volunteer tutors give two afternoons a month. We train you, pair you with a small group, and stay with you all year.
Read our 2025 annual report
Riverbend Youth Collective is a 501(c)(3) nonprofit in East Dayton, Ohio.`,
      },
      {
        url: "https://riverbendyouth.org/about",
        title: "About us",
        kind: "html",
        text: `About us
Our story
Riverbend Youth Collective was founded in 2016 by two former teachers at Belmont High School. It began as an after-school homework room with twelve students and a borrowed classroom.
Today we run programs inside three Dayton Public Schools buildings: Belmont High School, Stivers School for the Arts, and Wright Brothers Middle School.
Our students live in the 45403, 45404, and 45410 ZIP codes of East Dayton. Most come from low-income families, and many will be the first in their family to go to college.
Our team
We have 4 full-time staff and 2 part-time family navigators. 23 trained volunteer tutors gave more than 1,900 hours last year.
Our board
Nine volunteers from East Dayton businesses, schools, and congregations govern Riverbend. The board meets every other month and approves every grant application before it is submitted.`,
      },
      {
        url: "https://riverbendyouth.org/programs",
        title: "Programs",
        kind: "html",
        text: `Programs
After-School Studio
After-School Studio enrolled 140 students across Belmont and Stivers. Students get a hot meal, an hour of tutoring in groups of one to four led by trained volunteers, and an hour in a studio track: music production, screen printing, or digital photography. A woodworking track opens next fall if we can fund the equipment.
Summer Launch
Sixty teens completed Summer Launch, our six-week STEM and first-job program. Mornings are hands-on projects with engineers from local employers. Afternoons are a paid first job: students earn $15 an hour at neighborhood businesses, and Riverbend pays the wage.
Family Navigators
Family Navigators worked with 85 families on housing, benefits, and school enrollment. Navigators sit with families through the paperwork and follow up until the problem is solved.`,
      },
      {
        url: "https://riverbendyouth.org/impact",
        title: "Results",
        kind: "html",
        text: `Results
We track attendance daily and pull grades and credits from Dayton Public Schools each quarter under a data-sharing agreement.
Graduation
94% of seniors enrolled in After-School Studio graduated on time, compared with 81% district-wide.
Belonging
88% of surveyed students said they have at least one adult at Riverbend they can go to with a problem.
Staying in school
Of the 85 families our navigators worked with, 79 of their students stayed in school through June.`,
      },
      {
        url: "https://riverbendyouth.org/files/riverbend-annual-report-2025.pdf",
        title: "riverbend-annual-report-2025.pdf",
        kind: "pdf",
        text: `Riverbend Youth Collective
2025 Annual Report
A letter from our director
This was the year Summer Launch doubled. It was also the year we learned how much a family's housing decides a student's attendance, which is why Family Navigators now has two staff.
By the numbers
214 young people served
140 students in After-School Studio
85 families supported by navigators
Finances
Total expenses for the year were $342,118. About 82 cents of every dollar went directly to programs.
Revenue came from foundations (61%), individual donors (22%), a school district contract (11%), and events (6%).
Thank you to our funders, including the Hollis & Marsh Charitable Fund and The Meridian Family Foundation.`,
      },
    ],
    skipped: [{ url: "https://riverbendyouth.org/news/2025/03/spring-showcase-photos", reason: "almost empty" }],
  },
  calls: [
    {
      label: "extract_profile",
      durationMs: 7400,
      data: {
        profile: {
          name: "Riverbend Youth Collective",
          mission: "Riverbend Youth Collective helps middle and high school students in East Dayton stay in school, find out what they are good at, and build a path to a paying future.",
          programs: ["After-School Studio", "Summer Launch", "Family Navigators"],
          populations: ["Middle and high school students", "Students from low-income families", "First-generation college students"],
          causes: ["Youth development", "Education", "Workforce readiness", "Family stability"],
          city: "Dayton",
          state: "OH",
          serviceArea: "East Dayton (ZIP codes 45403, 45404, and 45410)",
          annualBudget: "$342,118",
          foundedYear: "2016",
          staffSize: "4",
        },
        facts: [
          { label: "People served in 2025", value: "214", category: "reach", sourceUrl: HOME, excerpt: "In 2025 we served 214 young people across our three programs, up from 181 the year before." },
          { label: "Year founded", value: "2016", category: "organization", sourceUrl: "https://riverbendyouth.org/about", excerpt: "Riverbend Youth Collective was founded in 2016 by two former teachers at Belmont High School." },
          { label: "Partner schools", value: "Belmont High School, Stivers School for the Arts, Wright Brothers Middle School", category: "geography", sourceUrl: "https://riverbendyouth.org/about", excerpt: "Today we run programs inside three Dayton Public Schools buildings: Belmont High School, Stivers School for the Arts, and Wright Brothers Middle School." },
          { label: "Service area ZIP codes", value: "45403, 45404, and 45410", category: "geography", sourceUrl: "https://riverbendyouth.org/about", excerpt: "Our students live in the 45403, 45404, and 45410 ZIP codes of East Dayton." },
          { label: "Full-time staff", value: "4", category: "people", sourceUrl: "https://riverbendyouth.org/about", excerpt: "We have 4 full-time staff and 2 part-time family navigators." },
          { label: "Volunteer tutors", value: "23", category: "people", sourceUrl: "https://riverbendyouth.org/about", excerpt: "23 trained volunteer tutors gave more than 1,900 hours last year." },
          { label: "Volunteer hours last year", value: "1,900", category: "people", sourceUrl: "https://riverbendyouth.org/about", excerpt: "23 trained volunteer tutors gave more than 1,900 hours last year." },
          { label: "Board members", value: "9", category: "people", sourceUrl: "https://riverbendyouth.org/about", excerpt: "Nine volunteers from East Dayton businesses, schools, and congregations govern Riverbend." },
          { label: "After-School Studio enrollment", value: "140 students", category: "reach", sourceUrl: "https://riverbendyouth.org/programs", excerpt: "After-School Studio enrolled 140 students across Belmont and Stivers." },
          { label: "Summer Launch participants", value: "60 teens", category: "reach", sourceUrl: "https://riverbendyouth.org/programs", excerpt: "Sixty teens completed Summer Launch, our six-week STEM and first-job program." },
          { label: "Summer Launch wage", value: "$15 an hour", category: "organization", sourceUrl: "https://riverbendyouth.org/programs", excerpt: "students earn $15 an hour at neighborhood businesses, and Riverbend pays the wage." },
          { label: "Families served by Family Navigators", value: "85 families", category: "reach", sourceUrl: "https://riverbendyouth.org/programs", excerpt: "Family Navigators worked with 85 families on housing, benefits, and school enrollment." },
          { label: "Graduation rate of enrolled seniors", value: "94%", category: "outcomes", sourceUrl: "https://riverbendyouth.org/impact", excerpt: "94% of seniors enrolled in After-School Studio graduated on time, compared with 81% district-wide." },
          { label: "District graduation rate", value: "81%", category: "outcomes", sourceUrl: "https://riverbendyouth.org/impact", excerpt: "94% of seniors enrolled in After-School Studio graduated on time, compared with 81% district-wide." },
          { label: "Students with a trusted adult at Riverbend", value: "88%", category: "outcomes", sourceUrl: "https://riverbendyouth.org/impact", excerpt: "88% of surveyed students said they have at least one adult at Riverbend they can go to with a problem." },
          { label: "Navigator students who stayed in school", value: "79 of 85 families", category: "outcomes", sourceUrl: "https://riverbendyouth.org/impact", excerpt: "Of the 85 families our navigators worked with, 79 of their students stayed in school through June." },
          { label: "Total expenses (2025)", value: "$342,118", category: "finance", sourceUrl: "https://riverbendyouth.org/files/riverbend-annual-report-2025.pdf", excerpt: "Total expenses for the year were $342,118." },
          { label: "Share of spending on programs", value: "82 cents of every dollar", category: "finance", sourceUrl: "https://riverbendyouth.org/files/riverbend-annual-report-2025.pdf", excerpt: "About 82 cents of every dollar went directly to programs." },
          { label: "Revenue from foundations", value: "61%", category: "finance", sourceUrl: "https://riverbendyouth.org/files/riverbend-annual-report-2025.pdf", excerpt: "Revenue came from foundations (61%), individual donors (22%), a school district contract (11%), and events (6%)." },
        ],
      },
    },
    {
      label: "plan_searches",
      durationMs: 1900,
      data: {
        searches: [
          { keyword: "mentoring", fundingCategories: [] },
          { keyword: "youth employment", fundingCategories: [] },
          { keyword: "afterschool", fundingCategories: ["ED"] },
        ],
      },
    },
    {
      label: "triage_titles",
      durationMs: 2600,
      data: {
        keep: [
          { id: "363902", why: "Youth substance use prevention in schools and extracurricular settings, close to After-School Studio." },
          { id: "364058", why: "Mentoring for youth, which the tutoring groups resemble." },
          { id: "363353", why: "Community coalitions on youth substance use." },
          { id: "363911", why: "Mentoring, though it may be meant for larger organizations." },
          { id: "361206", why: "Service coordination for families, close to Family Navigators." },
          { id: "363055", why: "Youth violence prevention for ages 10 to 24." },
        ],
      },
    },
    {
      label: "score_fit",
      durationMs: 9800,
      data: {
        scores: [
          {
            id: "363902",
            eligible: true,
            ineligibleReason: "",
            fitScore: 64,
            reasons: [
              { text: "After-School Studio already runs inside three Dayton Public Schools buildings, and the program funds prevention work in schools and after school.", factId: "{{fact:Partner schools}}", noticeQuote: "in schools and extracurricular settings" },
              { text: "Mentoring is one of the strategies it pays for, and your 23 volunteer tutors already meet students every week.", factId: "{{fact:Volunteer tutors}}", noticeQuote: "education, early intervention, mentoring" },
            ],
            cautions: ["Very little time before the due date.", "Awards go up to $750,000, more than twice your annual budget. Ask for a part of it.", "Work must be coordinated with law enforcement and community coalitions."],
          },
          {
            id: "363353",
            eligible: true,
            ineligibleReason: "",
            fitScore: 52,
            reasons: [{ text: "It funds local coalitions working on youth substance use, and Riverbend already works inside three East Dayton schools.", factId: "{{fact:Partner schools}}", noticeQuote: "community-based coalitions addressing youth substance use" }],
            cautions: ["You would apply on behalf of a coalition, which needs to exist before you apply.", "Forecast only, not open yet.", "Cost sharing is required."],
          },
          {
            id: "364058",
            eligible: false,
            ineligibleReason: "The notice limits applicants to units of local government, national organizations, and organizations with statewide reach, and Riverbend serves three ZIP codes in one city.",
            fitScore: 0,
            reasons: [],
            cautions: [],
          },
          { id: "363911", eligible: false, ineligibleReason: "It funds multistate mentoring programs, and Riverbend works in one city.", fitScore: 0, reasons: [], cautions: [] },
          { id: "361206", eligible: true, ineligibleReason: "", fitScore: 18, reasons: [], cautions: ["Serves residents of HUD-assisted housing after an emergency; not a program you run."] },
          { id: "363055", eligible: false, ineligibleReason: "It seeks investigator-initiated research proposals, which calls for a research institution.", fitScore: 0, reasons: [], cautions: [] },
        ],
      },
    },
    ...youthLetters,
  ],
  grantsgov: grantsgov as unknown as GrantsGovRecording,
};
