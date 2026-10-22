import { HttpError } from "../ingest/http";
import { plainText } from "../normalize";
import type { Connector, IngestContext, OpportunityInput, SourceDefinition } from "../types";
import { toProgram, splitAgency } from "./_sam-assistance";
import { fromApi, fromCsv, groupKey, isAwardNotice, kindOf, latestOf, noticeUrl, postedSortKey, toOpportunity, type ChainEntry, type SamNotice } from "./_sam-notices";
import { agencyFunders, csvRows, extractModified, funderEmitter } from "./_sam-shared";

/**
 * SAM.gov, the federal government's official place for contract notices and the assistance program catalog.
 *
 * sam_opportunities: every live Contract Opportunities notice. The backfill reads the public daily extract
 * (Data Services, no key). Incremental runs use the Opportunities API v2 when SAM_GOV_API_KEY is set (fresher,
 * with attachment links), and the extract otherwise. Notices that share a solicitation number are one row: the
 * latest notice, with the earlier ones listed as amendments.
 *
 * sam_assistance: the Assistance Listings catalog (formerly CFDA) from its public weekly extract, one rolling
 * row per funding program.
 */

const DATA_SERVICES = "https://sam.gov/api/prod/fileextractservices/v1/api/download";
export const OPPORTUNITIES_EXTRACT = `${DATA_SERVICES}/Contract%20Opportunities/datagov/ContractOpportunitiesFullCSV.csv?privacy=Public`;
export const OPPORTUNITIES_S3 = "https://s3.amazonaws.com/falextracts/Contract%20Opportunities/datagov/ContractOpportunitiesFullCSV.csv";
export const ASSISTANCE_EXTRACT = `${DATA_SERVICES}/Assistance%20Listings/datagov/AssistanceListings_DataGov_PUBLIC_CURRENT.csv?privacy=Public`;
export const ASSISTANCE_S3 = "https://s3.amazonaws.com/falextracts/Assistance%20Listings/datagov/AssistanceListings_DataGov_PUBLIC_CURRENT.csv";
export const SAM_SEARCH_API = "https://api.sam.gov/opportunities/v2/search";

export const opportunitiesSource: SourceDefinition = {
  id: "sam_opportunities",
  name: "SAM.gov Contract Opportunities",
  covers: "Every federal contract notice still open for responses on SAM.gov: solicitations, combined synopses, presolicitations, sources sought, and special notices, one row per solicitation.",
  homepage: "https://sam.gov/content/opportunities",
  docsUrl: "https://open.gsa.gov/api/get-opportunities-public-api/",
  termsUrl: "https://sam.gov/content/about/terms-of-use",
  license: "Public domain (U.S. government work)",
  attribution: "Source: SAM.gov",
  kinds: ["contract"],
  region: "us",
  cadence: "Hourly with a free SAM.gov API key, daily from the public extract without one",
  schedule: "25 * * * *",
  optionalKey: "SAM_GOV_API_KEY",
  enabled: true,
  priority: 20,
  notes:
    "Backfill: the public daily Contract Opportunities extract, no key. Incremental: the Opportunities API v2 when SAM_GOV_API_KEY is set (a key with a SAM.gov role allows 1,000 requests a day; one without a role allows 10), otherwise the extract when it has changed.",
};

export const assistanceSource: SourceDefinition = {
  id: "sam_assistance",
  name: "SAM.gov Assistance Listings",
  covers: "Every federal grant and cooperative agreement program in the Assistance Listings catalog (formerly CFDA), with objectives, who may apply, and typical award ranges.",
  homepage: "https://sam.gov/content/assistance-listings",
  docsUrl: "https://sam.gov/data-services/Assistance%20Listings/datagov?privacy=Public",
  termsUrl: "https://sam.gov/content/about/terms-of-use",
  license: "Public domain (U.S. government work)",
  attribution: "Source: SAM.gov Assistance Listings",
  kinds: ["grant", "research"],
  region: "us",
  cadence: "Weekly",
  schedule: "40 6 * * 0",
  enabled: true,
  priority: 30,
};

const DAY = 86_400_000;
/** Incremental runs with no earlier success look back this far. */
const FALLBACK_WINDOW_DAYS = 3;
const BATCH = 400;
/** Tests pin the clock with SAM_NOW so recorded notices keep their status. */
const nowOf = (ctx: IngestContext) => (ctx.env.SAM_NOW ? new Date(ctx.env.SAM_NOW) : new Date());

