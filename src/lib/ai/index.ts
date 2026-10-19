import { GeminiProvider } from "./gemini";
import type { AiProvider } from "./types";
import { replayActive } from "@/lib/replay/active";

export * from "./types";
export { estimateCostUsd, GEMINI_PRICES } from "./pricing";

let provider: AiProvider | null = null;
let replay: AiProvider | null = null;

/**
 * The one provider the agents call. Change this line to swap vendors. In the
 * demo with no key, a recorded run answers instead (see src/lib/replay).
 */
export function getAi(): AiProvider {
  if (replayActive()) return (replay ??= lazyReplay());
  if (!provider) provider = new GeminiProvider(process.env.GEMINI_API_KEY);
  return provider;
}

/** Kind, honest copy for the UI when a model call fails. */
export function aiErrorMessage(err: unknown): { code: "rate_limited" | "no_ai" | "failed"; message: string } {
  const code = err && typeof err === "object" && "code" in err ? (err as { code: string }).code : "failed";
  if (code === "rate_limited") return { code: "rate_limited", message: "We are being asked to slow down by our AI provider. Give it a minute and try again." };
  if (code === "not_recorded") return { code: "no_ai", message: `${err instanceof Error ? err.message : "This step was not recorded."} The demo replays recorded runs for its sample organizations; with a model key this step runs live.` };
  if (code === "no_key") return { code: "no_ai", message: "The AI service is not set up on this server yet, so we could not read your site." };
  return { code: "failed", message: "Something went wrong on our side. Try again, and if it keeps happening, tell us." };
}

/** The replay engine, loaded on first use so it never lands in a browser bundle. */
function lazyReplay(): AiProvider {
  return {
    name: "replay",
    modelFor: () => "recorded run",
    async generateJson(req) {
      const { ReplayProvider } = await import("@/lib/replay");
      return new ReplayProvider().generateJson(req);
    },
  };
}
