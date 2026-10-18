/**
 * Runtime mode. Read once per call so tests and scripts can flip env vars.
 *
 * DEMO_MODE=true          Mock data for every screen (the marketing demo). Default when no Supabase keys are set.
 * GEMINI_API_KEY          Enables the real agents. In demo mode they run against the in-memory store.
 * NEXT_PUBLIC_SUPABASE_*  Enables real auth and persistence.
 */
export function hasSupabase() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

export function hasAi() {
  return Boolean(process.env.GEMINI_API_KEY);
}

let warned = false;
export function isDemoMode() {
  const flag = process.env.DEMO_MODE?.trim().toLowerCase();
  if (flag === "true" || flag === "1" || flag === "yes") return true;
  if (flag === "false" || flag === "0" || flag === "no") {
    if (hasSupabase()) return false;
    // Asked for real mode without the keys for it: stay on demo data rather than crash on every screen.
    if (!warned) {
      warned = true;
      console.warn("DEMO_MODE=false but the Supabase keys are missing; running on demo data. See /settings/integrations.");
    }
    return true;
  }
  return !hasSupabase();
}

export type RuntimeMode = { demo: boolean; ai: boolean; persistence: "memory" | "supabase"; googleAuth: boolean };

export function runtimeMode(): RuntimeMode {
  const demo = isDemoMode();
  return { demo, ai: hasAi(), persistence: demo ? "memory" : "supabase", googleAuth: Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) && !demo };
}
