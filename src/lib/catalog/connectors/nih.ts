import { deadline, isoDate, plainText } from "../normalize";
import type { Connector, FunderInput, IngestContext, KeyDate, OpportunityInput, SourceDefinition } from "../types";
import { stateCode, uniq, type EligibilityCode } from "../vocab";
import { getJson } from "../ingest/http";
import { AwardAggregator, MIN_STATE_GROUP, completedFiscalYears } from "./_research-stats";

/**
 * National Institutes of Health.
 *
 * nih_guide: active funding notices (RFA, PA, PAR, PAS) from the NIH Guide for Grants and Contracts, read from the JSON
 * service behind the Guide's own search page (search.grants.nih.gov/guide/api/data). One run reads every active notice
 * (about 400, in pages of 50), so it is a full snapshot. Since fiscal year 2026 NIH posts new notices of funding
 * opportunity on Grants.gov only (NOT-OD-25-143); the Guide index still lists them and links to Grants.gov, so those rows
 * point at the Grants.gov page. Grants.gov stays primary in dedupe (priority 10 against our 20); this source adds the
 * application due dates, letter of intent dates, activity codes, and participating institutes.
 *
 * nih_reporter: past awards from the RePORTER API v2, aggregated by institute, activity code, organization state, and
 * fiscal year. Project rows are never stored.
 */

const NIH_FUNDER: FunderInput = {
  key: "agency:HHS-NIH11",
  name: "National Institutes of Health",
  kind: "federal_agency",
  parentKey: "agency:HHS",
  website: "https://www.nih.gov",
  country: "US",
  sourceUrl: "https://grants.nih.gov/funding/nih-guide-for-grants-and-contracts",
};

// ---------------------------------------------------------------- NIH Guide

export const guideSource: SourceDefinition = {
  id: "nih_guide",
  name: "NIH Guide for Grants and Contracts",
  covers: "Active NIH funding notices (RFAs, program announcements, and PARs) with due dates, activity codes, and participating institutes.",
  homepage: "https://grants.nih.gov/funding/nih-guide-for-grants-and-contracts",
  docsUrl: "https://grants.nih.gov/funding/nih-guide-for-grants-and-contracts",
  termsUrl: "https://www.nih.gov/web-policies-notices",
  license: "Public domain (U.S. government work)",
  attribution: "Source: NIH Guide for Grants and Contracts",
  kinds: ["research"],
  region: "us",
  cadence: "Daily",
  schedule: "40 10 * * *",
  enabled: true,
  priority: 20,
};

const GUIDE_API = "https://search.grants.nih.gov/guide/api/data";
const GUIDE_PAGE = 50;
/** Funding notice types. NOT- notices (changes, NOSIs) are skipped. */
const FUNDING_DOCTYPES = new Set(["RFA", "PA", "PAR", "PAS", "OTA", "NOFO"]);

export interface GuideDoc {
  rowid?: string;
  type?: string;
  title?: string;
  docnum?: string;
  organization?: { parent?: string; primary?: string };
  primaryIC?: string;
  reldate?: string | null;
  expdate?: string | null;
  opendate?: string | null;
  parentFOA?: string | null;
  doctype?: string;
  ac?: string[] | null;
  filename?: string | null;
  clinicaltrials?: string | null;
  sponsors?: string[] | null;
  appreceiptdate?: string | null;
  fadirectcosts?: string | null;
  purpose?: string | null;
  ggid?: string | null;
  doctext?: string | null;
}

interface GuideResponse {
  statusCode?: number;
  data?: { hits?: { total?: number | { value: number }; hits?: { _source: GuideDoc }[] } };
}

function mmddyyyy(d: Date) {
  return `${String(d.getUTCMonth() + 1).padStart(2, "0")}${String(d.getUTCDate()).padStart(2, "0")}${d.getUTCFullYear()}`;
}

export function guideApiUrl(from: number, now = new Date()): string {
  const q = new URLSearchParams({
    perpage: String(GUIDE_PAGE),
    sort: "reldate:desc",
    from: String(from),
    type: "active",
    parentic: "all",
    primaryic: "all",
    activitycodes: "all",
    doctype: "all",
    parentfoa: "all",
    daterange: `01021991-${mmddyyyy(now)}`,
    clinicaltrials: "all",
    fields: "all",
    spons: "true",
    query: "",
  });
  return `${GUIDE_API}?${q.toString()}`;
}

