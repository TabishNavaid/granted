import { httpUrl, isoDate, plainText } from "../normalize";
import type { EligibilityCode, OpportunityInput } from "../types";
import { causesFromText, researchAreasFromText, uniq } from "../vocab";
import { agencyKeys, type AgencyPath } from "./_sam-shared";

/**
 * SAM.gov Assistance Listings (the federal program catalog, formerly CFDA), from the public Data Services extract
 * AssistanceListings_DataGov_PUBLIC_CURRENT.csv. Listings are programs, not single notices: each becomes one
 * rolling row keyed by its Assistance Listing number so it never collides with a funding notice.
 */

export const ALN_RE = /^\d{2}\.[0-9A-Z]{3}$/;

/** "SUB AGENCY, DEPARTMENT NAME, DEPARTMENT OF" to its department and sub-tier. */
export function splitAgency(raw: string): AgencyPath {
  const parts = raw.split(",").map((p) => p.trim()).filter(Boolean);
  if (!parts.length) return { department: null, subTier: null };
  let deptParts = 1;
  if (parts.length >= 2 && /^(DEPARTMENT|DEPT\.?) OF( THE)?$/i.test(parts[parts.length - 1])) deptParts = 2;
  const department = parts.slice(-deptParts).join(", ");
  const sub = parts.slice(0, parts.length - deptParts).join(", ") || null;
  return { department, subTier: sub };
}

/** Assistance types that are funding someone applies for. Loans, insurance, services, and benefits are left out. */
const FUNDING_TYPE = /\bGRANTS?\b|COOPERATIVE AGREEMENT|DIRECT PAYMENTS? FOR SPECIFIED USE/i;

export function assistanceTypes(raw: string): string[] {
  return uniq(raw.split(";").map((t) => plainText(t)).filter(Boolean));
}

/** Phrases a listing uses when it takes no new applicants; read from its deadlines, objectives, eligibility, and award procedure. */
const CLOSED_RE = /\b(no longer (accepting|accepts|available|making (new )?awards|funded)|not (currently )?accepting (new )?applications|will not (be )?(accepting|making) (new )?(applications|awards)|program (is )?(inactive|discontinued|terminated)|no (new )?(awards|funding) will be made)\b/i;

