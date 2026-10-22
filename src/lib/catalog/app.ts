import { adminClient } from "@/lib/supabase/clients";
import { hasSupabase, isDemoMode } from "@/lib/env";
import { ELIGIBILITY, GRANTSGOV_CATEGORIES, type CatalogType, type EligibilityCode } from "./vocab";

/**
 * The app's read side of the opportunity database. Matching for every kind of
 * applicant reads from here when the product runs on Supabase; the zero-key
 * demo keeps its recorded runs. Reads go through the service role on the
 * server after the session is checked, like every other server read.
 */
export function catalogActive(): boolean {
  return hasSupabase() && !isDemoMode() && process.env.CATALOG_MATCHING?.trim().toLowerCase() !== "off";
}

/** Sources whose rows are federal notices people apply to (not programs, foundations, or bids). */
export const FEDERAL_NOTICE_SOURCES = ["grantsgov", "federal_register", "nih_guide", "nsf_funding", "sbir", "nasa_nspires"];
/** Sources of contracts and bids. */
export const BID_SOURCES = ["sam_opportunities"];

export interface CatalogSearchParams {
  q?: string | null;
  types?: CatalogType[] | null;
  statuses?: ("open" | "forecasted" | "closed" | "archived")[] | null;
  eligibility?: EligibilityCode[] | null;
  naicsPrefixes?: string[] | null;
  setAsides?: string[] | null;
  states?: string[] | null;
  assistanceListings?: string[] | null;
  researchAreas?: string[] | null;
  causes?: string[] | null;
  sources?: string[] | null;
  categories?: string[] | null;
  amountAtLeast?: number | null;
  amountAtMost?: number | null;
  closesAfter?: string | null;
  closesBefore?: string | null;
  includeRolling?: boolean;
  /** Only rows first seen after this time (new this week). */
  seenAfter?: string | null;
  limit?: number;
  offset?: number;
}

export interface CatalogHit {
  id: string;
  source: string;
  source_url: string;
  opportunity_number: string | null;
  type: CatalogType;
  notice_type: string | null;
  title: string;
  summary: string | null;
  funder_id: string | null;
  funder_name: string | null;
  status: string;
  posted_at: string | null;
  close_at: string | null;
  close_text: string | null;
  rolling: boolean;
  amount_min: number | null;
  amount_max: number | null;
  eligibility: string[];
  naics: string[];
  set_aside: string | null;
  assistance_listings: string[];
  research_areas: string[];
  causes: string[];
  place_state: string | null;
  place_country: string | null;
  also_listed: { source: string; url: string }[];
  last_checked: string;
  rank: number;
  total: number;
}

export interface CatalogRow extends Omit<CatalogHit, "rank" | "total"> {
  agency_code: string | null;
  open_at: string | null;
  archive_at: string | null;
  key_dates: { kind: string; date: string; label?: string }[];
  amount_total: number | null;
  award_count: number | null;
  currency: string;
  eligibility_text: string | null;
  psc: string | null;
  set_aside_code: string | null;
  categories: string[];
  place_city: string | null;
  place_zip: string | null;
  place_text: string | null;
  attachments: { name: string; url: string; size?: number | null }[];
  amendments: { number?: string | null; date?: string | null; summary?: string | null; url?: string | null }[];
  contact: { name?: string | null; email?: string | null; phone?: string | null; title?: string | null } | null;
  extra: Record<string, unknown>;
  license: string | null;
  first_seen: string;
}

export async function searchCatalog(p: CatalogSearchParams): Promise<{ hits: CatalogHit[]; total: number }> {
  const { data, error } = await adminClient().rpc("catalog_search", {
    q: p.q ?? null,
    types: p.types ?? null,
    statuses: p.statuses === undefined ? ["open", "forecasted"] : p.statuses,
    eligibility: p.eligibility ?? null,
    naics_prefixes: p.naicsPrefixes ?? null,
    set_asides: p.setAsides ?? null,
    states: p.states ?? null,
    assistance_listings: p.assistanceListings ?? null,
    research_areas: p.researchAreas ?? null,
    causes: p.causes ?? null,
    sources: p.sources ?? null,
    categories: p.categories ?? null,
    amount_at_least: p.amountAtLeast ?? null,
    amount_at_most: p.amountAtMost ?? null,
    closes_after: p.closesAfter ?? null,
    closes_before: p.closesBefore ?? null,
    include_rolling: p.includeRolling ?? true,
    seen_after: p.seenAfter ?? null,
    lim: p.limit ?? 25,
    off: p.offset ?? 0,
  });
  if (error) throw new Error(`Opportunity search failed: ${error.message}`);
  const hits = (data ?? []) as CatalogHit[];
  return { hits, total: hits[0]?.total ?? 0 };
}