// ---------- Contract Opportunities: the public extract ----------

interface Chain {
  latest: string;
  latestPosted: string;
  entries: ChainEntry[];
}

/** First pass: every listable notice grouped by solicitation, so the second pass knows each group's latest notice. */
async function indexExtract(file: string, ctx: IngestContext) {
  const groups = new Map<string, Chain>();
  const counts = { rows: 0, unreadable: 0, awards: 0, otherTypes: 0 };
  for await (const row of csvRows(file)) {
    counts.rows++;
    const n = fromCsv(row);
    if (!n) {
      counts.unreadable++;
      continue;
    }
    if (isAwardNotice(n)) {
      counts.awards++;
      continue;
    }
    if (!kindOf(n)) {
      counts.otherTypes++;
      continue;
    }
    const key = groupKey(n);
    const entry: ChainEntry = { noticeId: n.noticeId, posted: n.posted, type: n.type, title: n.title.slice(0, 200) };
    const sort = postedSortKey(n.posted);
    const g = groups.get(key);
    if (!g) groups.set(key, { latest: n.noticeId, latestPosted: sort, entries: [entry] });
    else {
      if (sort > g.latestPosted) {
        g.latest = n.noticeId;
        g.latestPosted = sort;
      }
      // Long chains (a standing schedule with hundreds of refreshes) keep their newest 60 entries.
      g.entries.push(entry);
      if (g.entries.length > 120) g.entries = g.entries.sort((a, b) => postedSortKey(b.posted).localeCompare(postedSortKey(a.posted))).slice(0, 60);
    }
  }
  if (counts.unreadable) ctx.warn(`${counts.unreadable} extract rows had no notice id or title`);
  return { groups, counts };
}

async function runExtract(ctx: IngestContext, opts: { since: Date | null }) {
  let file = ctx.env.SAM_OPPORTUNITIES_CSV_FILE;
  if (!file) {
    if (opts.since) {
      const modified = await extractModified(ctx, OPPORTUNITIES_S3);
      if (modified && modified.getTime() < opts.since.getTime()) {
        ctx.log(`the public extract has not changed since ${modified.toISOString()}; nothing to do`);
        return;
      }
    }
    file = await ctx.download(OPPORTUNITIES_EXTRACT, "ContractOpportunitiesFullCSV.csv", { maxAgeHours: 12 });
  }
  const now = nowOf(ctx);
  const { groups, counts } = await indexExtract(file, ctx);
  ctx.log(`${counts.rows} notices in the extract, ${groups.size} solicitations to consider, ${counts.awards} award notices counted and skipped, ${counts.otherTypes} other notices (justifications, surplus sales) skipped`);
  const sinceDay = opts.since ? new Date(opts.since.getTime() - DAY).toISOString().slice(0, 10) : null;
  const emitFunders = funderEmitter(ctx);
  const skipped: Record<string, number> = {};
  let batch: OpportunityInput[] = [];
  for await (const row of csvRows(file)) {
    if (ctx.done()) break;
    const n = fromCsv(row);
    if (!n || !kindOf(n)) continue;
    const g = groups.get(groupKey(n));
    if (!g || g.latest !== n.noticeId) continue;
    if (sinceDay && !g.entries.some((e) => postedSortKey(e.posted).slice(0, 10) >= sinceDay)) continue;
    try {
      const o = toOpportunity(n, { now, liveOnly: !opts.since, chain: g.entries });
      if (typeof o === "string") {
        skipped[o] = (skipped[o] ?? 0) + 1;
        continue;
      }
      await emitFunders(agencyFunders(n, noticeUrl(n.noticeId)));
      batch.push(o);
      if (batch.length >= BATCH) {
        await ctx.opportunities(batch);
        batch = [];
      }
    } catch (err) {
      ctx.warn(`Could not read notice ${n.noticeId}`, err);
    }
  }
  if (batch.length) await ctx.opportunities(batch);
  ctx.log(`skipped solicitations whose latest notice is not live: ${JSON.stringify(skipped)}`);
}

// ---------- Contract Opportunities: the API ----------

const mmddyyyy = (d: Date) => `${String(d.getUTCMonth() + 1).padStart(2, "0")}/${String(d.getUTCDate()).padStart(2, "0")}/${d.getUTCFullYear()}`;

