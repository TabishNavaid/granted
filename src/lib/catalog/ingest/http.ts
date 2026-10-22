import { createWriteStream } from "node:fs";
import { mkdir, rename, stat } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import type { PoliteFetch, PoliteFetchInit } from "../types";

/**
 * Every request the ingestion jobs make goes through here: one identifiable
 * User-Agent, a minimum gap between requests to the same host, robots.txt
 * honored, retries with backoff on 429 and 5xx (Retry-After respected), and a
 * timeout. Hosts with published limits get their own gap in HOST_GAP_MS.
 */
export const USER_AGENT = "FundFellowsBot/1.0 (+https://fundfellows.com/data; hello@fundfellows.com)";

const DEFAULT_GAP_MS = 1_000;
/** Minimum milliseconds between requests per host. Set from each API's published guidance (docs/data-sources.md). */
const HOST_GAP_MS: Record<string, number> = {
  "api.reporter.nih.gov": 1_000, // NIH asks for no more than one request per second
  "api.usaspending.gov": 500,
  "www.federalregister.gov": 500,
  "api.sam.gov": 1_500,
  "api.nsf.gov": 1_000,
  "api.grants.gov": 1_000,
  "apps.irs.gov": 250,
  "www.irs.gov": 500,
};

const lastAt = new Map<string, number>();
const chains = new Map<string, Promise<unknown>>();

function gapFor(host: string) {
  return HOST_GAP_MS[host] ?? DEFAULT_GAP_MS;
}

/** Serialize requests per host with a minimum gap. */
function throttle<T>(host: string, fn: () => Promise<T>): Promise<T> {
  const prev = chains.get(host) ?? Promise.resolve();
  const run = prev.then(async () => {
    const wait = Math.max(0, (lastAt.get(host) ?? 0) + gapFor(host) - Date.now());
    if (wait) await sleep(wait);
    lastAt.set(host, Date.now());
    return fn();
  });
  chains.set(host, run.catch(() => undefined));
  return run;
}

export function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

// ---------- robots.txt ----------

interface RobotsRules {
  disallow: string[];
  allow: string[];
}
const robotsCache = new Map<string, Promise<RobotsRules>>();

/** Parse the rules that apply to us: our own agent group if present, else `*`. */
export function parseRobots(text: string, agent = "fundfellowsbot"): RobotsRules {
  const groups: { agents: string[]; allow: string[]; disallow: string[] }[] = [];
  let current: (typeof groups)[number] | null = null;
  let lastWasAgent = false;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/#.*$/, "").trim();
    if (!line) continue;
    const idx = line.indexOf(":");
    if (idx < 0) continue;
    const key = line.slice(0, idx).trim().toLowerCase();
    const value = line.slice(idx + 1).trim();
    if (key === "user-agent") {
      if (!current || !lastWasAgent) {
        current = { agents: [], allow: [], disallow: [] };
        groups.push(current);
      }
      current.agents.push(value.toLowerCase());
      lastWasAgent = true;
      continue;
    }
    lastWasAgent = false;
    if (!current) continue;
    if (key === "disallow" && value) current.disallow.push(value);
    if (key === "allow" && value) current.allow.push(value);
  }
  const mine = groups.find((g) => g.agents.some((a) => a !== "*" && agent.includes(a)));
  const star = groups.find((g) => g.agents.includes("*"));
  const g = mine ?? star;
  return { disallow: g?.disallow ?? [], allow: g?.allow ?? [] };
}

function pathMatches(rule: string, p: string): boolean {
  const anchored = rule.endsWith("$");
  const body = (anchored ? rule.slice(0, -1) : rule).split("*").map((s) => s.replace(/[.+?^${}()|[\]\\]/g, "\\$&")).join(".*");
  return new RegExp(`^${body}${anchored ? "$" : ""}`).test(p);
}

/** Longest matching rule wins; Allow wins a tie. */
export function robotsAllows(rules: RobotsRules, pathAndQuery: string): boolean {
  let best: { len: number; allow: boolean } | null = null;
  for (const r of rules.disallow) if (pathMatches(r, pathAndQuery) && (!best || r.length > best.len)) best = { len: r.length, allow: false };
  for (const r of rules.allow) if (pathMatches(r, pathAndQuery) && (!best || r.length >= best.len)) best = { len: r.length, allow: true };
  return best ? best.allow : true;
}

async function rulesFor(origin: string): Promise<RobotsRules> {
  let p = robotsCache.get(origin);
  if (!p) {
    p = (async () => {
      try {
        const res = await fetch(`${origin}/robots.txt`, { headers: { "user-agent": USER_AGENT }, signal: AbortSignal.timeout(15_000) });
        if (!res.ok) return { disallow: [], allow: [] };
        const type = res.headers.get("content-type") ?? "";
        if (type.includes("html")) return { disallow: [], allow: [] };
        return parseRobots(await res.text());
      } catch {
        return { disallow: [], allow: [] };
      }
    })();
    robotsCache.set(origin, p);
  }
  return p;
}

