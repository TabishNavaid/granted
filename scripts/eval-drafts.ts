/**
 * Compare FundFellows drafts with the design partner's real winning proposals.
 *
 *   npx tsx --tsconfig tsconfig.json scripts/eval-drafts.ts eval/        (writes eval/report-YYYY-MM-DD.md)
 *
 * Layout: one folder per case under the given directory (keep it out of git; eval/ is ignored):
 *   eval/<case>/rfp.pdf|docx|txt       the solicitation as issued
 *   eval/<case>/winning.pdf|docx|txt   the proposal that won
 *   eval/<case>/draft.docx|pdf|txt     the FundFellows draft for the same solicitation (exported from the bid page)
 *
 * Plain measures always run (src/lib/eval/compare.ts). With GEMINI_API_KEY set, a model also scores both against
 * the solicitation's evaluation criteria, quoting evidence for each score. Nothing leaves this machine otherwise.
 */
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { compare, type Comparison } from "@/lib/eval/compare";
import { fileToText } from "@/lib/loop/documents";

async function textOf(dir: string, base: string): Promise<{ text: string; pages: { page: number; text: string }[]; file: string } | null> {
  for (const ext of ["pdf", "docx", "txt", "md"]) {
    const file = path.join(dir, `${base}.${ext}`);
    if (!existsSync(file)) continue;
    const buf = readFileSync(file);
    if (ext === "pdf") {
      const { pdfPages } = await import("@/lib/crawl");
      const pages = await pdfPages(buf, { pages: 200 });
      return { text: pages.map((p) => p.text).join("\n"), pages, file };
    }
    const r = await fileToText(buf, ext === "docx" ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document" : "text/plain", file);
    if (!r.ok) throw new Error(`${file}: ${r.message}`);
    return { text: r.text, pages: [{ page: 1, text: r.text }], file };
  }
  return null;
}

async function rubric(rfp: string, draft: string, winner: string): Promise<string | null> {
  if (!process.env.GEMINI_API_KEY) return null;
  const { getAi } = await import("@/lib/ai");
  const r = await getAi().generateJson<{ criteria: { criterion: string; draft: number; winner: number; draftEvidence: string; winnerEvidence: string; gap: string }[] }>({
    tier: "standard",
    label: "eval_rubric",
    system: "You are a source selection evaluator for a public agency. Using only the evaluation criteria stated in the solicitation, score each proposal from 1 to 5 per criterion. Quote a short phrase from each proposal as evidence. Name the single most important gap in the draft for each criterion. Do not reward length.",
    prompt: `SOLICITATION:\n${rfp.slice(0, 40_000)}\n\nPROPOSAL A (draft):\n${draft.slice(0, 30_000)}\n\nPROPOSAL B (winner):\n${winner.slice(0, 30_000)}`,
    schema: { type: "object", properties: { criteria: { type: "array", items: { type: "object", properties: { criterion: { type: "string" }, draft: { type: "number" }, winner: { type: "number" }, draftEvidence: { type: "string" }, winnerEvidence: { type: "string" }, gap: { type: "string" } }, required: ["criterion", "draft", "winner", "draftEvidence", "winnerEvidence", "gap"] } } }, required: ["criteria"] },
    maxOutputTokens: 4096,
  });
  return ["| Criterion | Draft | Winner | Gap in the draft |", "| --- | --- | --- | --- |", ...r.data.criteria.map((c) => `| ${c.criterion} | ${c.draft} | ${c.winner} | ${c.gap.replace(/\|/g, "/")} |`), "", `Model cost: $${r.costUsd.toFixed(4)}`].join("\n");
}

function section(name: string, c: Comparison, extra: string | null): string {
  const pct = (n: number) => (c.requirements ? `${Math.round((n / c.requirements) * 100)}%` : "n/a");
  return [
    `## ${name}`,
    "",
    `| Measure | Draft | Winner |`,
    `| --- | --- | --- |`,
    `| Requirements addressed (of ${c.requirements}) | ${c.draftCovers} (${pct(c.draftCovers)}) | ${c.winnerCovers} (${pct(c.winnerCovers)}) |`,
    `| Words | ${c.specificity.draft.words} | ${c.specificity.winner.words} |`,
    `| Estimated pages${c.pages.limit ? ` (limit ${c.pages.limit})` : ""} | ${c.pages.draftEstimate} | ${c.pages.winnerEstimate} |`,
    `| Numbers per 1,000 words | ${c.specificity.draft.numbersPer1k} | ${c.specificity.winner.numbersPer1k} |`,
    `| Named things per 1,000 words | ${c.specificity.draft.namesPer1k} | ${c.specificity.winner.namesPer1k} |`,
    `| Headings | ${c.headings.draft.length} | ${c.headings.winner.length} (${c.headings.shared} shared) |`,
    "",
    `Word-sequence overlap (ROUGE-L F1): ${c.overlap}. Higher is not always better: the goal is the winner's coverage and specificity, not its words.`,
    "",
    c.missedByDraft.length ? `Addressed by the winner, missed by the draft:\n${c.missedByDraft.map((r) => `- ${r.ref}: ${r.title}`).join("\n")}` : "The draft addresses every requirement the winner addressed.",
    "",
    c.draftOnly.length ? `Addressed by the draft only:\n${c.draftOnly.map((r) => `- ${r.ref}: ${r.title}`).join("\n")}` : "",
    "",
    extra ? `### Model-judged rubric\n\n${extra}` : "",
    "",
  ].join("\n");
}

async function main() {
  const root = process.argv[2] ?? "eval";
  if (!existsSync(root)) throw new Error(`No folder ${root}. See the comment at the top of this script for the layout.`);
  const cases = readdirSync(root).filter((d) => statSync(path.join(root, d)).isDirectory());
  const parts: string[] = [`# Draft evaluation, ${new Date().toISOString().slice(0, 10)}`, "", `${cases.length} case${cases.length === 1 ? "" : "s"} in ${root}.`, ""];
  for (const c of cases) {
    const dir = path.join(root, c);
    const [rfp, winner, draft] = await Promise.all([textOf(dir, "rfp"), textOf(dir, "winning"), textOf(dir, "draft")]);
    if (!rfp || !winner || !draft) {
      parts.push(`## ${c}`, "", `Skipped: needs rfp, winning, and draft files (found ${[rfp && "rfp", winner && "winning", draft && "draft"].filter(Boolean).join(", ") || "none"}).`, "");
      continue;
    }
    const cmp = compare({ rfpPages: rfp.pages, draft: draft.text, winner: winner.text });
    parts.push(section(c, cmp, await rubric(rfp.text, draft.text, winner.text).catch((e) => `Rubric failed: ${e instanceof Error ? e.message : e}`)));
    console.log(`${c}: draft ${cmp.draftCovers}/${cmp.requirements}, winner ${cmp.winnerCovers}/${cmp.requirements}`);
  }
  const out = path.join(root, `report-${new Date().toISOString().slice(0, 10)}.md`);
  writeFileSync(out, parts.join("\n"));
  console.log(`Wrote ${out}`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