interface SearchPage {
  totalRecords?: number;
  opportunitiesData?: Record<string, unknown>[];
}

async function searchPage(ctx: IngestContext, key: string, from: Date, to: Date, offset: number, limit: number): Promise<SearchPage> {
  const q = new URLSearchParams({ api_key: key, postedFrom: mmddyyyy(from), postedTo: mmddyyyy(to), limit: String(limit), offset: String(offset) });
  const res = await ctx.fetch(`${SAM_SEARCH_API}?${q.toString()}`, { headers: { accept: "application/json" } });
  if (!res.ok) throw new HttpError(res.status, SAM_SEARCH_API, await res.text().catch(() => ""));
  return (await res.json()) as SearchPage;
}

/**
 * Every notice posted in the window. The docs call `offset` a page index; some clients treat it as a record
 * offset. We ask for offset 1 once and look at what comes back, so either reading pages correctly.
 */
export async function searchWindow(ctx: IngestContext, key: string, from: Date, to: Date, opts: { limit?: number; maxPages?: number } = {}): Promise<Record<string, unknown>[]> {
  const limit = opts.limit ?? 1000;
  const maxPages = opts.maxPages ?? Number(ctx.env.SAM_GOV_MAX_PAGES ?? 12);
  const first = await searchPage(ctx, key, from, to, 0, limit);
  const out = [...(first.opportunitiesData ?? [])];
  const total = first.totalRecords ?? out.length;
  if (out.length === 0 || out.length >= total) return out;
  const second = await searchPage(ctx, key, from, to, 1, limit);
  const data = second.opportunitiesData ?? [];
  const recordOffsets = data.length > 0 && out.length > 1 && data[0].noticeId === out[1].noticeId;
  let pages = 2;
  if (recordOffsets) {
    let offset = out.length;
    while (out.length < total && pages <= maxPages) {
      const p = await searchPage(ctx, key, from, to, offset, limit);
      const rows = p.opportunitiesData ?? [];
      if (!rows.length) break;
      out.push(...rows);
      offset += rows.length;
      pages++;
    }
  } else {
    out.push(...data);
    let page = 2;
    while (out.length < total && data.length && pages <= maxPages) {
      const p = await searchPage(ctx, key, from, to, page, limit);
      const rows = p.opportunitiesData ?? [];
      if (!rows.length) break;
      out.push(...rows);
      page++;
      pages++;
    }
  }
  if (out.length < total) ctx.warn(`SAM.gov listed ${total} notices in the window; read ${out.length} within the page budget`);
  return out;
}

/** The description behind the API's link, for a few notices per run (each one is a request against the daily limit). */
async function fetchDescription(ctx: IngestContext, key: string, url: string): Promise<string | null> {
  try {
    const res = await ctx.fetch(`${url}${url.includes("?") ? "&" : "?"}api_key=${encodeURIComponent(key)}`, { retries: 1 });
    if (!res.ok) {
      await res.body?.cancel().catch(() => undefined);
      return null;
    }
    const t = await res.text();
    let text = t;
    try {
      text = (JSON.parse(t) as { description?: string }).description ?? "";
    } catch {
      // plain text or HTML
    }
    const clean = plainText(text);
    return clean && !/^description not found/i.test(clean) ? clean : null;
  } catch {
    return null;
  }
}