export class RobotsDisallowed extends Error {
  constructor(url: string) {
    super(`robots.txt disallows ${url}`);
    this.name = "RobotsDisallowed";
  }
}

export class HttpError extends Error {
  constructor(
    public status: number,
    public url: string,
    body: string,
  ) {
    super(`HTTP ${status} from ${new URL(url).host}${new URL(url).pathname}: ${body.slice(0, 200)}`);
    this.name = "HttpError";
  }
}

/** Query strings can carry API keys. Never log them. */
export function redact(url: string): string {
  try {
    const u = new URL(url);
    for (const k of [...u.searchParams.keys()]) if (/key|token|secret|password/i.test(k)) u.searchParams.set(k, "REDACTED");
    return u.toString();
  } catch {
    return url;
  }
}

/** APIs that publish their own usage rules and are not crawled pages; robots.txt for their hosts covers the website. */
const API_HOSTS = new Set(["api.grants.gov", "api.sam.gov", "api.usaspending.gov", "api.reporter.nih.gov", "api.nsf.gov", "www.federalregister.gov"]);

export function makePoliteFetch(opts: { respectRobots?: boolean } = {}): PoliteFetch {
  const respectRobots = opts.respectRobots ?? true;
  return async function politeFetch(url: string, init: PoliteFetchInit = {}): Promise<Response> {
    const u = new URL(url);
    if (respectRobots && !API_HOSTS.has(u.host)) {
      const rules = await rulesFor(u.origin);
      if (!robotsAllows(rules, u.pathname + u.search)) throw new RobotsDisallowed(redact(url));
    }
    const retries = init.retries ?? 4;
    const timeoutMs = init.timeoutMs ?? 60_000;
    let attempt = 0;
    for (;;) {
      try {
        const res = await throttle(u.host, () =>
          fetch(url, {
            ...init,
            headers: { "user-agent": USER_AGENT, accept: "application/json, application/xml;q=0.9, */*;q=0.8", ...(init.headers as Record<string, string> | undefined) },
            signal: init.signal ?? AbortSignal.timeout(timeoutMs),
          }),
        );
        if (res.status === 429 || res.status >= 500) {
          if (attempt >= retries) throw new HttpError(res.status, redact(url), await res.text().catch(() => ""));
          const retryAfter = Number(res.headers.get("retry-after"));
          await res.body?.cancel().catch(() => undefined);
          await sleep(Number.isFinite(retryAfter) && retryAfter > 0 ? Math.min(retryAfter, 120) * 1000 : backoff(attempt));
          attempt++;
          continue;
        }
        return res;
      } catch (err) {
        if (err instanceof HttpError || err instanceof RobotsDisallowed) throw err;
        if (attempt >= retries) throw new Error(`Request failed after ${retries + 1} tries: ${redact(url)}: ${err instanceof Error ? err.message : String(err)}`);
        await sleep(backoff(attempt));
        attempt++;
      }
    }
  };
}

function backoff(attempt: number) {
  return Math.min(60_000, 2_000 * 2 ** attempt) + Math.floor(Math.random() * 500);
}

/** JSON from a polite fetch, or a clear error with the status and the first part of the body. */
export async function getJson<T>(f: PoliteFetch, url: string, init?: PoliteFetchInit): Promise<T> {
  const res = await f(url, init);
  if (!res.ok) throw new HttpError(res.status, redact(url), await res.text().catch(() => ""));
  return (await res.json()) as T;
}

export async function getText(f: PoliteFetch, url: string, init?: PoliteFetchInit): Promise<string> {
  const res = await f(url, init);
  if (!res.ok) throw new HttpError(res.status, redact(url), await res.text().catch(() => ""));
  return res.text();
}

/**
 * Download once into the cache directory; reuse it while younger than maxAgeHours.
 * Written to a temporary name first so a failed download never looks complete.
 */
export function makeDownloader(f: PoliteFetch, cacheDir: string) {
  return async function download(url: string, fileName: string, opts: { maxAgeHours?: number; headers?: Record<string, string> } = {}): Promise<string> {
    await mkdir(cacheDir, { recursive: true });
    const target = path.join(cacheDir, fileName);
    const maxAge = (opts.maxAgeHours ?? 20) * 3_600_000;
    try {
      const s = await stat(target);
      if (Date.now() - s.mtimeMs < maxAge && s.size > 0) return target;
    } catch {
      // not cached yet
    }
    const res = await f(url, { headers: opts.headers, timeoutMs: 30 * 60_000 });
    if (!res.ok || !res.body) throw new HttpError(res.status, redact(url), await res.text().catch(() => ""));
    const tmp = `${target}.part`;
    await pipeline(Readable.fromWeb(res.body as import("node:stream/web").ReadableStream), createWriteStream(tmp));
    await rename(tmp, target);
    return target;
  };
}
