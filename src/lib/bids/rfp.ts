import type { BidDate, RequirementKind, Solicitation, SolicitationType } from "@/lib/types";

/**
 * Reads a solicitation (an RFP, RFQ, IFB, or a federal A-E notice) with plain
 * rules, so "Add an RFP" works on any document with no model key. Every
 * requirement keeps the sentence it came from and where it sits (section and
 * page), so the firm can check it against the original. With a model key, a
 * model pass can tidy titles and add what the rules missed; it never removes
 * a quoted requirement.
 */

export interface RfpPage {
  page: number;
  text: string;
}

export interface ParsedRequirement {
  /** Stable within one reading: "r1", "r2", ... */
  key: string;
  title: string;
  kind: RequirementKind;
  /** "Section 3.2, page 7", or "Page 7" when no section number is found. */
  ref: string;
  excerpt: string;
  mandatory: boolean;
  /** Proposal section that should answer it. */
  sectionKey: SectionKey;
}

export type SectionKey = "cover_letter" | "qualifications" | "projects" | "personnel" | "approach" | "schedule" | "quality_safety" | "references" | "forms" | "pricing" | "submission";

export interface ParsedRfp {
  title: string;
  issuer: string | null;
  solicitation: Solicitation;
  /** Proposals due: ISO date (with time when stated). */
  dueDate: string | null;
  requirements: ParsedRequirement[];
  /** How the reading was done: "rules" alone, or "rules and model". */
  readBy: "rules" | "rules and model";
  pageCount: number;
  wordCount: number;
}

const MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
const MONTH_RE = "(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)";
const DATE_RES: RegExp[] = [
  new RegExp(`\\b${MONTH_RE}\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?,?\\s+(20\\d\\d)\\b`, "gi"),
  /\b(\d{1,2})\/(\d{1,2})\/(20\d\d)\b/g,
  /\b(20\d\d)-(\d{2})-(\d{2})\b/g,
  /\b(\d{1,2})-(\d{1,2})-(20\d\d)\b/g,
  new RegExp(`\\b(\\d{1,2})\\s+${MONTH_RE}\\.?\\s+(20\\d\\d)\\b`, "gi"),
];
const TIME_RE = /\b(\d{1,2})(?::(\d{2}))?\s*(a\.?m\.?|p\.?m\.?)\b|\b(\d{1,2}):(\d{2})\s*(?:hours|hrs)?\b/i;

const pad = (n: number) => String(n).padStart(2, "0");

/** Every date in a sentence, as ISO dates, in the order they appear. */
export function datesIn(text: string): { iso: string; index: number; raw: string }[] {
  const out: { iso: string; index: number; raw: string }[] = [];
  for (const [i, re] of DATE_RES.entries()) {
    re.lastIndex = 0;
    for (const m of text.matchAll(re)) {
      let y: number, mo: number, d: number;
      if (i === 0) {
        mo = MONTHS.findIndex((x) => x.startsWith(m[1].toLowerCase().slice(0, 3))) + 1;
        d = Number(m[2]);
        y = Number(m[3]);
      } else if (i === 1) {
        mo = Number(m[1]);
        d = Number(m[2]);
        y = Number(m[3]);
      } else if (i === 2) {
        y = Number(m[1]);
        mo = Number(m[2]);
        d = Number(m[3]);
      } else if (i === 3) {
        mo = Number(m[1]);
        d = Number(m[2]);
        y = Number(m[3]);
      } else {
        d = Number(m[1]);
        mo = MONTHS.findIndex((x) => x.startsWith(m[2].toLowerCase().slice(0, 3))) + 1;
        y = Number(m[3]);
      }
      if (mo < 1 || mo > 12 || d < 1 || d > 31) continue;
      if (out.some((o) => Math.abs(o.index - (m.index ?? 0)) < 3)) continue;
      out.push({ iso: `${y}-${pad(mo)}-${pad(d)}`, index: m.index ?? 0, raw: m[0] });
    }
  }
  return out.sort((a, b) => a.index - b.index);
}