async function runApi(ctx: IngestContext, key: string) {
  const to = new Date();
  let from = ctx.since ? new Date(ctx.since.getTime() - DAY) : new Date(to.getTime() - FALLBACK_WINDOW_DAYS * DAY);
  if (to.getTime() - from.getTime() > 360 * DAY) from = new Date(to.getTime() - 360 * DAY);
  ctx.log(`searching the SAM.gov API for notices posted ${mmddyyyy(from)} to ${mmddyyyy(to)}`);
  const raw = await searchWindow(ctx, key, from, to);
  const notices: SamNotice[] = [];
  let unreadable = 0;
  for (const r of raw) {
    const n = fromApi(r);
    if (n) notices.push(n);
    else unreadable++;
  }
  if (unreadable) ctx.warn(`${unreadable} API records had no notice id or title`);
  const groups = new Map<string, SamNotice[]>();
  let awards = 0;
  for (const n of notices) {
    if (isAwardNotice(n)) {
      awards++;
      continue;
    }
    if (!kindOf(n)) continue;
    const k = groupKey(n);
    groups.set(k, [...(groups.get(k) ?? []), n]);
  }
  ctx.log(`${notices.length} notices in the window, ${groups.size} solicitations, ${awards} award notices counted and skipped`);
  let budget = Number(ctx.env.SAM_GOV_DESCRIPTION_BUDGET ?? 25);
  const emitFunders = funderEmitter(ctx);
  let batch: OpportunityInput[] = [];
  for (const members of groups.values()) {
    if (ctx.done()) break;
    const n = latestOf(members)!;
    try {
      if (!n.description && n.descriptionUrl && budget > 0) {
        budget--;
        n.description = await fetchDescription(ctx, key, n.descriptionUrl);
      }
      const chain = members.map((m) => ({ noticeId: m.noticeId, posted: m.posted, type: m.type, title: m.title }));
      const o = toOpportunity(n, { chain, now: nowOf(ctx) });
      if (typeof o === "string") continue;
      await emitFunders(agencyFunders(n, noticeUrl(n.noticeId)));
      batch.push(o);
      if (batch.length >= BATCH) {
        await ctx.opportunities(batch);
        batch = [];
      }
    } catch (err) {
      ctx.warn(`Could not read notice ${n.noticeId}`, err);
    }
  }
  if (batch.length) await ctx.opportunities(batch);
}

export const samOpportunities: Connector = {
  source: opportunitiesSource,
  fullSnapshot: true,
  async run(ctx) {
    if (ctx.mode === "backfill") return runExtract(ctx, { since: null });
    const key = ctx.env.SAM_GOV_API_KEY?.trim();
    const since = ctx.since ?? new Date(Date.now() - FALLBACK_WINDOW_DAYS * DAY);
    if (!key) {
      ctx.log("SAM_GOV_API_KEY is not set; reading the public daily extract instead of the API");
      return runExtract(ctx, { since });
    }
    try {
      await runApi(ctx, key);
    } catch (err) {
      // A used-up daily limit or an outage should not lose the day: the public extract has the same notices.
      if (err instanceof HttpError && (err.status === 429 || err.status === 403 || err.status >= 500)) {
        ctx.log(`the SAM.gov API answered ${err.status}; reading the public daily extract instead`);
        return runExtract(ctx, { since });
      }
      throw err;
    }
  },
};

// ---------- Assistance Listings ----------

export const samAssistance: Connector = {
  source: assistanceSource,
  fullSnapshot: true,
  async run(ctx) {
    let file = ctx.env.SAM_ASSISTANCE_CSV_FILE;
    if (!file) {
      if (ctx.mode === "incremental" && ctx.since) {
        const modified = await extractModified(ctx, ASSISTANCE_S3);
        if (modified && modified.getTime() < ctx.since.getTime()) {
          ctx.log(`the Assistance Listings extract has not changed since ${modified.toISOString()}; nothing to do`);
          return;
        }
      }
      file = await ctx.download(ASSISTANCE_EXTRACT, "AssistanceListings_DataGov_PUBLIC_CURRENT.csv", { maxAgeHours: 20 });
    }
    const emitFunders = funderEmitter(ctx);
    const skipped: Record<string, number> = {};
    let rows = 0;
    let batch: OpportunityInput[] = [];
    for await (const r of csvRows(file)) {
      if (ctx.done()) break;
      rows++;
      try {
        const o = toProgram(r, { liveOnly: ctx.mode === "backfill" });
        if (typeof o === "string") {
          skipped[o] = (skipped[o] ?? 0) + 1;
          if (o === "invalid") ctx.warn(`Assistance listing row ${rows} has no valid number, title, or link`);
          continue;
        }
        await emitFunders(agencyFunders(splitAgency(r["Federal Agency (030)"] ?? ""), o.sourceUrl));
        batch.push(o);
        if (batch.length >= BATCH) {
          await ctx.opportunities(batch);
          batch = [];
        }
      } catch (err) {
        ctx.warn(`Could not read assistance listing ${r["Program Number"]}`, err);
      }
    }
    if (batch.length) await ctx.opportunities(batch);
    ctx.log(`${rows} listings in the extract; skipped ${JSON.stringify(skipped)} (not_funding: loans, insurance, services, and benefits)`);
  },
};

export const connectors: Connector[] = [samOpportunities, samAssistance];