/** The notice page in the Guide; notices posted only on Grants.gov (no Guide file) link to Grants.gov. */
export function guideUrl(d: GuideDoc): string | null {
  const file = d.filename?.trim();
  if (file && /^[A-Za-z0-9._-]+\.html?$/.test(file)) {
    const folder = /^RFA-/i.test(file) ? "rfa-files" : /^NOT-/i.test(file) ? "notice-files" : "pa-files";
    return `https://grants.nih.gov/grants/guide/${folder}/${file}`;
  }
  if (d.ggid && /^\d+$/.test(d.ggid)) return `https://www.grants.gov/search-results-detail/${d.ggid}`;
  return null;
}

const MONTHS = "January|February|March|April|May|June|July|August|September|October|November|December";
const TOKEN = new RegExp(`(${MONTHS})\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?,\\s*(\\d{4})|\\b(\\d{1,2})/(\\d{1,2})/(\\d{4})\\b|(Not Applicable)|(${MONTHS})\\s+(\\d{4})(?!\\d)`, "g");
const FULL_DATE = new RegExp(`(${MONTHS})\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?,\\s*(\\d{4})`, "g");

function dayOf(month: string, day: string, year: string): string | null {
  return isoDate(`${month} ${day}, ${year}`);
}

export interface GuideDates {
  posted: string | null;
  open: string | null;
  expiration: string | null;
  loi: string[];
  due: string[];
  aidsDue: string[];
  standardDates: boolean;
  /** Due dates written in words, when the notice gives no dates ("Due dates may vary by awarding IC"). */
  dueText: string | null;
}

/**
 * Key dates from the notice text. The Key Dates table flattens to a run of cells per review cycle:
 * new, renewal, and AIDS due dates (full dates or "Not Applicable"), then review, council, and start months
 * ("July 2027"). Cells are grouped into rows at each run of month-only tokens; with an AIDS column the last
 * date cell of a row is the AIDS due date.
 */
export function parseGuideDates(d: GuideDoc): GuideDates {
  const text = plainText(d.doctext ?? "").replace(/\s+/g, " ");
  const out: GuideDates = {
    posted: isoDate(d.reldate),
    open: isoDate(d.opendate),
    expiration: isoDate(d.expdate),
    loi: [],
    due: [],
    aidsDue: [],
    standardDates: false,
    dueText: null,
  };
  const k = text.indexOf("Key Dates");
  if (k < 0) return out;
  let end = text.indexOf("Expiration Date", k);
  if (end < 0) end = Math.min(text.length, k + 8_000);
  const block = text.slice(k, end);

  const loiAt = block.search(/Letter of Intent Due Date/i);
  const dueAt = block.search(/Application Due Date/i);
  if (loiAt >= 0) {
    const loiSeg = block.slice(loiAt, dueAt > loiAt ? dueAt : loiAt + 400);
    for (const m of loiSeg.matchAll(FULL_DATE)) {
      const day = dayOf(m[1], m[2], m[3]);
      if (day) out.loi.push(day);
    }
  }
  let seg: string;
  if (dueAt >= 0) seg = block.slice(dueAt);
  else {
    // Some notices drop the "Application Due Dates" header: start after the open date.
    const open = block.match(/Earliest Submission Date\)?\s*[A-Z][a-z]+\.? \d{1,2}(?:st|nd|rd|th)?, \d{4}/);
    seg = open ? block.slice((open.index ?? 0) + open[0].length) : block.replace(/Posted Date[^0-9]*\d{4}/, "");
    if (loiAt >= 0) seg = seg.replace(/Letter of Intent Due Date.*?(?=The following table|New\b|$)/i, "");
  }
  out.standardDates = /standard (?:AIDS )?(?:application )?(?:due )?dates? (?:apply|marked)|NIH standard due dates/i.test(seg);
  const hasAids = /\bAIDS\b/.test(seg);

  type Tok = { kind: "date"; day: string } | { kind: "na" } | { kind: "month" };
  const toks: Tok[] = [];
  for (const m of seg.matchAll(TOKEN)) {
    if (m[1]) {
      const day = dayOf(m[1], m[2], m[3]);
      if (day) toks.push({ kind: "date", day });
    } else if (m[4]) {
      const day = isoDate(`${m[4]}/${m[5]}/${m[6]}`);
      // "January 11th, 2027 (01/11/2027)" writes the same date twice.
      if (day && !(toks.length && toks[toks.length - 1].kind === "date" && (toks[toks.length - 1] as { day: string }).day === day)) toks.push({ kind: "date", day });
    } else if (m[7]) toks.push({ kind: "na" });
    else toks.push({ kind: "month" });
  }
  const months = toks.filter((t) => t.kind === "month").length;
  if (!months) {
    for (const t of toks) if (t.kind === "date") out.due.push(t.day);
  } else {
    let cells: Tok[] = [];
    let inMonths = false;
    const flush = () => {
      if (!cells.length) return;
      const aidsCell = hasAids && cells.length >= 2 ? cells[cells.length - 1] : null;
      const dueCells = aidsCell ? cells.slice(0, -1) : cells;
      for (const c of dueCells) if (c.kind === "date") out.due.push(c.day);
      if (aidsCell?.kind === "date") out.aidsDue.push(aidsCell.day);
      cells = [];
    };
    for (const t of toks) {
      if (t.kind === "month") {
        inMonths = true;
        continue;
      }
      if (inMonths) {
        flush();
        inMonths = false;
      }
      cells.push(t);
    }
    flush();
  }
  out.loi = uniq(out.loi).sort();
  out.due = uniq(out.due).sort();
  out.aidsDue = uniq(out.aidsDue).sort();
  if (!out.due.length && !out.aidsDue.length) {
    const words = seg.replace(/^Application Due Date\(?s?\)?\s*/i, "").split(/Applicants are encouraged|AIDS Application Due Date|All applications are due/i)[0].trim();
    if (words && !/^[\d\s]*$/.test(words)) out.dueText = words.slice(0, 280);
  }
  return out;
}

