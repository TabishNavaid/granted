/**
 * Published Gemini API prices in USD per 1M tokens, standard (non-batch) tier,
 * read from https://ai.google.dev/gemini-api/docs/pricing on 2026-10-18.
 * Output prices include thinking tokens. Update this table when prices change;
 * every agent_runs row records the cost computed from it at the time.
 */
export interface ModelPrice {
  inputPerM: number;
  outputPerM: number;
  /** When the listed price stops applying, if the page gives a date. */
  until?: string;
  note?: string;
}

export const GEMINI_PRICES: Record<string, ModelPrice> = {
  "gemini-3.8-flash": { inputPerM: 0.75, outputPerM: 3.75, until: "2026-12-31", note: "Rises to 1.50 / 7.50 on 2027-01-01" },
  "gemini-3.6-flash": { inputPerM: 0.75, outputPerM: 3.75, until: "2026-12-31", note: "Rises to 1.50 / 7.50 on 2027-01-01" },
  "gemini-3-flash-preview": { inputPerM: 0.5, outputPerM: 3.0 },
  "gemini-2.5-flash": { inputPerM: 0.3, outputPerM: 2.5, note: "Limited access: only for keys that used it before" },
  "gemini-3.5-flash-lite": { inputPerM: 0.3, outputPerM: 2.5 },
  "gemini-3.1-flash-lite": { inputPerM: 0.25, outputPerM: 1.5 },
  "gemini-2.5-flash-lite": { inputPerM: 0.1, outputPerM: 0.4, note: "Limited access: only for keys that used it before" },
};

export function estimateCostUsd(model: string, inputTokens: number, outputTokens: number): number {
  const price = GEMINI_PRICES[model];
  if (!price) return 0;
  const cost = (inputTokens / 1_000_000) * price.inputPerM + (outputTokens / 1_000_000) * price.outputPerM;
  return Math.round(cost * 1_000_000) / 1_000_000;
}
