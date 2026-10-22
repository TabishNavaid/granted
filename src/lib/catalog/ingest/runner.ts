import os from "node:os";
import path from "node:path";
import type { AwardStatInput, Connector, FunderInput, IngestContext, IngestStats, OpportunityInput, PoliteFetch } from "../types";
import { makeDownloader, makePoliteFetch, redact } from "./http";
import * as store from "./store";

/** Where a run's rows go: the database, or memory for tests and dry runs. */
export interface Sink {
  funders(source: string, rows: FunderInput[]): Promise<number>;
  opportunities(source: string, license: string, rows: OpportunityInput[]): Promise<{ added: number; updated: number }>;
  awards(source: string, rows: AwardStatInput[]): Promise<number>;
}

export class MemorySink implements Sink {
  funderRows: FunderInput[] = [];
  opportunityRows: OpportunityInput[] = [];
  awardRows: AwardStatInput[] = [];
  async funders(_s: string, rows: FunderInput[]) {
    this.funderRows.push(...rows);
    return rows.length;
  }
  async opportunities(_s: string, _l: string, rows: OpportunityInput[]) {
    this.opportunityRows.push(...rows);
    return { added: rows.length, updated: 0 };
  }
  async awards(_s: string, rows: AwardStatInput[]) {
    this.awardRows.push(...rows);
    return rows.length;
  }
}

export class DbSink implements Sink {
  private index: store.FunderIndex;
  constructor(private sql: store.Sql) {
    this.index = new store.FunderIndex(sql);
  }
  funders(source: string, rows: FunderInput[]) {
    return store.upsertFunders(this.sql, source, rows, this.index);
  }
  opportunities(source: string, license: string, rows: OpportunityInput[]) {
    return store.upsertOpportunities(this.sql, source, license, rows, this.index);
  }
  awards(source: string, rows: AwardStatInput[]) {
    return store.upsertAwards(this.sql, source, rows);
  }
}

export interface RunOptions {
  mode: "backfill" | "incremental";
  since?: Date | null;
  limit?: number | null;
  env?: Record<string, string | undefined>;
  cacheDir?: string;
  fetch?: PoliteFetch;
  log?: (m: string) => void;
}

export interface RunResult {
  source: string;
  status: "succeeded" | "partial" | "failed" | "skipped";
  stats: IngestStats;
  errors: { message: string; detail?: string }[];
  durationMs: number;
  notes?: string;
}

const FLUSH_AT = 400;