export async function getCatalogRow(id: string): Promise<CatalogRow | null> {
  const { data, error } = await adminClient().from("catalog_opportunities").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(`Could not read opportunity ${id}: ${error.message}`);
  return (data as CatalogRow | null) ?? null;
}

export async function getCatalogRows(ids: string[]): Promise<CatalogRow[]> {
  if (!ids.length) return [];
  const { data, error } = await adminClient().from("catalog_opportunities").select("*").in("id", ids);
  if (error) throw new Error(`Could not read opportunities: ${error.message}`);
  return (data ?? []) as CatalogRow[];
}

/** Our eligibility codes to Grants.gov applicant type codes, so the Grants.gov-shaped checks keep working. */
const TO_GRANTSGOV: Partial<Record<EligibilityCode, string>> = {
  state_government: "00",
  local_government: "01",
  school_district: "05",
  university: "06",
  tribal: "07",
  housing_authority: "08",
  nonprofit: "12",
  nonprofit_other: "13",
  individual: "21",
  for_profit: "22",
  small_business: "23",
  other: "25",
  unrestricted: "99",
};

/** Grants.gov applicant type codes to ours, for search filters given in Grants.gov terms. */
export function eligibilityFromGrantsGov(codes: string): EligibilityCode[] | null {
  const out = new Set<EligibilityCode>();
  for (const c of codes.split("|").map((x) => x.trim()).filter(Boolean)) {
    for (const [ours, theirs] of Object.entries(TO_GRANTSGOV)) if (theirs === c) out.add(ours as EligibilityCode);
    if (c === "20") out.add("university");
    if (c === "02" || c === "04") out.add("local_government");
    if (c === "11") out.add("tribal");
  }
  return out.size ? [...out] : null;
}

export function categoriesFromGrantsGov(codes: string): string[] | null {
  const out = codes.split("|").map((c) => GRANTSGOV_CATEGORIES[c.trim()]).filter(Boolean);
  return out.length ? out : null;
}

