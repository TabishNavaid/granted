import { createHash } from "node:crypto";
import { hasSupabase, isDemoMode } from "@/lib/env";

/**
 * Error monitoring on the free tier: every error is logged as one JSON line (Vercel keeps runtime logs) and, when
 * the deployment has a database, grouped and counted in app_errors for /admin/errors. Paths lose their query
 * strings and messages are trimmed, so tokens and emails in URLs never get stored.
 */
export interface ErrorReport {
  kind: "server" | "client";
  message: string;
  digest?: string | null;
  route?: string | null;
  path?: string | null;
  detail?: Record<string, string | number | null | undefined>;
}

const EMAIL = /[\w.+-]+@[\w-]+\.[\w.-]+/g;
const LONG_TOKEN = /\b[A-Za-z0-9_-]{32,}\b/g;

export function scrub(text: string, max = 1000): string {
  return text.replace(EMAIL, "[email]").replace(LONG_TOKEN, "[token]").slice(0, max);
}

export function cleanPath(path: string | null | undefined): string | null {
  if (!path) return null;
  try {
    return new URL(path, "https://x.invalid").pathname.slice(0, 300);
  } catch {
    return path.split(/[?#]/)[0].slice(0, 300);
  }
}

/** Same message on the same route is one group. Numbers and ids are folded so "row 12" and "row 13" group together. */
export function fingerprint(r: Pick<ErrorReport, "kind" | "message" | "route" | "path">): string {
  const msg = r.message.replace(/[0-9a-f]{8}-[0-9a-f-]{27}/gi, "<id>").replace(/\d+/g, "<n>").slice(0, 300);
  return createHash("sha256").update(`${r.kind}|${r.route ?? r.path ?? ""}|${msg}`).digest("hex").slice(0, 32);
}

export async function reportError(r: ErrorReport): Promise<void> {
  const message = scrub(r.message || "Unknown error");
  const path = cleanPath(r.path);
  const detail = Object.fromEntries(Object.entries(r.detail ?? {}).map(([k, v]) => [k, typeof v === "string" ? scrub(v, 2000) : v]));
  console.error(JSON.stringify({ level: "error", kind: r.kind, message, digest: r.digest ?? undefined, route: r.route ?? undefined, path, ...detail }));
  if (isDemoMode() || !hasSupabase()) return;
  try {
    const { adminClient } = await import("@/lib/supabase/clients");
    await adminClient().rpc("record_app_error", { fp: fingerprint({ ...r, message, path }), k: r.kind, msg: message, dig: r.digest ?? null, rt: r.route ?? null, pth: path, det: detail });
  } catch {
    // Reporting must never throw into the request that failed.
  }
}
