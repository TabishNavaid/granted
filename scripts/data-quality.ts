/**
 * Data checks for the opportunity database. Prints a Markdown report (and writes it with --out FILE):
 * open rows per source and type, the share with a usable deadline and a well-formed link, a polite live check of a
 * sample of links per source, the duplicate rate, and search speed on representative queries.
 *
 *   npx tsx --tsconfig tsconfig.json scripts/data-quality.ts --env .env.localdb --out docs/data-quality-report.md [--links 4]
 */
import { existsSync, writeFileSync } from "node:fs";
import { connect } from "@/lib/catalog/ingest/store";
import { makePoliteFetch } from "@/lib/catalog/ingest/http";

const arg = (n: string) => {
  const i = process.argv.indexOf(`--${n}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
};

async function main() {
  const env = arg("env");
  if (env && existsSync(env)) process.loadEnvFile(env);
  const sql = connect();
  const out: string[] = [`# Opportunity database: data checks`, "", `Run ${new Date().toISOString().slice(0, 16).replace("T", " ")} UTC against ${env ?? "DATABASE_URL"}.`, ""];
  try {
    const rows = await sql<{ source: string; type: string; live: string; dated: string; rolling: string; worded: string; link_ok: string; funder: string; total: string }[]>`
      select source, type,
        count(*) filter (where status in ('open','forecasted') and duplicate_of is null and coalesce(notice_type,'') <> 'program') as live,
        count(*) filter (where status in ('open','forecasted') and duplicate_of is null and close_at is not null) as dated,
        count(*) filter (where status in ('open','forecasted') and duplicate_of is null and rolling) as rolling,
        count(*) filter (where status in ('open','forecasted') and duplicate_of is null and close_at is null and not rolling and close_text is not null) as worded,
        count(*) filter (where source_url ~ '^https://[^ ]+$') as link_ok,
        count(*) filter (where funder_id is not null) as funder,
        count(*) as total
      from catalog_opportunities group by 1, 2 order by 1, 2`;
    out.push("## Rows by source and type", "", "Live means open or announced, not a duplicate of another source's row, and not a program listing. A usable deadline is a date, a rolling window, or a deadline the source states in words.", "");
    out.push("| Source | Type | Live | Dated | Rolling | In words | Usable deadline | Well-formed link | Has funder | Total rows |", "| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |");
    let live = 0;
    let usable = 0;
    for (const r of rows) {
      const l = Number(r.live);
      const u = Number(r.dated) + Number(r.rolling) + Number(r.worded);
      live += l;
      usable += Math.min(u, l);
      const pct = (n: number, d: number) => (d ? `${Math.round((n / d) * 100)}%` : "");
      out.push(`| ${r.source} | ${r.type} | ${l} | ${r.dated} | ${r.rolling} | ${r.worded} | ${pct(Math.min(u, l), l)} | ${pct(Number(r.link_ok), Number(r.total))} | ${pct(Number(r.funder), Number(r.total))} | ${r.total} |`);
    }
    out.push("", `All sources: ${live} live rows, ${live ? Math.round((usable / live) * 100) : 0}% with a usable deadline.`, "");

    const [d] = await sql<{ dups: string; keyed: string; total: string; groups: string }[]>`
      select count(*) filter (where duplicate_of is not null) as dups, count(*) filter (where canonical_key is not null) as keyed, count(*) as total,
        (select count(*) from (select canonical_key from catalog_opportunities where canonical_key is not null group by 1 having count(*) > 1) g) as groups
      from catalog_opportunities`;
    out.push("## Duplicates", "", `${d.dups} of ${d.total} rows (${((Number(d.dups) / Number(d.total)) * 100).toFixed(1)}%) are the same opportunity listed by a second source, in ${d.groups} groups. Search shows only the primary row of each group, with the others listed on it.`, "");
    const pairs = await sql<{ a: string; b: string; n: string }[]>`
      select p.source as a, d.source as b, count(*) as n from catalog_opportunities d join catalog_opportunities p on p.id = d.duplicate_of group by 1, 2 order by 3 desc limit 12`;
    if (pairs.length) out.push("| Primary source | Also listed on | Rows |", "| --- | --- | ---: |", ...pairs.map((p) => `| ${p.a} | ${p.b} | ${p.n} |`), "");

    out.push("## Search speed", "", "Each query runs `catalog_search` five times; the table shows the median.", "", "| Query | Rows | Median ms |", "| --- | ---: | ---: |");
    const queries: [string, () => Promise<{ total?: string }[]>][] = [
      ["Nonprofit: youth or mentoring, open to 501(c)(3)", () => sql`select total from catalog_search(q => 'youth or mentoring', eligibility => array['nonprofit'], lim => 25)`],
      ["Firm: NAICS 2362 in Texas", () => sql`select total from catalog_search(types => array['contract'], naics_prefixes => array['2362'], states => array['TX'], lim => 25)`],
      ["Firm: SDVOSB set-aside, architecture", () => sql`select total from catalog_search(q => 'architect or architectural', types => array['contract'], set_asides => array['Service-disabled veteran-owned small business'], lim => 25)`],
      ["Research: cancer, NIH and NSF", () => sql`select total from catalog_search(q => 'cancer', types => array['research'], lim => 25)`],
      ["Scholarships: engineering", () => sql`select total from catalog_search(q => 'engineering', types => array['scholarship'], lim => 25)`],
      ["Everything closing in 30 days", () => sql`select total from catalog_search(closes_before => now() + interval '30 days', include_rolling => false, lim => 25)`],
    ];
    for (const [label, q] of queries) {
      const times: number[] = [];
      let total = "0";
      for (let i = 0; i < 5; i++) {
        const t = performance.now();
        const r = await q();
        times.push(performance.now() - t);
        total = r[0]?.total ?? "0";
      }
      times.sort((a, b) => a - b);
      out.push(`| ${label} | ${total} | ${times[2].toFixed(0)} |`);
    }
    out.push("");

    const perSource = Number(arg("links") ?? 0);
    if (perSource > 0) {
      const f = makePoliteFetch();
      out.push("## Links, checked live", "", `${perSource} random live rows per source, fetched politely (GET, our user agent, robots.txt honored). Some official sites are single-page apps that answer 200 for any address, so a 200 there proves less than it seems; those are marked.`, "", "| Source | Checked | Answered 2xx or 3xx | Notes |", "| --- | ---: | ---: | --- |");
      const sources = await sql<{ source: string }[]>`select distinct source from catalog_opportunities where status in ('open','forecasted')`;
      for (const { source } of sources) {
        const sample = await sql<{ source_url: string }[]>`select source_url from catalog_opportunities where source = ${source} and status in ('open','forecasted') order by random() limit ${perSource}`;
        let ok = 0;
        const notes: string[] = [];
        for (const { source_url } of sample) {
          try {
            const res = await f(source_url, { retries: 1, timeoutMs: 20_000, redirect: "manual" });
            if (res.status < 400) ok++;
            else notes.push(String(res.status));
            await res.body?.cancel().catch(() => undefined);
          } catch (err) {
            notes.push(err instanceof Error ? err.message.slice(0, 60) : "error");
          }
        }
        if (/sam_/.test(source)) notes.push("single-page app");
        out.push(`| ${source} | ${sample.length} | ${ok} | ${[...new Set(notes)].join("; ")} |`);
      }
      out.push("");
    }

    const sizes = await sql<{ relname: string; total: string }[]>`select c.relname, pg_size_pretty(pg_total_relation_size(c.oid)) as total from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind = 'r' and c.relname like 'catalog%' order by pg_total_relation_size(c.oid) desc`;
    const [db] = await sql<{ size: string }[]>`select pg_size_pretty(pg_database_size(current_database())) as size`;
    out.push("## Size", "", `Database: ${db.size}.`, "", ...sizes.map((s) => `- ${s.relname}: ${s.total}`), "");
  } finally {
    await sql.end({ timeout: 5 });
  }
  const text = out.join("\n");
  const file = arg("out");
  if (file) writeFileSync(file, text);
  console.log(text);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
