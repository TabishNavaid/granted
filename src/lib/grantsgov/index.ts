import * as cheerio from "cheerio";
import { replayActive } from "@/lib/replay/active";
import { cached, HOURS } from "@/lib/cache";
import type { EligibilityRule, Funder, Opportunity } from "@/lib/types";

/**
 * Grants.gov public REST API. No key is needed. Request and response shapes
 * follow https://grants.gov/api/api-guide and what the live endpoints return
 * (probed 2026-10-18): search2 returns `data.oppHits[]`, fetchOpportunity
 * returns `data.synopsis` for posted notices and `data.forecast` for
 * forecasts. We throttle to one request per second and cache for six hours.
 */
const BASE = "https://api.grants.gov/v1/api";
const THROTTLE_MS = 1_000;
const CACHE_TTL = 6 * HOURS;

/** Applicant type codes from the API's own eligibility list. */
export const ELIGIBILITY = {
  nonprofit501c3: "12",
  nonprofitOther: "13",
  others: "25",
  unrestricted: "99",
  /** For-profit organizations other than small businesses. */
  forProfit: "22",
  smallBusiness: "23",
  publicHigherEd: "06",
  privateHigherEd: "20",
  individuals: "21",
} as const;

export { FUNDING_CATEGORIES } from "./categories";

export interface SearchParams {
  keyword: string;
  oppStatuses?: string;
  eligibilities?: string;
  fundingCategories?: string;
  agencies?: string;
  rows?: number;
  startRecordNum?: number;
}

export interface SearchHit {
  id: string;
  number: string;
  title: string;
  agencyCode: string;
  agency: string;
  openDate: string;
  closeDate: string;
  oppStatus: "forecasted" | "posted" | "closed" | "archived";
  docType: "synopsis" | "forecast";
  cfdaList: string[];
  /** The notice's page, when it comes from the opportunity database rather than Grants.gov itself. */
  url?: string;
}

export interface SearchResponse {
  hitCount: number;
  oppHits: SearchHit[];
}

interface CodeDesc {
  id: string;
  description: string;
}

interface NoticeBlock {
  synopsisDesc?: string;
  forecastDesc?: string;
  agencyName?: string;
  agencyCode?: string;
  agencyDetails?: { agencyName?: string; agencyCode?: string; topAgencyCode?: string };
  topAgencyDetails?: { agencyName?: string };
  responseDateStr?: string;
  estApplicationResponseDateStr?: string;
  estApplicationResponseDateDesc?: string;
  postingDateStr?: string;
  archiveDateStr?: string;
  fundingDescLinkUrl?: string;
  costSharing?: boolean;
  numberOfAwards?: string;
  estimatedFunding?: string;
  awardCeiling?: string;
  awardFloor?: string;
  applicantEligibilityDesc?: string;
  applicantTypes?: CodeDesc[];
  fundingInstruments?: CodeDesc[];
  fundingActivityCategories?: CodeDesc[];
  lastUpdatedDate?: string;
}

export interface OpportunityDetail {
  id: number;
  opportunityNumber: string;
  opportunityTitle: string;
  owningAgencyCode: string;
  agencyDetails?: { agencyName?: string; agencyCode?: string; topAgencyCode?: string };
  topAgencyDetails?: { agencyName?: string };
  synopsis?: NoticeBlock;
  forecast?: NoticeBlock;
  cfdas?: { cfdaNumber: string; programTitle: string }[];
  docType: "synopsis" | "forecast";
  ost?: string;
  /** Set when the notice comes from the opportunity database: its page and the source that published it. */
  sourceUrl?: string;
  sourceName?: string;
  lastCheckedAt?: string;
}

export class GrantsGovError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GrantsGovError";
  }
}

// One request per second, shared by every caller in this process.
let chain: Promise<unknown> = Promise.resolve();
let lastAt = 0;
function throttled<T>(fn: () => Promise<T>): Promise<T> {
  const run = chain.then(async () => {
    const wait = Math.max(0, lastAt + THROTTLE_MS - Date.now());
    if (wait) await new Promise((r) => setTimeout(r, wait));
    lastAt = Date.now();
    return fn();
  });
  chain = run.catch(() => undefined);
  return run;
}

