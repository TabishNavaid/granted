/**
 * The one interface every model call goes through. Swapping Gemini for
 * another provider means adding a file in this folder and changing index.ts.
 */

/** "lite" is the cheapest Flash-Lite class model (page cleanup, extraction). "standard" is a Flash class model (scoring, letters). */
export type ModelTier = "lite" | "standard";

/** A JSON Schema subset that every provider we care about accepts. */
export interface JsonSchema {
  type: "object" | "array" | "string" | "number" | "integer" | "boolean";
  description?: string;
  properties?: Record<string, JsonSchema>;
  required?: string[];
  items?: JsonSchema;
  enum?: string[];
  nullable?: boolean;
  minimum?: number;
  maximum?: number;
  minItems?: number;
  maxItems?: number;
}

export interface GenerateJsonRequest {
  tier: ModelTier;
  /** Standing instructions: who the model is and the rules it must follow. */
  system: string;
  /** The task and its inputs. */
  prompt: string;
  schema: JsonSchema;
  maxOutputTokens?: number;
  /** A short label for logs, e.g. "extract_profile". */
  label: string;
}

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  /** Reasoning tokens, billed as output. Included in outputTokens. */
  thoughtTokens: number;
}

export interface GenerateJsonResult<T> {
  data: T;
  model: string;
  usage: TokenUsage;
  costUsd: number;
  durationMs: number;
}

export interface AiProvider {
  readonly name: string;
  modelFor(tier: ModelTier): string;
  generateJson<T>(req: GenerateJsonRequest): Promise<GenerateJsonResult<T>>;
}

export class AiError extends Error {
  constructor(
    message: string,
    public readonly code: "rate_limited" | "no_key" | "bad_response" | "failed" | "not_recorded",
    public readonly retryAfterMs?: number,
  ) {
    super(message);
    this.name = "AiError";
  }
}
