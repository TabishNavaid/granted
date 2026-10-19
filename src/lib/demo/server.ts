import { replayActive } from "@/lib/replay/active";
import type { BrowserDemo } from "./flags";

/** On the server: does the demo run in the visitor's browser? Yes when there are no keys (no Supabase, no model). */
export function browserDemoFlag(): BrowserDemo | null {
  return replayActive() ? { speed: Number(process.env.REPLAY_SPEED) || 1 } : null;
}
