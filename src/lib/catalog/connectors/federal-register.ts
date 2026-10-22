import { causesFromText, researchAreasFromText, uniq, type EligibilityCode } from "../vocab";
import { deadline, int, isoDate, normalizeNumber, plainText } from "../normalize";
import { getJson, getText } from "../ingest/http";
import type { Attachment, Connector, FunderInput, IngestContext, KeyDate, OpportunityInput, SourceDefinition } from "../types";

/**
 * Federal Register: funding notices agencies publish in the daily Federal Register (notices of funding
 * opportunity or availability, "applications for new awards", competition announcements). Many of these
 * are also on Grants.gov; when a notice links to its Grants.gov listing we look up the Grants.gov
 * opportunity number so the two rows dedupe, and Grants.gov stays the primary listing.
 *
 * API: https://www.federalregister.gov/developers/documentation/api/v1 (no key). Search is full text, so
 * precision comes from a title and action classifier (isFundingNotice). The API pages through at most
 * 2,000 results per query; we search in date windows that stay under that and split any that do not.
 * Programmatic access to the website itself is blocked; only the API and the full-text links it returns
 * (raw_text_url) are used.
 */
export const source: SourceDefinition = {
  id: "federal_register",
  name: "Federal Register",
  covers: "Funding notices federal agencies publish in the Federal Register, such as notices of funding opportunity and applications for new awards, with deadlines read from each notice.",
  homepage: "https://www.federalregister.gov",
  docsUrl: "https://www.federalregister.gov/developers/documentation/api/v1",
  termsUrl: "https://www.federalregister.gov/reader-aids/government-policy-and-ofr-procedures/about-this-site",
  license: "Public domain (1 CFR 2.6: anyone may reproduce Federal Register material)",
  attribution: "Source: FederalRegister.gov, Office of the Federal Register",
  kinds: ["grant", "research"],
  region: "us",
  cadence: "Daily on weekdays",
  schedule: "30 12 * * 1-5",
  enabled: true,
  priority: 20,
};

const API = "https://www.federalregister.gov/api/v1/documents.json";
const GRANTS_GOV_FETCH = "https://api.grants.gov/v1/api/fetchOpportunity";

/** Phrase searches (full text). Each is cheap; the classifier decides what is a funding notice. */
export const SEARCH_TERMS = [
  '"funding opportunity"',
  '"funds availability"',
  '"funding availability"',
  '"availability of funds"',
  '"new awards"',
  '"inviting applications"',
  '"request for applications"',
  '"request for proposals"',
  '"solicitation of applications"',
  '"notice announcing"',
  '"competition announcement"',
  '"grant application"',
  '"grant funds"',
  '"pre-applications"',
  '"funding round"',
];

const FIELDS = ["document_number", "title", "type", "abstract", "action", "dates", "html_url", "pdf_url", "publication_date", "agencies", "raw_text_url"];

/** The API serves at most this many results per query; larger result sets need narrower date windows. */
const MAX_REACHABLE = 2_000;
const PER_PAGE = 1_000;
const BACKFILL_DAYS = 365;
const WINDOW_DAYS = 92;

export interface FrAgency {
  raw_name?: string | null;
  name?: string | null;
  id?: number | null;
  parent_id?: number | null;
  slug?: string | null;
}

export interface FrDoc {
  document_number: string;
  title: string;
  type?: string | null;
  abstract?: string | null;
  action?: string | null;
  dates?: string | null;
  html_url: string;
  pdf_url?: string | null;
  publication_date: string;
  agencies?: FrAgency[] | null;
  raw_text_url?: string | null;
}

interface FrSearch {
  count: number;
  total_pages?: number;
  results?: FrDoc[];
}

export function searchUrl(term: string, from: string, to: string, page = 1): string {
  const p = new URLSearchParams();
  p.set("per_page", String(PER_PAGE));
  p.set("page", String(page));
  p.set("order", "oldest");
  p.set("conditions[term]", term);
  p.append("conditions[type][]", "NOTICE");
  p.set("conditions[publication_date][gte]", from);
  p.set("conditions[publication_date][lte]", to);
  for (const f of FIELDS) p.append("fields[]", f);
  return `${API}?${p.toString()}`;
}

// ---------- Classifier ----------

const TITLE_INCLUDE = new RegExp(
  [
    "notices? of funding (opportunit|availabilit)",
    "notices? of funds? availab",
    "funds? availability",
    "availability of (\\S+ )?(funds|funding|grant funds|competitive grant funds)",
    "fund(ing)? opportunit",
    "applications? for new awards",
    "new awards",
    "inviting (applications|proposals|pre-?applications)",
    "request for (grant )?(applications|proposals)",
    "solicitation (of|for) (grant )?(applications|proposals)",
    "call for (applications|proposals)",
    "competition announcement",
    "program competition",
    "grants? competition",
    "grant guideline",
    "pre-?applications? for",
    "grant application package",
    "allocation availability",
    "funding round",
  ].join("|"),
  "i",
);