/** A time near a date, as HH:MM in 24 hours, when the sentence gives one. */
function timeNear(text: string, from: number): string | null {
  const m = text.slice(from, from + 60).match(TIME_RE) ?? text.slice(Math.max(0, from - 90), from).match(TIME_RE);
  if (!m) return null;
  if (m[1]) {
    let h = Number(m[1]) % 12;
    if (/p/i.test(m[3])) h += 12;
    return `${pad(h)}:${m[2] ?? "00"}`;
  }
  const h = Number(m[4]);
  return h < 24 ? `${pad(h)}:${m[5]}` : null;
}

const DATE_KINDS: { kind: BidDate["kind"]; re: RegExp; label: string }[] = [
  { kind: "questions_due", re: /\b(questions?|inquir(y|ies)|requests? for (clarification|information)|RFIs?)\b/i, label: "Questions due" },
  { kind: "prebid_meeting", re: /\bpre-?\s?(bid|proposal|submittal|solicitation)\s+(meeting|conference)\b|\bpre-?bid\b/i, label: "Pre-bid meeting" },
  { kind: "site_visit", re: /\bsite (visit|walk|tour|inspection)|walk-?through\b/i, label: "Site visit" },
  { kind: "interview", re: /\b(interviews?|oral presentations?|presentations will)\b/i, label: "Interviews" },
  { kind: "award", re: /\b(anticipated award|award date|notice to proceed|contract award)\b/i, label: "Anticipated award" },
  {
    kind: "submission",
    re: /\b(proposals?|submittals?|responses?|qualifications|SF\s?330s?|statements? of qualifications|bids?|offers?|quotes?)\b.{0,80}\b(due|received|submitted|no later than|deadline|closing)\b|\b(due date|closing date|submission deadline|response date|bid opening|receipt of (submittals|proposals|offers|bids|qualifications))\b/i,
    label: "Proposals due",
  },
];

const FORM_RES: [RegExp, string][] = [
  [/\bSF\s?-?\s?330\b|standard form 330/i, "SF 330"],
  [/\bSF\s?-?\s?1442\b/i, "SF 1442"],
  [/\bSF\s?-?\s?1449\b/i, "SF 1449"],
  [/\bSF\s?-?\s?24\b/i, "SF 24 (bid bond)"],
  [/\bSF\s?-?\s?25A?\b/i, "SF 25 / 25A (performance and payment bonds)"],
  [/\bSF\s?-?\s?33\b/i, "SF 33"],
  [/\bSF\s?-?\s?30\b|amendment acknowledg/i, "SF 30 or signed amendment acknowledgement"],
  [/\bbid bond\b|bid guarantee/i, "Bid bond"],
  [/\bW-?9\b/i, "W-9"],
  [/\bcertificate of insurance\b/i, "Certificate of insurance"],
  [/\bnon-?collusion\b/i, "Non-collusion affidavit"],
  [/\bdrug-?free workplace\b/i, "Drug-free workplace certification"],
  [/\bE-?Verify\b/i, "E-Verify affidavit"],
  [/\bbid form\b|proposal form\b|price form\b/i, "Bid or price form"],
  [/\bsubcontracting plan\b/i, "Small business subcontracting plan"],
  [/\bDBE|disadvantaged business enterprise\b/i, "DBE participation forms"],
];