async function post<T>(path: string, body: unknown): Promise<T> {
  return throttled(async () => {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 20_000);
    try {
      const res = await fetch(`${BASE}/${path}`, {
        method: "POST",
        headers: { "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify(body),
        signal: ctl.signal,
      });
      if (!res.ok) throw new GrantsGovError(`Grants.gov answered ${res.status} for ${path}.`);
      const json = (await res.json()) as { errorcode?: number; msg?: string; data?: T };
      if (json.errorcode && json.errorcode !== 0) throw new GrantsGovError(`Grants.gov error ${json.errorcode}: ${json.msg ?? "unknown"}`);
      if (!json.data) throw new GrantsGovError(`Grants.gov returned no data for ${path}.`);
      return json.data;
    } catch (err) {
      if (err instanceof GrantsGovError) throw err;
      throw new GrantsGovError(err instanceof Error && err.name === "AbortError" ? "Grants.gov timed out." : `Grants.gov is unreachable: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      clearTimeout(timer);
    }
  });
}

/**
 * Where searches go. The zero-key demo replays recorded runs; the real product reads the opportunity database,
 * which is refreshed daily from Grants.gov and the other federal sources; anything else asks Grants.gov live.
 */
type CatalogBackend = typeof import("@/lib/catalog/app");
let catalogLoader: (() => Promise<CatalogBackend>) | null = null;

/** The server registers the database reader (src/lib/services/server.ts); the browser demo never loads it. */
export function registerCatalogBackend(load: () => Promise<CatalogBackend>) {
  catalogLoader = load;
}

/** The database reader when the product runs on Supabase, else null (demo, or no database). */
export async function catalogBackend(): Promise<CatalogBackend | null> {
  return catalog();
}

async function catalog(): Promise<CatalogBackend | null> {
  if (!catalogLoader) return null;
  const mod = await catalogLoader();
  return mod.catalogActive() ? mod : null;
}

export async function search(params: SearchParams): Promise<{ result: SearchResponse; fromCache: boolean; from?: "database" | "grants.gov" }> {
  if (replayActive()) return { result: await (await import("@/lib/replay")).replaySearch(params), fromCache: false };
  const db = await catalog();
  if (db) {
    const statuses = (params.oppStatuses ?? "forecasted|posted").split("|").map((s) => (s === "posted" ? "open" : s)) as ("open" | "forecasted" | "closed" | "archived")[];
    const { hits, total } = await db.searchCatalog({
      q: db.anyWords(params.keyword),
      types: ["grant", "research", "scholarship"],
      statuses,
      eligibility: params.eligibilities ? db.eligibilityFromGrantsGov(params.eligibilities) : null,
      categories: params.fundingCategories ? db.categoriesFromGrantsGov(params.fundingCategories) : null,
      sources: db.FEDERAL_NOTICE_SOURCES,
      limit: params.rows ?? 25,
      offset: params.startRecordNum ?? 0,
    });
    return { result: { hitCount: total, oppHits: hits.map(db.toSearchHit) }, fromCache: false, from: "database" };
  }
  const body = {
    keyword: params.keyword,
    oppStatuses: params.oppStatuses ?? "forecasted|posted",
    eligibilities: params.eligibilities ?? "",
    fundingCategories: params.fundingCategories ?? "",
    agencies: params.agencies ?? "",
    rows: params.rows ?? 25,
    startRecordNum: params.startRecordNum ?? 0,
  };
  const { value, fromCache } = await cached(`gg:search2:${JSON.stringify(body)}`, CACHE_TTL, async () => {
    const data = await post<{ hitCount: number; oppHits: SearchHit[] }>("search2", body);
    return { hitCount: data.hitCount, oppHits: data.oppHits ?? [] };
  });
  return { result: value, fromCache };
}

export async function fetchOpportunity(id: string | number): Promise<{ detail: OpportunityDetail; fromCache: boolean }> {
  if (replayActive()) return { detail: await (await import("@/lib/replay")).replayFetchOpportunity(id), fromCache: false };
  const db = await catalog();
  if (db && /^[0-9a-f-]{36}$/i.test(String(id))) {
    const row = await db.getCatalogRow(String(id));
    if (!row) throw new GrantsGovError("That notice is no longer in the opportunity database.");
    return { detail: db.toOpportunityDetail(row) as unknown as OpportunityDetail, fromCache: true };
  }
  const { value, fromCache } = await cached(`gg:opp:${id}`, CACHE_TTL, () => post<OpportunityDetail>("fetchOpportunity", { opportunityId: String(id) }));
  return { detail: value, fromCache };
}

export function opportunityPageUrl(id: string | number) {
  return `https://www.grants.gov/search-results-detail/${id}`;
}

/** The public page for a notice: its source's page when it came from the opportunity database, else Grants.gov. */
export function pageUrlOf(detail: Pick<OpportunityDetail, "id" | "sourceUrl">) {
  return detail.sourceUrl ?? opportunityPageUrl(detail.id);
}

function htmlToText(html: string | undefined): string {
  if (!html) return "";
  const $ = cheerio.load(`<div>${html}</div>`);
  $("br").replaceWith("\n");
  $("p, li, div, tr, h1, h2, h3, h4").each((_, el) => {
    $(el).prepend("\n").append("\n");
  });
  return $.text().replace(/\u00a0/g, " ").replace(/[ \t]+/g, " ").replace(/ *\n */g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}

function dateFromStr(s: string | undefined): string | null {
  if (!s) return null;
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
}

function money(s: string | undefined): number | null {
  if (!s) return null;
  const n = Number(String(s).replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function notice(detail: OpportunityDetail): NoticeBlock | null {
  return detail.synopsis ?? detail.forecast ?? null;
}

/** 501(c)(3) nonprofits can apply, judging by the applicant type codes alone. */
export function nonprofitMayApply(detail: OpportunityDetail): boolean {
  const types = notice(detail)?.applicantTypes ?? [];
  if (!types.length) return true; // no codes listed: let the eligibility text decide
  const ids = new Set(types.map((t) => t.id));
  return ids.has(ELIGIBILITY.nonprofit501c3) || ids.has(ELIGIBILITY.unrestricted) || ids.has(ELIGIBILITY.others);
}

export function deadlineOf(detail: OpportunityDetail): string | null {
  const n = notice(detail);
  return dateFromStr(n?.responseDateStr) ?? dateFromStr(n?.estApplicationResponseDateStr);
}

export function isStillOpen(detail: OpportunityDetail, today = new Date().toISOString().slice(0, 10)): boolean {
  const d = deadlineOf(detail);
  return !d || d >= today;
}

/** Plain text the scorer and the letter writer read. Everything in it comes from Grants.gov. */
export function opportunityText(detail: OpportunityDetail, maxChars = 3_000): string {
  const n = notice(detail);
  const lines: string[] = [];
  lines.push(`Title: ${detail.opportunityTitle}`);
  lines.push(`Opportunity number: ${detail.opportunityNumber}`);
  lines.push(`Agency: ${n?.agencyName ?? detail.agencyDetails?.agencyName ?? detail.owningAgencyCode}${detail.topAgencyDetails?.agencyName ? ` (${detail.topAgencyDetails.agencyName})` : ""}`);
  lines.push(`Status: ${detail.docType === "forecast" ? "Forecasted (not yet open)" : "Posted (open)"}`);
  const deadline = deadlineOf(detail);
  if (deadline) lines.push(`${detail.docType === "forecast" ? "Estimated application due date" : "Application due date"}: ${deadline}`);
  if (n?.estApplicationResponseDateDesc) lines.push(`Due date note: ${n.estApplicationResponseDateDesc}`);
  if (n?.awardFloor || n?.awardCeiling) lines.push(`Award range: ${n?.awardFloor ?? "not stated"} to ${n?.awardCeiling ?? "not stated"}`);
  if (n?.estimatedFunding) lines.push(`Estimated total program funding: ${n.estimatedFunding}`);
  if (n?.numberOfAwards) lines.push(`Expected number of awards: ${n.numberOfAwards}`);
  if (n?.costSharing != null) lines.push(`Cost sharing required: ${n.costSharing ? "yes" : "no"}`);
  if (n?.fundingActivityCategories?.length) lines.push(`Funding categories: ${n.fundingActivityCategories.map((c) => c.description).join("; ")}`);
  if (n?.fundingInstruments?.length) lines.push(`Funding instrument: ${n.fundingInstruments.map((c) => c.description).join("; ")}`);
  if (n?.applicantTypes?.length) lines.push(`Eligible applicant types: ${n.applicantTypes.map((c) => c.description).join("; ")}`);
  if (n?.applicantEligibilityDesc) lines.push(`Additional information on eligibility: ${htmlToText(n.applicantEligibilityDesc)}`);
  if (detail.cfdas?.length) lines.push(`Assistance listings: ${detail.cfdas.map((c) => `${c.cfdaNumber} ${c.programTitle}`).join("; ")}`);
  const desc = htmlToText(n?.synopsisDesc ?? n?.forecastDesc);
  if (desc) lines.push(`Description: ${desc}`);
  const text = lines.join("\n");
  return text.length > maxChars ? `${text.slice(0, maxChars)}…` : text;
}

export function toOpportunity(detail: OpportunityDetail, checkedAt = new Date().toISOString()): { opportunity: Opportunity; funder: Funder } {
  const n = notice(detail);
  // Some notices put a contact's name and title in the agency field; use the agency record then.
  const rawAgency = n?.agencyName?.trim() ?? "";
  const looksLikePerson = /\n|\b(specialist|officer|manager|coordinator|director)\b/i.test(rawAgency);
  const agencyName = ((looksLikePerson ? null : rawAgency) || detail.agencyDetails?.agencyName || detail.topAgencyDetails?.agencyName || detail.owningAgencyCode).trim();
  const agencyCode = (n?.agencyCode ?? detail.agencyDetails?.agencyCode ?? detail.owningAgencyCode).trim();
  const top = detail.topAgencyDetails?.agencyName?.trim();
  const funderId = `gg_agency_${agencyCode.replace(/[^A-Za-z0-9]+/g, "_")}`;
  const deadline = deadlineOf(detail);
  const ceiling = money(n?.awardCeiling);
  const floor = money(n?.awardFloor);
  const eligibility: EligibilityRule[] = (n?.applicantTypes ?? []).map((t) => ({ label: t.description, required: true }));
  const extra = htmlToText(n?.applicantEligibilityDesc);
  if (extra) eligibility.push({ label: `Agency note on eligibility: ${extra.length > 240 ? `${extra.slice(0, 240)}…` : extra}`, required: true });
  const description = htmlToText(n?.synopsisDesc ?? n?.forecastDesc);
  const summary = description.length > 420 ? `${description.slice(0, 420).trimEnd()}…` : description || "No description was posted.";
  const funder: Funder = {
    id: funderId,
    name: agencyName,
    ein: null,
    type: "federal",
    description: top && top !== agencyName ? `${agencyName}, part of the ${top}. Its funding opportunities are listed on ${detail.sourceName ?? "Grants.gov"}.` : `${agencyName}. Its funding opportunities are listed on ${detail.sourceName ?? "Grants.gov"}.`,
    focusAreas: (n?.fundingActivityCategories ?? []).map((c) => c.description),
    geography: "United States",
    givingMin: null,
    givingMax: null,
    websiteUrl: pageUrlOf(detail),
    sourceUrl: pageUrlOf(detail),
    aiPolicy: null,
    lastVerifiedAt: detail.lastCheckedAt ?? checkedAt,
    recentGrantees: [],
  };
  const opportunity: Opportunity = {
    id: `gg_${detail.id}`,
    funderId,
    title: detail.opportunityTitle.trim(),
    summary,
    deadline,
    deadlineType: deadline ? "fixed" : "rolling",
    amountMin: floor,
    amountMax: ceiling,
    eligibility,
    guidelinesUrl: n?.fundingDescLinkUrl?.trim() || pageUrlOf(detail),
    sourceUrl: pageUrlOf(detail),
    lastVerifiedAt: detail.lastCheckedAt ?? checkedAt,
    effort: ceiling != null && ceiling <= 100_000 ? "medium" : "high",
    forecasted: detail.docType === "forecast",
  };
  return { opportunity, funder };
}
