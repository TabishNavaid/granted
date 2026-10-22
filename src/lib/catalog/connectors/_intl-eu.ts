import { causesFromText, researchAreasFromText, uniq } from "../vocab";
import { int, isoDate, money, plainText } from "../normalize";
import type { Attachment, Connector, FunderInput, IngestContext, KeyDate, OpportunityInput, SourceDefinition } from "../types";
import { HttpError } from "../ingest/http";
import { all, countryCode, first, isFuture, parseJsonField, slug, zonedIso } from "./_intl-shared";

/**
 * EU Funding & Tenders Portal: calls for proposals (Horizon Europe, Erasmus+, LIFE, CERV, Digital Europe and the
 * rest), EU external action calls (PROSPECT), cascade funding calls run by EU-funded projects, and the
 * institutions' calls for tenders. Read through the portal's public Search API (the SEDIA corporate search),
 * documented at https://ec.europa.eu/info/funding-tenders/opportunities/portal/screen/support/apis.
 *
 * The index holds every language version; we ask for English only. Its status field lags (calls whose last
 * deadline passed years ago still say "open"), so status is decided from the deadlines here.
 */
export const source: SourceDefinition = {
  id: "eu_funding_tenders",
  name: "EU Funding & Tenders Portal",
  covers:
    "Open and forthcoming European Union calls for proposals (Horizon Europe, Erasmus+, LIFE, CERV, Digital Europe, and more), EU external action grants, cascade funding calls, and calls for tenders from EU institutions.",
  homepage: "https://ec.europa.eu/info/funding-tenders/opportunities/portal/screen/home",
  docsUrl: "https://ec.europa.eu/info/funding-tenders/opportunities/portal/screen/support/apis",
  termsUrl: "https://commission.europa.eu/legal-notice_en",
  license: "CC BY 4.0 (European Commission reuse policy, Decision 2011/833/EU)",
  attribution: "Source: EU Funding & Tenders Portal, European Commission",
  kinds: ["research", "grant", "contract"],
  region: "international",
  cadence: "Daily",
  schedule: "40 5 * * *",
  enabled: true,
  priority: 20,
};

const API = "https://api.tech.ec.europa.eu/search-api/prod/rest";
const PORTAL = "https://ec.europa.eu/info/funding-tenders/opportunities/portal/screen";
/**
 * The most records one search page returns. Paging deeper than one page is not stable in this index (records
 * repeat and others are skipped), so each request covers an ingest-date window holding at most this many.
 */
export const LEAF = 100;
/** A safety stop on requests per record type. A full run needs about 60 for all four types together. */
const MAX_REQUESTS = Number(process.env.EU_FT_MAX_REQUESTS ?? 400);
const EPOCH = Date.UTC(2000, 0, 1);

export const STATUS = { forthcoming: "31094501", open: "31094502", closed: "31094503" } as const;

/** Record types in the index: 0 tender, 1 topic (call for proposals), 2 external action call, 8 cascade funding call. */
export const RECORD_TYPES = ["1", "2", "8", "0"] as const;
type RecordType = (typeof RECORD_TYPES)[number];

/** The portal shows every topic deadline as that day at 17:00 Brussels time. */
const TOPIC_DEADLINE_TIME = "17:00";
const BRUSSELS = "Europe/Brussels";

/** Programmes whose topics are research funding. */
const RESEARCH_PROGRAMME = /\b(horizon|euratom|research fund for coal and steel|rfcs)\b/i;

export interface SediaResult {
  reference: string;
  url: string;
  summary?: string;
  language?: string;
  metadata: Record<string, string[] | undefined>;
}
export interface SediaPage {
  totalResults: number;
  pageNumber: number;
  pageSize: number;
  results: SediaResult[];
}
interface FacetValue {
  rawValue: string;
  value: string;
}
interface FacetResponse {
  facets?: { name: string; values?: FacetValue[] }[];
}

/** Code-to-label lookups from the Facet API (programme names, contract types, buyers, zones). */
export type Facets = Map<string, Map<string, string>>;

export function readFacets(r: FacetResponse): Facets {
  const out: Facets = new Map();
  for (const f of r.facets ?? []) out.set(f.name, new Map((f.values ?? []).map((v) => [String(v.rawValue), String(v.value ?? "").trim()])));
  return out;
}

