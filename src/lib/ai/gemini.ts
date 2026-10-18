import { GoogleGenAI, ThinkingLevel } from "@google/genai";
import { AiError, type AiProvider, type GenerateJsonRequest, type GenerateJsonResult, type JsonSchema, type ModelTier } from "./types";
import { estimateCostUsd } from "./pricing";

/**
 * Gemini through Google's official Gen AI SDK for JavaScript (@google/genai).
 *
 * Model choice, per the pricing page on 2026-10-18:
 *  - lite:     gemini-3.1-flash-lite, the cheapest Flash-Lite model open to new keys
 *              (gemini-2.5-flash-lite is cheaper but limited to keys that used it before).
 *  - standard: gemini-3.8-flash, the current Flash model, same price as 3.6 Flash.
 * Both can be overridden with GEMINI_LITE_MODEL and GEMINI_STANDARD_MODEL.
 */
const DEFAULT_MODELS: Record<ModelTier, string> = {
  lite: "gemini-3.1-flash-lite",
  standard: "gemini-3.8-flash",
};

const RETRY_DELAYS_MS = [4_000, 12_000, 30_000];

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

/** Strip keys Gemini's schema subset does not accept and keep the rest. */
function toGeminiSchema(schema: JsonSchema): Record<string, unknown> {
  const out: Record<string, unknown> = { type: schema.type.toUpperCase() };
  if (schema.description) out.description = schema.description;
  if (schema.nullable) out.nullable = true;
  if (schema.enum) out.enum = schema.enum;
  if (schema.minimum != null) out.minimum = schema.minimum;
  if (schema.maximum != null) out.maximum = schema.maximum;
  if (schema.minItems != null) out.minItems = schema.minItems;
  if (schema.maxItems != null) out.maxItems = schema.maxItems;
  if (schema.items) out.items = toGeminiSchema(schema.items);
  if (schema.properties) {
    out.properties = Object.fromEntries(Object.entries(schema.properties).map(([k, v]) => [k, toGeminiSchema(v)]));
    // Gemini honors property ordering; keep the order we wrote.
    out.propertyOrdering = Object.keys(schema.properties);
  }
  if (schema.required) out.required = schema.required;
  return out;
}

function retryAfterFromError(err: unknown): number | undefined {
  const msg = err instanceof Error ? err.message : String(err);
  const m = msg.match(/retry(?:Delay|.after)?["':\s]*([0-9.]+)s/i);
  if (m) return Math.ceil(parseFloat(m[1]) * 1000);
  return undefined;
}

function isRateLimit(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  const status = (err as { status?: number; code?: number })?.status ?? (err as { code?: number })?.code;
  return status === 429 || /\b429\b|RESOURCE_EXHAUSTED|rate limit|quota/i.test(msg);
}

export class GeminiProvider implements AiProvider {
  readonly name = "gemini";
  private client: GoogleGenAI | null = null;

  constructor(private readonly apiKey: string | undefined) {}

  modelFor(tier: ModelTier): string {
    const env = tier === "lite" ? process.env.GEMINI_LITE_MODEL : process.env.GEMINI_STANDARD_MODEL;
    return env?.trim() || DEFAULT_MODELS[tier];
  }

  private ai(): GoogleGenAI {
    if (!this.apiKey) throw new AiError("GEMINI_API_KEY is not set.", "no_key");
    if (!this.client) this.client = new GoogleGenAI({ apiKey: this.apiKey });
    return this.client;
  }

  async generateJson<T>(req: GenerateJsonRequest): Promise<GenerateJsonResult<T>> {
    const model = this.modelFor(req.tier);
    const ai = this.ai();
    const started = Date.now();
    let lastErr: unknown;
    for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
      try {
        const response = await ai.models.generateContent({
          model,
          contents: req.prompt,
          config: {
            systemInstruction: req.system,
            responseMimeType: "application/json",
            responseSchema: toGeminiSchema(req.schema),
            maxOutputTokens: req.maxOutputTokens ?? 8192,
            // Extraction needs little reasoning; scoring and writing get the model's default.
            thinkingConfig: req.tier === "lite" ? { thinkingLevel: ThinkingLevel.LOW } : undefined,
          },
        });
        const text = response.text;
        if (!text) throw new AiError(`Empty response from ${model} for ${req.label}.`, "bad_response");
        let data: T;
        try {
          data = JSON.parse(text) as T;
        } catch {
          throw new AiError(`Could not parse JSON from ${model} for ${req.label}.`, "bad_response");
        }
        const u = response.usageMetadata;
        const inputTokens = u?.promptTokenCount ?? 0;
        const thoughtTokens = u?.thoughtsTokenCount ?? 0;
        const outputTokens = (u?.candidatesTokenCount ?? 0) + thoughtTokens;
        return {
          data,
          model,
          usage: { inputTokens, outputTokens, thoughtTokens },
          costUsd: estimateCostUsd(model, inputTokens, outputTokens),
          durationMs: Date.now() - started,
        };
      } catch (err) {
        lastErr = err;
        if (err instanceof AiError && err.code === "bad_response" && attempt < 1) continue; // one re-ask for malformed JSON
        if (isRateLimit(err) && attempt < RETRY_DELAYS_MS.length) {
          await sleep(retryAfterFromError(err) ?? RETRY_DELAYS_MS[attempt]);
          continue;
        }
        break;
      }
    }
    if (lastErr instanceof AiError) throw lastErr;
    if (isRateLimit(lastErr)) throw new AiError("The model is rate limited right now.", "rate_limited", retryAfterFromError(lastErr));
    throw new AiError(lastErr instanceof Error ? lastErr.message : String(lastErr), "failed");
  }
}
