/**
 * The demo with no keys runs in the visitor's browser: the sample workspaces
 * live in localStorage, recorded runs play back in the tab, and pages render
 * from that state (see ./runtime.ts and src/components/demo). The server only
 * serves pages and does stateless work (reading an uploaded PDF, fetching a
 * link), so it runs the same on serverless hosts, where memory does not last
 * from one request to the next.
 *
 * The server sets this flag on the page (src/app/layout.tsx and the app's
 * demo shells); it is never set when Supabase or a model key is configured.
 */
export interface BrowserDemo {
  /** Recorded runs play this many times faster than they took live (REPLAY_SPEED; tests use 10). */
  speed: number;
}

declare global {
  interface Window {
    __flDemo?: BrowserDemo;
  }
}

export function inBrowserDemo(): boolean {
  return typeof window !== "undefined" && Boolean(window.__flDemo);
}

export function setBrowserDemo(flag: BrowserDemo | null) {
  if (typeof window === "undefined") return;
  if (flag) window.__flDemo = flag;
  else delete window.__flDemo;
}

export function replaySpeed(): number {
  if (typeof window !== "undefined") return window.__flDemo?.speed || 1;
  return Number(process.env.REPLAY_SPEED) || 1;
}
