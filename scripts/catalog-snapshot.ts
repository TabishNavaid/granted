/**
 * Writes src/data/catalog-snapshot.json: every source's public description (from the connectors themselves) and,
 * when a database is reachable, the counts measured in it. The /data page shows live counts when the app has a
 * database and this snapshot, clearly dated, when it does not (the zero-key demo).
 *
 *   npx tsx --tsconfig tsconfig.json scripts/catalog-snapshot.ts [--env .env.localdb] [--label "local test load"]
 */
import { existsSync, writeFileSync } from "node:fs";
import path from "node:path";
import { loadConnectors } from "@/lib/catalog/connectors";
import { connect, databaseUrl } from "@/lib/catalog/ingest/store";

function arg(name: string) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function main() {
  const env = arg("env");
  if (env && existsSync(env)) process.loadEnvFile(env);
  const connectors = await loadConnectors();
  const sources = connectors
    .map(({ source: s }) => ({ id: s.id, name: s.name, covers: s.covers, homepage: s.homepage, docsUrl: s.docsUrl ?? null, termsUrl: s.termsUrl ?? null, license: s.license, attribution: s.attribution ?? null, kinds: s.kinds, region: s.region, cadence: s.cadence, needsKey: s.needsKey ?? null, enabled: s.enabled, notes: s.notes ?? null }))
    .sort((a, b) => a.name.localeCompare(b.name));
  let counts: Record<string, { open: number; forecasted: number; total: number; lastChecked: string | null; byType: Record<string, number>; programs: number }> = {};
  let funders: Record<string, number> = {};
  let awardRows = 0;
  let sizeMb: number | null = null;
  let measuredAt: string | null = null;
  let construction = { federal: 0, stateLocal: 0, international: 0 };
  if (databaseUrl()) {
    const sql = connect();
    try {
      const rows = await sql<{ source: string; type: string; open_count: string; forecasted_count: string; total_count: string; last_checked: Date | null; program_count: string }[]>`select * from catalog_public_stats()`;
      counts = {};
      for (const r of rows) {
        const c = (counts[r.source] ??= { open: 0, forecasted: 0, total: 0, lastChecked: null, byType: {}, programs: 0 });
        c.programs += Number(r.program_count);
        c.open += Number(r.open_count);
        c.forecasted += Number(r.forecasted_count);
        c.total += Number(r.total_count);
        c.byType[r.type] = (c.byType[r.type] ?? 0) + Number(r.open_count) + Number(r.forecasted_count);
        const lc = r.last_checked ? r.last_checked.toISOString() : null;
        if (lc && (!c.lastChecked || lc > c.lastChecked)) c.lastChecked = lc;
      }
      funders = Object.fromEntries((await sql<{ kind: string; funder_count: string }[]>`select * from catalog_public_funder_counts()`).map((r) => [r.kind, Number(r.funder_count)]));
      const aec = Object.fromEntries((await sql<{ scope: string; open_count: string }[]>`select * from catalog_public_construction_stats()`).map((r) => [r.scope, Number(r.open_count)]));
      construction = { federal: aec.federal ?? 0, stateLocal: aec.state_local ?? 0, international: aec.international ?? 0 };
      awardRows = Number((await sql<{ n: string }[]>`select count(*) as n from catalog_award_stats`)[0].n);
      sizeMb = Math.round(Number((await sql<{ b: string }[]>`select sum(pg_total_relation_size(c.oid)) as b from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind = 'r' and c.relname like 'catalog_%'`)[0].b) / 1048576);
      measuredAt = new Date().toISOString();
    } finally {
      await sql.end({ timeout: 5 });
    }
  }
  const out = { measuredAt, label: arg("label") ?? (measuredAt ? "a test load of the database" : null), sources, counts, funders, construction, awardRows, sizeMb };
  const file = path.join(process.cwd(), "src", "data", "catalog-snapshot.json");
  writeFileSync(file, `${JSON.stringify(out, null, 1)}\n`);
  const open = Object.values(counts).reduce((n, c) => n + c.open, 0);
  console.log(`Wrote ${file}: ${sources.length} sources, ${open} open opportunities, ${Object.values(funders).reduce((a, b) => a + b, 0)} funders, ${sizeMb ?? "?"} MB`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