function label(facets: Facets, facet: string, code: string): string | null {
  const v = facets.get(facet)?.get(code);
  return v && v !== code ? v : null;
}

const indexTime = (ms: number) => new Date(ms).toISOString().replace("Z", "+0000");

/** Open and forthcoming records of one type whose ingest time is in [from, to). */
export function searchQuery(type: RecordType, from: number, to: number) {
  return {
    bool: {
      must: [
        { terms: { type: [type] } },
        { terms: { status: [STATUS.forthcoming, STATUS.open] } },
        { range: { esDA_IngestDate: { gte: indexTime(from), lt: indexTime(to) } } },
      ],
    },
  };
}

function form(parts: Record<string, unknown>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(parts)) fd.append(k, new Blob([JSON.stringify(v)], { type: "application/json" }));
  return fd;
}

async function post<T>(ctx: IngestContext, url: string, parts: Record<string, unknown>): Promise<T> {
  const res = await ctx.fetch(url, { method: "POST", body: form(parts), timeoutMs: 120_000 });
  if (!res.ok) throw new HttpError(res.status, url, await res.text().catch(() => ""));
  return (await res.json()) as T;
}

export const searchUrl = (page: number, size = LEAF) => `${API}/search?apiKey=SEDIA&text=***&pageSize=${size}&pageNumber=${page}`;
export const facetUrl = () => `${API}/facet?apiKey=SEDIA&text=***`;

// ---------- programme and funder ----------

/** "Horizon Europe (HORIZON)" to "HORIZON"; otherwise a slug of the label or the code. */
export function programmeAbbr(labelText: string | null, code: string): string {
  const m = labelText ? /\(([A-Z0-9][A-Z0-9 .&-]{1,30})\)\s*$/.exec(labelText) : null;
  if (m) return m[1].replace(/\s+/g, "-");
  return labelText ? slug(labelText, 40).toUpperCase() : code;
}

export const EU_ROOT: FunderInput = {
  key: "intl:eu",
  name: "European Union",
  kind: "international",
  country: "BE",
  website: "https://european-union.europa.eu",
  sourceUrl: `${PORTAL}/home`,
};

function programmeFunder(facets: Facets, code: string): FunderInput | null {
  if (!code) return null;
  const name = label(facets, "frameworkProgramme", code);
  if (!name) return null;
  const abbr = programmeAbbr(name, code);
  return {
    key: `intl:eu:${abbr}`,
    name,
    kind: "international",
    parentKey: EU_ROOT.key,
    country: "BE",
    sourceUrl: `${PORTAL}/opportunities/calls-for-proposals?frameworkProgramme=${encodeURIComponent(code)}`,
    extra: { programmeCode: code },
  };
}

function buyerFunder(facets: Facets, m: SediaResult["metadata"]): FunderInput | null {
  const lead = parseJsonField<{ name?: string; link?: string; isLeadAuthority?: boolean }[]>(m.cftLeadContractingAuthorityCode) ?? [];
  const entity = first(m.cftPartyLegalEntityId);
  const leadOne = lead.find((l) => l.isLeadAuthority) ?? lead[0];
  const name = plainText(leadOne?.name ?? "") || (entity ? label(facets, "cftPartyLegalEntityId", entity) : null);
  if (!name) return null;
  return {
    key: entity ? `intl:eu:buyer:${entity}` : `intl:eu:buyer:${slug(name)}`,
    name,
    kind: "international",
    parentKey: EU_ROOT.key,
    country: "BE",
    website: leadOne?.link && /^https?:\/\//.test(leadOne.link) ? leadOne.link : null,
    sourceUrl: `${PORTAL}/opportunities/calls-for-tenders`,
    extra: entity ? { legalEntityId: entity, label: label(facets, "cftPartyLegalEntityId", entity) } : {},
  };
}

// ---------- deadlines ----------

interface Deadlines {
  closeAt: string | null;
  keyDates: KeyDate[];
}

/**
 * Topic deadlines. The index gives bare days (sometimes stamped 00:00 or 17:00 "UTC"); the portal shows each as
 * 17:00 Brussels time, so that is what we store. Two-stage calls close for new applicants at the first stage;
 * multiple cut-off calls close at the next cut-off still ahead.
 */
