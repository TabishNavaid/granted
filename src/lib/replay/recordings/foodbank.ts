import type { GrantsGovRecording, Recording } from "../types";
import grantsgov from "./foodbank.grantsgov.json";
import { foodbankLetters } from "./foodbank.letters";

/**
 * Second Furrow Food Network, a fictional food bank in McDowell County, North
 * Carolina. The website below does not exist. The Grants.gov notices are
 * real, fetched on the day in `recordedOn`.
 */
const HOME = "https://secondfurrow.org/";

export const recording: Recording = {
  id: "foodbank",
  recordedOn: "2026-10-18",
  site: {
    homepage: HOME,
    pages: [
      {
        url: HOME,
        title: "Second Furrow Food Network",
        kind: "html",
        text: `Second Furrow Food Network
Good food for every family in McDowell and Rutherford counties.
Second Furrow Food Network gets good food to every family in McDowell and Rutherford counties, using what our farms grow and what our neighbors give.
In 2025 we distributed 2.1 million pounds of food through 32 partner pantries, a mobile market, and weekend backpacks for students.
Find food near you
Our partner pantries are open six days a week across both counties. The mobile market stops at 11 communities without a grocery store.
Glean with us
Every fall, volunteers walk the fields after the harvest and pick what the machines leave behind. That second pass is where our name comes from.
Second Furrow Food Network is a 501(c)(3) nonprofit based in Marion, North Carolina.`,
      },
      {
        url: "https://secondfurrow.org/about",
        title: "About Second Furrow",
        kind: "html",
        text: `About Second Furrow
Second Furrow began in 2009, when four church pantries and two apple growers in McDowell County started sharing one cooler and one truck.
We now run a 14,000-square-foot warehouse in Marion and supply 32 partner pantries, soup kitchens, and shelters.
Our team
We have 6 full-time staff and about 1,400 volunteers. Volunteers gave 31,500 hours in 2025, the equal of 15 full-time staff.
Where we work
McDowell and Rutherford counties are rural and mountainous. In parts of both counties the nearest full grocery store is more than 20 miles away.`,
      },
      {
        url: "https://secondfurrow.org/programs",
        title: "What we do",
        kind: "html",
        text: `What we do
Partner pantries
We deliver food every week to 32 partner pantries, soup kitchens, and shelters. Pantries order online and we deliver for free.
Field gleaning
Volunteers gleaned 410,000 pounds of fresh produce from 27 farms in 2025. Apples, cabbage, sweet potatoes, and squash go out to pantries within two days of picking.
Mobile market
A refrigerated truck visits 11 rural communities twice a month. Families choose their own food, the way they would in a store.
Weekend backpacks
Every Friday during the school year, 940 students in 18 schools take home a backpack with food for the weekend.`,
      },
      {
        url: "https://secondfurrow.org/impact",
        title: "By the numbers",
        kind: "html",
        text: `By the numbers, 2025
2.1 million pounds of food distributed
6,300 households served each month on average
410,000 pounds of produce gleaned from local farms
940 students fed each weekend during the school year
1 in 6 households we surveyed at mobile market stops had skipped meals in the past month.
About 38% of what we distributed was fresh produce, up from 24% in 2022.`,
      },
      {
        url: "https://secondfurrow.org/files/second-furrow-2025-report.pdf",
        title: "second-furrow-2025-report.pdf",
        kind: "pdf",
        text: `Second Furrow Food Network
2025 Report to the Community
Finances
Cash expenses for the year were $486,250. Donated food is counted separately and is not included in that figure.
Every dollar given to Second Furrow moves about 7 pounds of food.
Looking ahead
Our walk-in cooler is 19 years old and holds four days of produce. A larger cooler would let us accept every load the farms offer during harvest.`,
      },
    ],
    skipped: [{ url: "https://secondfurrow.org/volunteer/shifts", reason: "almost empty" }],
  },
  calls: [
    {
      label: "extract_profile",
      durationMs: 7100,
      data: {
        profile: {
          name: "Second Furrow Food Network",
          mission: "Second Furrow Food Network gets good food to every family in McDowell and Rutherford counties, using what our farms grow and what our neighbors give.",
          programs: ["Partner pantries", "Field gleaning", "Mobile market", "Weekend backpacks"],
          populations: ["Households facing food insecurity", "Students", "Rural families without a nearby grocery store"],
          causes: ["Food security", "Hunger relief", "Rural communities", "Local agriculture"],
          city: "Marion",
          state: "NC",
          serviceArea: "McDowell and Rutherford counties, North Carolina",
          annualBudget: "$486,250",
          foundedYear: "2009",
          staffSize: "6",
        },
        facts: [
          { label: "Food distributed in 2025", value: "2.1 million pounds", category: "reach", sourceUrl: HOME, excerpt: "In 2025 we distributed 2.1 million pounds of food through 32 partner pantries, a mobile market, and weekend backpacks for students." },
          { label: "Partner pantries", value: "32", category: "reach", sourceUrl: "https://secondfurrow.org/programs", excerpt: "We deliver food every week to 32 partner pantries, soup kitchens, and shelters." },
          { label: "Year founded", value: "2009", category: "organization", sourceUrl: "https://secondfurrow.org/about", excerpt: "Second Furrow began in 2009, when four church pantries and two apple growers in McDowell County started sharing one cooler and one truck." },
          { label: "Warehouse size", value: "14,000 square feet", category: "organization", sourceUrl: "https://secondfurrow.org/about", excerpt: "We now run a 14,000-square-foot warehouse in Marion and supply 32 partner pantries, soup kitchens, and shelters." },
          { label: "Full-time staff", value: "6", category: "people", sourceUrl: "https://secondfurrow.org/about", excerpt: "We have 6 full-time staff and about 1,400 volunteers." },
          { label: "Volunteers", value: "about 1,400", category: "people", sourceUrl: "https://secondfurrow.org/about", excerpt: "We have 6 full-time staff and about 1,400 volunteers." },
          { label: "Volunteer hours in 2025", value: "31,500", category: "people", sourceUrl: "https://secondfurrow.org/about", excerpt: "Volunteers gave 31,500 hours in 2025, the equal of 15 full-time staff." },
          { label: "Distance to a full grocery store", value: "more than 20 miles in parts of both counties", category: "geography", sourceUrl: "https://secondfurrow.org/about", excerpt: "In parts of both counties the nearest full grocery store is more than 20 miles away." },
          { label: "Produce gleaned in 2025", value: "410,000 pounds", category: "reach", sourceUrl: "https://secondfurrow.org/programs", excerpt: "Volunteers gleaned fresh produce from local farms in 2025." },
          { label: "Farms gleaned", value: "27", category: "reach", sourceUrl: "https://secondfurrow.org/programs", excerpt: "Volunteers gleaned 410,000 pounds of fresh produce from 27 farms in 2025." },
          { label: "Mobile market stops", value: "11 rural communities, twice a month", category: "reach", sourceUrl: "https://secondfurrow.org/programs", excerpt: "A refrigerated truck visits 11 rural communities twice a month." },
          { label: "Students receiving weekend backpacks", value: "940 students in 18 schools", category: "reach", sourceUrl: "https://secondfurrow.org/programs", excerpt: "Every Friday during the school year, 940 students in 18 schools take home a backpack with food for the weekend." },
          { label: "Households served each month", value: "6,300", category: "reach", sourceUrl: "https://secondfurrow.org/impact", excerpt: "6,300 households served each month on average" },
          { label: "Mobile market households that skipped meals", value: "1 in 6 households surveyed", category: "outcomes", sourceUrl: "https://secondfurrow.org/impact", excerpt: "1 in 6 households we surveyed at mobile market stops had skipped meals in the past month." },
          { label: "Share of food that was fresh produce", value: "38%", category: "outcomes", sourceUrl: "https://secondfurrow.org/impact", excerpt: "About 38% of what we distributed was fresh produce, up from 24% in 2022." },
          { label: "Meals provided in 2025", value: "1.75 million meals", category: "outcomes", sourceUrl: "https://secondfurrow.org/impact", excerpt: "That is about 1.75 million meals for our neighbors." },
          { label: "Cash expenses (2025)", value: "$486,250", category: "finance", sourceUrl: "https://secondfurrow.org/files/second-furrow-2025-report.pdf", excerpt: "Cash expenses for the year were $486,250." },
          { label: "Food moved per dollar given", value: "about 7 pounds", category: "finance", sourceUrl: "https://secondfurrow.org/files/second-furrow-2025-report.pdf", excerpt: "Every dollar given to Second Furrow moves about 7 pounds of food." },
          { label: "Walk-in cooler age and capacity", value: "19 years old, four days of produce", category: "organization", sourceUrl: "https://secondfurrow.org/files/second-furrow-2025-report.pdf", excerpt: "Our walk-in cooler is 19 years old and holds four days of produce." },
        ],
      },
    },
    {
      label: "plan_searches",
      durationMs: 1800,
      data: {
        searches: [
          { keyword: "hunger", fundingCategories: ["FN"] },
          { keyword: "food security", fundingCategories: [] },
          { keyword: "nutrition", fundingCategories: [] },
        ],
      },
    },
    {
      label: "triage_titles",
      durationMs: 2400,
      data: {
        keep: [
          { id: "363696", why: "AmeriCorps members often staff food banks and gleaning programs." },
          { id: "363482", why: "Older volunteers, a large part of your volunteer base." },
          { id: "363392", why: "Nutrition services, though it may be for health centers." },
          { id: "361876", why: "Specialty crops such as the produce you glean." },
        ],
      },
    },
    {
      label: "score_fit",
      durationMs: 8600,
      data: {
        scores: [
          {
            id: "363696",
            eligible: true,
            ineligibleReason: "",
            fitScore: 63,
            reasons: [
              { text: "AmeriCorps places members with organizations that rely on volunteers, and you already organize about 1,400 of them.", factId: "{{fact:Volunteers}}", noticeQuote: "AmeriCorps members serve with organizations dedicated to the improvement of communities" },
              { text: "Food and Nutrition is one of the program's funding categories, and you moved 2.1 million pounds of food last year.", factId: "{{fact:Food distributed in 2025}}", noticeQuote: "Food and Nutrition" },
            ],
            cautions: ["Most organizations apply through their state service commission, which sets an earlier deadline. Check it first.", "Cost sharing is required.", "Members must be part of an evidence-based or evidence-informed program."],
          },
          {
            id: "363482",
            eligible: true,
            ineligibleReason: "",
            fitScore: 49,
            reasons: [{ text: "RSVP engages adults 55 and older, and your gleaning and pantry shifts depend on volunteers.", factId: "{{fact:Volunteers}}", noticeQuote: "engage adults ages 55 and older" }],
            cautions: ["RSVP grants usually go to one sponsor per county; another group may already hold it.", "The due date is very close."],
          },
          { id: "363392", eligible: false, ineligibleReason: "It funds technical assistance to HRSA health centers, not food distribution.", fitScore: 0, reasons: [], cautions: [] },
          { id: "361876", eligible: false, ineligibleReason: "It funds multi-state partnerships that make specialty crops more competitive, which a single food bank cannot lead.", fitScore: 0, reasons: [], cautions: [] },
        ],
      },
    },
    ...foodbankLetters,
  ],
  grantsgov: grantsgov as unknown as GrantsGovRecording,
};