const TITLE_EXCLUDE = new RegExp(
  [
    "information collection", "privacy act", "paperwork", "submission for omb", "omb review", "comment request",
    "\\bmeetings?\\b", "advisory (committee|board|council|panel|group)", "nominations?", "membership", "\\bmembers\\b", "vacanc",
    "intent to (award|prepare)", "sole[- ]source", "single[- ]source", "unsolicited", "declaration", "\\bcorrections?\\b",
    "extension", "extending", "reopening", "deadline (date )?(extension|dates?)", "terminat", "cancell?ation", "withdraw",
    "rescission", "recission", "amendment", "amended", "final (priorit|rule|requirement|definition)",
    "proposed (priorit|requirement|definition)", "binational", "roster", "request for information", "request for comments?",
    "environmental impact", "data collection", "supplemental funding", "project selections?", "selections? for", "waiver",
    "tariff", "harmonized system", "exemption",
  ].join("|"),
  "i",
);

const ACTION_EXCLUDE = /intent to award|supplement|correction|extension|reopen|cancel|withdraw|rescission|recission|final|proposed|information collection|meeting/i;
const ACTION_INCLUDE = /notice of (funding|funds) (opportunity|availability)|funding opportunity|availability of (funds|funding)|inviting applications|solicitation of (grant )?applications|fund opportunity|funding availability/i;
const ABSTRACT_INCLUDE = /\b(is|are) (soliciting|inviting|accepting) (applications|proposals|pre-?applications|letters of (intent|interest))|announc\w* (the )?(availability of (funds|funding|grant)|opportunity to apply)/i;

/** True when a Federal Register notice announces money someone can apply for. Corrections, extensions, and paperwork notices are left out. */
export function isFundingNotice(d: Pick<FrDoc, "title" | "action" | "abstract" | "type">): boolean {
  const title = d.title ?? "";
  const action = d.action ?? "";
  if (d.type && d.type !== "Notice") return false;
  if (TITLE_EXCLUDE.test(title) || ACTION_EXCLUDE.test(action)) return false;
  if (TITLE_INCLUDE.test(title)) return true;
  if (/^notice announcing /i.test(title) && /program|competition|grants?/i.test(title)) return true;
  if (ACTION_INCLUDE.test(action)) return true;
  return ABSTRACT_INCLUDE.test(d.abstract ?? "") && /grant|fund|program|award|competition/i.test(title);
}

// ---------- Text helpers ----------

/** The GPO text of a notice (HTML-wrapped <pre>) to plain lines, with page markers dropped and links broken across lines rejoined. */
export function noticeText(raw: string): string {
  return plainText(raw.replace(/<pre>/gi, "").replace(/<\/pre>/gi, ""))
    .replace(/\[\[Page \d+\]\]/g, "")
    .replace(/(https?:\/\/\S*?-)\n(?=[a-z0-9])/gi, "$1")
    .replace(/(https?:\/\/\S*?\/)\n(?=[a-z0-9])/gi, "$1")
    .replace(/``|''/g, '"')
    .trim();
}

const HEADINGS = ["SUMMARY", "DATES", "ADDRESSES", "FOR FURTHER INFORMATION CONTACT", "SUPPLEMENTARY INFORMATION", "AGENCY", "ACTION"];

/** One labeled section of a notice ("DATES:"), up to the next standard heading. */
export function section(text: string, name: string): string | null {
  const start = text.search(new RegExp(`(^|\\n)${name}:`, "i"));
  if (start < 0) return null;
  const after = text.slice(start).replace(new RegExp(`^\\n?${name}:\\s*`, "i"), "");
  const others = HEADINGS.filter((h) => h !== name).join("|");
  const end = after.search(new RegExp(`\\n(${others}):`, "i"));
  const body = (end >= 0 ? after.slice(0, end) : after.slice(0, 6_000)).trim();
  return body || null;
}

const MONTH = "(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|June?|July?|Aug(?:ust)?|Sept?(?:ember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)";
const DATE_RE = new RegExp(`\\b(${MONTH})\\.?\\s+(\\d{1,2}),?\\s+(\\d{4})`, "g");
const TIME_RE = /\b(\d{1,2})(?::(\d{2}))?(?::\d{2})?\s*(a\.?m\.?|p\.?m\.?)/i;

function datesIn(s: string): string[] {
  const out: string[] = [];
  for (const m of s.replace(/\s+/g, " ").matchAll(DATE_RE)) {
    const d = isoDate(`${m[1]} ${m[2]}, ${m[3]}`);
    if (d) out.push(d);
  }
  return out;
}

/** US Eastern offset for a date: daylight time from the second Sunday of March to the first Sunday of November. */
function easternOffset(day: string): string {
  const [y, m, d] = day.split("-").map(Number);
  const nthSunday = (month: number, n: number) => {
    const first = new Date(Date.UTC(y, month - 1, 1)).getUTCDay();
    return 1 + ((7 - first) % 7) + (n - 1) * 7;
  };
  const dstStart = nthSunday(3, 2);
  const dstEnd = nthSunday(11, 1);
  const inDst = (m > 3 && m < 11) || (m === 3 && d >= dstStart) || (m === 11 && d < dstEnd);
  return inDst ? "-04:00" : "-05:00";
}