/** "Any of these words", the way Grants.gov's keyword search behaves. */
export function anyWords(keyword: string): string | null {
  const words = keyword.replace(/["()]/g, " ").split(/\s+/).filter((w) => w.length > 1 && !/^(or|and|not)$/i.test(w));
  return words.length ? words.join(" or ") : null;
}

const mmddyyyy = (iso: string | null) => (iso ? `${iso.slice(5, 7)}/${iso.slice(8, 10)}/${iso.slice(0, 4)}` : "");

/** The Grants.gov search2 hit shape, filled from a catalog row. */
export function toSearchHit(h: CatalogHit) {
  return {
    id: h.id,
    number: h.opportunity_number ?? "",
    title: h.title,
    agencyCode: "",
    agency: h.funder_name ?? "",
    openDate: mmddyyyy(h.posted_at),
    closeDate: mmddyyyy(h.close_at ? new Date(h.close_at).toISOString().slice(0, 10) : null),
    oppStatus: (h.status === "forecasted" ? "forecasted" : h.status === "open" ? "posted" : "closed") as "forecasted" | "posted" | "closed",
    docType: (h.status === "forecasted" ? "forecast" : "synopsis") as "forecast" | "synopsis",
    cfdaList: h.assistance_listings,
    url: h.source_url,
  };
}

const SOURCE_NAMES: Record<string, string> = {
  grantsgov: "Grants.gov",
  federal_register: "the Federal Register",
  nih_guide: "the NIH Guide",
  nsf_funding: "NSF",
  sbir: "SBIR.gov",
  nasa_nspires: "NASA NSPIRES",
  sam_opportunities: "SAM.gov",
};

export function sourceName(source: string): string {
  return SOURCE_NAMES[source] ?? source;
}

/** The Grants.gov fetchOpportunity shape, filled from a catalog row, so the scorer and letter writer read it unchanged. */
export function toOpportunityDetail(r: CatalogRow) {
  const forecast = r.status === "forecasted";
  const closeDay = r.close_at ? new Date(r.close_at).toISOString().slice(0, 10) : undefined;
  const block = {
    synopsisDesc: forecast ? undefined : (r.summary ?? undefined),
    forecastDesc: forecast ? (r.summary ?? undefined) : undefined,
    agencyName: r.funder_name ?? undefined,
    agencyCode: r.agency_code ?? undefined,
    responseDateStr: forecast ? undefined : closeDay,
    estApplicationResponseDateStr: forecast ? closeDay : undefined,
    estApplicationResponseDateDesc: r.close_text ?? undefined,
    postingDateStr: r.posted_at ?? undefined,
    archiveDateStr: r.archive_at ?? undefined,
    awardCeiling: r.amount_max != null ? String(r.amount_max) : undefined,
    awardFloor: r.amount_min != null ? String(r.amount_min) : undefined,
    estimatedFunding: r.amount_total != null ? String(r.amount_total) : undefined,
    numberOfAwards: r.award_count != null ? String(r.award_count) : undefined,
    costSharing: typeof r.extra?.costSharing === "boolean" ? (r.extra.costSharing as boolean) : undefined,
    applicantEligibilityDesc: r.eligibility_text ?? undefined,
    applicantTypes: (r.eligibility as EligibilityCode[]).filter((e) => TO_GRANTSGOV[e]).map((e) => ({ id: TO_GRANTSGOV[e]!, description: ELIGIBILITY[e] })),
    fundingActivityCategories: r.categories.map((c) => ({ id: c, description: c })),
    fundingDescLinkUrl: r.attachments[0]?.url,
  };
  return {
    id: r.id,
    opportunityNumber: r.opportunity_number ?? "",
    opportunityTitle: r.title,
    owningAgencyCode: r.agency_code ?? "",
    agencyDetails: { agencyName: r.funder_name ?? undefined, agencyCode: r.agency_code ?? undefined },
    synopsis: forecast ? undefined : block,
    forecast: forecast ? block : undefined,
    cfdas: r.assistance_listings.map((n) => ({ cfdaNumber: n, programTitle: "" })),
    docType: (forecast ? "forecast" : "synopsis") as "forecast" | "synopsis",
    sourceUrl: r.source_url,
    sourceName: sourceName(r.source),
    lastCheckedAt: r.last_checked,
  };
}

/** Contract and bid sources: SAM.gov plus state and local feeds; international tenders only when asked for. */
export async function contractSources(opts: { international?: boolean } = {}): Promise<string[]> {
  const { data } = await adminClient().from("catalog_sources").select("id, kinds, enabled, region").contains("kinds", ["contract"]);
  const ids = (data ?? []).filter((s) => s.enabled !== false && (opts.international || s.region !== "international")).map((s) => String(s.id));
  return ids.length ? ids : BID_SOURCES;
}

/**
 * Open bids for a firm's NAICS codes (and region, when given), in the SAM.gov v2 notice shape the bid screens read.
 * Rows from state and local portals often carry no NAICS code, so with a region we also take bids there that
 * mention the firm's kind of work.
 */
export async function contractNotices(input: { naics: string[]; states?: string[] | null; keywords?: string[]; setAsides?: string[]; limit?: number }): Promise<import("@/lib/samgov").SamV2Notice[]> {
  const sources = await contractSources();
  const limit = input.limit ?? 60;
  const setAsides = input.setAsides?.length ? input.setAsides : null;
  const byNaics = input.naics.length ? await searchCatalog({ types: ["contract"], naicsPrefixes: input.naics, states: input.states ?? null, setAsides, sources, limit }) : { hits: [] };
  const words = (input.keywords ?? []).filter(Boolean);
  const byWords = words.length && (input.states?.length || !input.naics.length) ? await searchCatalog({ q: words.join(" or "), types: ["contract"], states: input.states ?? null, setAsides, sources, limit: Math.ceil(limit / 2) }) : { hits: [] };
  const ids = [...new Set([...byNaics.hits, ...byWords.hits].map((h) => h.id))].slice(0, limit);
  const rows = await getCatalogRows(ids);
  const order = new Map(ids.map((id, i) => [id, i]));
  return rows.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0)).map(toSamV2);
}