export function topicDeadlines(m: SediaResult["metadata"], now: Date): Deadlines {
  const actions = parseJsonField<{ deadlineDates?: string[]; submissionProcedure?: { abbreviation?: string } }[]>(m.actions) ?? [];
  const raw = actions.flatMap((a) => a.deadlineDates ?? []);
  const days = uniq((raw.length ? raw : all(m.deadlineDate)).map((d) => d.slice(0, 10)).filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d))).sort();
  const stamps = days.map((d) => zonedIso(d, TOPIC_DEADLINE_TIME, BRUSSELS)).filter((x): x is string => !!x);
  const model = (first(m.deadlineModel) || actions[0]?.submissionProcedure?.abbreviation || "").toLowerCase();
  let closeAt: string | null = null;
  const keyDates: KeyDate[] = [];
  if (model.includes("two-stage") && stamps.length >= 2) {
    closeAt = stamps[0];
    keyDates.push({ kind: "stage_1_deadline", date: days[0], label: "First stage deadline" });
    keyDates.push({ kind: "stage_2_deadline", date: days[1], label: "Second stage deadline (invited applicants)" });
  } else {
    closeAt = stamps.find((s) => isFuture(s, now)) ?? stamps[stamps.length - 1] ?? null;
    if (stamps.length > 1) days.forEach((d, i) => keyDates.push({ kind: "cutoff", date: d, label: `Cut-off ${i + 1}` }));
  }
  const opening = actions.map((a) => (a as { plannedOpeningDate?: string }).plannedOpeningDate).find(Boolean);
  if (opening) keyDates.push({ kind: "opening", date: opening.slice(0, 10), label: "Opens for submission" });
  return { closeAt, keyDates };
}

/**
 * A deadline stamp from the index ("2026-12-21T15:00:59.000+0000"). Despite the "+0000", the clock time is local:
 * the portal shows that example as 15:00 in the call's own time zone (Europe/Paris), and cascade calls as Brussels
 * time. So the day and the hour and minute are read as wall-clock time in `timeZone`.
 */
export function wallClock(value: string, timeZone: string): string | null {
  const m = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/.exec(value.trim());
  return m ? zonedIso(m[1], m[2], timeZone) : null;
}

/** The earliest future deadline among the record's stamps, else the last one, with its local wording. */
function stampedDeadline(m: SediaResult["metadata"], timeZone: string, now: Date): { closeAt: string | null; closeText: string | null } {
  const stamps = uniq(all(m.deadlineDate))
    .map((v) => ({ iso: wallClock(v, timeZone), hhmm: v.slice(11, 16) }))
    .filter((x): x is { iso: string; hhmm: string } => !!x.iso)
    .sort((a, b) => a.iso.localeCompare(b.iso));
  const pick = stamps.find((s) => isFuture(s.iso, now)) ?? stamps[stamps.length - 1];
  if (!pick) return { closeAt: null, closeText: null };
  const zone = timeZone === BRUSSELS ? "Brussels" : timeZone;
  return { closeAt: pick.iso, closeText: `${pick.hhmm} ${zone} time` };
}