const SECTION_HINTS: [RegExp, SectionKey][] = [
  [/\b(fee|price|pricing|cost proposal|compensation|hourly rates?|bid schedule|unit prices?)\b/i, "pricing"],
  [/\b(cover letter|letter of (interest|transmittal)|transmittal letter)\b/i, "cover_letter"],
  [/\b(references?)\b/i, "references"],
  [/\b(r[ée]sum[ée]s?|key (personnel|staff)|project team|team members?|organizational chart|staffing|personnel|qualifications of (the )?(staff|team)|professional qualifications)\b/i, "personnel"],
  [/\b(similar projects?|past performance|relevant (experience|projects?)|specialized experience|example projects|project experience|previous (work|projects))\b/i, "projects"],
  [/\b(schedule|timeline|time ?frame|milestones?|duration)\b/i, "schedule"],
  [/\b(quality (control|assurance)|QA\/?QC|safety|EMR|OSHA)\b/i, "quality_safety"],
  [/\b(approach|methodology|understanding|work plan|management plan|technical proposal|scope of (work|services)|design philosophy)\b/i, "approach"],
  [/\b(forms?|certifications? and representations|affidavits?|acknowledg)/i, "forms"],
  [/\b(firm|company|capacity|history|qualifications|capabilities|location|knowledge of (the )?locality|office)\b/i, "qualifications"],
];

const MUST = /\b(shall|must|is required|are required|required to|will be required|is mandatory|are mandatory)\b/i;
const ASK = /\b(submit|include|provide|demonstrate|describe|identify|list|furnish|attach|indicate|address|discuss|explain|should (precede|outline|include|describe|provide|be))\b/i;
/** Sentences about what the buyer does, not what the firm must do. */
const NOT_A_REQUIREMENT = /\b(should be considered|(the )?(government|owner|city|county|agency|agencies|state|selection (board|committee)|contracting officer|report|VA|department) (shall|will|may|reserves)(?! evaluate)|will not be (returned|reimbursed)|is not responsible|reserves the right|this announcement will not|is not an? IDIQ)\b/i;

function kindOf(sentence: string, heading: string): RequirementKind {
  const s = `${sentence}`;
  if ((/\bevaluat|selection criteria|criteria\b|will be (rated|scored|ranked)/i.test(`${heading} ${s}`) || /\bwill be used (for|to|in) (the )?(first |initial )?(preliminary )?(screening|evaluat|select|rank)/i.test(s)) && !/\bsubmit|page/i.test(s)) return "evaluation";
  if (FORM_RES.some(([re]) => re.test(s)) || /\bsign(ed|ature)\b/i.test(s)) return "form";
  if (/\b(pages?|font|point|margins?|single-sided|double-sided|copies|binder|tabs?|file size|8\.5|11\s?x\s?17|PDF format|letter-size|single (pdf|file)|brief and concise|MB)\b/i.test(s)) return "format";
  if (/\bquestions?\b.{0,60}\b(referred|directed|submitted|sent|emailed)\b/i.test(s)) return "submission";
  if (/\b(set-?aside|small business|licensed|licensure|registered|registration|SAM\b|eligib|bonding capacity|bondable|size standard)\b/i.test(s)) return "eligibility";
  if (/\b(submit(ted)?|deliver(ed)?|e-?mail(ed)?|portal|received by|no later than|late (proposals|submittals))\b/i.test(s)) return "submission";
  if (/\b(attach|appendix|exhibit|certificate|r[ée]sum[ée]s?|letters? of)\b/i.test(s)) return "attachment";
  return "section";
}

function sectionKeyOf(sentence: string, heading: string, kind: RequirementKind): SectionKey {
  if (kind === "form") return "forms";
  if (kind === "submission" || kind === "format") return "submission";
  for (const [re, key] of SECTION_HINTS) if (re.test(sentence)) return key;
  for (const [re, key] of SECTION_HINTS) if (re.test(heading)) return key;
  return kind === "eligibility" ? "qualifications" : "approach";
}

/** A short title for a requirement: its heading when it has one, else the sentence's first words. */
function titleOf(sentence: string, heading: string, kind: RequirementKind): string {
  const words = sentence.replace(/^[\s\d.()a-z]{0,6}(?=[A-Z])/, "").replace(/\s+/g, " ").trim().split(" ");
  const short = words.slice(0, 12).join(" ").replace(/[,;:]$/, "");
  const head = heading.replace(/^\s*(section\s+)?([\d]+(\.\d+)*(-\d+)?|[IVX]{1,4}|[A-Z])[.)]?\s+(?=[A-Z])/, "").replace(/[.:?]+$/, "").trim();
  if (kind === "evaluation" && head && head.length < 70 && !/\?$/.test(heading.trim()) && !/^(what|how|who|when|where|why)\b/i.test(head)) return `${head.replace(/^./, (c) => c.toUpperCase())}: ${short}${words.length > 12 ? "…" : ""}`;
  return `${short}${words.length > 12 ? "…" : ""}`;
}

