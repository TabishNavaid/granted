import type { RecordedCall } from "../types";
import { A, F, G, P, letter, redraft } from "./letter-kit";

/** Pine Hollow's recorded letters for its strongest matches, and the rewrites after each answer. */
const ORG = `Pine Hollow opened in 1998 in two rooms above the Hyden post office ${F("Year founded")}. In 2025 we cared for 3,420 patients in 11,860 visits ${F("Patients in 2025")}, with a care team of 1 physician, 3 nurse practitioners, 4 community health workers, and a licensed clinical social worker ${F("Care team")}.`;

export const clinicLetters: RecordedCall[] = [
  letter(
    "Rural Health Network Development Planning Program",
    {
      opening: `Pine Hollow Family Health intends to apply to the Rural Health Network Development Planning Program to plan a referral network with the county health department and two other rural clinics ${F("Planned referral network")}. We are writing to introduce the clinic and to ask the program office for guidance before the notice opens.`,
      organization: ORG,
      need: `62% of our patients are covered by Medicaid and 14% have no insurance at all ${F("Patients covered by Medicaid")}. When a patient has someone coordinating their care, it shows: patients enrolled with a community health worker had 38% fewer emergency room visits than the year before they enrolled ${F("Fewer ER visits with a community health worker")}.`,
      plan: `The planning year would bring our clinic, the health department, and two other rural clinics into one referral network ${F("Planned referral network")}, so a patient seen in one place is known in all of them. The partners who have agreed to plan with us are ${G("rhn_partners")}.`,
      fit: `The program supports the planning and development of rural integrated health care networks, and applicants must show experience serving rural underserved populations. Our mobile unit visits 9 communities on a weekly route ${F("Mobile unit communities")}, and our network plan is already written into our annual report ${F("Planned referral network")}.`,
      closing: `We understand the notice is forecast with an estimated due date of March 23, 2027, and that awards go up to $100,000. We will apply when it opens and would be grateful for any guidance before then.\n\nDr. Ruth Sizemore`,
    },
    [{ key: "rhn_partners", paragraphKey: "plan", question: "Which partners have agreed, in writing or by email, to plan the network with you?", whyItMatters: "Network grants are judged on the partners who have committed, and reviewers expect letters of commitment.", suggestedLabel: "Committed network partners" }],
  ),
  redraft("rhn_partners", `The planning year would bring our clinic, the health department, and two other rural clinics into one referral network ${F("Planned referral network")}, so a patient seen in one place is known in all of them. The partners who have agreed to plan with us are ${A("rhn_partners")}.`),

  letter(
    "Rural Communities Opioid Response Program - Overdose Response",
    {
      opening: `Pine Hollow Family Health intends to apply to the Rural Communities Opioid Response Program - Overdose Response to reach more people in Leslie and Clay counties through our recovery care ${P("Recovery care")}. We are writing to introduce the clinic and to ask the program office a question about eligibility before the notice opens.`,
      organization: ORG,
      need: `62% of our patients are covered by Medicaid and 14% have no insurance at all ${F("Patients covered by Medicaid")}. 112 patients were in recovery care with us in 2025 ${F("Recovery care patients in 2025")}, and 71% were still in care after six months ${F("Recovery care retention at six months")}.`,
      plan: `We offer medications for opioid use disorder with counseling, in the same clinic as everything else ${P("Recovery care")}, and our mobile unit visits 9 communities on a weekly route ${F("Mobile unit communities")}. With this award we would ${G("ror_use")}.`,
      fit: `The program aims to reduce and prevent the risk of overdoses in rural areas, and its services may only support HRSA-designated rural counties and rural census tracts. HRSA's eligibility analyzer lists Leslie and Clay counties as ${G("ror_counties")}.`,
      closing: `We understand the notice is forecast with an estimated due date of March 10, 2027, and that each award is $300,000. We will apply when it opens and would be grateful for any guidance before then.\n\nDr. Ruth Sizemore`,
    },
    [
      { key: "ror_use", paragraphKey: "plan", question: "What would this award let recovery care do that it cannot do now: naloxone on the mobile unit, a peer recovery coach, or something else?", whyItMatters: "Reviewers score the plan on what changes for people at risk of overdose.", suggestedLabel: "Use of the overdose response award" },
      { key: "ror_counties", paragraphKey: "fit", question: "How does HRSA's Rural Health Grants Eligibility Analyzer on hrsa.gov list Leslie and Clay counties: rural, partly rural, or not rural?", whyItMatters: "Only HRSA-designated rural counties and tracts qualify, so the letter should say so plainly.", suggestedLabel: "HRSA rural status of Leslie and Clay counties" },
    ],
  ),
  redraft("ror_use", `We offer medications for opioid use disorder with counseling, in the same clinic as everything else ${P("Recovery care")}, and our mobile unit visits 9 communities on a weekly route ${F("Mobile unit communities")}. With this award we would ${A("ror_use")}.`),
  redraft("ror_counties", `The program aims to reduce and prevent the risk of overdoses in rural areas, and its services may only support HRSA-designated rural counties and rural census tracts. HRSA's eligibility analyzer lists Leslie and Clay counties as ${A("ror_counties")}.`),

  letter(
    "The Yung Family Foundation grants",
    {
      opening: `We are writing to ask whether The Yung Family Foundation would consider a request from Pine Hollow Family Health for recovery care ${P("Recovery care")} in Leslie and Clay counties.`,
      organization: ORG,
      need: `112 patients were in recovery care with us in 2025 ${F("Recovery care patients in 2025")}, and 71% were still in care after six months ${F("Recovery care retention at six months")}. Keeping people in care that long is what recovery depends on.`,
      plan: `We offer medications for opioid use disorder with counseling, in the same clinic as everything else ${P("Recovery care")}. A grant would pay for ${G("yff_use")}.`,
      fit: `Your filing names three objectives: veterans, research of mental health, and education for disadvantaged youth. Our recovery care is treatment rather than research, so we want to ask plainly whether it fits before we send a full request. Among our patients, ${G("yff_veterans")} are veterans.`,
      closing: `Your filing invites letters by mail with the purpose and background of the organization, and lists no deadline. Thank you for reading.\n\nDr. Ruth Sizemore`,
    },
    [
      { key: "yff_use", paragraphKey: "plan", question: "What would a Yung Family Foundation grant pay for in recovery care?", whyItMatters: "The foundation reviews every application, and a specific use helps it judge fit.", suggestedLabel: "Use of the Yung grant" },
      { key: "yff_veterans", paragraphKey: "fit", question: "How many of your patients are veterans? An estimate from your records is fine.", whyItMatters: "Veterans are one of the foundation's three stated objectives.", suggestedLabel: "Patients who are veterans" },
    ],
  ),
  redraft("yff_use", `We offer medications for opioid use disorder with counseling, in the same clinic as everything else ${P("Recovery care")}. A grant would pay for ${A("yff_use")}.`),
  redraft("yff_veterans", `Your filing names three objectives: veterans, research of mental health, and education for disadvantaged youth. Our recovery care is treatment rather than research, so we want to ask plainly whether it fits before we send a full request. Among our patients, ${A("yff_veterans")} are veterans.`),

  letter(
    "Ray & Kay Eckstein Charitable Trust grants",
    {
      opening: `Pine Hollow Family Health would like to submit a request for 2026 funding to the Ray & Kay Eckstein Charitable Trust for our mobile health unit ${P("Mobile health unit")}. We would ask for ${G("ekt_ask")}.`,
      organization: ORG,
      need: `Our mobile unit visits 9 communities on a weekly route and made 1,140 visits in 2025 ${F("Mobile unit visits in 2025")}. 14% of our patients have no insurance at all ${F("Patients with no insurance")}, and we see everyone on a sliding fee scale ${F("Sliding fee scale")}.`,
      plan: `The unit carries a nurse practitioner, a community health worker, and a telehealth link to the clinic ${P("Mobile health unit")}. The request would fund ${G("ekt_use")}.`,
      fit: `Your trust supports human needs, families, and vibrant communities, and its recent grants include recovery and health work in Kentucky. No one is turned away from Pine Hollow because they cannot pay ${F("Sliding fee scale")}, and the mobile unit is how that promise reaches families far from the clinic.`,
      closing: `Your filing says requests for 2026 funding are submitted online with an IRS determination letter. We will follow those steps and would be glad to answer questions first.\n\nDr. Ruth Sizemore`,
    },
    [
      { key: "ekt_ask", paragraphKey: "opening", question: "How much should we ask the Eckstein Trust for? Its typical grant in its last filing was $50,000.", whyItMatters: "A specific ask near the trust's usual size reads as informed.", suggestedLabel: "Ask to the Ray & Kay Eckstein Charitable Trust" },
      { key: "ekt_use", paragraphKey: "plan", question: "What would this grant fund on the mobile unit: a second route, staff, fuel and upkeep, or something else?", whyItMatters: "Funders want to know what changes because of their money.", suggestedLabel: "Use of the Eckstein grant" },
    ],
  ),
  redraft("ekt_ask", `Pine Hollow Family Health would like to submit a request for 2026 funding to the Ray & Kay Eckstein Charitable Trust for our mobile health unit ${P("Mobile health unit")}. We would ask for ${A("ekt_ask")}.`),
  redraft("ekt_use", `The unit carries a nurse practitioner, a community health worker, and a telehealth link to the clinic ${P("Mobile health unit")}. The request would fund ${A("ekt_use")}.`),
];