/** A date plus the time written next to it (Eastern unless stated otherwise) to an ISO timestamp. */
function deadlineWithTime(day: string, context: string): string | null {
  const t = context.match(TIME_RE);
  if (!t || !/eastern|\bE[SD]?T\b/i.test(context)) return deadline(day);
  let h = Number(t[1]) % 12;
  if (/p/i.test(t[3])) h += 12;
  const mm = t[2] ?? "00";
  const d = new Date(`${day}T${String(h).padStart(2, "0")}:${mm}:00${easternOffset(day)}`);
  return Number.isNaN(d.getTime()) ? deadline(day) : d.toISOString();
}

const STRONG_DEADLINE = /transmittal of applications|\bno later than\b|\b(are|is) due\b|applications? (and \w+ )?(must|shall|are to|will need to) be (received|submitted|transmitted|filed)|applications? (are|is) due|due (no later than|by|on)|(complete )?(proposals|applications) must be submitted|closing date|application deadline|deadline for (applications|submission|submitting)|submitted (electronically )?(no later than|by)|received (no later than|by)|must be (received|submitted|filed|postmarked)|\bclos(es|ing)\b|accepted (electronically )?(through|until)|deadline:/i;
const NOT_DEADLINE = /intergovernmental review|letters? of (intent|interest)|notice of intent to apply|pre-?applications?|webinar|informational|technical assistance (call|session|meeting)|\bsessions?\b|applications available|\bavailable:|\bopen:|comments?\b|effective (date|on)|question|\bregist(er|ration)\b|office hours/i;

function keyDateKind(seg: string): string {
  if (/intergovernmental/i.test(seg)) return "intergovernmental_review";
  if (/letters? of (intent|interest)|notice of intent to apply/i.test(seg)) return "letter_of_intent";
  if (/pre-?application/i.test(seg)) return "pre_application";
  if (/applications available|\bavailable:|\bopen:/i.test(seg)) return "applications_open";
  if (/webinar|session|informational|meeting/i.test(seg)) return "information_session";
  return "other";
}

export interface DeadlineInfo {
  closeAt: string | null;
  closeText: string | null;
  rolling: boolean;
  keyDates: KeyDate[];
}

/**
 * The application deadline from a notice's DATES section (the API's `dates` field or the text), falling back to
 * the body when DATES only points elsewhere. Lines about letters of intent, intergovernmental review, and
 * webinars become key dates, not the deadline. When several deadlines remain (tracks or parts), the earliest wins.
 */
