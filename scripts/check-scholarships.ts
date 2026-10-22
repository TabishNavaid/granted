/**
 * Monthly re-check of the curated scholarships (src/lib/catalog/curated/scholarships.ts).
 *
 *   npx tsx --tsconfig tsconfig.json scripts/check-scholarships.ts [--only slug,slug] [--json]
 *
 * Re-fetches every official page through the polite fetch (robots.txt, rate limits, our User-Agent) and
 * reports, per entry: dead or moved links, pages that refuse automated requests, the `watch` phrase
 * missing (the deadline or status text changed), deadlines that have passed, and entries not checked by
 * hand for more than 45 days. Exit code 1 when anything needs attention.
 */
import { makePoliteFetch } from "@/lib/catalog/ingest/http";
import { plainText } from "@/lib/catalog/normalize";
import { statusOf } from "@/lib/catalog/connectors/curated-scholarships";
import { pagesOf, SCHOLARSHIPS, type CuratedScholarship } from "@/lib/catalog/curated/scholarships";
import type { PoliteFetch } from "@/lib/catalog/types";

export interface PageResult {
  url: string;
  status: number | null;
  finalUrl: string | null;
  error: string | null;
  text: string;
}

export interface EntryReport {
  slug: string;
  problems: string[];
  notes: string[];
}

const norm = (s: string) => plainText(s).replace(/\s+/g, " ").replace(/[’‘]/g, "'").toLowerCase();

export async function fetchPage(f: PoliteFetch, url: string): Promise<PageResult> {
  try {
    const res = await f(url, { retries: 2, timeoutMs: 30_000, headers: { accept: "text/html,application/xhtml+xml" } });
    const body = res.ok ? await res.text() : "";
    if (!res.ok) await res.body?.cancel().catch(() => undefined);
    return { url, status: res.status, finalUrl: res.url || url, error: null, text: norm(body) };
  } catch (err) {
    return { url, status: null, finalUrl: null, error: err instanceof Error ? err.message : String(err), text: "" };
  }
}

/** Judge one entry from its fetched pages. Pure, so it is tested offline. */
export function judge(s: CuratedScholarship, pages: PageResult[], now = new Date()): EntryReport {
  const problems: string[] = [];
  const notes: string[] = [];
  for (const p of pages) {
    if (p.error) problems.push(`unreachable: ${p.url} (${p.error.slice(0, 120)})`);
    else if (p.status === 403 || p.status === 429) (s.botBlocked ? notes : problems).push(`refuses automated requests (${p.status}): ${p.url}; check it in a browser`);
    else if (p.status !== 200) problems.push(`HTTP ${p.status}: ${p.url}`);
    else if (p.finalUrl && new URL(p.finalUrl).pathname.replace(/\/$/, "") !== new URL(p.url).pathname.replace(/\/$/, "")) notes.push(`redirects to ${p.finalUrl}`);
  }
  const readable = pages.filter((p) => p.status === 200 && p.text);
  if (s.watch && readable.length) {
    const phrase = norm(s.watch);
    if (!readable.some((p) => p.text.includes(phrase))) problems.push(`watch text not found: "${s.watch}" (the deadline or status text changed)`);
  }
  const status = statusOf(s, now);
  if (status === "closed") notes.push(`deadline passed (${s.deadline}); look for the next cycle`);
  if (status === "forecasted" && !s.deadline) notes.push("no deadline posted yet; look again");
  const age = (now.getTime() - new Date(`${s.lastChecked}T00:00:00Z`).getTime()) / 86_400_000;
  if (age > 45) problems.push(`last checked ${s.lastChecked}, more than 45 days ago`);
  return { slug: s.slug, problems, notes };
}

export async function checkAll(entries: CuratedScholarship[], f: PoliteFetch = makePoliteFetch(), now = new Date()): Promise<EntryReport[]> {
  const cache = new Map<string, Promise<PageResult>>();
  const get = (u: string) => {
    let p = cache.get(u);
    if (!p) cache.set(u, (p = fetchPage(f, u)));
    return p;
  };
  return Promise.all(entries.map(async (s) => judge(s, await Promise.all(pagesOf(s).map(get)), now)));
}

async function main() {
  const i = process.argv.indexOf("--only");
  const only = i >= 0 ? process.argv[i + 1]?.split(",") : null;
  const entries = only ? SCHOLARSHIPS.filter((s) => only.includes(s.slug)) : SCHOLARSHIPS;
  const reports = await checkAll(entries);
  if (process.argv.includes("--json")) {
    console.log(JSON.stringify(reports, null, 2));
  } else {
    for (const r of reports) {
      if (!r.problems.length && !r.notes.length) continue;
      console.log(`\n${r.slug}`);
      for (const p of r.problems) console.log(`  PROBLEM ${p}`);
      for (const n of r.notes) console.log(`  note    ${n}`);
    }
    const bad = reports.filter((r) => r.problems.length).length;
    console.log(`\n${reports.length} entries checked, ${bad} need attention, ${reports.length - bad} fine.`);
  }
  if (reports.some((r) => r.problems.length)) process.exitCode = 1;
}

if (process.argv[1]?.endsWith("check-scholarships.ts")) {
  main().catch((err) => {
    console.error(err);
    process.exitCode = 1;
  });
}