const ELIGIBILITY_RULES: [RegExp, EligibilityCode, string][] = [
  [/Higher Education Institutions/i, "university", "Higher education institutions"],
  [/Nonprofits with 501\(?c\)?\(3\)|Nonprofits Other Than Institutions of Higher Education/i, "nonprofit", "Nonprofits with 501(c)(3) status"],
  [/Nonprofits without 501\(?c\)?\(3\)/i, "nonprofit_other", "Nonprofits without 501(c)(3) status"],
  [/Small Business/i, "small_business", "Small businesses"],
  [/For-Profit Organizations/i, "for_profit", "For-profit organizations"],
  [/State Governments/i, "state_government", "State governments"],
  [/County Governments|City or Township Governments|Special District Governments|Local Governments/i, "local_government", "Local governments"],
  [/Independent School Districts/i, "school_district", "Independent school districts"],
  [/Public Housing Authorities|Indian Housing Authorities/i, "housing_authority", "Public housing authorities"],
  [/Tribal Governments|Native American Tribal Organizations/i, "tribal", "Tribal governments and organizations"],
  [/Faith-based or Community-based Organizations|Regional Organizations|U\.S\. Territory or Possession|Agencies of the Federal Government/i, "other", "Other organizations named in the notice"],
];

/** Who may apply, from the "Eligible Organizations" part of the notice text. */
export function parseGuideEligibility(d: GuideDoc): { codes: EligibilityCode[]; text: string | null } {
  const text = plainText(d.doctext ?? "").replace(/\s+/g, " ");
  const i = text.search(/Eligible Organizations/i);
  if (i < 0) return { codes: [], text: null };
  const rest = text.slice(i);
  const stop = rest.search(/Required Registrations|Eligible Individuals/i);
  const sec = rest.slice(0, stop > 0 ? stop : 3_000);
  const codes: EligibilityCode[] = [];
  const labels: string[] = [];
  for (const [re, code, label] of ELIGIBILITY_RULES) {
    if (re.test(sec)) {
      codes.push(code);
      labels.push(label);
    }
  }
  const foreign = sec.match(/Non-domestic.{0,120}?Entities.{0,60}?are (not )?eligible to apply/i);
  if (foreign && !foreign[1]) codes.push("international");
  const parts = [];
  if (labels.length) parts.push(`Eligible organizations: ${labels.join("; ")}.`);
  if (foreign) parts.push(foreign[1] ? "Foreign organizations are not eligible." : "Foreign organizations are eligible.");
  return { codes: uniq(codes), text: parts.join(" ") || null };
}