/** Run one connector into a sink. Errors inside the connector end the run as failed or partial, never silently. */
export async function runConnector(connector: Connector, sink: Sink, opts: RunOptions): Promise<RunResult> {
  const started = Date.now();
  const src = connector.source;
  const env = opts.env ?? process.env;
  const log = opts.log ?? ((m: string) => console.log(`[${src.id}] ${m}`));
  if (src.needsKey && !env[src.needsKey]?.trim()) {
    return { source: src.id, status: "skipped", stats: emptyStats(), errors: [], durationMs: 0, notes: `Needs ${src.needsKey}` };
  }
  const fetcher = opts.fetch ?? makePoliteFetch();
  const cacheDir = opts.cacheDir ?? path.join(process.env.INGEST_CACHE_DIR || path.join(os.tmpdir(), "fundfellows-ingest"), src.id);
  const stats = emptyStats();
  const errors: { message: string; detail?: string }[] = [];
  let pendingOpps: OpportunityInput[] = [];
  let pendingFunders: FunderInput[] = [];
  let pendingAwards: AwardStatInput[] = [];
  const limit = opts.limit ?? null;

  const flushFunders = async () => {
    if (!pendingFunders.length) return;
    const rows = pendingFunders;
    pendingFunders = [];
    stats.funders += await sink.funders(src.id, rows);
  };
  const flushOpps = async () => {
    await flushFunders();
    if (!pendingOpps.length) return;
    const rows = pendingOpps;
    pendingOpps = [];
    const r = await sink.opportunities(src.id, src.license, rows);
    stats.added += r.added;
    stats.updated += r.updated;
  };
  const flushAwards = async () => {
    if (!pendingAwards.length) return;
    const rows = pendingAwards;
    pendingAwards = [];
    stats.awards += await sink.awards(src.id, rows);
  };

  const ctx: IngestContext = {
    mode: opts.mode,
    since: opts.since ?? null,
    fetch: fetcher,
    download: makeDownloader(fetcher, cacheDir),
    cacheDir,
    env,
    limit,
    log,
    warn(message, detail) {
      const d = detail instanceof Error ? detail.message : detail === undefined ? undefined : typeof detail === "string" ? detail : JSON.stringify(detail).slice(0, 500);
      errors.push({ message: redact(message), detail: d ? redact(d) : undefined });
      if (errors.length <= 5) log(`warning: ${redact(message)}${d ? `: ${redact(d)}` : ""}`);
    },
    async funders(rows) {
      pendingFunders.push(...rows);
      if (pendingFunders.length >= FLUSH_AT) await flushFunders();
    },
    async opportunities(rows) {
      const room = limit === null ? rows.length : Math.max(0, limit - stats.seen);
      const take = rows.slice(0, room);
      stats.seen += take.length;
      pendingOpps.push(...take);
      if (pendingOpps.length >= FLUSH_AT) await flushOpps();
    },
    async awards(rows) {
      pendingAwards.push(...rows);
      if (pendingAwards.length >= FLUSH_AT) await flushAwards();
    },
    done: () => limit !== null && stats.seen >= limit,
    stats,
  };

  let status: RunResult["status"] = "succeeded";
  let notes: string | undefined;
  try {
    await connector.run(ctx);
    await flushOpps();
    await flushAwards();
    if (errors.length) status = "partial";
  } catch (err) {
    await flushOpps().catch(() => undefined);
    await flushAwards().catch(() => undefined);
    errors.push({ message: redact(err instanceof Error ? err.message : String(err)) });
    status = stats.seen > 0 || stats.funders > 0 || stats.awards > 0 ? "partial" : "failed";
    notes = "Stopped early";
  }
  log(`${status}: ${stats.seen} seen, ${stats.added} added, ${stats.updated} updated, ${stats.funders} funders, ${stats.awards} award rows, ${errors.length} errors, ${Math.round((Date.now() - started) / 1000)}s`);
  return { source: src.id, status, stats, errors, durationMs: Date.now() - started, notes };
}

export function emptyStats(): IngestStats {
  return { seen: 0, added: 0, updated: 0, closed: 0, funders: 0, awards: 0 };
}

/** Run against the database with the run recorded in catalog_ingest_runs, then expire and dedupe. */
export async function runIntoDatabase(sql: store.Sql, connector: Connector, opts: RunOptions & { trigger?: string }): Promise<RunResult> {
  const src = connector.source;
  const env = opts.env ?? process.env;
  if (src.needsKey && !env[src.needsKey]?.trim()) {
    return { source: src.id, status: "skipped", stats: emptyStats(), errors: [], durationMs: 0, notes: `Needs ${src.needsKey}` };
  }
  await store.upsertSources(sql, [src]);
  const since = opts.since !== undefined ? opts.since : opts.mode === "incremental" ? await store.lastSuccess(sql, src.id) : null;
  const runStart = new Date();
  const runId = await store.startRun(sql, src.id, opts.mode, opts.trigger ?? "manual");
  const result = await runConnector(connector, new DbSink(sql), { ...opts, since });
  if (connector.fullSnapshot && opts.mode === "backfill" && result.status === "succeeded" && !opts.limit) {
    result.stats.closed += await store.closeUnseen(sql, src.id, runStart);
  }
  const { expired } = await store.expireAndDedupe(sql);
  result.stats.closed += expired;
  await store.finishRun(sql, runId, { ...result.stats, status: result.status, errors: result.errors, notes: result.notes, startedAt: runStart.getTime() });
  return result;
}