const HEADING = /^\s*((section|part|article)\s+)?([A-Z]|[IVX]{1,4}|\d{1,2})((\.\d{1,2}){0,3})[.)]?\s+([A-Z][A-Za-z0-9 ,&/'()-]{2,80})\s*$/;
const CAPS_HEADING = /^\s*[A-Z][A-Z0-9\s,&/'’()-]{4,120}[?:]?\s*$/;
/** A short line naming a criteria list, e.g. "36.602-1 Selection criteria." */
const CRITERIA_HEADING = /^\s*[\d.()-]*\s*(selection|evaluation) (criteria|factors)\.?\s*$/i;
/** "SOLICITATION NUMBER* | 36C25723R0049": the field table at the top of a federal notice. */
const FIELD = /^\s*([A-Z][A-Z’'/&() -]{2,45})\*?\s*\|\s*(.+?)\s*$/;

interface Sentence {
  text: string;
  page: number;
  heading: string;
  sectionNo: string | null;
}

/** Sentences with the heading and page they sit under. Lists count as sentences. */
export function sentencesOf(pages: RfpPage[]): Sentence[] {
  const out: Sentence[] = [];
  let heading = "";
  let sectionNo: string | null = null;
  for (const p of pages) {
    const lines = p.text.replace(/\r/g, "").split("\n");
    let buf = "";
    const flush = () => {
      // Abbreviations end in a period without ending the sentence.
      const block = buf.replace(/\s+/g, " ").trim().replace(/\b(a\.m|p\.m|No|Nos|U\.S|e\.g|i\.e|Dr|St|Inc|Co|Ltd|Mr|Ms|Mrs|vs|approx|Rev)\./gi, (m) => m.replace(/\./g, "\u2024"));
      buf = "";
      if (!block) return;
      for (const s0 of block.split(/(?<=[.;?!])\s+(?=[A-Z(•\d])/)) {
        const s = s0.replace(/\u2024/g, ".");
        const t = s.replace(/^[•▪◦·*-]\s*/, "").trim();
        if (t.length >= 25 && t.length <= 700) out.push({ text: t, page: p.page, heading, sectionNo });
      }
    };
    for (const raw of lines) {
      const line = raw.trimEnd();
      if (FIELD.test(line)) {
        flush();
        continue;
      }
      if (CRITERIA_HEADING.test(line)) {
        flush();
        heading = line.trim();
        sectionNo = line.match(/^\s*([\d.]+-?\d*)/)?.[1] ?? sectionNo;
        continue;
      }
      const h = line.match(HEADING);
      if (h && line.length < 100 && !/[.;]$/.test(line.trim())) {
        flush();
        sectionNo = `${h[3]}${h[4] ?? ""}`;
        heading = line.trim();
        continue;
      }
      if (CAPS_HEADING.test(line) && line.trim().split(" ").length <= 22 && !/\d{3,}/.test(line)) {
        flush();
        heading = line.trim();
        const no = heading.match(/^(?:section|part|article)\s+([\dA-Z]+(?:\.\d+)*)\b/i)?.[1] ?? heading.match(/^(\d+(?:\.\d+)*)\.?\s/)?.[1];
        if (no) sectionNo = no;
        continue;
      }
      if (!line.trim() || /^\s*[•▪◦·*-]\s+/.test(line) || /^\s*(\(?[a-z0-9]{1,3}[.)])\s+/i.test(line)) flush();
      buf += ` ${line}`;
    }
    flush();
  }
  return out;
}

const refOf = (s: Sentence) => (s.sectionNo ? `Section ${s.sectionNo}, page ${s.page}` : `Page ${s.page}`);
const money = (s: string) => Number(s.replace(/[$,\s]/g, ""));

/** Read a solicitation with rules. Pass the notice's own fields (from SAM.gov) in `known` when there are some. */
/** SAM.gov set-aside codes, as the notice's field table or the API gives them. */
export const SET_ASIDE_CODES: Record<string, string> = {
  SBA: "Total Small Business Set-Aside (FAR 19.5)",
  SBP: "Partial Small Business Set-Aside (FAR 19.5)",
  "8A": "8(a) Set-Aside (FAR 19.8)",
  "8AN": "8(a) Sole Source (FAR 19.8)",
  HZC: "HUBZone Set-Aside (FAR 19.13)",
  HZS: "HUBZone Sole Source (FAR 19.13)",
  SDVOSBC: "Service-Disabled Veteran-Owned Small Business (SDVOSB) Set-Aside (FAR 19.14)",
  SDVOSBS: "Service-Disabled Veteran-Owned Small Business (SDVOSB) Sole Source (FAR 19.14)",
  WOSB: "Women-Owned Small Business (WOSB) Program Set-Aside (FAR 19.15)",
  WOSBSS: "Women-Owned Small Business (WOSB) Program Sole Source (FAR 19.15)",
  EDWOSB: "Economically Disadvantaged WOSB (EDWOSB) Program Set-Aside (FAR 19.15)",
  EDWOSBSS: "Economically Disadvantaged WOSB (EDWOSB) Program Sole Source (FAR 19.15)",
  VSA: "Veteran-Owned Small Business Set-Aside (specific to Department of Veterans Affairs)",
  VSS: "Veteran-Owned Small Business Sole Source (specific to Department of Veterans Affairs)",
};

/** The "FIELD | value" table at the top of a federal notice, keyed by field name in capitals. */
export function fieldTable(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of text.split("\n")) {
    const m = line.match(FIELD);
    if (m && m[2].trim() && m[2].trim() !== "|") out[m[1].replace(/\*/g, "").trim().toUpperCase()] ??= m[2].replace(/\s*\|\s*/g, " ").trim();
  }
  return out;
}

export function readRfp(pages: RfpPage[], known: Partial<{ title: string; issuer: string; number: string; type: SolicitationType; naics: string[]; setAside: string | null; placeOfPerformance: string | null; dueDate: string | null; contact: Solicitation["contact"] }> = {}): ParsedRfp {
  const all = pages.map((p) => p.text).join("\n");
  const fields = fieldTable(all);
  if (!known.title && fields.SUBJECT) known = { ...known, title: fields.SUBJECT };
  if (!known.number && fields["SOLICITATION NUMBER"]) known = { ...known, number: fields["SOLICITATION NUMBER"] };
  if (!known.naics?.length && fields["NAICS CODE"]?.match(/\d{6}/)) known = { ...known, naics: [fields["NAICS CODE"].match(/\d{6}/)![0]] };
  if (known.setAside === undefined && fields["SET-ASIDE"]) known = { ...known, setAside: SET_ASIDE_CODES[fields["SET-ASIDE"].toUpperCase()] ?? fields["SET-ASIDE"] };
  if (!known.placeOfPerformance && fields["PLACE OF PERFORMANCE"]) known = { ...known, placeOfPerformance: fields["PLACE OF PERFORMANCE"] };
  const sentences = sentencesOf(pages);
  const requirements: ParsedRequirement[] = [];
  const seen = new Set<string>();
  for (const s of sentences) {
    if (NOT_A_REQUIREMENT.test(s.text)) continue;
    const mandatory = MUST.test(s.text);
    const inEval = /\bevaluat|selection criteria|criteria/i.test(s.heading);
    const words = s.text.split(/\s+/).length;
    if (words < 7 && !inEval) continue;
    const pageLimit = /\b(first|only|maximum of|no more than|not (to )?exceed|limited to)\b[^.]{0,30}\(?\d{1,3}\)?\s*pages?\b/i.test(s.text);
    if (!mandatory && !pageLimit && !(ASK.test(s.text) && /\b(offerors?|proposers?|firms?|respondents?|consultants?|contractors?|bidders?|submittals?|submissions?|proposals?|letter|data|you|your)\b/i.test(s.text)) && !inEval) continue;
    if (inEval && !mandatory && !/\b(experience|qualifications?|capacity|past performance|knowledge|approach|understanding|price|cost|schedule|personnel|team)\b/i.test(s.text)) continue;
    const key = s.text.toLowerCase().replace(/\W+/g, " ").slice(0, 120);
    if (seen.has(key)) continue;
    seen.add(key);
    const kind = kindOf(s.text, s.heading);
    requirements.push({ key: `r${requirements.length + 1}`, title: titleOf(s.text, s.heading, kind), kind, ref: refOf(s), excerpt: s.text, mandatory, sectionKey: sectionKeyOf(s.text, s.heading, kind) });
  }

  // Dates: each sentence with a date, classified by the words around it.
  const dates: BidDate[] = [];
  for (const s of sentences) {
    const found = datesIn(s.text);
    if (!found.length) continue;
    for (const dk of DATE_KINDS) {
      if (!dk.re.test(s.text)) continue;
      const d = found[found.length > 1 && dk.kind === "submission" ? found.length - 1 : 0];
      const t = timeNear(s.text, d.index + d.raw.length);
      const iso = t ? `${d.iso}T${t}` : d.iso;
      if (dates.some((x) => x.kind === dk.kind && x.date.slice(0, 10) === d.iso)) break;
      dates.push({ kind: dk.kind, date: iso, label: dk.label, note: s.text.length > 220 ? `${s.text.slice(0, 218)}…` : s.text, ref: refOf(s), mandatory: /\bmandatory\b/i.test(s.text) || undefined });
      break;
    }
  }
  const submission = known.dueDate ? null : dates.filter((d) => d.kind === "submission").sort((a, b) => b.date.localeCompare(a.date))[0];
  const fieldDue = fields["RESPONSE DATE/TIME/ZONE"] ?? fields["RESPONSE DATE"] ?? fields["DUE DATE"] ?? null;
  const fieldDueIso = fieldDue ? datesIn(fieldDue)[0] : null;
  const dueDate = known.dueDate ?? submission?.date ?? (fieldDueIso ? `${fieldDueIso.iso}${timeNear(fieldDue!, fieldDueIso.index + fieldDueIso.raw.length) ? `T${timeNear(fieldDue!, fieldDueIso.index + fieldDueIso.raw.length)}` : ""}` : null);
  if (known.dueDate) {
    // The notice's own response date wins over dates in older text (an amendment may have moved it).
    for (let i = dates.length - 1; i >= 0; i--) if (dates[i].kind === "submission" && dates[i].date.slice(0, 10) !== known.dueDate.slice(0, 10)) dates.splice(i, 1);
    if (!dates.some((d) => d.kind === "submission")) dates.push({ kind: "submission", date: known.dueDate, label: "Proposals due", note: "Response date on the notice, after any amendments.", ref: "Notice", mandatory: true });
  }

  // Evaluation factors: lines under an evaluation heading that name a factor, with points, percent, or an order.
  const evaluation: Solicitation["evaluation"] = [];
  for (const s of sentences) {
    if (!/\bevaluat|selection criteria|criteria|factors?\b/i.test(`${s.heading} ${s.text}`)) continue;
    const m = s.text.match(/^(?:\(?[a-z0-9]{1,3}[.)]\s*)?([A-Z][A-Za-z ,&/'-]{3,80}?)\s*[(:–-]\s*(\d{1,3})\s*(points?|pts\.?|%|percent)/);
    if (m) {
      if (!evaluation.some((e) => e.factor === m[1].trim())) evaluation.push({ factor: m[1].trim(), weight: `${m[2]} ${/%|percent/.test(m[3]) ? "percent" : "points"}`, ref: refOf(s) });
      continue;
    }
    const f = s.text.match(/^(?:\(?([a-z0-9]{1,2})[.)]\s*)?(Specialized experience|Professional qualifications|Past performance|Capacity|Knowledge of (the )?local(ity|e)|Location|Technical approach|Management approach|Price|Cost|Small business participation|Project understanding|Key personnel|Schedule)[^.:]{0,60}/i);
    if (f && !evaluation.some((e) => e.factor.toLowerCase() === f[2].toLowerCase())) evaluation.push({ factor: f[2].replace(/^./, (c) => c.toUpperCase()), weight: /descending order of importance/i.test(all) ? "In descending order of importance" : null, ref: refOf(s) });
  }

  const forms = FORM_RES.filter(([re]) => re.test(all)).map(([, label]) => label);
  const pageLimits = [...new Set(sentences.filter((s) => /\b(\d{1,3})\)?\s*(pages?|page limit|sheets?)\b|not (to )?exceed \d+ pages/i.test(s.text) && /\b(limit|exceed|maximum|no more than|not more than|shall be|must be|only the first|first)\b/i.test(s.text)).map((s) => s.text))].slice(0, 8);
  const naics = known.naics?.length ? known.naics : [...new Set([...all.matchAll(/\bNAICS(?:\s+code)?s?\s*(?:is|:|#)?\s*(\d{6})\b/gi)].map((m) => m[1]))];
  const setAsideMatch = all.match(/\b(total small business set-?aside|small business set-?aside|8\(a\)[^.\n]{0,40}set-?aside|HUBZone[^.\n]{0,30}set-?aside|service-?disabled veteran-?owned[^.\n]{0,30}set-?aside|set-?aside for (SDVOSB|service-?disabled veteran-?owned|small business|8\(a\)|HUBZone|WOSB|women-?owned)[^.\n]{0,20}|(economically disadvantaged )?women-?owned[^.\n]{0,30}set-?aside|unrestricted|full and open competition)\b/i);
  const setAside = known.setAside !== undefined ? known.setAside : setAsideMatch && !/unrestricted|full and open/i.test(setAsideMatch[0]) ? setAsideMatch[0].replace(/\s+/g, " ") : null;
  const bidBond = all.match(/\bbid (?:bond|guarantee)[^.]{0,80}?(\d{1,2})\s?(%|percent)/i);
  const perfBond = all.match(/\bperformance (?:and payment )?bonds?[^.]{0,80}?(\d{2,3})\s?(%|percent)/i);
  const payBond = all.match(/\bpayment bonds?[^.]{0,60}?(\d{2,3})\s?(%|percent)/i);
  const bonding = bidBond || perfBond || payBond ? { bidBondPercent: bidBond ? Number(bidBond[1]) : null, performanceBondPercent: perfBond ? Number(perfBond[1]) : null, paymentBondPercent: payBond ? Number(payBond[1]) : perfBond && /and payment/i.test(perfBond[0]) ? Number(perfBond[1]) : null, note: (bidBond ?? perfBond ?? payBond)![0].replace(/\s+/g, " ") } : null;
  const requiredCredentials = [...new Set(sentences.filter((s) => /\b(licensed|registered|registration|licensure)\b.{0,80}\b(state|commonwealth|architect|engineer|contractor)\b|\b(professional engineer|registered architect|P\.E\.|R\.A\.|AIA|NCARB|LEED)\b/i.test(s.text) && MUST.test(s.text)).map((s) => s.text))].slice(0, 6);
  const competitionSignals: string[] = [];
  if (/\bincumbent\b/i.test(all)) competitionSignals.push("The solicitation mentions an incumbent.");
  const multi = all.match(/\b(up to|multiple|approximately)\s+(\w+)\s+(IDIQ\s+)?(contracts?|awards?)\b/i);
  if (multi) competitionSignals.push(`It plans ${multi[0].replace(/\s+/g, " ")}.`);
  if (/\bIDIQ|indefinite[- ]delivery\b/i.test(all) && !/\b(is not an? IDIQ|not result in (the )?(award of )?an? (IDIQ|indefinite))/i.test(all)) competitionSignals.push("It is an indefinite-delivery contract: task orders compete again later.");
  if (/short selection|FAR 36\.602-5|36\.602-5/i.test(all)) competitionSignals.push("It builds a pool of firms for small projects under the simplified acquisition threshold; each project is then selected from the pool.");
  if (setAside) competitionSignals.push(`Set aside: ${setAside}. Only firms with that status compete.`);
  else if (/full and open|unrestricted/i.test(all)) competitionSignals.push("Full and open competition: large firms can bid too.");
  if (/\bsources sought\b/i.test(all)) competitionSignals.push("A sources sought notice: the agency is still deciding how to buy.");
  const value = all.match(/\b(estimated|magnitude|construction cost|cost range|budget|not to exceed|between)\b[^.$]{0,60}(\$\s?[\d,.]+(?:\s?(?:million|M))?)(?:\s*(?:and|to|-|–)\s*(\$\s?[\d,.]+(?:\s?(?:million|M))?))?/i);
  const toNum = (v: string | undefined) => (v ? Math.round(money(v.replace(/million|M/i, "")) * (/million|M/i.test(v) ? 1_000_000 : 1)) : null);
  const estimatedValue = value ? { min: value[3] ? toNum(value[2]) : null, max: toNum(value[3] ?? value[2]), note: value[0].replace(/\s+/g, " ") } : null;
  const email = all.match(/[\w.+-]+@[\w-]+\.(?:gov|mil|us|org|com|edu)\b/i)?.[0] ?? null;
  const phone = all.match(/\(?\b\d{3}\)?[-.\s]\d{3}[-.]\d{4}\b/)?.[0] ?? null;
  const contactName = fields["POINT OF CONTACT"]?.replace(/^(contract specialist|contracting officer)\s*/i, "").trim() || (all.match(/\b(?:contracting officer|contract specialist|point of contact|contact person|purchasing agent)\s*[:,-]?\s*([A-Z][a-z]+(?:\s[A-Z]\.?)?\s[A-Z][A-Za-z'-]+)/)?.[1] ?? null);
  const type: SolicitationType = known.type ?? (/\bSF\s?-?\s?330\b|architect-?engineer|A-E services|Brooks Act/i.test(all) ? "SF330" : /request for qualifications|\bRFQ\b|statement of qualifications/i.test(all) ? "RFQ" : /invitation for bids?|\bIFB\b|sealed bids?/i.test(all) ? "IFB" : /request for information|\bRFI\b/i.test(all) && !/request for proposals?/i.test(all) ? "RFI" : /sources sought/i.test(all) ? "sources_sought" : "RFP");
  const number = known.number ?? all.match(/\b(?:solicitation|RFP|RFQ|IFB|bid|project)\s*(?:no\.?|number|#)\s*:?\s*([A-Z0-9][A-Z0-9-]{4,})/i)?.[1] ?? null;
  const title = known.title ?? pages[0]?.text.split("\n").map((l) => l.trim()).find((l) => l.length > 12 && l.length < 140 && /[a-z]/.test(l) && !/^page \d/i.test(l)) ?? "Solicitation";

  return {
    title,
    issuer: known.issuer ?? null,
    dueDate,
    solicitation: {
      type,
      number,
      naics,
      setAside,
      placeOfPerformance: known.placeOfPerformance ?? null,
      estimatedValue,
      dates: dates.sort((a, b) => a.date.localeCompare(b.date)),
      source: "upload",
      documentId: null,
      bonding,
      requiredCredentials,
      forms,
      pageLimits,
      evaluation,
      competitionSignals,
      contact: known.contact ?? (contactName || email ? { name: contactName ?? "Contracting office", email, phone } : null),
    },
    requirements,
    readBy: "rules",
    pageCount: pages.length,
    wordCount: all.split(/\s+/).filter(Boolean).length,
  };
}