/** One Guide notice to our model, or null when it is not a funding notice. */
export function toGuideOpportunity(d: GuideDoc, now = new Date()): OpportunityInput | null {
  const docnum = d.docnum?.trim();
  const title = plainText(d.title);
  if (!docnum || !title) return null;
  if (d.doctype && !FUNDING_DOCTYPES.has(d.doctype.toUpperCase())) return null;
  if (/^NOT-/i.test(docnum)) return null;
  const url = guideUrl(d);
  if (!url) return null;
  const dates = parseGuideDates(d);
  const nowMs = now.getTime();
  const expiresAt = dates.expiration ? deadline(dates.expiration) : null;
  const expired = expiresAt ? new Date(expiresAt).getTime() < nowMs : false;
  const dueAll = dates.due.length ? dates.due : dates.aidsDue;
  const next = dueAll.map((x) => deadline(x)!).find((x) => new Date(x).getTime() >= nowMs) ?? null;
  let status: OpportunityInput["status"];
  let closeAt: string | null;
  if (expired) {
    status = "closed";
    closeAt = expiresAt;
  } else if (dueAll.length) {
    closeAt = next ?? deadline(dueAll[dueAll.length - 1]);
    status = next ? "open" : "closed";
  } else {
    closeAt = expiresAt;
    status = "open";
  }
  let closeText: string | null = null;
  if (dates.standardDates) closeText = "Standard NIH due dates apply";
  else if (dates.dueText) closeText = dates.dueText;
  if (!dates.due.length && dates.aidsDue.length) closeText = "AIDS-related applications only";

  const keyDates: KeyDate[] = [];
  if (dates.open) keyDates.push({ kind: "open", date: dates.open, label: "Earliest submission" });
  for (const x of dates.loi) keyDates.push({ kind: "loi", date: x, label: "Letter of intent due" });
  for (const x of dates.due) keyDates.push({ kind: "due", date: x, label: "Application due" });
  for (const x of dates.aidsDue) keyDates.push({ kind: "due_aids", date: x, label: "AIDS application due" });
  if (dates.expiration) keyDates.push({ kind: "expiration", date: dates.expiration, label: "Notice expires" });

  const elig = parseGuideEligibility(d);
  const activityCodes = uniq((d.ac ?? []).map((x) => x.trim().toUpperCase()).filter((x) => /^[A-Z0-9]{3}$/.test(x)));
  const primary = d.organization?.primary ?? d.primaryIC ?? null;
  const participating = uniq([primary, ...(d.sponsors ?? [])].filter((x): x is string => !!x && x.toLowerCase() !== "none"));
  const capRaw = d.fadirectcosts?.replace(/[$,\s]/g, "");
  const directCostsCap = capRaw && /^\d+$/.test(capRaw) && Number(capRaw) > 0 ? Number(capRaw) : undefined;
  return {
    sourceId: docnum,
    sourceUrl: url,
    opportunityNumber: docnum,
    type: "research",
    noticeType: "nofo",
    title,
    summary: plainText(d.purpose) || null,
    funderKey: NIH_FUNDER.key,
    funderName: NIH_FUNDER.name,
    agencyCode: "HHS-NIH11",
    status,
    postedAt: dates.posted,
    openAt: dates.open,
    closeAt,
    closeText,
    archiveAt: dates.expiration,
    rolling: false,
    keyDates,
    eligibility: elig.codes,
    eligibilityText: elig.text,
    researchAreas: ["biomedical"],
    categories: uniq([...activityCodes, ...(d.doctype ? [d.doctype.toUpperCase()] : [])]),
    place: { country: "US" },
    attachments: d.ggid && /^\d+$/.test(d.ggid) && !url.includes("grants.gov") ? [{ name: "Grants.gov listing", url: `https://www.grants.gov/search-results-detail/${d.ggid}` }] : [],
    extra: {
      activityCodes,
      primaryInstitute: primary ?? undefined,
      participatingInstitutes: participating,
      clinicalTrials: d.clinicaltrials?.replace(/_/g, " ") || undefined,
      parentAnnouncement: d.parentFOA === "Yes" || undefined,
      grantsGovId: d.ggid || undefined,
      directCostsCap,
    },
  };
}

