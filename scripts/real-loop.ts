/**
 * Run the real loop from the command line for one or more websites and print
 * a Markdown report. Needs GEMINI_API_KEY in .env.local (Grants.gov needs no key).
 *
 *   npm run loop -- riverbendyouth.org otherorg.org
 *   npm run loop -- --no-ai riverbendyouth.org     # crawl and Grants.gov only, no model calls
 */
import { readFileSync } from "node:fs";
import path from "node:path";

function loadEnv() {
  for (const file of [".env.local", ".env"]) {
    try {
      for (const line of readFileSync(path.join(process.cwd(), file), "utf8").split("\n")) {
        const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
        if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
      }
    } catch {
      // no file
    }
  }
}
loadEnv();
process.env.DEMO_MODE = "true";

async function main() {
  const args = process.argv.slice(2);
  const noAi = args.includes("--no-ai");
  const sites = args.filter((a) => !a.startsWith("--"));
  if (!sites.length) {
    console.error("Usage: npm run loop -- <website> [more websites] [--no-ai]");
    process.exit(1);
  }
  const { crawlSite } = await import("@/lib/crawl");
  const gg = await import("@/lib/grantsgov");
  if (noAi || !process.env.GEMINI_API_KEY) {
    if (!noAi) console.error("GEMINI_API_KEY is not set, so only the crawl and the Grants.gov search run.\n");
    for (const site of sites) {
      const t = Date.now();
      const crawl = await crawlSite(site);
      console.log(`## ${site}\n\nCrawled ${crawl.pages.length} pages in ${((Date.now() - t) / 1000).toFixed(1)}s:`);
      for (const p of crawl.pages) console.log(`- ${p.kind} ${p.url} (${p.text.length} chars)`);
      for (const s of crawl.skipped) console.log(`- skipped ${s.url}: ${s.reason}`);
      const { result } = await gg.search({ keyword: "youth", eligibilities: gg.ELIGIBILITY.nonprofit501c3, rows: 5 });
      console.log(`\nGrants.gov reachable: ${result.hitCount} hits for "youth" open to 501(c)(3)s.\n`);
    }
    return;
  }

  const { memoryStore } = await import("@/lib/loop/memory-store");
  const { buildProfile, confirmProfile, findMatches, draftLetterFor } = await import("@/lib/loop");
  const { state } = await import("@/lib/services/mock");
  const { mockServices } = await import("@/lib/services/mock");

  for (const site of sites) {
    const started = Date.now();
    console.log(`\n## ${site}\n`);
    const p = await buildProfile(memoryStore, { websiteUrl: site, ein: null });
    if (!p.ok) {
      console.log(`Profile failed: ${p.error}`);
      continue;
    }
    const org = await memoryStore.getOrg();
    const facts = await memoryStore.listFacts();
    console.log(`**${org.name}**. ${org.mission}\n`);
    console.log(`Pages read: ${p.data.pageCount}. Facts extracted: ${p.data.factCount}. Dropped by the source check: ${p.data.droppedCount}.\n`);
    console.log("| Fact | Value | Source | Passage |\n| --- | --- | --- | --- |");
    for (const f of facts) console.log(`| ${f.label} | ${f.value} | ${f.sourceLabel ?? ""} | ${f.sourceExcerpt.replace(/\|/g, "/").slice(0, 140)} |`);

    // Confirm everything, as a director who trusts the chips would.
    await confirmProfile(memoryStore, { keptFactIds: facts.map((f) => f.id), factEdits: {}, org: {} });
    const m = await findMatches(memoryStore);
    if (!m.ok) {
      console.log(`\nMatches failed: ${m.error}`);
      continue;
    }
    const matches = await mockServices.opportunities.listMatches();
    console.log(`\nScreened ${m.data.screened} notices, read ${m.data.read} in full, kept ${m.data.matchCount}.\n`);
    for (const match of matches.slice(0, 5)) {
      console.log(`### ${match.fitScore} ${match.opportunity.title}\n${match.funder.name}. ${match.opportunity.forecasted ? "Forecasted." : "Posted."} Deadline ${match.opportunity.deadline ?? "none"}. Award ${match.opportunity.amountMin ?? "?"} to ${match.opportunity.amountMax ?? "?"}. ${match.opportunity.sourceUrl}`);
      for (const r of match.reasons) console.log(`- ${r}`);
      for (const c of match.cautions) console.log(`- Caution: ${c}`);
      console.log("");
    }

    if (matches[0]) {
      const app = await mockServices.opportunities.startApplication(matches[0].opportunity.id);
      const l = await draftLetterFor(memoryStore, app.id);
      if (!l.ok) console.log(`Letter failed: ${l.error}`);
      else {
        console.log(`### Letter (${l.data.wordCount} words, ${l.data.openQuestions} open questions, ${l.data.issues} validation issues)\n`);
        const sections = await memoryStore.listSections(app.id);
        const mfs = await memoryStore.listMissingFacts(app.id);
        for (const s of sections) {
          const text = s.bodyHtml
            .replace(/<span data-citation="([^"]+)"[^>]*><\/span>/g, (_x, id) => ` [${facts.find((f) => f.id === id)?.label ?? id}]`)
            .replace(/<span data-gap="([^"]+)"[^>]*><\/span>/g, (_x, id) => ` {NEED: ${mfs.find((q) => q.id === id)?.suggestedLabel ?? id}}`)
            .replace(/<[^>]+>/g, "")
            .replace(/&amp;/g, "&");
          console.log(`**${s.title}**\n\n${text}\n`);
        }
        if (mfs.length) {
          console.log("Questions raised:");
          for (const q of mfs) console.log(`- ${q.question}`);
        }
      }
    }
    const runs = state.runs.filter((r) => r.orgId === org.id && r.startedAt >= new Date(started).toISOString());
    const cost = runs.reduce((s, r) => s + r.costUsd, 0);
    const tin = runs.reduce((s, r) => s + r.tokensIn, 0);
    const tout = runs.reduce((s, r) => s + r.tokensOut, 0);
    console.log(`\nTotal time ${((Date.now() - started) / 1000).toFixed(0)}s. Tokens in ${tin}, out ${tout}. Estimated cost $${cost.toFixed(4)} across ${runs.length} runs.`);
    for (const r of runs) console.log(`- ${r.agent}: ${r.title}: ${r.status}, $${r.costUsd.toFixed(4)}, ${r.toolsCalled.map((t) => `${t.name} (${t.summary})`).join("; ")}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
