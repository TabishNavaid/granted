/** Text helpers shared by the validators. Everything here is deterministic code, not a model call. */

/** Lowercase, straight quotes, single spaces, no leading or trailing space. */
export function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[‘’‚‛]/g, "'")
    .replace(/[“”„‟]/g, '"')
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** True when `needle` appears verbatim in `hay` after normalization. */
export function contains(hay: string, needle: string): boolean {
  const n = normalize(needle);
  if (!n) return false;
  return normalize(hay).includes(n);
}

/** Every number-like token in a string: 214, 1,900, $342,000, 94%, 2016, 1.5. Returned as written. */
export function numbersIn(s: string): string[] {
  const out: string[] = [];
  for (const m of s.matchAll(/\$?\d[\d,]*(?:\.\d+)?%?/g)) {
    const tok = m[0];
    // Skip stray punctuation-only matches and trailing commas.
    out.push(tok.replace(/,$/, ""));
  }
  return out;
}

/** "$342,000" and "342000" compare equal; "94%" and "94" compare equal. */
export function numberKey(tok: string): string {
  return tok.replace(/[$,%\s]/g, "").replace(/\.0+$/, "");
}

/** Does every number in `value` also appear in `excerpt`? Words like "sixty" are not checked. */
export function numbersCovered(value: string, excerpt: string): { ok: boolean; missing: string[] } {
  const have = new Set(numbersIn(excerpt).map(numberKey));
  // "342,118" in a source also covers "342,000"? No. Exact digits only; the model must quote the real figure.
  const missing = numbersIn(value)
    .map(numberKey)
    .filter((k) => k.length > 0 && !have.has(k));
  return { ok: missing.length === 0, missing };
}

export function truncate(s: string, n: number): string {
  return s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s;
}
