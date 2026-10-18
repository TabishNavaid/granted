import type { AgentName, AgentRun, SourceUsed, ToolCall } from "@/lib/types";
import type { TokenUsage } from "@/lib/ai";
import type { LoopStore } from "./store";

/**
 * Every agent call lands in agent_runs: what it read, which tools it called,
 * how many tokens it used, and what it cost. A failure is recorded too, with
 * the error, so the Activity log never has a hole.
 */
export interface RunOutcome<T> {
  output: T;
  summary: string;
  tools: ToolCall[];
  sources: SourceUsed[];
  usage: TokenUsage;
  costUsd: number;
  models: string[];
}

export class Recorder {
  readonly tools: ToolCall[] = [];
  readonly sources: SourceUsed[] = [];
  usage: TokenUsage = { inputTokens: 0, outputTokens: 0, thoughtTokens: 0 };
  costUsd = 0;
  models = new Set<string>();

  tool(name: string, summary: string, durationMs: number) {
    this.tools.push({ name, summary, durationMs });
  }
  source(label: string, url: string | null, kind: SourceUsed["kind"] = "web") {
    if (!this.sources.some((s) => s.url === url && s.label === label)) this.sources.push({ label, url, documentId: null, kind });
  }
  tally(r: { usage: TokenUsage; costUsd: number; model?: string; models?: string[] }) {
    this.usage.inputTokens += r.usage.inputTokens;
    this.usage.outputTokens += r.usage.outputTokens;
    this.usage.thoughtTokens += r.usage.thoughtTokens;
    this.costUsd += r.costUsd;
    if (r.model) this.models.add(r.model);
    for (const m of r.models ?? []) this.models.add(m);
  }
  /** Time a step and log it as a tool call. */
  async step<T>(name: string, fn: () => Promise<T>, summarize: (result: T) => string): Promise<T> {
    const t = Date.now();
    try {
      const r = await fn();
      this.tool(name, summarize(r), Date.now() - t);
      return r;
    } catch (err) {
      this.tool(name, err instanceof Error ? err.message : String(err), Date.now() - t);
      throw err;
    }
  }
}

export async function recordRun<T>(
  store: LoopStore,
  meta: { agent: AgentName; title: string; trigger: AgentRun["trigger"] },
  fn: (rec: Recorder) => Promise<{ output: T; summary: string }>,
): Promise<{ output: T; run: AgentRun }> {
  const rec = new Recorder();
  const run = await store.createRun({
    orgId: store.orgId,
    agent: meta.agent,
    trigger: meta.trigger,
    title: meta.title,
    status: "running",
    toolsCalled: [],
    sourcesUsed: [],
    outputSummary: "Working on it.",
    costUsd: 0,
    tokensIn: 0,
    tokensOut: 0,
    startedAt: new Date().toISOString(),
    finishedAt: null,
    inboxItemId: null,
  });
  const finish = async (patch: Partial<AgentRun>) => {
    const full: Partial<AgentRun> = {
      toolsCalled: rec.tools,
      sourcesUsed: rec.sources,
      costUsd: Math.round(rec.costUsd * 10_000) / 10_000,
      tokensIn: rec.usage.inputTokens,
      tokensOut: rec.usage.outputTokens,
      finishedAt: new Date().toISOString(),
      ...patch,
    };
    await store.updateRun(run.id, full);
    return { ...run, ...full } as AgentRun;
  };
  try {
    const { output, summary } = await fn(rec);
    const done = await finish({ status: "succeeded", outputSummary: summary });
    return { output, run: done };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await finish({ status: "failed", outputSummary: `Stopped: ${message}` });
    throw err;
  }
}