/** Index dates come as "2026-10-22T00:00:00", "2024-09-06+02:00 Europe/Brussels", or "25/01/2021" (day first). */
export function euDay(value: string | null | undefined): string | null {
  const v = (value ?? "").trim();
  const dmy = /^(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(v);
  if (dmy) return isoDate(`${dmy[3]}-${dmy[2].padStart(2, "0")}-${dmy[1].padStart(2, "0")}`);
  return isoDate(v.slice(0, 10));
}

// ---------- budget ----------

interface BudgetLine {
  action?: string;
  expectedGrants?: number;
  minContribution?: number;
  maxContribution?: number;
  budgetYearMap?: Record<string, string | number>;
}

/** The topic's own lines from the call's budget table ("HORIZON-CL5-2027-07-D3-32 - HORIZON-IA ..."). */
export function topicBudget(m: SediaResult["metadata"], identifier: string) {
  const overview = parseJsonField<{ budgetTopicActionMap?: Record<string, BudgetLine[]> }>(m.budgetOverview);
  const lines = Object.values(overview?.budgetTopicActionMap ?? {})
    .flat()
    .filter((l) => (l.action ?? "").split(/\s+-\s+/)[0].trim() === identifier);
  if (!lines.length) return { amountMin: null, amountMax: null, amountTotal: null, awardCount: null };
  const mins = lines.map((l) => money(l.minContribution)).filter((x): x is number => x !== null);
  const maxs = lines.map((l) => money(l.maxContribution)).filter((x): x is number => x !== null);
  const total = lines.reduce((s, l) => s + Object.values(l.budgetYearMap ?? {}).reduce<number>((a, v) => a + (money(v) ?? 0), 0), 0);
  const grants = lines.reduce((s, l) => s + (int(l.expectedGrants) ?? 0), 0);
  return {
    amountMin: mins.length ? Math.min(...mins) : null,
    amountMax: maxs.length ? Math.max(...maxs) : null,
    amountTotal: total > 0 ? total : null,
    awardCount: grants > 0 ? grants : null,
  };
}

/** "6000000 EUR" to an amount and a currency. */
export function valueWithCurrency(v: string): { amount: number | null; currency: string | null } {
  const m = /^\s*([\d.,]+)\s*([A-Z]{3})?\s*$/.exec(v ?? "");
  if (!m) return { amount: null, currency: null };
  return { amount: money(m[1]), currency: m[2] ?? null };
}

// ---------- records to opportunities ----------

const EU_PLACE = { country: null, text: "European Union" };

function statusFor(code: string, openAt: string | null, closeAt: string | null, now: Date): OpportunityInput["status"] {
  if (closeAt && !isFuture(closeAt, now)) return "closed";
  if (openAt && isFuture(`${openAt.slice(0, 10)}T00:00:00Z`, now)) return "forecasted";
  if (code === STATUS.forthcoming && !openAt) return "forecasted";
  return "open";
}

export interface Mapped {
  opportunity: OpportunityInput;
  funders: FunderInput[];
}

/** One index record to our model, or null when it is no longer open or forthcoming (or unreadable). */
export function toOpportunity(r: SediaResult, facets: Facets, now = new Date()): Mapped | null {
  const m = r.metadata ?? {};
  const type = first(m.type) as RecordType;
  const code = first(m.status);
  const url = first(m.url) || r.url;
  if (!url || !/^https?:\/\//.test(url)) return null;
  const programmeCode = first(m.frameworkProgramme);
  const programme = programmeFunder(facets, programmeCode);
  const programmeName = programme?.name ?? null;
  const openAt = euDay(first(m.startDate));

  if (type === "1") {
    const identifier = first(m.identifier);
    const title = plainText(first(m.title));
    if (!identifier || !title) return null;
    const { closeAt, keyDates } = topicDeadlines(m, now);
    if (!closeAt || !isFuture(closeAt, now)) return null;
    const research = RESEARCH_PROGRAMME.test(programmeName ?? "");
    const summary = plainText(first(m.descriptionByte) || first(m.description));
    const destination = plainText(first(m.destinationDescription));
    const callTitle = plainText(first(m.callTitle));
    const actionTypes = all(m.typesOfAction);
    const priorities = all(m.crossCuttingPriorities).map((c) => label(facets, "crossCuttingPriorities", c) ?? c);
    const text = `${title} ${callTitle} ${destination} ${summary.slice(0, 2_000)}`;
    const model = first(m.deadlineModel);
    return {
      funders: programme ? [programme] : [],
      opportunity: {
        sourceId: identifier,
        // Older index records link to a JSON file; the topic page is the public view.
        sourceUrl: /\/topic-details\//.test(url) ? url : `${PORTAL}/opportunities/topic-details/${encodeURIComponent(identifier)}`,
        opportunityNumber: identifier,
        type: research ? "research" : "grant",
        noticeType: "call_topic",
        title,
        summary,
        funderKey: programme?.key ?? EU_ROOT.key,
        funderName: programmeName ?? "European Union",
        agencyCode: programme ? programmeAbbr(programmeName, programmeCode) : null,
        status: statusFor(code, openAt, closeAt, now),
        postedAt: null,
        openAt,
        closeAt,
        closeText: `${TOPIC_DEADLINE_TIME} Brussels time`,
        rolling: false,
        keyDates,
        ...topicBudget(m, identifier),
        currency: "EUR",
        eligibility: [],
        researchAreas: research ? researchAreasFromText(text) : [],
        causes: research ? [] : causesFromText(text),
        categories: uniq([programmeName, ...actionTypes, destination || null, ...priorities].filter((x): x is string => !!x)).slice(0, 12),
        place: EU_PLACE,
        extra: {
          programme: programmeName,
          call: first(m.callIdentifier) || null,
          callTitle: callTitle || null,
          deadlineModel: model || null,
          typesOfAction: actionTypes,
        },
      },
    };
  }

  if (type === "2") {
    const identifier = first(m.identifier) || first(m.callIdentifier);
    const title = plainText(first(m.title) || r.summary);
    if (!identifier || !title) return null;
    const { closeAt, closeText } = stampedDeadline(m, BRUSSELS, now);
    if (!closeAt || !isFuture(closeAt, now)) return null;
    const zoneCode = first(m.geographicalZone);
    const zone = zoneCode ? label(facets, "geographicalZones", zoneCode) : null;
    const contract = label(facets, "contractType", first(m.contractType));
    const region = label(facets, "programmeDivisionProspect", first(m.programmeDivisionProspect));
    const docs = parseJsonField<{ nameDoc?: string; docUrl?: string }[]>(m.publicationDocuments) ?? [];
    const attachments: Attachment[] = docs
      .filter((d) => d.docUrl && /^https:\/\//.test(d.docUrl))
      .slice(0, 12)
      .map((d) => ({ name: plainText(d.nameDoc) || "Document", url: d.docUrl! }));
    const beneficiary = plainText(first(m.beneficiaryAdministration));
    return {
      funders: programme ? [programme] : [],
      opportunity: {
        sourceId: identifier,
        // The index links some of these to a sign-in page; the portal's own page for the record is public.
        sourceUrl: r.reference ? `${PORTAL}/opportunities/prospect-details/${encodeURIComponent(r.reference)}` : url,
        opportunityNumber: identifier,
        type: "grant",
        noticeType: contract ? `external_action_${slug(contract, 20)}` : "external_action_call",
        title,
        summary: beneficiary ? `Beneficiary administration: ${beneficiary}` : null,
        funderKey: programme?.key ?? EU_ROOT.key,
        funderName: programmeName ?? "European Union",
        agencyCode: programme ? programmeAbbr(programmeName, programmeCode) : null,
        status: statusFor(code, openAt, closeAt, now),
        openAt,
        postedAt: openAt,
        closeAt,
        closeText,
        amountTotal: money(first(m.budget)),
        currency: first(m.currency) || "EUR",
        eligibility: [],
        causes: causesFromText(title),
        categories: uniq([programmeName, contract, region?.trim() || null].filter((x): x is string => !!x)),
        place: { country: countryCode(zone), text: zone ?? "European Union" },
        attachments,
        extra: { programme: programmeName, contractType: contract, region: region?.trim() || null, call: first(m.callIdentifier) || null },
      },
    };
  }

  if (type === "8") {
    // callccm2Id is the call's own id; ccm2Id is the parent topic's and is shared by many calls.
    const id = first(m.callccm2Id);
    const title = plainText(first(m.callTitle) || first(m.caName) || r.summary);
    if (!id || !title) return null;
    const { closeAt, closeText } = stampedDeadline(m, BRUSSELS, now);
    if (!closeAt || !isFuture(closeAt, now)) return null;
    const project = plainText(first(m.projectAcronym)) || plainText(first(m.projectName));
    const summary = [first(m.furtherInformation), first(m.description)].map(plainText).filter(Boolean).join(" ");
    const research = RESEARCH_PROGRAMME.test(programmeName ?? "");
    const text = `${title} ${summary.slice(0, 2_000)}`;
    return {
      funders: programme ? [programme] : [],
      opportunity: {
        sourceId: `cascade-${id}`,
        sourceUrl: `${PORTAL}/opportunities/competitive-calls-cs/${encodeURIComponent(id)}`,
        // The identifier field holds the parent EU topic, not this call; it would merge this call with the topic.
        opportunityNumber: null,
        type: research ? "research" : "grant",
        noticeType: "cascade_call",
        title,
        summary,
        funderKey: programme?.key ?? EU_ROOT.key,
        funderName: project ? `${project} (EU-funded project)` : (programmeName ?? "European Union"),
        agencyCode: programme ? programmeAbbr(programmeName, programmeCode) : null,
        status: statusFor(code, openAt, closeAt, now),
        openAt,
        postedAt: openAt,
        closeAt,
        closeText,
        amountTotal: money(first(m.budget)),
        currency: "EUR",
        eligibility: [],
        researchAreas: research ? researchAreasFromText(text) : [],
        causes: research ? [] : causesFromText(text),
        categories: uniq([programmeName, "Cascade funding (financial support to third parties)"].filter((x): x is string => !!x)),
        place: EU_PLACE,
        extra: {
          programme: programmeName,
          parentTopic: first(m.identifier) || null,
          project: project || null,
          projectId: first(m.projectId) || null,
        },
      },
    };
  }

  if (type === "0") {
    const id = first(m.identifier) || first(m.cftId) || r.reference;
    const title = plainText(first(m.title) || r.summary);
    if (!id || !title) return null;
    const { closeAt, closeText } = stampedDeadline(m, first(m.cftTimezone) || BRUSSELS, now);
    const published = euDay(first(m.cftPublicationDateEForm)) ?? euDay(first(m.startDate));
    const planned = euDay(first(m.cftPlannedDate));
    const procedure = label(facets, "procedureType", first(m.procedureType));
    // Prior information notices announce a call that is not open yet, whatever the index status says.
    const planning = /^planned\b/i.test(procedure ?? "") || /-PIN$/i.test(id);
    const vendorList = /vendor/i.test(procedure ?? "");
    const recent = !!published && now.getTime() - new Date(`${published}T00:00:00Z`).getTime() <= 365 * 86_400_000;
    let status: OpportunityInput["status"];
    if (closeAt) {
      if (!isFuture(closeAt, now)) return null;
      status = code === STATUS.forthcoming || planning ? "forecasted" : "open";
    } else if (code === STATUS.forthcoming || planning) {
      // Keep a planned call while its planned launch is ahead, or for a year after the notice when it gives no date.
      if (planned ? !isFuture(`${planned}T23:59:59Z`, now) : !recent) return null;
      status = "forecasted";
    } else {
      // Open with no deadline (vendor lists, preselection lists): keep it for a year after publication.
      if (!recent) return null;
      status = "open";
    }
    const buyer = buyerFunder(facets, m);
    const value = valueWithCurrency(first(m.cftEstimatedTotalProcedureValue));
    const contract = label(facets, "contractType", first(m.contractType));
    const cpv = all(m.mainCpv);
    const cpvLabels = cpv.map((c) => label(facets, "mainCpv", c)).filter((x): x is string => !!x);
    const summary = plainText(first(m.description));
    return {
      funders: buyer ? [buyer] : [],
      opportunity: {
        sourceId: id,
        sourceUrl: url,
        opportunityNumber: first(m.callIdentifier) || null,
        type: "contract",
        noticeType: procedure ? slug(procedure, 60).replace(/-/g, "_") : "call_for_tenders",
        title,
        summary,
        funderKey: buyer?.key ?? EU_ROOT.key,
        funderName: buyer?.name ?? "European Union",
        agencyCode: buyerCode(buyer),
        status,
        postedAt: published,
        openAt: published,
        closeAt,
        // A vendor list takes applications at any time while the list is valid.
        closeText: closeText ?? (vendorList ? "Applications accepted while the list is valid" : null),
        rolling: !closeAt && vendorList,
        keyDates: planned ? [{ kind: "planned_launch", date: planned, label: "Planned launch" }] : [],
        amountMax: value.amount,
        currency: value.currency ?? (first(m.cftEstimatedOverallContractCurrency) || "EUR"),
        eligibility: [],
        categories: uniq([contract, procedure, ...cpvLabels].filter((x): x is string => !!x)).slice(0, 10),
        place: EU_PLACE,
        extra: { cpv, contractType: contract, procedure, timeZone: first(m.cftTimezone) || null, submission: first(m.cftSubmissionMethodCode) || null },
      },
    };
  }
  return null;
}

/** "JRC - Joint Research Centre" to "JRC". */
function buyerCode(buyer: FunderInput | null): string | null {
  const l = buyer?.extra?.label;
  return typeof l === "string" && / - /.test(l) ? l.split(" - ")[0].trim() || null : null;
}

/** Newest ingest wins when the index holds two records for one id. */
function newer(a: SediaResult, b: SediaResult): SediaResult {
  const ta = first(a.metadata.esDA_IngestDate);
  const tb = first(b.metadata.esDA_IngestDate);
  return tb > ta ? b : a;
}

export const euFundingTenders: Connector = {
  source,
  fullSnapshot: true,
  async run(ctx) {
    const now = new Date();
    const since = ctx.mode === "incremental" ? new Date((ctx.since?.getTime() ?? now.getTime() - 3 * 86_400_000) - 86_400_000) : null;
    const facetQuery = { bool: { must: [{ terms: { type: [...RECORD_TYPES] } }, { terms: { status: [STATUS.forthcoming, STATUS.open] } }] } };
    const facets = readFacets(await post<FacetResponse>(ctx, facetUrl(), { query: facetQuery, languages: ["en"] }));
    ctx.log(`facets: ${facets.size} lists, ${facets.get("frameworkProgramme")?.size ?? 0} programmes`);
    await ctx.funders([EU_ROOT]);
    const seenFunders = new Set<string>([EU_ROOT.key]);
    let skipped = 0;

    for (const type of RECORD_TYPES) {
      if (ctx.done()) break;
      const byId = new Map<string, SediaResult>();
      let requests = 0;
      const keep = (r: SediaResult) => {
        if (r.language && r.language !== "en") return;
        // Cascade calls share their parent topic's identifier; their own id is callccm2Id.
        const own = type === "8" ? first(r.metadata?.callccm2Id) : first(r.metadata?.identifier);
        const key = own ? `${type}|${own}` : r.reference;
        const prev = byId.get(key);
        byId.set(key, prev ? newer(prev, r) : r);
      };
      const search = async (from: number, to: number, size: number, page = 1) => {
        requests++;
        return post<SediaPage>(ctx, searchUrl(page, size), { query: searchQuery(type, from, to), languages: ["en"] });
      };
      // Split the ingest-date range in halves until each window fits in one page.
      const collect = async (from: number, to: number, known: number | null): Promise<void> => {
        if (requests >= MAX_REQUESTS) throw new Error(`EU search: more than ${MAX_REQUESTS} requests for record type ${type}`);
        if (ctx.limit !== null && byId.size >= ctx.limit * 3) return;
        const n = known ?? (await search(from, to, 1)).totalResults ?? 0;
        if (n === 0) return;
        if (n <= LEAF || to - from < 2_000) {
          for (let page = 1; (page - 1) * LEAF < n; page++) (await search(from, to, LEAF, page)).results?.forEach(keep);
          return;
        }
        const mid = from + Math.floor((to - from) / 2);
        await collect(from, mid, null);
        await collect(mid, to, null);
      };
      const from = since ? since.getTime() : EPOCH;
      const to = now.getTime() + 86_400_000;
      const total = (await search(from, to, 1)).totalResults ?? 0;
      await collect(from, to, total);
      const batch: OpportunityInput[] = [];
      for (const r of byId.values()) {
        try {
          const mapped = toOpportunity(r, facets, now);
          if (!mapped) {
            skipped++;
            continue;
          }
          const fresh = mapped.funders.filter((f) => !seenFunders.has(f.key));
          fresh.forEach((f) => seenFunders.add(f.key));
          if (fresh.length) await ctx.funders(fresh);
          batch.push(mapped.opportunity);
        } catch (err) {
          ctx.warn(`Could not read EU record ${r.reference}`, err);
        }
      }
      await ctx.opportunities(batch);
      ctx.log(`type ${type}: ${total} in the index, ${byId.size} read in ${requests} requests, ${batch.length} open or forthcoming`);
    }
    ctx.log(`${skipped} records past their deadlines skipped`);
  },
};