export function findDeadline(dates: string | null | undefined, body: string, publicationDate: string): DeadlineInfo {
  const keyDates: KeyDate[] = [];
  const rolling = /rolling basis|on a rolling|continuous(ly)? (basis|open|accept)|accepted (on an? )?(ongoing|continuous)|open until (all )?funds are/i.test(`${dates ?? ""}\n${body}`);
  const pick = (text: string, strongOnly: boolean): string | null => {
    const segs = text.replace(/\n(?=\s*[A-Z][A-Za-z ()'/,&-]{2,80}:(\s|$))/g, "\n\u0000").split(/\u0000|(?<=[a-z0-9)]{2}\.)\s+(?=[A-Z])/);
    const candidates: { day: string; seg: string }[] = [];
    for (const raw of segs) {
      const seg = raw.replace(/\s+/g, " ").trim();
      const days = datesIn(seg);
      if (!days.length) continue;
      const strong = STRONG_DEADLINE.test(seg);
      const not = NOT_DEADLINE.test(seg);
      if (strong && !not) {
        for (const day of days) candidates.push({ day, seg });
      } else if (!strongOnly) {
        for (const day of days) keyDates.push({ kind: keyDateKind(seg), date: day, label: seg.slice(0, 120) });
      }
    }
    if (!candidates.length) return null;
    candidates.sort((a, b) => a.day.localeCompare(b.day));
    // Ignore dates on or before the publication day (a deadline is in the future of its notice).
    const real = candidates.filter((c) => c.day > publicationDate);
    const best = real[0] ?? null;
    if (!best) return null;
    for (const c of real.slice(1)) if (c.day !== best.day) keyDates.push({ kind: "other_deadline", date: c.day, label: c.seg.slice(0, 120) });
    return deadlineWithTime(best.day, best.seg);
  };

  let closeAt: string | null = null;
  if (dates) {
    closeAt = pick(dates, false);
    if (!closeAt) {
      // "DATES: March 3, 2027." with nothing else: a bare date well after publication is the deadline.
      const only = uniq(datesIn(dates));
      const minDay = new Date(Date.parse(`${publicationDate}T00:00:00Z`) + 7 * 86_400_000).toISOString().slice(0, 10);
      if (only.length === 1 && dates.replace(/\s+/g, " ").trim().length < 40 && only[0] > minDay) closeAt = deadline(only[0]);
    }
  }
  if (!closeAt) {
    // DATES points to the body ("See SUPPLEMENTARY INFORMATION"), or there is no DATES section.
    const supp = section(body, "SUPPLEMENTARY INFORMATION") ?? body;
    closeAt = pick(supp.slice(0, 40_000), true);
  }
  const seen = new Set<string>();
  const kd = keyDates.filter((k) => {
    const key = `${k.kind}|${k.date}`;
    if (seen.has(key) || (closeAt && closeAt.startsWith(k.date))) return false;
    seen.add(key);
    return true;
  });
  return { closeAt, closeText: !closeAt && rolling ? "Rolling: applications accepted on a rolling basis" : null, rolling: !closeAt && rolling, keyDates: kd.slice(0, 10) };
}

// ---------- Numbers ----------

/** "$1,250,000", "$12 million", "$1.5 billion" to a number. */
export function dollars(s: string): number | null {
  const m = s.match(/\$\s?([\d,]+(?:\.\d+)?)\s*(million|billion|thousand)?/i);
  if (!m) return null;
  let n = Number(m[1].replace(/,/g, ""));
  if (!Number.isFinite(n) || n <= 0) return null;
  const unit = m[2]?.toLowerCase();
  if (unit === "million") n *= 1e6;
  else if (unit === "billion") n *= 1e9;
  else if (unit === "thousand") n *= 1e3;
  // Typos like "$28,492,618 million" would read as trillions; such values are not award sizes.
  return n < 5e10 ? Math.round(n * 100) / 100 : null;
}

function labeled(text: string, label: RegExp, span = 400): string | null {
  const m = text.match(label);
  if (!m || m.index === undefined) return null;
  return text.slice(m.index + m[0].length, m.index + m[0].length + span).replace(/\s+/g, " ");
}

export interface AmountInfo {
  amountMin: number | null;
  amountMax: number | null;
  amountTotal: number | null;
  awardCount: number | null;
  averageAward: number | null;
}

export function findAmounts(text: string, abstract = ""): AmountInfo {
  const out: AmountInfo = { amountMin: null, amountMax: null, amountTotal: null, awardCount: null, averageAward: null };
  const range = labeled(text, /Estimated Range of Awards[^:]{0,80}:/i, 300);
  if (range) {
    const ms = [...range.matchAll(/\$\s?[\d,]+(?:\.\d+)?(?:\s*(?:million|billion|thousand))?/gi)].slice(0, 2).map((m) => dollars(m[0]));
    if (ms[0]) out.amountMin = ms[0];
    if (ms[1]) out.amountMax = ms[1];
  }
  const max = labeled(text, /(Maximum Award|Award Ceiling)[^:]{0,80}:/i, 300);
  if (max) out.amountMax = dollars(max) ?? out.amountMax;
  const min = labeled(text, /(Minimum Award|Award Floor)[^:]{0,80}:/i, 300);
  if (min) out.amountMin = dollars(min) ?? out.amountMin;
  const avg = labeled(text, /Estimated Average Size of Awards?[^:]{0,80}:/i, 200);
  if (avg) out.averageAward = dollars(avg);
  const avail = labeled(text, /(Estimated Available Funds|Total (Amount of )?Funding( Available)?|Estimated Total (Program )?Funding)[^:]{0,40}:/i, 200);
  if (avail) out.amountTotal = dollars(avail);
  const count = labeled(text, /Estimated Number of Awards[^:]{0,80}:/i, 120);
  if (count) {
    const m = count.match(/^\s*(?:up to |approximately |about )?([\d,]+)\b/i);
    if (m) out.awardCount = int(m[1]);
  }
  const flat = `${abstract} ${text.slice(0, 20_000)}`.replace(/\s+/g, " ");
  if (!out.amountMax) {
    const m = flat.match(/(?:maximum award (?:amount )?(?:is|of)|awards? of up to|up to)\s+(\$\s?[\d,]+(?:\.\d+)?(?:\s*(?:million|billion))?)\s+(?:per|for each|for a|for one|to each|for any one)\s+(?:award|project|applicant|grant|recipient|eligible)/i);
    if (m) out.amountMax = dollars(m[1]);
  }
  if (!out.amountTotal) {
    const m = flat.match(/(?:availability of|apply for|approximately|up to|total of)\s+(?:approximately |up to )?(\$\s?[\d,]+(?:\.\d+)?(?:\s*(?:million|billion))?)\s+(?:in|for|of)\s+(?:\w+\s+){0,3}(?:grants?|funding|funds|awards?|federal)/i);
    if (m) out.amountTotal = dollars(m[1]);
  }
  if (out.amountMin && out.amountMax && out.amountMin > out.amountMax) [out.amountMin, out.amountMax] = [out.amountMax, out.amountMin];
  if (out.amountTotal && out.amountMax && out.amountMax > out.amountTotal) out.amountTotal = null;
  return out;
}

// ---------- Eligibility, listings, numbers ----------

const ELIGIBILITY_RULES: [EligibilityCode, RegExp][] = [
  ["university", /institutions? of higher education|\bIHEs?\b|colleges?|universit/i],
  ["nonprofit", /non-?profit|not-for-profit|501\(c\)\(3\)/i],
  ["for_profit", /for-profit|for profit|commercial (firms|organizations|entities)/i],
  ["small_business", /small business/i],
  ["state_government", /\bstates?\b(?! of\b)|state (governments?|agenc|educational agenc|lead agenc)/i],
  ["school_district", /local educational agenc|\bLEAs?\b|school districts?/i],
  ["local_government", /units? of (general )?local government|local governments?|count(y|ies)\b|\bcities\b|municipal|townships?|special districts?|political subdivisions?/i],
  ["tribal", /tribe|tribal|alaska native|native hawaiian organi/i],
  ["housing_authority", /public housing (authorit|agenc)/i],
  ["other", /credit unions?|cooperatives?|community development financial institutions|\bCDFIs?\b|lenders?|\bbanks?\b|airport sponsors?|transit agenc|railroads?/i],
];

export function findEligibility(text: string): { codes: EligibilityCode[]; text: string | null } {
  const raw = labeled(text, /\n\s*(?:\d\.\s*)?Eligible (Applicants|Entities|Recipients)\s*:/i, 900) ?? labeled(text, /\n\s*(?:\d\.\s*)?Eligibility( Information| Requirements)?\s*:/i, 900);
  if (!raw) return { codes: [], text: null };
  const cut = raw.split(/\s(?:\d\.\s+)?(?:Note|Cost Sharing or Matching|Program Authority|To Apply|Applicable Regulations|Maximum Award|Other)\s*:/i)[0].trim();
  const t = cut.replace(/United States/g, "US");
  const codes = ELIGIBILITY_RULES.filter(([, re]) => re.test(t)).map(([c]) => c);
  return { codes: codes.length ? codes : ["other"], text: cut.slice(0, 800) || null };
}

/** Assistance Listing numbers (formerly CFDA) written in the notice. Returned as the 5-digit form Grants.gov uses, plus the lettered forms ED writes. */
export function findAssistanceListings(text: string): { listings: string[]; lettered: string[] } {
  const listings: string[] = [];
  const lettered: string[] = [];
  const re = /(Assistance Listing|\bALNs?\b|CFDA|Catalog of Federal Domestic Assistance).{0,160}/gi;
  for (const m of text.replace(/\s+/g, " ").matchAll(re)) {
    for (const n of m[0].matchAll(/\b(\d{2}\.\d{3})([A-Z])?\b/g)) {
      listings.push(n[1]);
      if (n[2]) lettered.push(`${n[1]}${n[2]}`);
    }
  }
  return { listings: uniq(listings), lettered: uniq(lettered) };
}

/** Funding opportunity numbers stated in the notice ("Funding Opportunity Number: HHS-2026-ACF-...", "the funding number is TREAS-GRANTS-052027-001"). */
export function findOpportunityNumbers(text: string): string[] {
  const out: string[] = [];
  const flat = text.replace(/\s+/g, " ");
  const re = /(?:funding opportunity (?:announcement )?(?:number|no\.?|#)|funding number|(?:NOFO|FOA|announcement|solicitation) (?:number|no\.?|#))\s*(?:\(FON\)\s*)?(?:is|:)?\s*:?\s*([A-Z][A-Z0-9]*(?:[-_.][A-Z0-9]+)+)/gi;
  for (const m of flat.matchAll(re)) {
    const n = m[1].replace(/[.]$/, "");
    if (/\d/.test(n) && /[A-Z]/i.test(n) && n.length >= 6 && !/^\d{2}\.\d{3}/.test(n)) out.push(n.toUpperCase());
  }
  return uniq(out);
}

/** Grants.gov opportunity ids linked from the notice. */
export function findGrantsGovIds(text: string): string[] {
  const out: string[] = [];
  if (!/grants\.gov/i.test(text)) return [];
  // Links in tables are often broken across lines ("https://grants.gov/search-" ... "results-detail/364086"), so match the tail.
  for (const m of text.matchAll(/(?:results-detail\/|view-opportunity\.html\?oppId=)(\d{5,7})\b/gi)) out.push(m[1]);
  return uniq(out);
}

// ---------- Funders ----------

/** Federal Register agency slugs to the agency codes Grants.gov uses, so both sources point at one funder. */
export const AGENCY_CODES: Record<string, string> = {
  "education-department": "ED",
  "agriculture-department": "USDA",
  "rural-utilities-service": "USDA-RUS",
  "rural-business-cooperative-service": "USDA-RBCS",
  "rural-housing-service": "USDA-RHS",
  "forest-service": "USDA-FS",
  "agricultural-marketing-service": "USDA-AMS",
  "animal-and-plant-health-inspection-service": "USDA-APHIS",
  "farm-service-agency": "USDA-FSA",
  "foreign-agricultural-service": "USDA-FAS",
  "national-institute-of-food-and-agriculture": "USDA-NIFA",
  "natural-resources-conservation-service": "USDA-NRCS",
  "transportation-department": "DOT",
  "federal-transit-administration": "DOT-FTA",
  "federal-railroad-administration": "DOT-FRA",
  "federal-aviation-administration": "DOT-FAA",
  "federal-highway-administration": "DOT-FHWA",
  "federal-motor-carrier-safety-administration": "DOT-FMCSA",
  "national-highway-traffic-safety-administration": "DOT-NHTSA",
  "pipeline-and-hazardous-materials-safety-administration": "DOT-PHMSA",
  "maritime-administration": "DOT-MA",
  "employment-and-training-administration": "DOL-ETA",
  "occupational-safety-and-health-administration": "DOL-OSHA",
  "veterans-employment-and-training-service": "DOL-VETS",
  "health-resources-and-services-administration": "HHS-HRSA",
  "children-and-families-administration": "HHS-ACF",
  "substance-abuse-and-mental-health-services-administration": "HHS-SAMHS",
  "centers-for-disease-control-and-prevention": "HHS-CDC",
  "community-living-administration": "HHS-ACL",
  "indian-health-service": "HHS-IHS",
  "agency-for-healthcare-research-and-quality": "HHS-AHRQ",
  "food-and-drug-administration": "HHS-FDA",
  "centers-for-medicare-medicaid-services": "HHS-CMS",
  "national-institutes-of-health": "HHS-NIH11",
  "veterans-affairs-department": "VA",
  "environmental-protection-agency": "EPA",
  "interior-department": "DOI",
  "indian-affairs-bureau": "DOI-BIA",
  "fish-and-wildlife-service": "DOI-FWS",
  "national-park-service": "DOI-NPS",
  "land-management-bureau": "DOI-BLM",
  "reclamation-bureau": "DOI-BOR",
  "geological-survey": "DOI-USGS1",
  "ocean-energy-management-bureau": "DOI-BOEM",
  "commerce-department": "DOC",
  "national-oceanic-and-atmospheric-administration": "DOC-NOAA",
  "national-institute-of-standards-and-technology": "DOC-NIST",
  "economic-development-administration": "DOC-EDA",
  "national-telecommunications-and-information-administration": "DOC-NTIA",
  "minority-business-development-agency": "DOC-MBDA",
  "justice-department": "USDOJ",
  "justice-programs-office": "USDOJ-OJP",
  "housing-and-urban-development-department": "HUD",
  "homeland-security-department": "DHS",
  "federal-emergency-management-agency": "DHS-DHS",
  "coast-guard": "DHS-USCG",
  "energy-department": "DOE",
  "national-science-foundation": "NSF",
  "national-aeronautics-and-space-administration": "NASA",
  "national-endowment-for-the-arts": "NEA",
  "national-endowment-for-the-humanities": "NEH",
  "institute-of-museum-and-library-services": "IMLS",
  "national-credit-union-administration": "NCUA",
  "small-business-administration": "SBA",
  "corporation-for-national-and-community-service": "AC",
  "state-department": "DOS",
  "defense-department": "DOD",
  "engineers-corps": "DOD-COE",
  "denali-commission": "DC",
  "nuclear-regulatory-commission": "NRC",
  "national-archives-and-records-administration": "NARA",
};

const THE = new Set(["Interior", "Treasury"]);

/**
 * Federal Register agency names read "Education Department", "Indian Affairs Bureau". Funders are shared with other
 * sources, so we write them the usual way: "Department of Education", "Bureau of Indian Affairs".
 */
export function agencyName(name: string): string {
  const n = name.trim();
  let m = n.match(/^(.+) Department$/);
  if (m) return `Department of ${THE.has(m[1]) ? "the " : ""}${m[1]}`;
  m = n.match(/^(.+) (Bureau|Office)$/);
  if (m) return `${m[2]} of ${m[1]}`;
  m = n.match(/^(.+), Office of (.+)$/);
  if (m) return `Office of ${m[2]} ${m[1]}`;
  return n;
}

function funderKeyFor(slug: string): string {
  return `agency:${AGENCY_CODES[slug] ?? `FR-${slug}`}`;
}

/** Funders for a notice, parents first. The most specific agency is the one the notice points at. */
export function fundersFor(doc: FrDoc): { funders: FunderInput[]; key: string | null; name: string | null; code: string | null } {
  const agencies = (doc.agencies ?? []).filter((a) => a.slug && a.name);
  if (!agencies.length) return { funders: [], key: null, name: null, code: null };
  const byId = new Map(agencies.filter((a) => a.id).map((a) => [a.id!, a]));
  const leaf = agencies.find((a) => !agencies.some((b) => b.parent_id && b.parent_id === a.id)) ?? agencies[agencies.length - 1];
  const funders: FunderInput[] = [];
  const parent = leaf.parent_id ? byId.get(leaf.parent_id) : undefined;
  if (parent?.slug && parent.name) {
    funders.push({ key: funderKeyFor(parent.slug), name: agencyName(parent.name), kind: "federal_agency", country: "US", sourceUrl: `https://www.federalregister.gov/agencies/${parent.slug}` });
  }
  const key = funderKeyFor(leaf.slug!);
  funders.push({
    key,
    name: agencyName(leaf.name!),
    kind: "federal_agency",
    parentKey: parent?.slug ? funderKeyFor(parent.slug) : null,
    country: "US",
    sourceUrl: `https://www.federalregister.gov/agencies/${leaf.slug}`,
  });
  return { funders, key, name: agencyName(leaf.name!), code: AGENCY_CODES[leaf.slug!] ?? null };
}

// ---------- One notice to rows ----------

export interface GrantsGovRef {
  id: string;
  number: string | null;
  title: string | null;
}

const RESEARCH_AGENCY = /institute of education sciences|national institutes of health|national science foundation|standards and technology|aeronautics and space|food and agriculture|office of science|advanced research projects/i;
const LOAN_LIKE = /\bloans?\b|credit assistance|guarantee|relending|tax credit|bond/i;

export function toOpportunities(doc: FrDoc, text: string, gg: GrantsGovRef[], now = new Date()): OpportunityInput[] {
  const title = plainText(doc.title).replace(/^Title:\s*/i, "");
  if (!doc.document_number || !title || !doc.html_url) return [];
  const abstract = plainText(doc.abstract);
  // The API's `dates` field holds only the first paragraph of DATES; the notice text has all of it.
  const dates = section(text, "DATES") ?? (doc.dates ? plainText(doc.dates) : null);
  const dl = findDeadline(dates, text, doc.publication_date);
  const amounts = findAmounts(text, abstract);
  const elig = findEligibility(text);
  const aln = findAssistanceListings(`${abstract}\n${text}`);
  const numbers = findOpportunityNumbers(text);
  const funder = fundersFor(doc);
  const research = /\bresearch\b/i.test(title) || (RESEARCH_AGENCY.test(`${funder.name ?? ""} ${abstract.slice(0, 300)}`) && /\bresearch\b/i.test(abstract));
  const loanLike = LOAN_LIKE.test(`${title} ${abstract.slice(0, 400)}`) && !/\bgrants?\b/i.test(title);
  const nowMs = now.getTime();
  const status: OpportunityInput["status"] = dl.closeAt ? (new Date(dl.closeAt).getTime() >= nowMs ? "open" : "closed") : dl.rolling ? "open" : "closed";
  const attachments: Attachment[] = [];
  if (doc.pdf_url) attachments.push({ name: "Federal Register notice (PDF)", url: doc.pdf_url });
  for (const g of gg) attachments.push({ name: g.number ? `Grants.gov listing ${g.number}` : "Grants.gov listing", url: `https://www.grants.gov/search-results-detail/${g.id}` });
  const textForTags = `${title} ${abstract}`;

  const base: Omit<OpportunityInput, "sourceId" | "title" | "opportunityNumber"> = {
    sourceUrl: doc.html_url,
    type: research ? "research" : "grant",
    noticeType: "fr_notice",
    summary: abstract || section(text, "SUMMARY"),
    funderKey: funder.key,
    funderName: funder.name,
    agencyCode: funder.code,
    status,
    postedAt: isoDate(doc.publication_date),
    openAt: isoDate(doc.publication_date),
    closeAt: dl.closeAt,
    closeText: dl.closeText,
    rolling: dl.rolling,
    keyDates: dl.keyDates,
    amountMin: amounts.amountMin,
    amountMax: amounts.amountMax,
    amountTotal: amounts.amountTotal,
    awardCount: amounts.awardCount,
    eligibility: elig.codes,
    eligibilityText: elig.text,
    assistanceListings: aln.listings,
    categories: loanLike ? ["Loans, guarantees, and credit"] : [],
    causes: research ? [] : causesFromText(textForTags),
    researchAreas: research ? researchAreasFromText(textForTags) : [],
    place: { country: "US" },
    attachments,
    extra: {
      frDocumentNumber: doc.document_number,
      action: doc.action ? plainText(doc.action).slice(0, 200) : undefined,
      lettered: aln.lettered.length ? aln.lettered : undefined,
      averageAward: amounts.averageAward ?? undefined,
      instrument: loanLike ? "loan_or_credit" : undefined,
      grantsGovIds: gg.length ? gg.map((g) => g.id) : undefined,
    },
  };

  const rows = rowsFor(doc.document_number, title, gg, numbers, base);
  // Without an opportunity number, the title-based dedupe key would merge different years of the same recurring
  // notice ("Grant Guideline; Notice"). Such rows keep a key of their own.
  return rows.map((r) => (normalizeNumber(r.opportunityNumber) ? r : { ...r, canonicalKey: `fr:${r.sourceId}` }));
}

function rowsFor(docNumber: string, title: string, gg: GrantsGovRef[], numbers: string[], base: Omit<OpportunityInput, "sourceId" | "title" | "opportunityNumber">): OpportunityInput[] {
  if (gg.length > 1) {
    return gg.map((g) => ({ ...base, sourceId: `${docNumber}:${g.id}`, title: g.title ? plainText(g.title) : `${title} (${g.number ?? g.id})`, opportunityNumber: g.number }));
  }
  if (gg.length === 1) return [{ ...base, sourceId: docNumber, title, opportunityNumber: gg[0].number ?? numbers[0] ?? null }];
  if (numbers.length > 1) return numbers.map((n) => ({ ...base, sourceId: `${docNumber}:${n}`, title: `${title} (${n})`, opportunityNumber: n }));
  return [{ ...base, sourceId: docNumber, title, opportunityNumber: numbers[0] ?? null }];
}

// ---------- Run ----------

function day(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Date windows [from, to] covering the run, newest last. */
export function windows(ctx: Pick<IngestContext, "mode" | "since">, now = new Date()): [string, string][] {
  const end = now;
  let start: Date;
  if (ctx.mode === "incremental") {
    start = ctx.since ? new Date(ctx.since.getTime() - 3 * 86_400_000) : new Date(now.getTime() - 14 * 86_400_000);
    const floor = new Date(now.getTime() - BACKFILL_DAYS * 86_400_000);
    if (start < floor) start = floor;
  } else {
    start = new Date(now.getTime() - BACKFILL_DAYS * 86_400_000);
  }
  const out: [string, string][] = [];
  for (let s = start; s <= end; s = new Date(s.getTime() + WINDOW_DAYS * 86_400_000)) {
    const e = new Date(Math.min(end.getTime(), s.getTime() + (WINDOW_DAYS - 1) * 86_400_000));
    out.push([day(s), day(e)]);
  }
  return out;
}

async function searchWindow(ctx: IngestContext, term: string, from: string, to: string, onDoc: (d: FrDoc) => Promise<void>): Promise<void> {
  const first = await getJson<FrSearch>(ctx.fetch, searchUrl(term, from, to, 1));
  if (first.count > MAX_REACHABLE && from < to) {
    // Too many to page through: split the window.
    const mid = day(new Date((Date.parse(`${from}T00:00:00Z`) + Date.parse(`${to}T00:00:00Z`)) / 2));
    const next = day(new Date(Date.parse(`${mid}T00:00:00Z`) + 86_400_000));
    await searchWindow(ctx, term, from, mid, onDoc);
    await searchWindow(ctx, term, next, to, onDoc);
    return;
  }
  for (const d of first.results ?? []) await onDoc(d);
  const pages = Math.min(first.total_pages ?? 1, Math.ceil(MAX_REACHABLE / PER_PAGE));
  for (let p = 2; p <= pages && !ctx.done(); p++) {
    const page = await getJson<FrSearch>(ctx.fetch, searchUrl(term, from, to, p));
    for (const d of page.results ?? []) await onDoc(d);
  }
}

async function grantsGovRefs(ctx: IngestContext, ids: string[]): Promise<GrantsGovRef[]> {
  const out: GrantsGovRef[] = [];
  for (const id of ids.slice(0, 8)) {
    try {
      const res = await ctx.fetch(GRANTS_GOV_FETCH, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ opportunityId: id }), retries: 2 });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const j = (await res.json()) as { data?: { opportunityNumber?: string; opportunityTitle?: string } };
      out.push({ id, number: j.data?.opportunityNumber?.trim() || null, title: j.data?.opportunityTitle?.trim() || null });
    } catch (err) {
      ctx.warn(`Could not look up Grants.gov opportunity ${id}`, err);
      out.push({ id, number: null, title: null });
    }
  }
  return out;
}

export const federalRegister: Connector = {
  source,
  async run(ctx) {
    const seen = new Set<string>();
    const funderKeys = new Set<string>();
    let candidates = 0;
    let kept = 0;
    const resolve = ctx.env.FR_RESOLVE_GRANTSGOV !== "0";
    for (const [from, to] of windows(ctx)) {
      for (const term of SEARCH_TERMS) {
        if (ctx.done()) break;
        await searchWindow(ctx, term, from, to, async (doc) => {
          if (ctx.done() || !doc?.document_number || seen.has(doc.document_number)) return;
          seen.add(doc.document_number);
          candidates++;
          if (!isFundingNotice(doc)) return;
          kept++;
          try {
            const raw = doc.raw_text_url ? await getText(ctx.fetch, doc.raw_text_url) : "";
            const text = noticeText(raw);
            const ids = findGrantsGovIds(text);
            const gg = resolve && ids.length ? await grantsGovRefs(ctx, ids) : ids.map((id) => ({ id, number: null, title: null }));
            const rows = toOpportunities(doc, text, gg);
            const { funders } = fundersFor(doc);
            const fresh = funders.filter((f) => !funderKeys.has(f.key));
            for (const f of fresh) funderKeys.add(f.key);
            if (fresh.length) await ctx.funders(fresh);
            if (rows.length) await ctx.opportunities(rows);
          } catch (err) {
            ctx.warn(`Could not read Federal Register notice ${doc.document_number}`, err);
          }
        });
      }
    }
    ctx.log(`${candidates} notices matched the searches, ${kept} were funding notices`);
  },
};

export const connectors: Connector[] = [federalRegister];
