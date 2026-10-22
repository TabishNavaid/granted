import { getJson } from "../ingest/http";
import type { Connector, IngestContext } from "../types";
import { emitBids, runClock, type BidPortalBase } from "./_bids";

/**
 * A bid portal published as a Socrata dataset (the SODA API that most US city and state open data portals
 * run on: https://dev.socrata.com/docs/endpoints). One config entry is one connector: the dataset id,
 * a SoQL filter for what is live, a stable order, and a mapping from one row to our model.
 */

export type SodaRow = Record<string, unknown>;

export interface SocrataPortal<Row extends SodaRow = SodaRow> extends BidPortalBase<Row> {
  kind: "socrata";
  /** Portal host, e.g. "data.cityofnewyork.us". */
  domain: string;
  /** Dataset id, e.g. "dg92-zbpx". */
  dataset: string;
  /** SoQL $where for a backfill: everything live plus a short window of recently closed records. */
  where: (now: Date) => string;
  /** SoQL $order. Must be stable for paging; oldest first when groupKey keeps the newest notice. */
  order: string;
  /** Optional SoQL $select (smaller pages). */
  select?: string;
  /** Rows per request. SODA allows up to 50,000; small pages are kinder and plenty here. */
  pageSize?: number;
  /** Field that changes when a row changes. ":updated_at" works on every Socrata dataset. */
  updatedField?: string;
}

/** A floating timestamp literal for SoQL ("2026-10-22T00:00:00"). */
export function soqlTime(d: Date): string {
  return d.toISOString().slice(0, 19);
}

/** SoQL string literal with quotes escaped. */
export function soqlString(s: string): string {
  return `'${s.replace(/'/g, "''")}'`;
}

export function sodaResource(domain: string, dataset: string): string {
  return `https://${domain}/resource/${dataset}.json`;
}

/** A public link to one record through the SODA API, for datasets whose records have no web page of their own. */
export function sodaRecordUrl(domain: string, dataset: string, field: string, value: string): string {
  return `${sodaResource(domain, dataset)}?${encodeURIComponent(field)}=${encodeURIComponent(value)}`;
}

/** The dataset's page on the portal. */
export function sodaDatasetPage(domain: string, dataset: string): string {
  return `https://${domain}/d/${dataset}`;
}

/** Text from a row field ("" when missing). Socrata URL columns come back as { url }. */
export function txt(row: SodaRow, field: string): string {
  const v = row[field];
  if (v === null || v === undefined) return "";
  if (typeof v === "object") {
    const u = (v as { url?: unknown }).url;
    return typeof u === "string" ? u : "";
  }
  return String(v).trim();
}

/** The where clause a run uses: the backfill filter, narrowed to recent changes in incremental mode. */
export function whereFor<Row extends SodaRow>(portal: SocrataPortal<Row>, ctx: Pick<IngestContext, "mode" | "since">, now: Date): string {
  const base = portal.where(now);
  if (ctx.mode !== "incremental") return base;
  // A little overlap so nothing changed during the last run is missed; a week when there was no last run.
  const since = ctx.since ? new Date(ctx.since.getTime() - 2 * 86_400_000) : new Date(now.getTime() - 7 * 86_400_000);
  return `(${base}) AND ${portal.updatedField ?? ":updated_at"} > ${soqlString(soqlTime(since))}`;
}

export function pageUrl<Row extends SodaRow>(portal: SocrataPortal<Row>, where: string, offset: number): string {
  const p = new URLSearchParams();
  if (portal.select) p.set("$select", portal.select);
  p.set("$where", where);
  p.set("$order", portal.order);
  p.set("$limit", String(portal.pageSize ?? 1000));
  p.set("$offset", String(offset));
  return `${sodaResource(portal.domain, portal.dataset)}?${p.toString()}`;
}

export function socrataConnector<Row extends SodaRow>(portal: SocrataPortal<Row>): Connector {
  return {
    source: portal.source,
    fullSnapshot: portal.fullSnapshot ?? true,
    async run(ctx) {
      const now = runClock(ctx);
      const where = whereFor(portal, ctx, now);
      const size = portal.pageSize ?? 1000;
      const headers: Record<string, string> = { accept: "application/json" };
      // Optional free app token raises Socrata's shared rate limit. Sent as a header, never in a URL.
      if (ctx.env.SOCRATA_APP_TOKEN?.trim()) headers["X-App-Token"] = ctx.env.SOCRATA_APP_TOKEN.trim();
      const rows: Row[] = [];
      // Grouped portals need every row before combining; others can stop paging once the limit is met.
      for (let offset = 0; ; offset += size) {
        const page = await getJson<Row[]>(ctx.fetch, pageUrl(portal, where, offset), { headers });
        if (!Array.isArray(page)) throw new Error(`${portal.source.id}: unexpected response from ${portal.domain}`);
        rows.push(...page);
        if (page.length < size) break;
        if (!portal.groupKey && ctx.limit !== null && rows.length >= ctx.limit * 2) break;
        if (offset > 200_000) throw new Error(`${portal.source.id}: more than 200,000 rows; the filter is too wide`);
      }
      ctx.log(`${rows.length} rows from ${portal.domain}/${portal.dataset}`);
      const n = await emitBids(ctx, portal, rows, new Set(), now);
      ctx.log(`${n} opportunities`);
    },
  };
}
