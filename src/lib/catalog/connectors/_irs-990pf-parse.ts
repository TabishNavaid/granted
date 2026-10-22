import sax from "sax";

/**
 * Form 990-PF e-file XML to the fields FundFellows uses. A TypeScript port of the parsing and derivation rules in
 * scripts/foundations/build_foundations.py (see docs/foundations-data.md): elements are matched by local name so
 * schema years differ without breaking, grants to individuals are counted but their names are never read into the
 * output, and focus labels come from keyword rules over grant purposes and recipient names.
 */

// ---------- A small namespace-free element tree ----------

export interface El {
  n: string;
  t: string;
  c: El[];
}

/** Parse XML into a tree of local names. Refuses DTDs and entity declarations (IRS e-files never have them). */
export function parseXml(xml: string | Buffer): El {
  const text = typeof xml === "string" ? xml : xml.toString("utf8");
  if (/<!DOCTYPE|<!ENTITY/i.test(text.slice(0, 4096)) || text.includes("<!ENTITY")) throw new Error("DOCTYPE or ENTITY not allowed");
  const parser = sax.parser(true, { trim: false, normalize: false });
  const root: El = { n: "#root", t: "", c: [] };
  const stack: El[] = [root];
  let error: Error | null = null;
  parser.onopentag = (node) => {
    const el: El = { n: node.name.replace(/^.*:/, ""), t: "", c: [] };
    stack[stack.length - 1].c.push(el);
    stack.push(el);
  };
  parser.ontext = (t) => {
    stack[stack.length - 1].t += t;
  };
  parser.oncdata = (t) => {
    stack[stack.length - 1].t += t;
  };
  parser.onclosetag = () => {
    const el = stack.pop()!;
    el.t = el.c.length ? "" : el.t.trim();
  };
  parser.onerror = (e) => {
    error = e;
  };
  parser.write(text.replace(/^﻿/, "")).close();
  if (error) throw error;
  return root;
}

/** Every element named `name` at any depth under `el`. */
export function descendants(el: El | null | undefined, name: string, out: El[] = []): El[] {
  if (!el) return out;
  for (const c of el.c) {
    if (c.n === name) out.push(c);
    descendants(c, name, out);
  }
  return out;
}

/** ElementPath subset: "A/B" (children) and ".//A/B" (A at any depth, then child B). */
export function select(el: El | null | undefined, p: string): El[] {
  if (!el) return [];
  let cur: El[] = [el];
  let parts = p.split("/");
  if (p.startsWith(".//")) {
    parts = parts.slice(2);
    cur = descendants(el, parts[0]);
    parts = parts.slice(1);
  }
  for (const part of parts) cur = cur.flatMap((x) => x.c.filter((c) => c.n === part));
  return cur;
}

export function first(el: El | null | undefined, ...paths: string[]): El | null {
  for (const p of paths) {
    const hit = select(el, p)[0];
    if (hit) return hit;
  }
  return null;
}

/** First non-empty text among the paths. */
export function ftext(el: El | null | undefined, ...paths: string[]): string | null {
  for (const p of paths) {
    for (const node of select(el, p)) if (node.t && node.t.trim()) return node.t.trim();
  }
  return null;
}

