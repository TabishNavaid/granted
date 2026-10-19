import { hasAi, isDemoMode } from "@/lib/env";

/**
 * Replay mode: the demo with no model key (see ./index.ts). Kept in its own
 * module, with no other imports, so code that may end up in a browser bundle
 * can ask the question without pulling in the replay engine.
 */
export function replayActive(): boolean {
  return isDemoMode() && !hasAi();
}
