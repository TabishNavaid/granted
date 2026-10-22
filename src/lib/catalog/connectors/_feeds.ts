import { parse as parseCsv } from "csv-parse/sync";
import sax from "sax";
import { getText } from "../ingest/http";
import type { Connector } from "../types";
import { emitBids, runClock, type BidPortalBase } from "./_bids";

/**
 * A bid portal published as an official feed: RSS 2.0, Atom, CSV, or JSON at one URL. One config entry is
 * one connector: the URL, the format, and a mapping from one item to our model. Use this only for feeds the
 * portal publishes for reuse; never point it at an HTML page.
 */

/** One feed item: every child element (RSS/Atom) or column (CSV) as text. Repeated elements are joined by "; ". */
export type FeedItem = Record<string, string>;

export interface FeedPortal<Row = FeedItem> extends BidPortalBase<Row> {
  kind: "feed";
  url: string;
  format: "rss" | "atom" | "csv" | "json";
  /** JSON only: dotted path to the array of records ("features", "data.items"); empty for a top-level array. */
  itemsPath?: string;
}

/** RSS <item> or Atom <entry> elements to flat records. Atom links keep their href; categories are joined. */
export function parseXmlFeed(xml: string): FeedItem[] {
  const items: FeedItem[] = [];
  const parser = sax.parser(true, { trim: false, normalize: false });
  let item: FeedItem | null = null;
  let field: string | null = null;
  let depth = 0;
  let text = "";
  const put = (k: string, v: string) => {
    if (!item || !v) return;
    item[k] = item[k] ? `${item[k]}; ${v}` : v;
  };
  parser.onopentag = (node) => {
    const name = node.name.replace(/^.*:/, "").toLowerCase();
    if (name === "item" || name === "entry") {
      item = {};
      depth = 0;
      return;
    }
    if (!item) return;
    depth++;
    if (depth === 1) {
      field = name;
      text = "";
      const attrs = node.attributes as Record<string, string>;
      if (name === "link" && attrs.href && (!attrs.rel || attrs.rel === "alternate")) put("link", attrs.href);
      if (name === "category" && attrs.term) put("category", attrs.term);
      if (name === "enclosure" && attrs.url) put("enclosure", attrs.url);
    }
  };
  parser.ontext = (t) => {
    if (item && field) text += t;
  };
  parser.oncdata = (t) => {
    if (item && field) text += t;
  };
  parser.onclosetag = (tag) => {
    const name = tag.replace(/^.*:/, "").toLowerCase();
    if (item && (name === "item" || name === "entry") && depth === 0) {
      items.push(item);
      item = null;
      return;
    }
    if (!item) return;
    if (depth === 1 && field) {
      put(field, text.trim());
      field = null;
    }
    depth--;
  };
  parser.write(xml).close();
  return items;
}

export function parseJsonFeed(body: string, itemsPath?: string): Record<string, unknown>[] {
  let v: unknown = JSON.parse(body);
  for (const k of (itemsPath ?? "").split(".").filter(Boolean)) v = (v as Record<string, unknown> | null)?.[k];
  if (!Array.isArray(v)) throw new Error(`No array at "${itemsPath ?? ""}" in the JSON feed`);
  return v as Record<string, unknown>[];
}

export function parseCsvFeed(body: string): FeedItem[] {
  return parseCsv(body, { columns: true, skip_empty_lines: true, bom: true, relax_column_count: true, trim: true }) as FeedItem[];
}

export function feedConnector<Row>(portal: FeedPortal<Row>): Connector {
  return {
    source: portal.source,
    fullSnapshot: portal.fullSnapshot ?? true,
    async run(ctx) {
      const now = runClock(ctx);
      const accept = portal.format === "json" ? "application/json" : portal.format === "csv" ? "text/csv" : "application/rss+xml, application/atom+xml, application/xml";
      const body = await getText(ctx.fetch, portal.url, { headers: { accept } });
      const rows = (portal.format === "json" ? parseJsonFeed(body, portal.itemsPath) : portal.format === "csv" ? parseCsvFeed(body) : parseXmlFeed(body)) as Row[];
      ctx.log(`${rows.length} items in ${portal.url}`);
      // Feeds list what is live; an incremental run reads the same feed and lets unchanged rows be skipped by hash.
      const n = await emitBids(ctx, portal, rows, new Set(), now);
      ctx.log(`${n} opportunities`);
    },
  };
}
