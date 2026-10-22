import { NextResponse, type NextRequest } from "next/server";
import { hasSupabase, isDemoMode } from "@/lib/env";
import "@/lib/services/server-init";

/**
 * Restarts background jobs whose worker stopped (an instance recycled mid-draft). Called every ten minutes
 * by .github/workflows/sweep-jobs.yml with the CRON_SECRET (Authorization: Bearer).
 */
export const maxDuration = 300;

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET?.trim();
  const given = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!secret || given !== secret) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (isDemoMode() || !hasSupabase()) return NextResponse.json({ restarted: [], note: "No database on this deployment." });
  const { sweepJobs } = await import("@/lib/jobs/runner");
  return NextResponse.json(await sweepJobs());
}