export function fnum(el: El | null | undefined, ...paths: string[]): number | null {
  const t = ftext(el, ...paths);
  if (t === null) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

// ---------- Text helpers (title and sentence case for IRS all-caps text) ----------

const SMALL = new Set(["an", "and", "as", "at", "by", "for", "in", "of", "on", "or", "the", "to", "with", "de", "la"]);
const KEEP_UPPER = new Set(
  "USA US YMCA YWCA UMC LLC LLP NA II III IV VI VII VIII IX XI SPCA PTA PTO FFA NC OH KY UNC OSU UK WKU EKU NKU ECU UNCW NCSU CMC PNC JP PBS NPR WOSU WCPN WUNC AME CME AMVETS VFW ALS CF MS ARC STEM KIPP HIV AIDS WVXU WGUC KET CCF UCLA MIT YMHA JCC CYO YMI BSA GSA LGBT LGBTQ AARP SECU TTEE UA UW UC OU BGSU CWRU JDRF".split(" "),
);
const ABBREV: Record<string, string> = {
  FDN: "Foundation", FNDN: "Foundation", FNDTN: "Foundation", FOUNDATIO: "Foundation", FOUND: "Foundation", FOUNDATI: "Foundation", FOUNDAT: "Foundation",
  CHAR: "Charitable", CHARITAB: "Charitable", CHARITABL: "Charitable", MEM: "Memorial", INC: "Inc", CORP: "Corp", CO: "Co", ASSN: "Association",
  ASSOC: "Association", SCHOL: "Scholarship", TR: "Trust", TRST: "Trust",
};
const NOT_ACRONYM = new Set(["MR", "MRS", "DR", "ST", "JR", "SR", "MT", "FT", "CT", "LTD", "BLVD", "PL"]);

function capWord(w: string): string {
  if (!w) return w;
  if (w.includes("-") && w.length > 1) return w.split("-").map(capWord).join("-");
  if (w.includes("/") && w.length > 1) return w.split("/").map(capWord).join("/");
  const core = w.replace(/^[.,()'"]+|[.,()'"]+$/g, "");
  const up = core.toUpperCase();
  if (ABBREV[up] && /^[A-Za-z]+$/.test(core)) return w.replace(core, ABBREV[up]);
  if (KEEP_UPPER.has(up)) return w.toUpperCase();
  if (core.length >= 2 && core.length <= 4 && /^[A-Za-z]+$/.test(core) && !/[aeiouy]/i.test(core) && !NOT_ACRONYM.has(up)) return w.toUpperCase();
  if (/^[A-Za-z]\.([A-Za-z]\.?)+,?$/.test(w)) return w.toUpperCase();
  const lw = w.toLowerCase();
  let m = lw.match(/^([^a-z]*)(mc)([a-z])(.*)$/);
  if (m && lw.length > 3) return `${m[1]}Mc${m[3].toUpperCase()}${m[4]}`;
  m = lw.match(/^([^a-z]*)(o')([a-z])(.*)$/);
  if (m) return `${m[1]}O'${m[3].toUpperCase()}${m[4]}`;
  return lw.replace(/[a-z]/, (c) => c.toUpperCase()).replace(/'S\b/g, "'s");
}

/** All-caps names to title case; text that is already mixed case is left alone. */
export function titleCase(s: string | null | undefined): string | null {
  if (!s) return s ?? null;
  const t = s.replace(/\s+/g, " ").trim();
  const letters = t.replace(/[^A-Za-z]/g, "");
  if (letters && letters.replace(/[^a-z]/g, "").length / letters.length > 0.3) return t;
  const words = t.split(" ");
  const out = words.map((w, i) => (i > 0 && i < words.length - 1 && SMALL.has(w.toLowerCase()) ? w.toLowerCase() : capWord(w)));
  return out.join(" ").replace(/\bInc\b\.?$/, "Inc.");
}

const PROPER = new RegExp(
  "\\b(january|february|march|april|may 1|june|july|august|september|october|november|december|monday|tuesday|wednesday|thursday|friday|saturday|sunday|" +
    "alabama|alaska|arizona|arkansas|california|colorado|connecticut|delaware|florida|georgia|hawaii|idaho|illinois|indiana|iowa|kansas|kentucky|louisiana|maine|maryland|" +
    "massachusetts|michigan|minnesota|mississippi|missouri|montana|nebraska|nevada|new hampshire|new jersey|new mexico|new york|north carolina|north dakota|ohio|oklahoma|" +
    "oregon|pennsylvania|rhode island|south carolina|south dakota|tennessee|texas|utah|vermont|virginia|washington|west virginia|wisconsin|wyoming|puerto rico|" +
    "appalachia|christian|god|jesus|christ|catholic|jewish|united way|salvation army|red cross|habitat for humanity)\\b",
  "g",
);

/** Long all-caps text to sentence case, optionally trimmed to `limit` characters. */
export function sentenceCase(s: string | null | undefined, limit?: number): string | null {
  if (s === null || s === undefined) return null;
  let t = s.replace(/\s+/g, " ").trim();
  if (!t) return null;
  const letters = t.replace(/[^A-Za-z]/g, "");
  if (letters && letters.replace(/[^A-Z]/g, "").length / letters.length > 0.8) {
    t = t.toLowerCase();
    t = t.replace(/(^|[.!?]\s+)([a-z])/g, (_, a: string, b: string) => a + b.toUpperCase());
    t = t.replace(/\bi\b/g, "I");
    t = t.replace(PROPER, (m) => m.replace(/\b[a-z]/g, (c) => c.toUpperCase()));
    t = t.replace(/\b(usa|u\.s\.|irs|ymca|ywca|llc|n\/a)\b|501\(c\)\(3\)/g, (m) => m.toUpperCase());
  }
  if (limit && t.length > limit) {
    const cut = t.slice(0, limit - 1).replace(/\s+\S*$/, "").replace(/[,;:\- ]+$/, "");
    t = `${cut}...`;
  }
  return t.replace(/[–—]/g, "-");
}

const NULLISH = new Set(["", "N/A", "NA", "NONE.", "N A", "-", "--", "0", "NOT APPLICABLE", "N/A.", "X", "."]);

export function cleanText(s: string | null | undefined, limit = 400): string | null {
  if (s === null || s === undefined) return null;
  const t = s.replace(/\s+/g, " ").trim();
  if (NULLISH.has(t.toUpperCase())) return null;
  return sentenceCase(t, limit);
}

const ORG_WORD = /\b(foundation|fund|trust|charitable|charities|memorial|endowment|scholarship|association|society|institute|inc|corp|family|fdn|trst|tr)\b/i;
const CARE_OF = /^\s*(%|c\/o\b|co\b|attn\b|ttee\b|trustee\b)/i;
const TRUSTEE_WORD = /\b(ttee|trustee|bank|n\.?a\.?|wealth|trust company|trust co)\b/i;

/** Append name line 2 only when it continues the name; drop care-of lines, people, and bank trustees. */
export function joinNameLines(line1: string | null, line2: string | null): string | null {
  if (line1) line1 = line1.replace(/\s+(c\/o|%|co)\s+.*\b(trust|trustee|ttee|bank)\b.*$/i, "").trim();
  if (!line2 || !line1) return line1;
  if (CARE_OF.test(line2) || TRUSTEE_WORD.test(line2)) return line1;
  const dangling = /\b(the|and|&|of|for|family|memorial|charitable)$/i.test(line1);
  return ORG_WORD.test(line2) || dangling ? `${line1} ${line2}` : line1;
}

// A profile on a nonprofit directory or an IRS page is not the foundation's own site.
const DIRECTORY_SITES = /(\birs\.gov\b|\b\d{2}-?\d{7}\b|\/(profiles?|organizations?|nonprofits?|orgs?|ein|charities|funders?|grantmakers?)\/)/i;

export function normalizeWebsite(s: string | null | undefined): string | null {
  if (!s) return null;
  let t = s.trim().replace(/\/+$/, "").replace(/^\/+/, "").toLowerCase();
  if (NULLISH.has(t.toUpperCase()) || ["none", "n/a", "na", "no", "www", "http://", "https://"].includes(t)) return null;
  t = t.replace(/^https?:\/*/, "").replace(/^www\.\s+/, "www.");
  t = t.split(/\s+/)[0] ?? "";
  if (DIRECTORY_SITES.test(t)) return null;
  if (!/^[a-z0-9.-]+\.[a-z]{2,}(\/\S*)?$/.test(t)) return null;
  return `https://${t}`;
}

export function formatPhone(s: string | null | undefined): string | null {
  if (!s) return null;
  let d = s.replace(/\D/g, "");
  if (d.length === 11 && d.startsWith("1")) d = d.slice(1);
  if (d.length !== 10 || /^0+$/.test(d)) return null;
  return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
}

// ---------- The 990-PF ----------

export interface ApplicationInfo {
  contact: string | null;
  contactName: string | null;
  phone: string | null;
  email: string | null;
  howTo: string | null;
  deadlines: string | null;
  restrictions: string | null;
}

export interface OrgGrant {
  name: string;
  city: string | null;
  state: string | null;
  amount: number;
  purpose: string | null;
}

export interface Parsed990PF {
  ein: string | null;
  name: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  website: string | null;
  taxYear: number | null;
  taxPeriodEnd: string | null;
  assets: number | null;
  totalXV: number | null;
  contri: number | null;
  onlyPreselected: boolean;
  accepts: boolean | null;
  application: ApplicationInfo | null;
  grants: OrgGrant[];
  /** Grants to individuals: amount and purpose only. Names are never read. */
  indiv: { amount: number; purpose: string | null }[];
}

const TRUE_IND = new Set(["X", "1", "TRUE", "YES"]);

export function parse990PF(xml: string | Buffer): Parsed990PF | null {
  const root = parseXml(xml);
  const header = descendants(root, "ReturnHeader")[0] ?? null;
  const pf = descendants(root, "IRS990PF")[0] ?? null;
  if (!pf) return null;
  const filer = first(header, ".//Filer");
  const name = joinNameLines(
    ftext(filer, "BusinessName/BusinessNameLine1Txt", "BusinessName/BusinessNameLine1", "Name/BusinessNameLine1"),
    ftext(filer, "BusinessName/BusinessNameLine2Txt", "BusinessName/BusinessNameLine2"),
  );
  const addr = first(filer, "USAddress", "AddressUS");
  const end = ftext(header, "TaxPeriodEndDt", "TaxPeriodEndDate");
  let taxYr = ftext(header, "TaxYr", "TaxYear");
  if (!taxYr && end) taxYr = Number(end.slice(5, 7)) < 12 ? String(Number(end.slice(0, 4)) - 1) : end.slice(0, 4);

  const pre = ftext(pf, ".//OnlyContriToPreselectedInd", ".//OnlyContributesToPreselected");
  const onlyPreselected = pre !== null && TRUE_IND.has(pre.trim().toUpperCase());

  let application: ApplicationInfo | null = null;
  for (const g of descendants(pf, "ApplicationSubmissionInfoGrp")) {
    const person = ftext(g, "RecipientPersonNm", "RecipientPersonName", "RecipientName");
    const biz = ftext(g, "RecipientBusinessName/BusinessNameLine1Txt", "RecipientBusinessName/BusinessNameLine1");
    const phone = formatPhone(ftext(g, "RecipientPhoneNum", "RecipientPhoneNumber", "RecipientForeignPhoneNum"));
    let email = ftext(g, "RecipientEmailAddressTxt", "RecipientEmailAddress");
    if (email && !/^[^@\s]+@[^@\s]+\.[A-Za-z]{2,}$/.test(email)) email = null;
    const gaddr = first(g, "RecipientUSAddress");
    const parts: (string | null)[] = [person ? titleCase(person) : null, biz ? titleCase(biz) : null];
    if (gaddr) {
      const stZip = [ftext(gaddr, "StateAbbreviationCd", "State"), (ftext(gaddr, "ZIPCd", "ZIPCode") ?? "").slice(0, 5)].filter(Boolean).join(" ");
      const line = [titleCase(ftext(gaddr, "AddressLine1Txt", "AddressLine1")), titleCase(ftext(gaddr, "CityNm", "City")), stZip].filter(Boolean).join(", ");
      parts.push(line || null);
    }
    parts.push(phone, email ? email.toLowerCase() : null);
    const app: ApplicationInfo = {
      contact: parts.filter(Boolean).join("; ") || null,
      contactName: titleCase(person) ?? titleCase(biz) ?? null,
      phone,
      email: email ? email.toLowerCase() : null,
      howTo: cleanText(ftext(g, "FormAndInfoAndMaterialsTxt", "FormAndInfoAndMaterials")),
      deadlines: cleanText(ftext(g, "SubmissionDeadlinesTxt", "SubmissionDeadlines")),
      restrictions: cleanText(ftext(g, "RestrictionsOnAwardsTxt", "RestrictionsOnAwards")),
    };
    if (app.contact || app.howTo || app.deadlines || app.restrictions) {
      application = app;
      break;
    }
  }
  // Part XV line 2 is filled in only when the preselected box is not checked.
  const accepts = onlyPreselected ? false : application ? true : null;

  const grants: OrgGrant[] = [];
  const indiv: Parsed990PF["indiv"] = [];
  for (const g of descendants(root, "GrantOrContributionPdDurYrGrp")) {
    const amt = fnum(g, "Amt", "Amount");
    if (amt === null || amt <= 0) continue;
    const purpose = ftext(g, "GrantOrContributionPurposeTxt", "PurposeOfGrantOrContribution");
    const biz = [
      ftext(g, "RecipientBusinessName/BusinessNameLine1Txt", "RecipientBusinessName/BusinessNameLine1"),
      ftext(g, "RecipientBusinessName/BusinessNameLine2Txt", "RecipientBusinessName/BusinessNameLine2"),
    ]
      .filter(Boolean)
      .join(" ");
    if (!biz) {
      // A grant to a person. Count it; never keep the name.
      if (first(g, "RecipientPersonNm", "RecipientPersonName")) indiv.push({ amount: amt, purpose });
      continue;
    }
    const us = first(g, "RecipientUSAddress");
    grants.push({ name: biz, city: ftext(us, "CityNm", "City"), state: ftext(us, "StateAbbreviationCd", "State"), amount: amt, purpose });
  }

  return {
    ein: ftext(filer, "EIN"),
    name,
    city: ftext(addr, "CityNm", "City"),
    state: ftext(addr, "StateAbbreviationCd", "State"),
    zip: ftext(addr, "ZIPCd", "ZIPCode"),
    website: ftext(pf, ".//WebsiteAddressTxt", ".//WebSiteAddressTxt", ".//WebsiteAddress"),
    taxYear: taxYr && /^\d{4}$/.test(taxYr) ? Number(taxYr) : null,
    taxPeriodEnd: end,
    assets: fnum(pf, "FMVAssetsEOYAmt", ".//FMVAssetsEOYAmt", ".//FairMarketValueOfAllAssets"),
    totalXV: fnum(pf, ".//SupplementaryInformationGrp/TotalGrantOrContriPdDurYrAmt", ".//TotalGrantOrContriPdDurYrAmt", ".//TotalGrantOrContriPaidDuringYear"),
    contri: fnum(pf, ".//AnalysisOfRevenueAndExpenses/ContriPaidRevAndExpnssAmt", ".//ContriPaidRevAndExpnssAmt", ".//ContriPaidDsbrsChrtblAmt", ".//ContributionsGiftsGrantsPaid"),
    onlyPreselected,
    accepts,
    application,
    grants,
    indiv,
  };
}

// ---------- Derivations ----------

export const FOCUS_ORDER = [
  "Youth development", "Education", "Food security", "Health", "Rural health", "Human services", "Housing", "Arts and culture",
  "Environment", "Community development", "Religion", "Animals", "Scholarships",
] as const;
export type FocusLabel = (typeof FOCUS_ORDER)[number];

const FOCUS_RULES: Record<Exclude<FocusLabel, "Rural health">, [RegExp, RegExp | null]> = {
  "Youth development": [
    /boys? ?(&|and)? ?girls? club|boy scouts?|girl scouts?|\bscouts?\b|scouting|\bymca\b|\bywca\b|\b4-?h\b|big brothers|big sisters|\byouth\b|\bchild(ren)?'?s?\b|\bkids?\b|\bteens?\b|\bcamps?\b|little league|junior achievement|after[- ]?school|mentor|young life|\bfuture farmers|\bffa\b|juvenile|adolescen/,
    /children'?s hospital|children'?s medical|childrens hospital|kids'? cancer/,
  ],
  Education: [
    /school|universit|college|academ(y|ic)|education|\blibrar|literacy|\bstem\b|tutor|\bpta\b|\bpto\b|seminary|institute of technology|learning|students?\b|teacher|classroom|head start|pre-?k\b|preschool|montessori|curriculum/,
    null,
  ],
  "Food security": [/food ?bank|food pantr|pantry|hunger|\bmeals?\b|feeding|second harvest|soup kitchen|nutrition|\bfood\b|harvesters|feed the|backpack program|manna|loaves/, /food allergy/],
  Health: [
    /hospital|health|medical|medicine|cancer|clinic|hospice|heart association|alzheimer|diabetes|mental|disease|research foundation|cystic|leukemia|lymphoma|autism|nursing|dental|\bmed\b|cleveland clinic|ronald mcdonald|physician|wellness|addiction|recovery|substance|rehabilitation|disabilit|blind|deaf|lung|kidney|march of dimes|st\.? jude|muscular|parkinson|ms society|multiple sclerosis|behavioral|pregnancy|maternal|patient/,
    null,
  ],
  "Human services": [
    /united way|salvation army|red cross|family services|social services|human services|goodwill|catholic charities|lutheran services|community action|shelter|homeless|domestic violence|crisis|refugee|emergency (assistance|relief)|relief fund|disaster|\bneedy\b|\bpoor\b|poverty|seniors?\b|elderly|aging|volunteers of america|family promise|ministries of|rescue mission|city mission|union mission|charities\b|benevolen|welfare|assistance|outreach|\bcare\b|caregiv|foster|adoption|veterans?/,
    null,
  ],
  Housing: [/habitat for humanity|housing|homeless|shelter|\bhomes?\b(?! ?(health|care))|affordable|transitional living|family promise|rebuilding together/, /nursing home|funeral home/],
  "Arts and culture": [
    /museum|symphony|orchestra|theat(er|re)|\barts?\b|ballet|opera|public radio|\bpbs\b|\bnpr\b|public media|historical|history|heritage|music|dance|choir|chorale|film|library foundation|cultural|culture|gallery|playhouse|festival|preservation society/,
    /martial arts|liberal arts college/,
  ],
  Environment: [
    /conservanc|nature|\bparks?\b|land trust|environment|arboretum|garden|watershed|\briver|\blake\b|forest|conservation|audubon|sierra club|clean water|trails?\b|metroparks|greenway|botanical|soil|climate|sustainab|recycl|wildlands/,
    /park(way)? (school|church|elementary)/,
  ],
  "Community development": [
    /community foundation|economic development|downtown|chamber of commerce|revitaliz|community development|neighborhood|civic|main street|redevelopment|workforce|job training|small business|community center|community improvement|rotary|kiwanis|lions club|fire (department|company)|volunteer fire|rescue squad|police|city of |village of |county of |township/,
    null,
  ],
  Religion: [
    /church|ministr|diocese|parish|temple|synagogue|religious|congregation|baptist|methodist|lutheran|presbyterian|catholic|episcopal|\bmission\b|missions\b|gospel|christian|bible|jewish|islamic|mosque|evangel|faith|worship|chapel|\bumc\b|tithe|tithing|\bgod\b|jesus|christ\b|apostolic|pentecostal|mennonite|amish|seventh[- ]day|young life|cru\b|navigators|samaritan'?s purse|billy graham/,
    null,
  ],
  Animals: [/humane society|\bspca\b|animal|pets?\b|\bzoo\b|zoolog|wildlife|equine|horse|\bdogs?\b|\bcats?\b|veterinar|aquarium|raptor|bird/, /bird ?watch/],
  Scholarships: [/scholarship|tuition|student aid|financial aid|educational award|fellowship/, null],
};
const RURAL_CUE =
  /rural|critical access|county hospital|county health|health department|appalach|frontier nursing|mountain|countryside|farmworker|migrant|community health center|free clinic|mobile (clinic|health|unit)/;

/**
 * One to four focus labels. A label is kept when its matched grants are at least 10% of organization dollars, or
 * at least 15% of grants (and at least 2). Ranked by matched dollars; if none pass, the single best match.
 */
export function focusLabels(grants: OrgGrant[], indiv: Parsed990PF["indiv"]): FocusLabel[] {
  const dollars = new Map<FocusLabel, number>();
  const counts = new Map<FocusLabel, number>();
  const add = (l: FocusLabel, amt: number) => {
    dollars.set(l, (dollars.get(l) ?? 0) + amt);
    counts.set(l, (counts.get(l) ?? 0) + 1);
  };
  const total = grants.reduce((s, g) => s + g.amount, 0) || 1;
  const n = grants.length || 1;
  for (const g of grants) {
    const text = `${g.purpose ?? ""} ${g.name ?? ""}`.toLowerCase();
    const hit = new Set<FocusLabel>();
    for (const [label, [inc, exc]] of Object.entries(FOCUS_RULES) as [FocusLabel, [RegExp, RegExp | null]][]) {
      if (inc.test(text) && !(exc && exc.test(text))) hit.add(label);
    }
    if (hit.has("Health") && RURAL_CUE.test(text)) hit.add("Rural health");
    for (const l of hit) add(l, g.amount);
  }
  for (const g of indiv) if (/scholar|tuition|education|college|student/.test((g.purpose ?? "").toLowerCase())) add("Scholarships", g.amount);
  let keep = [...dollars.keys()].filter((l) => dollars.get(l)! / total >= 0.1 || (counts.get(l)! >= 2 && counts.get(l)! / n >= 0.15));
  keep.sort((a, b) => dollars.get(b)! - dollars.get(a)! || FOCUS_ORDER.indexOf(a) - FOCUS_ORDER.indexOf(b));
  if (!keep.length && dollars.size) keep = [[...dollars.entries()].sort((a, b) => b[1] - a[1])[0][0]];
  return keep.slice(0, 4);
}

const GENERIC_WORDS = new Set(
  `general operating operations support supports fund funds funding purpose purposes use unrestricted charitable annual campaign expenses expense contribution contributions donation donations gift gifts program programs see attached statement budget of the for to and a an exempt mission organization organizational organizations capacity public charity charities 501c3 501 c 3 its their activities ongoing needs need sustaining sustain continued continuing grant grants general-operating religious educational scientific literary`.split(
    /\s+/,
  ),
);

export function isGeneric(p: string): boolean {
  const words = p.toLowerCase().match(/[a-z0-9]+/g) ?? [];
  return !words.length || words.every((w) => GENERIC_WORDS.has(w));
}

/** Up to k distinct, non-generic grant purposes, ordered by dollars. */
export function purposeSample(grants: OrgGrant[], k = 3): string[] {
  const by = new Map<string, number>();
  for (const g of grants) {
    const p = (g.purpose ?? "").replace(/\s+/g, " ").trim();
    if (p.length < 4 || isGeneric(p)) continue;
    by.set(p.toUpperCase(), (by.get(p.toUpperCase()) ?? 0) + g.amount);
  }
  return [...by.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, k)
    .map(([p]) => sentenceCase(p, 140)!);
}

function median(sorted: number[]): number | null {
  if (!sorted.length) return null;
  const m = sorted.length >> 1;
  return sorted.length % 2 ? sorted[m] : (sorted[m - 1] + sorted[m]) / 2;
}

export interface GrantStats {
  totalGiving: number | null;
  grantCount: number;
  grantMedian: number | null;
  grantMin: number | null;
  grantMax: number | null;
  /** 10th and 90th percentile grant: the range most grants fall in, without one-off matching gifts and outliers. */
  grantP10: number | null;
  grantP90: number | null;
  granteeStates: { state: string; count: number }[];
  granteeCities: { city: string; state: string; count: number }[];
  grantees: { name: string; city: string | null; state: string | null; amount: number; purpose: string | null }[];
  purposeSample: string[];
  focus: FocusLabel[];
  individual: { count: number; total: number; min: number | null; median: number | null; max: number | null; scholarships: number };
}

/** Grant statistics, top grantees (organizations only), grantee places, and focus labels. */
export function grantStats(p: Parsed990PF): GrantStats {
  const amounts = p.grants.map((g) => g.amount).sort((a, b) => a - b);
  const sum = amounts.reduce((s, a) => s + a, 0);
  const total = p.totalXV || p.contri || (amounts.length ? sum : null);
  const states = new Map<string, number>();
  const cities = new Map<string, { city: string; state: string; count: number }>();
  for (const g of p.grants) {
    if (g.state) states.set(g.state, (states.get(g.state) ?? 0) + 1);
    if (g.city && g.state) {
      const city = titleCase(g.city)!;
      const k = `${city}|${g.state}`;
      const cur = cities.get(k) ?? { city, state: g.state, count: 0 };
      cur.count++;
      cities.set(k, cur);
    }
  }
  const ind = p.indiv.map((g) => g.amount).sort((a, b) => a - b);
  return {
    totalGiving: total !== null ? Math.round(total) : null,
    grantCount: amounts.length,
    grantMedian: amounts.length ? Math.round(median(amounts)!) : null,
    grantMin: amounts.length ? Math.round(amounts[0]) : null,
    grantMax: amounts.length ? Math.round(amounts[amounts.length - 1]) : null,
    grantP10: amounts.length ? Math.round(amounts[Math.floor(0.1 * (amounts.length - 1))]) : null,
    grantP90: amounts.length ? Math.round(amounts[Math.ceil(0.9 * (amounts.length - 1))]) : null,
    granteeStates: [...states.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([state, count]) => ({ state, count })),
    granteeCities: [...cities.values()].sort((a, b) => b.count - a.count || a.city.localeCompare(b.city)).slice(0, 5),
    grantees: [...p.grants]
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 15)
      .map((g) => ({ name: titleCase(g.name)!, city: titleCase(g.city), state: g.state, amount: Math.round(g.amount), purpose: sentenceCase(g.purpose, 100) })),
    purposeSample: purposeSample(p.grants),
    focus: focusLabels(p.grants, p.indiv),
    individual: {
      count: ind.length,
      total: Math.round(ind.reduce((s, a) => s + a, 0)),
      min: ind.length ? Math.round(ind[0]) : null,
      median: ind.length ? Math.round(median(ind)!) : null,
      max: ind.length ? Math.round(ind[ind.length - 1]) : null,
      scholarships: p.indiv.filter((g) => /scholar|tuition|education|college|student/i.test(g.purpose ?? "")).length,
    },
  };
}
