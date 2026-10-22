import { approxTokens, documentText, EMBEDDING_PRICE_PER_M, toVector, type Embedder } from "@/lib/ai/embed";
import type { Sql } from "./store";

/**
 * Fill in embeddings for live opportunities that have none (new rows, or rows whose title or summary changed,
 * which the store clears). Runs after ingestion when GEMINI_API_KEY is set. Capped per run so a big backfill is
 * spread over several days of jobs; the cost is logged.
 */
export async function embedMissing(sql: Sql, embed: Embedder, opts: { max?: number; batch?: number; source?: string; log?: (m: string) => void } = {}): Promise<{ embedded: number; costUsd: number }> {
  const max = opts.max ?? Number(process.env.CATALOG_EMBED_MAX ?? 3000);
  const batch = opts.batch ?? 50;
  let embedded = 0;
  let tokens = 0;
  while (embedded < max) {
    const rows = await sql<{ id: string; title: string; summary: string | null; funder_name: string | null }[]>`
      select id, title, summary, funder_name from catalog_opportunities
      where embedding is null and duplicate_of is null and status in ('open', 'forecasted')${opts.source ? sql` and source = ${opts.source}` : sql``}
      order by first_seen desc limit ${Math.min(batch, max - embedded)}`;
    if (!rows.length) break;
    const texts = rows.map((r) => documentText(r.title, [r.funder_name, r.summary].filter(Boolean).join(". ")));
    const vectors = await embed(texts);
    tokens += approxTokens(texts);
    for (let i = 0; i < rows.length; i++) await sql`update catalog_opportunities set embedding = ${toVector(vectors[i])}::vector where id = ${rows[i].id}`;
    embedded += rows.length;
  }
  const costUsd = Math.round((tokens / 1_000_000) * EMBEDDING_PRICE_PER_M * 10_000) / 10_000;
  opts.log?.(`embedded ${embedded} opportunities, about ${tokens} tokens, about $${costUsd}`);
  return { embedded, costUsd };
}
