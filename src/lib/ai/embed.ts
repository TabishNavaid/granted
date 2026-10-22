import { GoogleGenAI } from "@google/genai";
import { AiError } from "./types";

/**
 * Text embeddings for semantic matching over the opportunity database. Gemini's embedding model, 768 dimensions
 * (the column in migration 0006). gemini-embedding-2 takes no task type; instead documents and queries carry the
 * prefixes Google documents for retrieval. Without GEMINI_API_KEY nothing here is called and search stays full text.
 */
export const EMBEDDING_DIMENSIONS = 768;
/** Paid tier, USD per 1M input tokens, from https://ai.google.dev/gemini-api/docs/pricing on 2026-10-22. */
export const EMBEDDING_PRICE_PER_M = 0.2;

export function embeddingModel(): string {
  return process.env.GEMINI_EMBEDDING_MODEL?.trim() || "gemini-embedding-2";
}

export function documentText(title: string, body: string | null | undefined): string {
  return `title: ${title.trim() || "none"} | text: ${(body ?? "").replace(/\s+/g, " ").trim().slice(0, 6000)}`;
}

export function queryText(q: string): string {
  return `task: search result | query: ${q.replace(/\s+/g, " ").trim()}`;
}

/** A rough token count for cost logging; the API does not return one for embeddings. */
export function approxTokens(texts: string[]): number {
  return Math.ceil(texts.reduce((n, t) => n + t.length, 0) / 4);
}

export type Embedder = (texts: string[]) => Promise<number[][]>;

let client: GoogleGenAI | null = null;

/** Embed up to 100 texts in one request. */
export const geminiEmbedder: Embedder = async (texts) => {
  const key = process.env.GEMINI_API_KEY?.trim();
  if (!key) throw new AiError("GEMINI_API_KEY is not set.", "no_key");
  client ??= new GoogleGenAI({ apiKey: key });
  const res = await client.models.embedContent({ model: embeddingModel(), contents: texts, config: { outputDimensionality: EMBEDDING_DIMENSIONS } });
  const out = (res.embeddings ?? []).map((e) => e.values ?? []);
  if (out.length !== texts.length || out.some((v) => v.length !== EMBEDDING_DIMENSIONS)) throw new AiError("The embedding response did not match the request.", "bad_response");
  return out;
};

/** pgvector's text form. */
export function toVector(v: number[]): string {
  return `[${v.map((x) => (Number.isFinite(x) ? x.toFixed(6) : "0")).join(",")}]`;
}
