import { readRfp, type ParsedRequirement, type RfpPage } from "@/lib/bids/rfp";

/**
 * Comparing a FundFellows draft with the proposal that actually won, against the same solicitation.
 * Plain measures first, so the result does not depend on a model: how many of the solicitation's
 * requirements each document addresses, which ones the draft misses that the winner covered, structure,
 * specificity (numbers and named projects and people per thousand words), length against the page limit,
 * and word-sequence overlap. scripts/eval-drafts.ts adds a model-judged rubric when a key is set.
 */
const STOP = new Set("a an and are as at be by for from has have in into is it its of on or that the their this to was were will with shall must should may can not any all each other such than then there these those which who whom within without your our you we they them proposal offeror offerors contractor firm firms submit submitted provide provided include including required requirement requirements section page pages".split(" "));

export function words(text: string): string[] {
  return text.toLowerCase().replace(/[^a-z0-9$%.\s-]/g, " ").split(/\s+/).filter(Boolean);
}

/** Content words, lightly stemmed so "drawings" matches "drawing". */
export function terms(text: string): string[] {
  return words(text)
    .map((w) => w.replace(/[.-]+$/, ""))
    .filter((w) => w.length > 2 && !STOP.has(w) && !/^\d+$/.test(w))
    .map((w) => w.replace(/(ies)$/, "y").replace(/(es|s)$/, ""));
}

/**
 * A requirement is addressed when the document uses most of the terms in its opening clause (the requirement's
 * title), which carries its gist; incidental words later in the excerpt (names, addresses) are ignored. When the
 * title is too short, the excerpt's least common terms across the solicitation (`df`) fill in.
 */
export function addresses(req: Pick<ParsedRequirement, "title" | "excerpt">, docTerms: Set<string>, df?: Map<string, number>): boolean {
  const titleTerms = [...new Set(terms(req.title.replace(/^Selection criteria:\s*/i, "")))];
  let key = titleTerms;
  if (key.length < 3) {
    const rest = [...new Set(terms(req.excerpt))].filter((t) => !key.includes(t));
    key = [...key, ...(df ? rest.sort((a, b) => (df.get(a) ?? 0) - (df.get(b) ?? 0)) : rest).slice(0, 4 - key.length)];
  }
  if (!key.length) return false;
  const hit = key.filter((x) => docTerms.has(x)).length;
  return key.length <= 2 ? hit === key.length : hit / key.length >= 0.5;
}

/** Lines that look like headings: short, no final period, title case or numbered. */
export function headings(text: string): string[] {
  return text
    .split(/\n+/)
    .map((l) => l.trim())
    .filter((l) => l.length >= 3 && l.length <= 80 && !/[.:;,]$/.test(l) && (/^(\d+(\.\d+)*\.?|[A-Z]\.|[IVX]+\.)\s+\S/.test(l) || (/^[A-Z]/.test(l) && l.split(/\s+/).length <= 8 && l.split(/\s+/).filter((w) => /^[A-Z]/.test(w)).length >= Math.ceil(l.split(/\s+/).length * 0.6))));
}

export function specificity(text: string): { numbersPer1k: number; namesPer1k: number; words: number } {
  const w = words(text).length || 1;
  const numbers = (text.match(/\$?\d[\d,]*(\.\d+)?%?/g) ?? []).length;
  const names = (text.match(/\b[A-Z][a-z]+(?:\s+(?:of|the|and|de|for)?\s*[A-Z][a-z]+){1,4}\b/g) ?? []).length;
  return { numbersPer1k: Math.round((numbers / w) * 1000), namesPer1k: Math.round((names / w) * 1000), words: w };
}

/** ROUGE-L F1 over words: how much of one document's word order the other shares. Capped for speed. */
export function rougeL(a: string, b: string, cap = 2500): number {
  const x = terms(a).slice(0, cap);
  const y = terms(b).slice(0, cap);
  if (!x.length || !y.length) return 0;
  let prev = new Uint16Array(y.length + 1);
  for (let i = 1; i <= x.length; i++) {
    const cur = new Uint16Array(y.length + 1);
    for (let j = 1; j <= y.length; j++) cur[j] = x[i - 1] === y[j - 1] ? prev[j - 1] + 1 : Math.max(prev[j], cur[j - 1]);
    prev = cur;
  }
  const lcs = prev[y.length];
  const p = lcs / x.length;
  const r = lcs / y.length;
  return p + r ? Math.round(((2 * p * r) / (p + r)) * 1000) / 1000 : 0;
}

/** The page limit the solicitation states, if any. */
export function pageLimit(rfpText: string): number | null {
  const m = rfpText.match(/(?:limit(?:ed)?(?: of)?|not (?:to )?exceed|maximum of|no more than|up to)\s+(?:\w+\s+)?\(?(\d{1,3})\)?\s+(?:single-sided\s+|double-sided\s+)?pages?/i) ?? rfpText.match(/(\d{1,3})[- ]page (?:limit|maximum)/i);
  return m ? Number(m[1]) : null;
}

export interface Comparison {
  requirements: number;
  draftCovers: number;
  winnerCovers: number;
  /** Requirements the winner addressed and the draft did not: what to fix first. */
  missedByDraft: { ref: string; title: string }[];
  /** Requirements the draft addressed and the winner did not. */
  draftOnly: { ref: string; title: string }[];
  headings: { draft: string[]; winner: string[]; shared: number };
  specificity: { draft: ReturnType<typeof specificity>; winner: ReturnType<typeof specificity> };
  pages: { limit: number | null; draftEstimate: number; winnerEstimate: number };
  overlap: number;
}

const estPages = (w: number) => Math.round((w / 500) * 10) / 10;

export function compare(input: { rfpPages: RfpPage[]; draft: string; winner: string }): Comparison {
  const rfp = readRfp(input.rfpPages);
  const reqs = rfp.requirements.filter((r) => r.kind !== "submission" || r.mandatory);
  const dT = new Set(terms(input.draft));
  const wT = new Set(terms(input.winner));
  const df = new Map<string, number>();
  for (const r of reqs) for (const t of new Set(terms(`${r.title} ${r.excerpt}`))) df.set(t, (df.get(t) ?? 0) + 1);
  const d = reqs.map((r) => addresses(r, dT, df));
  const w = reqs.map((r) => addresses(r, wT, df));
  const dh = headings(input.draft);
  const wh = headings(input.winner);
  const norm = (h: string) => terms(h).join(" ");
  const whSet = new Set(wh.map(norm));
  const ds = specificity(input.draft);
  const ws = specificity(input.winner);
  return {
    requirements: reqs.length,
    draftCovers: d.filter(Boolean).length,
    winnerCovers: w.filter(Boolean).length,
    missedByDraft: reqs.filter((_, i) => w[i] && !d[i]).map((r) => ({ ref: r.ref, title: r.title })),
    draftOnly: reqs.filter((_, i) => d[i] && !w[i]).map((r) => ({ ref: r.ref, title: r.title })),
    headings: { draft: dh, winner: wh, shared: dh.filter((h) => whSet.has(norm(h))).length },
    specificity: { draft: ds, winner: ws },
    pages: { limit: pageLimit(input.rfpPages.map((p) => p.text).join("\n")), draftEstimate: estPages(ds.words), winnerEstimate: estPages(ws.words) },
    overlap: rougeL(input.draft, input.winner),
  };
}