function hitsTotal(r: GuideResponse): number {
  const t = r.data?.hits?.total;
  return typeof t === "number" ? t : (t?.value ?? 0);
}

export const nihGuide: Connector = {
  source: guideSource,
  fullSnapshot: true,
  async run(ctx: IngestContext) {
    // About 400 active notices: every run reads them all (due dates roll forward without the notice changing).
    await ctx.funders([NIH_FUNDER]);
    let from = 0;
    let total = Infinity;
    let skipped = 0;
    while (from < total && !ctx.done()) {
      const res = await getJson<GuideResponse>(ctx.fetch, guideApiUrl(from), { timeoutMs: 120_000 });
      total = hitsTotal(res);
      const hits = res.data?.hits?.hits ?? [];
      if (!hits.length) break;
      const batch: OpportunityInput[] = [];
      for (const h of hits) {
        try {
          const o = toGuideOpportunity(h._source);
          if (o) batch.push(o);
          else skipped++;
        } catch (err) {
          ctx.warn(`Could not read NIH Guide notice ${h._source?.docnum ?? "?"}`, err);
        }
      }
      await ctx.opportunities(batch);
      from += hits.length;
    }
    ctx.log(`${Number.isFinite(total) ? total : 0} active Guide documents, ${skipped} skipped (not funding notices or no link)`);
  },
};

// ---------------------------------------------------------------- NIH RePORTER

export const reporterSource: SourceDefinition = {
  id: "nih_reporter",
  name: "NIH RePORTER",
  covers: "Past NIH awards, summarized by institute, activity code, state, and fiscal year (counts, totals, and typical award sizes).",
  homepage: "https://reporter.nih.gov",
  docsUrl: "https://api.reporter.nih.gov/",
  termsUrl: "https://www.nih.gov/web-policies-notices",
  license: "Public domain (U.S. government work)",
  attribution: "Source: NIH RePORTER",
  kinds: ["research"],
  region: "us",
  cadence: "Weekly",
  // Sunday 06:00 UTC: NIH asks for large jobs on weekends or between 9 PM and 5 AM Eastern.
  schedule: "0 6 * * 0",
  enabled: true,
  priority: 20,
};

const REPORTER_API = "https://api.reporter.nih.gov/v2/projects/search";
const REPORTER_PAGE = 500;
const REPORTER_MAX_OFFSET = 14_999;
/**
 * Administering institutes and centers, the partitions we page through (each stays under the API's 15,000 offset cap).
 * The run checks that they add up to the NIH total for the year and warns if a new one appears.
 */
export const NIH_ICS = ["NCI", "NHLBI", "NIAID", "NIGMS", "NIDDK", "NINDS", "NIMH", "NIA", "NICHD", "NIDA", "NIEHS", "NEI", "NIAMS", "NIDCD", "NIDCR", "NIAAA", "NINR", "NHGRI", "NIBIB", "NIMHD", "NCCIH", "NCATS", "NLM", "FIC", "OD"];

export interface ReporterProject {
  appl_id?: number;
  fiscal_year?: number;
  award_amount?: number | null;
  award_type?: string | null;
  activity_code?: string | null;
  agency_ic_admin?: { abbreviation?: string | null } | null;
  organization?: { org_state?: string | null; org_country?: string | null } | null;
}

interface ReporterResponse {
  meta?: { total?: number; offset?: number; limit?: number };
  results?: ReporterProject[];
}

export function reporterBody(fy: number, ic: string | null, offset: number, limit = REPORTER_PAGE) {
  return {
    criteria: { fiscal_years: [fy], exclude_subprojects: true, ...(ic ? { agencies: [ic], is_agency_admin: true } : { agencies: ["NIH"] }) },
    include_fields: ["ApplId", "FiscalYear", "AwardAmount", "AwardType", "ActivityCode", "AgencyIcAdmin", "Organization"],
    offset,
    limit,
    sort_field: "appl_id",
    sort_order: "asc",
  };
}

async function reporterPage(ctx: IngestContext, body: unknown): Promise<ReporterResponse> {
  return getJson<ReporterResponse>(ctx.fetch, REPORTER_API, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body), timeoutMs: 120_000 });
}

