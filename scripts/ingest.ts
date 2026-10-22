/**
 * Ingestion CLI. Runs connectors into the catalog over DATABASE_URL.
 *
 *   npx tsx --tsconfig tsconfig.json scripts/ingest.ts <source...|all> [--mode backfill|incremental] [--limit N]
 *        [--env .env.localdb] [--trigger schedule|manual|launch] [--dry-run] [--list]
 *   npx tsx --tsconfig tsconfig.json scripts/ingest.ts --due hourly|daily|weekly|monthly   (what GitHub Actions runs)
 *
 * Sources that need a key they do not have are skipped and say so. Exit code 1 when any source failed.
 */
import { existsSync } from "node:fs";
import { loadConnectors } from "@/lib/catalog/connectors";
import { connect, prune } from "@/lib/catalog/ingest/store";
import { MemorySink, runConnector, runIntoDatabase, type RunResult } from "@/lib/catalog/ingest/runner";
import { tierOf } from "@/lib/catalog/schedule";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}
const flag = (name: string) => process.argv.includes(`--${name}`);

async function main() {
  const envFile = arg("env");
  if (envFile) {
    if (!existsSync(envFile)) throw new Error(`No env file at ${envFile}`);
    process.loadEnvFile(envFile);
  }
  const valued = new Set(["--mode", "--limit", "--env", "--trigger", "--due"]);
  const names = process.argv.slice(2).filter((a, i, all) => !a.startsWith("--") && !valued.has(all[i - 1] ?? ""));
  const due = arg("due");
  // A scheduled slot runs the sources whose cron falls in it. Sources that list everything each run (full snapshots)
  // also run a full backfill once a day, which is what closes notices a source has withdrawn.
  const loaded = await loadConnectors(names.includes("all") || due ? [] : names);
  const connectors = loaded.filter((c) => !due || tierOf(c.source) === due || (due === "daily" && c.fullSnapshot && tierOf(c.source) === "hourly"));
  if (due) names.push(...connectors.map((c) => c.source.id));
  if (flag("list") || !names.length) {
    for (const c of connectors) console.log(`${c.source.id.padEnd(28)} ${c.source.enabled ? "on " : "off"} ${tierOf(c.source).padEnd(8)} ${c.source.needsKey ? `needs ${c.source.needsKey}` : c.source.optionalKey ? `better with ${c.source.optionalKey}` : "no key"}  ${c.source.name}`);
    if (!names.length) console.log("\nUsage: scripts/ingest.ts <source...|all> [--mode backfill|incremental] [--limit N] [--env FILE] [--dry-run]");
    return;
  }
  const explicitMode = arg("mode") as "backfill" | "incremental" | undefined;
  const modeFor = (c: (typeof connectors)[number]) => explicitMode ?? (due && due !== "hourly" && c.fullSnapshot ? "backfill" : "incremental");
  const limit = arg("limit") ? Number(arg("limit")) : null;
  const trigger = arg("trigger") ?? (process.env.GITHUB_ACTIONS ? "schedule" : "manual");
  const results: RunResult[] = [];
  const selected = connectors.filter((c) => c.source.enabled || names.includes(c.source.id));
  if (flag("dry-run")) {
    for (const c of selected) {
      const sink = new MemorySink();
      const r = await runConnector(c, sink, { mode: modeFor(c), limit });
      results.push(r);
      console.log(JSON.stringify(sink.opportunityRows.slice(0, 2), null, 2));
    }
  } else {
    const sql = connect();
    try {
      for (const c of selected) results.push(await runIntoDatabase(sql, c, { mode: modeFor(c), limit, trigger }));
      await prune(sql);
      // Semantic matching: embed new live rows when a model key is set (search stays full text without one).
      if (process.env.GEMINI_API_KEY?.trim() && !flag("no-embed")) {
        const [{ embedMissing }, { geminiEmbedder }] = await Promise.all([import("@/lib/catalog/ingest/embed"), import("@/lib/ai/embed")]);
        await embedMissing(sql, geminiEmbedder, { log: (m) => console.log(`[embeddings] ${m}`) }).catch((e) => console.error(`[embeddings] ${e instanceof Error ? e.message : e}`));
      }
    } finally {
      await sql.end({ timeout: 5 });
    }
  }
  console.log("\nsource                   status     seen     added    updated  closed  errors  seconds");
  for (const r of results)
    console.log(`${r.source.padEnd(24)} ${r.status.padEnd(10)} ${String(r.stats.seen).padStart(7)} ${String(r.stats.added).padStart(8)} ${String(r.stats.updated).padStart(9)} ${String(r.stats.closed).padStart(7)} ${String(r.errors.length).padStart(7)} ${String(Math.round(r.durationMs / 1000)).padStart(8)}${r.notes ? `  ${r.notes}` : ""}`);
  if (results.some((r) => r.status === "failed")) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
