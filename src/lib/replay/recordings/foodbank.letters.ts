import type { RecordedCall } from "../types";
import { A, F, G, P, letter, redraft } from "./letter-kit";

/** Second Furrow's recorded letters for its three strongest matches, and the rewrites after each answer. */
const ORG = `Second Furrow began in 2009, when four church pantries and two apple growers started sharing one cooler and one truck ${F("Year founded")}. Today we run a 14,000-square-foot warehouse in Marion and supply 32 partner pantries, soup kitchens, and shelters ${F("Warehouse size")}, and in 2025 we distributed 2.1 million pounds of food ${F("Food distributed in 2025")}.`;

const NEED = `In parts of McDowell and Rutherford counties the nearest full grocery store is more than 20 miles away ${F("Distance to a full grocery store")}. When we surveyed families at our mobile market stops, 1 in 6 households had skipped meals in the past month ${F("Mobile market households that skipped meals")}.`;

const ASK = (key: string, funder: string, typical: string) => ({ key, paragraphKey: "opening" as const, question: `How much should we ask ${funder} for? Its typical grant in its last filing was ${typical}.`, whyItMatters: "A specific ask near the funder's usual size reads as informed.", suggestedLabel: `Ask to ${funder}` });

export const foodbankLetters: RecordedCall[] = [
  letter(
    "RHI Legacy Foundation Inc. grants",
    {
      opening: `Second Furrow Food Network requests ${G("rhi_ask")} from the RHI Legacy Foundation to bring more fresh produce to families in Rutherford County through our mobile market ${P("Mobile market")}.`,
      organization: ORG,
      need: NEED,
      plan: `Our refrigerated truck visits 11 rural communities twice a month, and families choose their own food, the way they would in a store ${F("Mobile market stops")}. About 38% of what we distributed was fresh produce, up from 24% in 2022 ${F("Share of food that was fresh produce")}. With your support we would add ${G("rhi_stops")} in Rutherford County.`,
      fit: `Your foundation funds programs that improve health and wellness in Rutherford County, and several of its recent grants went to healthy eating. Fresh produce is the part of our work closest to that aim: our volunteers gleaned from 27 farms last year ${F("Farms gleaned")}, and that produce goes to families through the same truck.`,
      closing: `We know your application deadline is July 31, and we would welcome a short call before then to make sure the request fits. Thank you for considering Second Furrow.\n\nTeresa Gaines`,
    },
    [ASK("rhi_ask", "the RHI Legacy Foundation", "$10,262"), { key: "rhi_stops", paragraphKey: "plan", question: "How many new mobile market stops would this grant add in Rutherford County?", whyItMatters: "The foundation funds Rutherford County only, so the request should say exactly what changes there.", suggestedLabel: "New Rutherford County mobile market stops" }],
  ),
  redraft("rhi_ask", `Second Furrow Food Network requests ${A("rhi_ask")} from the RHI Legacy Foundation to bring more fresh produce to families in Rutherford County through our mobile market ${P("Mobile market")}.`),
  redraft("rhi_stops", `Our refrigerated truck visits 11 rural communities twice a month, and families choose their own food, the way they would in a store ${F("Mobile market stops")}. About 38% of what we distributed was fresh produce, up from 24% in 2022 ${F("Share of food that was fresh produce")}. With your support we would add ${A("rhi_stops")} in Rutherford County.`),

  letter(
    "Strickland Family Foundation grants",
    {
      opening: `Second Furrow Food Network would like to ask the Strickland Family Foundation for ${G("sff_ask")} toward the food we move to partner pantries in McDowell and Rutherford counties.`,
      organization: ORG,
      need: `We serve 6,300 households each month on average ${F("Households served each month")}. In parts of our two counties the nearest full grocery store is more than 20 miles away ${F("Distance to a full grocery store")}, so the pantries we supply are often the closest source of fresh food.`,
      plan: `Every dollar given to Second Furrow moves about 7 pounds of food ${F("Food moved per dollar given")}, and our volunteers gave 31,500 hours in 2025 ${F("Volunteer hours in 2025")}. Your gift would ${G("sff_use")}.`,
      fit: `Your recent grants include Second Harvest Food Bank of Northwest North Carolina, so feeding families is part of what you fund. Most of your giving stays near Winston-Salem, and we would rather ask whether western North Carolina fits than assume it does.`,
      closing: `Your filing does not describe how to apply or list deadlines, so we are writing first to ask how you would like to receive a request. Thank you for reading.\n\nTeresa Gaines`,
    },
    [ASK("sff_ask", "the Strickland Family Foundation", "$2,250"), { key: "sff_use", paragraphKey: "plan", question: "What would a Strickland gift pay for: fuel for the mobile market, produce from local farms, or something else?", whyItMatters: "A small gift reads best when it buys one concrete thing.", suggestedLabel: "Use of a Strickland gift" }],
  ),
  redraft("sff_ask", `Second Furrow Food Network would like to ask the Strickland Family Foundation for ${A("sff_ask")} toward the food we move to partner pantries in McDowell and Rutherford counties.`),
  redraft("sff_use", `Every dollar given to Second Furrow moves about 7 pounds of food ${F("Food moved per dollar given")}, and our volunteers gave 31,500 hours in 2025 ${F("Volunteer hours in 2025")}. Your gift would ${A("sff_use")}.`),

  letter(
    "The Foundation for a Healthy High Point grants",
    {
      opening: `We are writing to ask whether The Foundation for a Healthy High Point considers requests from food banks outside the High Point area. Second Furrow Food Network serves McDowell and Rutherford counties ${F("Distance to a full grocery store")}.`,
      organization: ORG,
      need: NEED,
      plan: `Our refrigerated truck visits 11 rural communities twice a month ${F("Mobile market stops")}, and about 38% of what we distributed was fresh produce ${F("Share of food that was fresh produce")}. A grant would ${G("hhp_use")}.`,
      fit: `Your recent grants include the Greater High Point Food Alliance, so food access is part of how you think about health. We also understand that your grantmaking centers on High Point, and we would rather ask than send a request that does not fit.`,
      closing: `Your filing points to your website for guidelines and deadlines. If our work could fit, we would welcome a short call. Thank you for reading.\n\nTeresa Gaines`,
    },
    [{ key: "hhp_use", paragraphKey: "plan", question: "If High Point funds outside its area, what would you ask it to pay for?", whyItMatters: "Even an exploratory letter should name a concrete use.", suggestedLabel: "Use of a Healthy High Point grant" }],
  ),
  redraft("hhp_use", `Our refrigerated truck visits 11 rural communities twice a month ${F("Mobile market stops")}, and about 38% of what we distributed was fresh produce ${F("Share of food that was fresh produce")}. A grant would ${A("hhp_use")}.`),
];
