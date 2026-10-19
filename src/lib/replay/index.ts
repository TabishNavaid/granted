import { AiError, type AiProvider, type GenerateJsonRequest, type GenerateJsonResult, type ModelTier } from "@/lib/ai/types";
import type { CrawledPage, CrawlResult } from "@/lib/crawl";
import type { OpportunityDetail, SearchParams, SearchResponse } from "@/lib/grantsgov";
import type { Recording, RecordingId } from "./types";

export type { Recording, RecordingId } from "./types";

/**
 * Replay mode: the demo with no model key. The website reader, Grants.gov,
 * and the model answer from a recorded run of the sample organization the
 * visitor is looking at. Everything after them (the source check on every
 * fact, the eligibility filters, the check on every reason and citation, the
 * store, the activity log, the progress feed) is the live code.
 *
 * Set a GEMINI_API_KEY and all three go live again; nothing else changes.
 */
export { replayActive } from "./active";

/** REPLAY_SPEED=10 plays ten times faster (tests). Never slower than real time by default. */
function pace(ms: number): Promise<void> {
  const speed = Number(process.env.REPLAY_SPEED) || 1;
  const wait = Math.max(0, Math.round(ms / speed));
  return wait ? new Promise((r) => setTimeout(r, wait)) : Promise.resolve();
}

const loaders: Record<RecordingId, () => Promise<Recording>> = {
  youth: () => import("./recordings/youth").then((m) => m.recording),
  foodbank: () => import("./recordings/foodbank").then((m) => m.recording),
  clinic: () => import("./recordings/clinic").then((m) => m.recording),
};

export async function loadRecording(id: RecordingId): Promise<Recording> {
  return loaders[id]();
}

/** The recording for the workspace this request is looking at. */
export async function currentRecording(): Promise<Recording> {
  const [{ state }, { sampleById }] = await Promise.all([import("@/lib/services/mock"), import("@/lib/mock/samples")]);
  const sample = sampleById(state.org.id);
  return loadRecording(sample?.recording ?? "youth");
}

// ---------- Website reader ----------

function hostOf(url: string) {
  try {
    return new URL(/^https?:\/\//i.test(url) ? url : `https://${url}`).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return url.toLowerCase();
  }
}

/** Reads the recorded copy of the sample site, a page at a time. Refuses any other site rather than pretend to read it. */
export async function replayCrawl(input: string, opts: { onPage?: (page: CrawledPage, index: number) => void } = {}): Promise<CrawlResult> {
  const rec = await currentRecording();
  if (hostOf(input) !== hostOf(rec.site.homepage)) {
    const { CrawlError } = await import("@/lib/crawl");
    throw new CrawlError(`The demo can only read its sample sites, and ${hostOf(input)} is not one of them.`, "unreachable");
  }
  const pages: CrawledPage[] = [];
  for (const [i, p] of rec.site.pages.entries()) {
    // Fetching and cleaning a page took about a second live, PDFs longer.
    await pace((p.kind === "pdf" ? 2200 : 900) + ((p.text.length * 7) % 500));
    pages.push(p);
    opts.onPage?.(p, i);
  }
  return { homepage: rec.site.homepage, pages, skipped: rec.site.skipped };
}

// ---------- Grants.gov ----------

export async function replaySearch(params: SearchParams): Promise<SearchResponse> {
  const rec = await currentRecording();
  await pace(1000);
  const key = `${params.keyword}|${params.fundingCategories ?? ""}`;
  return rec.grantsgov.searches[key] ?? { hitCount: 0, oppHits: [] };
}

export async function replayFetchOpportunity(id: string | number): Promise<OpportunityDetail> {
  const rec = await currentRecording();
  await pace(1000);
  const d = rec.grantsgov.details[String(id)];
  if (!d) {
    const { GrantsGovError } = await import("@/lib/grantsgov");
    throw new GrantsGovError(`Notice ${id} is not in the recorded run.`);
  }
  return d;
}

// ---------- The model ----------

/** Fact ids as the prompt lists them: "- [fact_123] Label: value". */
function factsInPrompt(prompt: string): { id: string; label: string; value: string }[] {
  const out: { id: string; label: string; value: string }[] = [];
  for (const m of prompt.matchAll(/^- \[([^\]]+)\] ([^:\n]+): (.*)$/gm)) out.push({ id: m[1].trim(), label: m[2].trim(), value: m[3].replace(/\s+\(source says:.*$/, "").trim() });
  return out;
}

/** Answered questions as the redraft prompt lists them: "- [[gap:KEY]] -> [[fact:ID]] Label: value". */
function answersInPrompt(prompt: string): Map<string, { id: string; value: string }> {
  const out = new Map<string, { id: string; value: string }>();
  for (const m of prompt.matchAll(/^- \[\[gap:([^\]]+)\]\] -> \[\[fact:([^\]]+)\]\] [^:\n]+: (.*)$/gm)) out.set(m[1].trim(), { id: m[2].trim(), value: m[3].trim() });
  return out;
}

const norm = (s: string) => s.trim().toLowerCase();

export function fillPlaceholders(data: unknown, prompt: string): unknown {
  const facts = factsInPrompt(prompt);
  const answers = answersInPrompt(prompt);
  const fill = (s: string) =>
    s
      .replace(/\{\{fact:([^}=]+)(?:=([^}]+))?\}\}/g, (_m, label: string, value?: string) => {
        const hit = facts.find((f) => norm(f.label) === norm(label) && (!value || norm(f.value) === norm(value)));
        // A fact the visitor removed: leave a name the validators will not recognize.
        return hit?.id ?? `missing:${label}`;
      })
      .replace(/\{\{answer:([^}]+)\}\}/g, (_m, key: string) => answers.get(key.trim())?.id ?? `missing:${key}`)
      .replace(/\{\{value:([^}]+)\}\}/g, (_m, key: string) => answers.get(key.trim())?.value ?? "");
  const walk = (v: unknown): unknown => {
    if (typeof v === "string") return fill(v);
    if (Array.isArray(v)) return v.map(walk);
    if (v && typeof v === "object") return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, walk(x)]));
    return v;
  };
  return walk(data);
}

export const REPLAY_MODEL = "recorded run";

/** Answers model calls from the recording. Costs nothing and says so in the activity log. */
export class ReplayProvider implements AiProvider {
  readonly name = "replay";
  modelFor(_tier: ModelTier): string {
    void _tier;
    return REPLAY_MODEL;
  }
  async generateJson<T>(req: GenerateJsonRequest): Promise<GenerateJsonResult<T>> {
    const rec = await currentRecording();
    const call = rec.calls.find((c) => c.label === req.label && (!c.match || req.prompt.includes(c.match)));
    if (!call) throw new AiError(`The recorded demo has no ${req.label.replace(/_/g, " ")} for this.`, "not_recorded");
    const started = Date.now();
    await pace(call.durationMs);
    return { data: fillPlaceholders(structuredClone(call.data), req.prompt) as T, model: REPLAY_MODEL, usage: { inputTokens: 0, outputTokens: 0, thoughtTokens: 0 }, costUsd: 0, durationMs: Date.now() - started };
  }
}
