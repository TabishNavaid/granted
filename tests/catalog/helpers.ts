import { readFileSync } from "node:fs";
import path from "node:path";
import { MemorySink, runConnector } from "@/lib/catalog/ingest/runner";
import type { Connector, PoliteFetch } from "@/lib/catalog/types";

export const FIXTURES = path.join(__dirname, "..", "fixtures", "catalog");

export function fixture(source: string, file: string): string {
  return readFileSync(path.join(FIXTURES, source, file), "utf8");
}

export function fixturePath(source: string, file: string): string {
  return path.join(FIXTURES, source, file);
}

/**
 * A fetch that answers from recorded responses. Each route is a substring (or regex) of the URL and a fixture
 * file or a function. Any request without a route fails the test, so connectors never reach the network here.
 */
export function fixtureFetch(source: string, routes: [string | RegExp, string | ((url: string, init?: RequestInit) => string | Response)][]): PoliteFetch & { calls: string[] } {
  const calls: string[] = [];
  const f = (async (url: string, init?: RequestInit) => {
    calls.push(url);
    for (const [match, answer] of routes) {
      const hit = typeof match === "string" ? url.includes(match) : match.test(url);
      if (!hit) continue;
      if (typeof answer === "function") {
        const out = answer(url, init);
        return out instanceof Response ? out : new Response(out, { status: 200 });
      }
      const body = fixture(source, answer);
      const type = answer.endsWith(".json") ? "application/json" : answer.endsWith(".xml") ? "application/xml" : answer.endsWith(".csv") ? "text/csv" : "text/plain";
      return new Response(body, { status: 200, headers: { "content-type": type } });
    }
    throw new Error(`No recorded response for ${url}`);
  }) as PoliteFetch & { calls: string[] };
  f.calls = calls;
  return f;
}

/** Run a connector against recorded responses into memory. */
export async function runOffline(connector: Connector, fetch: PoliteFetch, opts: { mode?: "backfill" | "incremental"; env?: Record<string, string | undefined>; limit?: number | null; since?: Date | null } = {}) {
  const sink = new MemorySink();
  const result = await runConnector(connector, sink, {
    mode: opts.mode ?? "backfill",
    env: { ...opts.env },
    limit: opts.limit ?? null,
    since: opts.since ?? null,
    fetch,
    cacheDir: path.join(__dirname, "..", "..", "test-results", "catalog-cache", connector.source.id),
    log: () => undefined,
  });
  return { sink, result };
}