/**
 * Adds one project to the aggregates. Supplements (award type 3) are left out so typical sizes describe whole awards.
 * Levels: institute x activity code x state; institute x activity code (all states); activity code (all of NIH);
 * institute (all codes). A null field in a row means "all".
 */
export function addReporterProject(agg: AwardAggregator, p: ReporterProject): boolean {
  const amount = typeof p.award_amount === "number" ? p.award_amount : Number(p.award_amount);
  const fy = p.fiscal_year;
  const ic = p.agency_ic_admin?.abbreviation?.trim() || null;
  const ac = p.activity_code?.trim().toUpperCase() || null;
  // A handful of records carry placeholder amounts ($1); they are not awards anyone could plan around.
  if (!fy || !ic || !ac || !Number.isFinite(amount) || amount < 1_000) return false;
  if (String(p.award_type ?? "").startsWith("3")) return false;
  const state = /UNITED STATES/i.test(p.organization?.org_country ?? "UNITED STATES") ? stateCode(p.organization?.org_state ?? null) : null;
  const base = { awardType: "research" as const, agency: "HHS-NIH", fiscalYear: fy, sourceUrl: "https://reporter.nih.gov/" };
  if (state) agg.add({ ...base, subAgency: ic, activityCode: ac, placeState: state }, amount);
  agg.add({ ...base, subAgency: ic, activityCode: ac }, amount);
  agg.add({ ...base, activityCode: ac }, amount);
  agg.add({ ...base, subAgency: ic }, amount);
  return true;
}

/** Fiscal years to read: NIH_REPORTER_YEARS="2025,2026" overrides; backfill reads the last three completed years, incremental the last one. */
export function reporterYears(ctx: Pick<IngestContext, "mode" | "env">, now = new Date()): number[] {
  const forced = ctx.env.NIH_REPORTER_YEARS?.split(",").map((x) => Number(x.trim())).filter((x) => x > 1990);
  if (forced?.length) return forced;
  return completedFiscalYears(ctx.mode === "backfill" ? 3 : 1, now);
}

export const nihReporter: Connector = {
  source: reporterSource,
  async run(ctx) {
    await ctx.funders([NIH_FUNDER]);
    const agg = new AwardAggregator();
    // --limit samples: read at most this many projects per institute and year.
    const perPartition = ctx.limit ?? Infinity;
    for (const fy of reporterYears(ctx)) {
      const all = await reporterPage(ctx, reporterBody(fy, null, 0, 1));
      const expected = all.meta?.total ?? 0;
      let sum = 0;
      let read = 0;
      for (const ic of NIH_ICS) {
        let offset = 0;
        let total = Infinity;
        while (offset < total && offset <= REPORTER_MAX_OFFSET && offset < perPartition) {
          const limit = Math.min(REPORTER_PAGE, perPartition - offset);
          let res: ReporterResponse;
          try {
            res = await reporterPage(ctx, reporterBody(fy, ic, offset, limit));
          } catch (err) {
            ctx.warn(`RePORTER page failed for ${ic} FY${fy} at ${offset}`, err);
            break;
          }
          if (total === Infinity) {
            total = res.meta?.total ?? 0;
            sum += total;
            if (total > REPORTER_MAX_OFFSET + 1) ctx.warn(`${ic} FY${fy} has ${total} projects; the API stops at 15,000, so this institute is sampled`);
          }
          const rows = res.results ?? [];
          if (!rows.length) break;
          for (const p of rows) if (addReporterProject(agg, p)) read++;
          offset += rows.length;
        }
      }
      // A few dozen projects a year sit under administering offices outside these partitions (0.2% in FY2024 and FY2025).
      if (expected && sum !== expected) {
        const msg = `FY${fy}: institutes listed add up to ${sum} of ${expected} NIH projects`;
        if (Math.abs(expected - sum) > expected * 0.01) ctx.warn(`${msg}; an institute is missing from NIH_ICS`);
        else ctx.log(msg);
      }
      ctx.log(`FY${fy}: ${expected} NIH projects, ${read} awards aggregated`);
    }
    await ctx.awards(agg.rows(1, MIN_STATE_GROUP));
  },
};

export const connectors: Connector[] = [nihGuide, nihReporter];
