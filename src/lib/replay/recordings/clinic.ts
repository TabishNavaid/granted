import type { GrantsGovRecording, Recording } from "../types";
import grantsgov from "./clinic.grantsgov.json";
import { clinicLetters } from "./clinic.letters";

/**
 * Pine Hollow Family Health, a fictional nonprofit rural clinic in Leslie
 * County, Kentucky. The website below does not exist. The Grants.gov notices
 * are real, fetched on the day in `recordedOn`.
 */
const HOME = "https://pinehollowhealth.org/";

export const recording: Recording = {
  id: "clinic",
  recordedOn: "2026-10-18",
  site: {
    homepage: HOME,
    pages: [
      {
        url: HOME,
        title: "Pine Hollow Family Health",
        kind: "html",
        text: `Pine Hollow Family Health
Primary care for the hollows of Leslie and Clay counties.
Pine Hollow Family Health provides primary care to everyone in Leslie and Clay counties, whether or not they can pay, close to where they live.
In 2025 we cared for 3,420 patients in 11,860 visits at our clinic in Hyden and on our mobile health unit.
We see patients on a sliding fee scale. No one is turned away because they cannot pay.
New patients are welcome. Call the clinic to make an appointment, or find the mobile unit's schedule below.
Pine Hollow Family Health is a 501(c)(3) nonprofit clinic in Hyden, Kentucky.`,
      },
      {
        url: "https://pinehollowhealth.org/about",
        title: "About the clinic",
        kind: "html",
        text: `About the clinic
Pine Hollow Family Health opened in 1998 in two rooms above the Hyden post office, started by a nurse practitioner and a local congregation.
Today our clinic has 9 exam rooms. Our care team includes 1 physician, 3 nurse practitioners, 4 community health workers, and a licensed clinical social worker.
We employ 24 people, and 21 of them grew up in Leslie or Clay county.
Who we serve
Most of our patients live in hollows along gravel roads. Many have no reliable car. The nearest hospital is a forty-minute drive from much of the county.
62% of our patients are covered by Medicaid and 14% have no insurance at all.`,
      },
      {
        url: "https://pinehollowhealth.org/services",
        title: "Services",
        kind: "html",
        text: `Services
Primary care
Checkups, sick visits, chronic disease care, women's health, and vaccines for all ages.
Mobile health unit
Our mobile unit visits 9 communities on a weekly route and made 1,140 visits in 2025. It carries a nurse practitioner, a community health worker, and a telehealth link to the clinic.
Diabetes care
Sugar Smart is our diabetes self-management program. 186 patients took part in 2025, meeting with a nurse and a community health worker every month.
Recovery care
We offer medications for opioid use disorder with counseling, in the same clinic as everything else, so no one has to be seen walking into a separate building.
Community health workers
Our 4 community health workers visit patients at home, help with insurance and prescriptions, and drive patients to specialist visits when no one else can.`,
      },
      {
        url: "https://pinehollowhealth.org/results",
        title: "Results",
        kind: "html",
        text: `Results
Sugar Smart participants lowered their average A1C from 9.1 to 7.8 over twelve months.
Recovery care
112 patients were in recovery care with us in 2025. 71% were still in care after six months.
Emergency room visits
Patients enrolled with a community health worker had 38% fewer emergency room visits than the year before they enrolled.`,
      },
      {
        url: "https://pinehollowhealth.org/files/pine-hollow-annual-report-2025.pdf",
        title: "pine-hollow-annual-report-2025.pdf",
        kind: "pdf",
        text: `Pine Hollow Family Health
Annual Report 2025
Finances
Total operating expenses were $2,184,600. Patient revenue covered 58% of costs. Grants and donations covered the rest.
Our partners
We work with the county health department, two churches that host the mobile unit, and the regional hospital, which takes our referrals for specialty care.
What comes next
We want to add a second mobile route in Clay County and connect our clinic, the health department, and two other rural clinics into one referral network, so a patient seen in one place is known in all of them.`,
      },
    ],
    skipped: [{ url: "https://pinehollowhealth.org/patient-portal", reason: "not a page (application/octet-stream)" }],
  },
  calls: [
    {
      label: "extract_profile",
      durationMs: 7600,
      data: {
        profile: {
          name: "Pine Hollow Family Health",
          mission: "Pine Hollow Family Health provides primary care to everyone in Leslie and Clay counties, whether or not they can pay, close to where they live.",
          programs: ["Primary care", "Mobile health unit", "Sugar Smart", "Recovery care", "Community health workers"],
          populations: ["Rural residents of Leslie and Clay counties", "Patients covered by Medicaid", "Uninsured patients", "People in recovery from opioid use disorder"],
          causes: ["Rural health", "Primary care", "Chronic disease", "Substance use recovery"],
          city: "Hyden",
          state: "KY",
          serviceArea: "Leslie and Clay counties, Kentucky",
          annualBudget: "$2,184,600",
          foundedYear: "1998",
          staffSize: "24",
        },
        facts: [
          { label: "Patients in 2025", value: "3,420", category: "reach", sourceUrl: HOME, excerpt: "In 2025 we cared for 3,420 patients in 11,860 visits at our clinic in Hyden and on our mobile health unit." },
          { label: "Visits in 2025", value: "11,860", category: "reach", sourceUrl: HOME, excerpt: "In 2025 we cared for 3,420 patients in 11,860 visits at our clinic in Hyden and on our mobile health unit." },
          { label: "Sliding fee scale", value: "No one is turned away because they cannot pay", category: "organization", sourceUrl: HOME, excerpt: "We see patients on a sliding fee scale. No one is turned away because they cannot pay." },
          { label: "Year founded", value: "1998", category: "organization", sourceUrl: "https://pinehollowhealth.org/about", excerpt: "Pine Hollow Family Health opened in 1998 in two rooms above the Hyden post office, started by a nurse practitioner and a local congregation." },
          { label: "Care team", value: "1 physician, 3 nurse practitioners, 4 community health workers, 1 licensed clinical social worker", category: "people", sourceUrl: "https://pinehollowhealth.org/about", excerpt: "Our care team includes 1 physician, 3 nurse practitioners, 4 community health workers, and a licensed clinical social worker." },
          { label: "Staff", value: "24", category: "people", sourceUrl: "https://pinehollowhealth.org/about", excerpt: "We employ 24 people, and 21 of them grew up in Leslie or Clay county." },
          { label: "Distance to the nearest hospital", value: "40 minutes", category: "geography", sourceUrl: "https://pinehollowhealth.org/about", excerpt: "The nearest hospital is a forty-minute drive from much of the county." },
          { label: "Patients covered by Medicaid", value: "62%", category: "reach", sourceUrl: "https://pinehollowhealth.org/about", excerpt: "62% of our patients are covered by Medicaid and 14% have no insurance at all." },
          { label: "Patients with no insurance", value: "14%", category: "reach", sourceUrl: "https://pinehollowhealth.org/about", excerpt: "62% of our patients are covered by Medicaid and 14% have no insurance at all." },
          { label: "Mobile unit communities", value: "9", category: "reach", sourceUrl: "https://pinehollowhealth.org/services", excerpt: "Our mobile unit visits 9 communities on a weekly route and made 1,140 visits in 2025." },
          { label: "Mobile unit visits in 2025", value: "1,140", category: "reach", sourceUrl: "https://pinehollowhealth.org/services", excerpt: "Our mobile unit visits 9 communities on a weekly route and made 1,140 visits in 2025." },
          { label: "Sugar Smart participants in 2025", value: "186", category: "reach", sourceUrl: "https://pinehollowhealth.org/services", excerpt: "186 patients took part in 2025, meeting with a nurse and a community health worker every month." },
          { label: "Sugar Smart A1C change", value: "9.1 to 7.8 over twelve months", category: "outcomes", sourceUrl: "https://pinehollowhealth.org/results", excerpt: "Sugar Smart participants lowered their average A1C from 9.1 to 7.8 over twelve months." },
          { label: "Recovery care patients in 2025", value: "112", category: "reach", sourceUrl: "https://pinehollowhealth.org/results", excerpt: "112 patients were in recovery care with us in 2025." },
          { label: "Recovery care retention at six months", value: "71%", category: "outcomes", sourceUrl: "https://pinehollowhealth.org/results", excerpt: "71% were still in care after six months." },
          { label: "Fewer ER visits with a community health worker", value: "38%", category: "outcomes", sourceUrl: "https://pinehollowhealth.org/results", excerpt: "Patients enrolled with a community health worker had 38% fewer emergency room visits than the year before they enrolled." },
          { label: "Total operating expenses (2025)", value: "$2,184,600", category: "finance", sourceUrl: "https://pinehollowhealth.org/files/pine-hollow-annual-report-2025.pdf", excerpt: "Total operating expenses were $2,184,600." },
          { label: "Costs covered by patient revenue", value: "58%", category: "finance", sourceUrl: "https://pinehollowhealth.org/files/pine-hollow-annual-report-2025.pdf", excerpt: "Patient revenue covered 58% of costs." },
          { label: "Planned referral network", value: "the clinic, the health department, and two other rural clinics", category: "organization", sourceUrl: "https://pinehollowhealth.org/files/pine-hollow-annual-report-2025.pdf", excerpt: "connect our clinic, the health department, and two other rural clinics into one referral network" },
        ],
      },
    },
    {
      label: "plan_searches",
      durationMs: 2000,
      data: {
        searches: [
          { keyword: "rural health", fundingCategories: ["HL"] },
          { keyword: "telehealth", fundingCategories: [] },
          { keyword: "diabetes", fundingCategories: ["HL"] },
        ],
      },
    },
    {
      label: "triage_titles",
      durationMs: 2900,
      data: {
        keep: [
          { id: "363581", why: "Planning a rural health network, which the annual report says is next." },
          { id: "363686", why: "Rural overdose response, close to recovery care." },
          { id: "363277", why: "Telehealth nutrition services for chronic disease, close to Sugar Smart and the mobile unit's telehealth link." },
          { id: "363580", why: "Rural health network development, the larger version of the planning grant." },
          { id: "363697", why: "Appalachian rural health organizations." },
          { id: "364055", why: "Chronic disease education." },
          { id: "363423", why: "Health center service areas." },
        ],
      },
    },
    {
      label: "score_fit",
      durationMs: 10200,
      data: {
        scores: [
          {
            id: "363581",
            eligible: true,
            ineligibleReason: "",
            fitScore: 86,
            reasons: [
              { text: "Your annual report already plans a referral network with the health department and two other rural clinics, which is what this grant pays to plan.", factId: "{{fact:Planned referral network}}", noticeQuote: "supports the planning and development of rural integrated health care networks" },
              { text: "Up to $100,000 for planning is a sensible size next to a $2.2 million budget.", factId: "{{fact:Total operating expenses (2025)}}", noticeQuote: "Award range: 0 to 100000" },
              { text: "You serve a rural, underserved population, which every applicant must show.", factId: "{{fact:Patients with no insurance}}", noticeQuote: "capacity to serve, rural underserved populations" },
            ],
            cautions: ["Forecast only. Applications are not open yet.", "Network members usually sign letters of commitment before you apply."],
          },
          {
            id: "363686",
            eligible: true,
            ineligibleReason: "",
            fitScore: 74,
            reasons: [
              { text: "You already run recovery care with medications for opioid use disorder, and this program funds overdose prevention in rural areas.", factId: "{{fact:Recovery care patients in 2025}}", noticeQuote: "reduce and prevent the risk of overdoses in rural areas" },
              { text: "Your mobile unit already serves 9 rural communities, and only HRSA-designated rural counties and tracts qualify.", factId: "{{fact:Mobile unit communities}}", noticeQuote: "may only support HRSA-designated rural counties and rural census tracts" },
            ],
            cautions: ["Confirm both counties are on HRSA's rural list before writing.", "Forecast only. Applications are not open yet."],
          },
          {
            id: "363277",
            eligible: true,
            ineligibleReason: "",
            fitScore: 68,
            reasons: [{ text: "Sugar Smart lowered average A1C from 9.1 to 7.8, and this program uses telehealth nutrition services to manage chronic disease.", factId: "{{fact:Sugar Smart A1C change}}", noticeQuote: "telehealth nutrition services to help prevent and manage chronic diseases" }],
            cautions: ["It funds telehealth networks, so you would need partner sites.", "You would need a registered dietitian, on staff or under contract."],
          },
          {
            id: "363580",
            eligible: true,
            ineligibleReason: "",
            fitScore: 58,
            reasons: [{ text: "Rural health clinics are named among eligible applicants, and you serve rural patients.", factId: "{{fact:Patients in 2025}}", noticeQuote: "Rural Health Clinics (RHCs)" }],
            cautions: ["This is for networks that already exist. The planning grant comes first.", "Awards of $300,000 to $500,000 bring federal reporting a small team will feel."],
          },
          { id: "363697", eligible: true, ineligibleReason: "", fitScore: 31, reasons: [], cautions: ["It funds one organization to give technical assistance to rural clinics, not the clinics themselves."] },
          { id: "364055", eligible: false, ineligibleReason: "It will not consider applications on diabetes, which is the chronic disease Pine Hollow works on.", fitScore: 0, reasons: [], cautions: [] },
          { id: "363423", eligible: false, ineligibleReason: "It funds health center service areas listed in the agency's own table, and Pine Hollow is not a federally funded health center.", fitScore: 0, reasons: [], cautions: [] },
        ],
      },
    },
    ...clinicLetters,
  ],
  grantsgov: grantsgov as unknown as GrantsGovRecording,
};