export function toSamV2(r: CatalogRow): import("@/lib/samgov").SamV2Notice {
  const files = r.attachments.map((a) => `Attachment: ${a.name} ${a.url}`).join("\n");
  const path = typeof r.extra?.fullParentPathName === "string" ? (r.extra.fullParentPathName as string) : r.funder_name;
  return {
    noticeId: r.id,
    title: r.title,
    solicitationNumber: r.opportunity_number,
    fullParentPathName: path ?? null,
    postedDate: r.posted_at,
    type: r.notice_type ? r.notice_type.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase()) : null,
    baseType: r.notice_type,
    typeOfSetAside: r.set_aside_code,
    typeOfSetAsideDescription: r.set_aside,
    responseDeadLine: r.close_at,
    naicsCode: r.naics[0] ?? null,
    classificationCode: r.psc,
    active: r.status === "open" || r.status === "forecasted" ? "Yes" : "No",
    pointOfContact: r.contact?.name || r.contact?.email ? [{ type: "primary", fullName: r.contact.name ?? null, email: r.contact.email ?? null, phone: r.contact.phone ?? null, title: r.contact.title ?? null }] : null,
    placeOfPerformance: { city: r.place_city ? { name: r.place_city } : null, state: r.place_state ? { code: r.place_state } : null, zip: r.place_zip, country: { code: r.place_country ?? "US" } },
    description: null,
    uiLink: r.source_url,
    descriptionText: [r.summary ?? "", r.eligibility_text ? `Eligibility: ${r.eligibility_text}` : "", files, `Source: ${sourceName(r.source)}, last checked ${r.last_checked.slice(0, 10)}.`].filter(Boolean).join("\n\n"),
  };
}

/** What a workspace would want from the database, from what it told us: its kind, place, causes, and work categories. */
export function workspaceSearch(org: { orgType: string; state: string | null; causes: string[]; naics?: string[]; states?: string[] }): CatalogSearchParams {
  const states = [...new Set([org.state, ...(org.states ?? [])].filter((s): s is string => Boolean(s && /^[A-Z]{2}$/.test(s))))];
  switch (org.orgType) {
    case "firm":
      return { types: ["contract"], naicsPrefixes: org.naics?.length ? org.naics : null, states: states.length ? states : null };
    case "research":
      return { types: ["research"], eligibility: ["university", "small_business", "nonprofit"] };
    case "individual":
      return { types: ["scholarship"], eligibility: ["individual"] };
    default:
      return { types: ["grant"], eligibility: ["nonprofit"], states: states.length ? states : null, q: org.causes.length ? anyWords(org.causes.join(" ")) : null };
  }
}

/** Open opportunities that reached the database since `since`, for one workspace. */
export async function newForWorkspace(org: Parameters<typeof workspaceSearch>[0], since: string, limit = 6): Promise<CatalogHit[]> {
  const { hits } = await searchCatalog({ ...workspaceSearch(org), seenAfter: since, closesAfter: new Date().toISOString(), limit });
  return hits;
}

/** New open bids for one saved bid search since `since`. */
export async function newForBidSearch(f: { naics: string[]; states: string[]; setAsides: string[]; keywords: string[] }, since: string, limit = 5): Promise<CatalogHit[]> {
  const { hits } = await searchCatalog({
    types: ["contract"],
    naicsPrefixes: f.naics.length ? f.naics : null,
    states: f.states.length ? f.states : null,
    setAsides: f.setAsides.length ? f.setAsides : null,
    q: f.keywords.length ? anyWords(f.keywords.join(" ")) : null,
    sources: await contractSources(),
    seenAfter: since,
    closesAfter: new Date().toISOString(),
    limit,
  });
  return hits;
}