/** Applicant eligibility text to our codes. Conservative: only phrases that name the applicant type. */
const ELIGIBILITY_RULES: [EligibilityCode, RegExp][] = [
  ["nonprofit", /\b(non-?profit|501\s?\(c\)\s?\(3\))/i],
  ["state_government", /\b(state (governments?|agenc(y|ies)|and local|\(includes)|state,|(?<!united )states (and|,)|(?<!united )states, territories|any state)/i],
  ["local_government", /\b(local (governments?|agenc(y|ies)|units)|units of local government|counties|county governments?|(inter)?municipal(ities|ity)?\b|cities\b|city governments?|special districts?|townships?|state, local)/i],
  ["tribal", /\b(tribes?|tribal|indian|alaska native)\b/i],
  ["university", /\b(universit|colleges?\b|institutions? of higher (education|learning)|(research|educational|academic) institutions?)/i],
  ["school_district", /\b(school districts?|local educational agenc)/i],
  ["housing_authority", /\bhousing authorit/i],
  ["small_business", /\bsmall business/i],
  ["for_profit", /\b(for-profit|profit organizations?|private firms?|commercial (firms|organizations|entities))\b/i],
  ["individual", /\b(individuals? (may|are eligible|who are|must)|eligible individuals|individual (applicants|researchers|scientists|students|investigators))\b/i],
];

export function eligibilityFromText(text: string): EligibilityCode[] {
  if (!text || /^(not applicable|none|n\/a)\.?$/i.test(text.trim())) return [];
  const codes = ELIGIBILITY_RULES.filter(([, re]) => re.test(text)).map(([c]) => c);
  // The listing names who may apply, in words none of our codes fit.
  return codes.length ? codes : ["other"];
}

const MULT: Record<string, number> = { k: 1e3, thousand: 1e3, m: 1e6, million: 1e6, b: 1e9, billion: 1e9 };

/** "$15,000 to $1.5M. Average $200,000" to min, max, and average. Null where the text does not say. */
export function awardRange(text: string): { min: number | null; max: number | null; average: number | null } {
  const t = plainText(text);
  const num = (n: string, unit?: string) => Number(n.replace(/,/g, "")) * (unit ? (MULT[unit.toLowerCase()] ?? 1) : 1);
  const amount = String.raw`\$\s?([\d,]+(?:\.\d+)?)\s*(million|billion|thousand|[MBK])?\b`;
  const range = t.match(new RegExp(`${amount}\\s*(?:-|to|through)\\s*${amount}`, "i")) ?? t.match(new RegExp(`range low:?\\s*${amount}[\\s\\S]{0,20}?range high:?\\s*${amount}`, "i"));
  const avg = t.match(new RegExp(`average[^$]{0,40}${amount}`, "i"));
  let min = range ? num(range[1], range[2]) : null;
  let max = range ? num(range[3], range[4]) : null;
  if (min !== null && max !== null && (min <= 0 || max < min)) min = max = null;
  const average = avg ? num(avg[1], avg[2]) : null;
  return { min: min || null, max: max || null, average: average && average > 0 ? average : null };
}

/** The newest fiscal year's estimate in "(Grant) FY 24$9,482,035.00; FY 25$6,883,976.00; FY 26 est $6,000,000.00; ...", summed over types. */
export function currentObligations(text: string): { fiscalYear: number; amount: number } | null {
  const by = new Map<number, number>();
  for (const m of text.matchAll(/FY\s?(\d{2})\s*est\s*\$\s?([\d,]+(?:\.\d+)?)/gi)) {
    const fy = 2000 + Number(m[1]);
    by.set(fy, (by.get(fy) ?? 0) + Number(m[2].replace(/,/g, "")));
  }
  if (!by.size) return null;
  const fy = Math.max(...by.keys());
  return { fiscalYear: fy, amount: by.get(fy)! };
}

function contactOf(hq: string): OpportunityInput["contact"] {
  const text = plainText(hq.replace(/<\s*a[^>]*href=['"]mailto:([^'"]+)['"][^>]*>/gi, " $1 "));
  const email = text.match(/[\w.+-]+@[\w-]+(\.[\w-]+)+/)?.[0] ?? null;
  const phone = text.match(/Phone:\s*([()\d][\d() .-]{8,20}\d)/i)?.[1]?.trim() ?? null;
  return email || phone ? { email, phone } : null;
}

const RESEARCH_TITLE = /\bresearch\b/i;

export type AlSkip = "invalid" | "not_funding" | "closed";

export function toProgram(r: Record<string, string>, opts: { liveOnly?: boolean } = {}): OpportunityInput | AlSkip {
  const number = (r["Program Number"] ?? "").trim().toUpperCase();
  const title = plainText(r["Program Title"]);
  const url = httpUrl(r.URL);
  if (!ALN_RE.test(number) || !title || !url) return "invalid";
  const types = assistanceTypes(r["Types of Assistance (060)"] ?? "");
  if (!types.some((t) => FUNDING_TYPE.test(t))) return "not_funding";
  const deadlinesText = plainText(r["Deadlines (094)"]);
  const closed = [r["Deadlines (094)"], r["Objectives (050)"], r["Applicant Eligibility (081)"], r["Award Procedure (093)"]].some((t) => CLOSED_RE.test(plainText(t)));
  if (closed && opts.liveOnly) return "closed";
  const agency = splitAgency(r["Federal Agency (030)"] ?? "");
  const keys = agencyKeys(agency);
  const objectives = plainText(r["Objectives (050)"]);
  const eligibilityText = plainText(r["Applicant Eligibility (081)"]);
  const research = /^4[37]\./.test(number) || /NATIONAL INSTITUTES OF HEALTH/i.test(agency.subTier ?? "") || RESEARCH_TITLE.test(title);
  const range = awardRange(r["Range and Average of Financial Assistance (123)"] ?? "");
  const obligations = currentObligations(r["Obligations (122)"] ?? "");
  const website = httpUrl(r["Website Address (153)"]?.trim().split(/\s+/)[0]);
  const text = `${title} ${objectives}`;
  const extra: Record<string, unknown> = { typesOfAssistance: types };
  const popular = plainText(r["Popular Name (020)"]);
  if (popular && !/^not applicable/i.test(popular)) extra.popularName = popular.slice(0, 200);
  if (range.average) extra.averageAward = range.average;
  if (obligations) extra.obligationsFiscalYear = obligations.fiscalYear;
  if (r["Parent Shortname"]?.trim()) extra.agencyShortName = r["Parent Shortname"].trim();
  const useless = /^(not applicable|none|n\/a)\.?$/i;
  return {
    sourceId: number,
    sourceUrl: url,
    opportunityNumber: `ALN ${number}`,
    canonicalKey: `aln:${number}`,
    type: research ? "research" : "grant",
    noticeType: "program",
    title,
    summary: objectives || null,
    funderKey: keys.funderKey,
    funderName: keys.funderName,
    agencyCode: (r["Parent Shortname"] ?? "").trim() || null,
    status: closed ? "closed" : "open",
    postedAt: isoDate((r["Published Date"] ?? "").replace(/,\s*/, ", ")),
    closeAt: null,
    closeText: deadlinesText && !useless.test(deadlinesText) ? deadlinesText.slice(0, 300) : null,
    rolling: true,
    amountMin: range.min,
    amountMax: range.max,
    amountTotal: obligations && obligations.amount > 0 ? obligations.amount : null,
    eligibility: eligibilityFromText(eligibilityText),
    eligibilityText: eligibilityText && !useless.test(eligibilityText) ? eligibilityText : null,
    assistanceListings: [number],
    categories: types.map((t) => t.charAt(0) + t.slice(1).toLowerCase()),
    causes: research ? [] : causesFromText(title),
    researchAreas: research ? researchAreasFromText(text) : [],
    place: { country: "US" },
    attachments: website ? [{ name: "Program website", url: website }] : [],
    contact: contactOf(r["Headquarters Office (152)"] ?? ""),
    extra,
  };
}
