import type { RecordedCall } from "../types";
import { A, F, G, P, letter, redraft } from "./letter-kit";

/**
 * Riverbend's recorded letters for its three strongest new matches, and the
 * paragraph rewrites after each question is answered.
 */
const ORG = `Riverbend was founded in 2016 by two former teachers at Belmont High School ${F("Year founded")}. We now run programs inside three Dayton Public Schools buildings ${F("Partner schools")}, and in 2025 we served 214 young people across our three programs ${F("People served in 2025")}. A staff of 4 full-time employees ${F("Full-time staff")} works alongside 23 trained volunteer tutors ${F("Volunteer tutors")}.`;

const FRL = (key: string) => ({ key, paragraphKey: "need" as const, question: "What share of your students qualify for free or reduced-price lunch?", whyItMatters: "Funders use it to see that the program reaches the students with the least.", suggestedLabel: "Students eligible for free or reduced-price lunch" });

export const youthLetters: RecordedCall[] = [
  letter(
    "Kettering Family Foundation grants",
    {
      opening: `We are writing to introduce Riverbend Youth Collective and to ask whether a request for After-School Studio ${P("After-School Studio")} would fit the Kettering Family Foundation's priorities. We would ask for ${G("kff_ask")} toward the program's next school year.`,
      organization: ORG,
      need: `Our students live in the 45403, 45404, and 45410 ZIP codes of East Dayton ${F("Service area ZIP codes")}. In these neighborhoods, ${G("kff_frl")} of students qualify for free or reduced-price lunch, and the district's on-time graduation rate is 81% ${F("District graduation rate")}.`,
      plan: `After-School Studio runs four afternoons a week at Belmont High School and Stivers School for the Arts ${P("After-School Studio")}. Students get a hot meal, an hour of small-group tutoring, and an hour in a studio track, and the program enrolled 140 students ${F("After-School Studio enrollment")}. With your support we would use the grant for ${G("kff_use")}.`,
      fit: `Your foundation is based in Dayton, and its recent grants include the Dayton Boys Club. After-School Studio serves the same city's teenagers ${P("After-School Studio")}, and 94% of its seniors graduated on time, compared with 81% district-wide ${F("Graduation rate of enrolled seniors")}.`,
      closing: `We understand the next step is the request summary on your website, ahead of the January 31 or July 31 deadline. We would be glad to send our budget and most recent annual report, and to host a visit on a studio afternoon. Thank you for considering Riverbend.\n\nDana Okafor`,
    },
    [
      { key: "kff_ask", paragraphKey: "opening", question: "How much should we ask the Kettering Family Foundation for? Its typical grant in its last filing was $20,000.", whyItMatters: "A specific, sensible ask makes it easy for a funder to say yes.", suggestedLabel: "Ask to Kettering Family Foundation" },
      FRL("kff_frl"),
      { key: "kff_use", paragraphKey: "plan", question: "What would this grant pay for in After-School Studio?", whyItMatters: "Foundations want to know what their money buys.", suggestedLabel: "Use of the Kettering grant" },
    ],
  ),
  redraft("kff_ask", `We are writing to introduce Riverbend Youth Collective and to ask whether a request for After-School Studio ${P("After-School Studio")} would fit the Kettering Family Foundation's priorities. We would ask for ${A("kff_ask")} toward the program's next school year.`),
  redraft("kff_frl", `Our students live in the 45403, 45404, and 45410 ZIP codes of East Dayton ${F("Service area ZIP codes")}. In these neighborhoods, ${A("kff_frl")} of students qualify for free or reduced-price lunch, and the district's on-time graduation rate is 81% ${F("District graduation rate")}.`),
  redraft("kff_use", `After-School Studio runs four afternoons a week at Belmont High School and Stivers School for the Arts ${P("After-School Studio")}. Students get a hot meal, an hour of small-group tutoring, and an hour in a studio track, and the program enrolled 140 students ${F("After-School Studio enrollment")}. With your support we would use the grant for ${A("kff_use")}.`),

  letter(
    "Martha Holden Jennings Foundation grants",
    {
      opening: `Riverbend Youth Collective would like to apply to the Martha Holden Jennings Foundation for support of After-School Studio ${P("After-School Studio")}, which runs inside Dayton Public Schools buildings ${F("Partner schools")}. Before we complete the application on your website, we want to make sure the project fits your guidelines.`,
      organization: `Riverbend was founded in 2016 by two former teachers at Belmont High School ${F("Year founded")}. In 2025 we served 214 young people across our three programs ${F("People served in 2025")}, and 23 trained volunteer tutors gave more than 1,900 hours ${F("Volunteer tutors")}.`,
      need: `Your foundation supports public school teachers and students throughout Ohio. Our students attend Belmont High School, Stivers School for the Arts, and Wright Brothers Middle School ${F("Partner schools")}, in a district where the on-time graduation rate is 81% ${F("District graduation rate")}.`,
      plan: `After-School Studio gives each student a hot meal, an hour of small-group tutoring led by trained volunteers, and an hour in a studio track, four afternoons a week ${P("After-School Studio")}. The project we would propose is ${G("mhj_project")}, so that classroom teachers and our tutors work from the same plan for each student.`,
      fit: `Nearly all of the foundation's grants stay in Ohio, and many support learning in and around the school day. Riverbend's results are tied to the school day: 94% of seniors enrolled in After-School Studio graduated on time ${F("Graduation rate of enrolled seniors")}, and 88% of surveyed students said they have an adult at Riverbend they can go to with a problem ${F("Students with a trusted adult at Riverbend")}.`,
      closing: `We plan to apply ahead of one of your published deadlines. Our working figure for the request is ${G("mhj_ask")}, and we would welcome guidance if a different amount fits better. Thank you for your time.\n\nDana Okafor`,
    },
    [
      { key: "mhj_project", paragraphKey: "plan", question: "What specific project would you propose to Jennings? It has to support public school teachers or students.", whyItMatters: "The foundation funds projects that support public school teachers and students, not general operations.", suggestedLabel: "Project proposed to the Jennings Foundation" },
      { key: "mhj_ask", paragraphKey: "closing", question: "How much should we request from the Jennings Foundation? Its typical grant in its last filing was $11,102.", whyItMatters: "Its grants are mostly modest; a request near its typical size reads as informed.", suggestedLabel: "Ask to Martha Holden Jennings Foundation" },
    ],
  ),
  redraft("mhj_project", `After-School Studio gives each student a hot meal, an hour of small-group tutoring led by trained volunteers, and an hour in a studio track, four afternoons a week ${P("After-School Studio")}. The project we would propose is ${A("mhj_project")}, so that classroom teachers and our tutors work from the same plan for each student.`),
  redraft("mhj_ask", `We plan to apply ahead of one of your published deadlines. Our working figure for the request is ${A("mhj_ask")}, and we would welcome guidance if a different amount fits better. Thank you for your time.\n\nDana Okafor`),

  letter(
    "Doris & Floyd Kimble Foundation grants",
    {
      opening: `We are writing to ask whether the Doris & Floyd Kimble Foundation would consider a written request of ${G("dfk_ask")} from Riverbend Youth Collective, an after-school and summer program in East Dayton ${F("Service area ZIP codes")}.`,
      organization: ORG,
      need: `Our students live in the 45403, 45404, and 45410 ZIP codes ${F("Service area ZIP codes")}, where ${G("dfk_frl")} of students qualify for free or reduced-price lunch. Of the 85 families our navigators worked with, 79 of their students stayed in school through June ${F("Navigator students who stayed in school")}.`,
      plan: `Summer Launch pairs hands-on STEM projects in the morning with a paid first job in the afternoon ${P("Summer Launch")}, and students earn $15 an hour at neighborhood businesses ${F("Summer Launch wage")}. A grant would let us ${G("dfk_use")}.`,
      fit: `Your filing lists educational programs and sustaining support for community organizations, and it accepts written requests at any time. Most of your grants stay close to Dover and New Philadelphia, so we would be grateful to know whether a Dayton program can be considered before we send a full request.`,
      closing: `Thank you for reading. With a full request we can send our budget, our annual report, and our IRS determination letter.\n\nDana Okafor`,
    },
    [
      { key: "dfk_ask", paragraphKey: "opening", question: "How much should we ask the Kimble Foundation for? Its typical grant in its last filing was $10,000.", whyItMatters: "A first request to a new funder is usually close to its typical grant.", suggestedLabel: "Ask to Doris & Floyd Kimble Foundation" },
      FRL("dfk_frl"),
      { key: "dfk_use", paragraphKey: "plan", question: "What would this grant let Summer Launch do that it cannot do now?", whyItMatters: "A clear use turns a general request into a fundable one.", suggestedLabel: "Use of the Kimble grant" },
    ],
  ),
  redraft("dfk_ask", `We are writing to ask whether the Doris & Floyd Kimble Foundation would consider a written request of ${A("dfk_ask")} from Riverbend Youth Collective, an after-school and summer program in East Dayton ${F("Service area ZIP codes")}.`),
  redraft("dfk_frl", `Our students live in the 45403, 45404, and 45410 ZIP codes ${F("Service area ZIP codes")}, where ${A("dfk_frl")} of students qualify for free or reduced-price lunch. Of the 85 families our navigators worked with, 79 of their students stayed in school through June ${F("Navigator students who stayed in school")}.`),
  redraft("dfk_use", `Summer Launch pairs hands-on STEM projects in the morning with a paid first job in the afternoon ${P("Summer Launch")}, and students earn $15 an hour at neighborhood businesses ${F("Summer Launch wage")}. A grant would let us ${A("dfk_use")}.`),
];
