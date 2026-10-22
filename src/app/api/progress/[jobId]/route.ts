import { NextResponse } from "next/server";
import { readJob } from "@/lib/loop/progress";
import { hasSupabase, isDemoMode } from "@/lib/env";

/**
 * Live progress for a running job. A route handler, not a server action,
 * because the browser queues server actions one after another and a poll
 * would wait behind the job it is watching. This server's memory answers
 * first; in the real product the jobs table answers when the job runs on
 * another instance, with the result once it is finished.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params;
  if (!/^job_[a-z0-9]+$/i.test(jobId)) return NextResponse.json(null, { status: 400 });
  const headers = { "cache-control": "no-store" };
  const mem = readJob(jobId);
  if (isDemoMode() || !hasSupabase()) return NextResponse.json(mem, { headers });
  const { getSession } = await import("@/lib/supabase/session");
  const session = await getSession();
  if (!session) return NextResponse.json(null, { status: 401, headers });
  const { readStoredJob } = await import("@/lib/jobs/runner");
  const stored = await readStoredJob(jobId, session.orgId);
  if (!stored) return NextResponse.json(mem, { headers });
  const finished = stored.status === "done" || stored.status === "failed";
  return NextResponse.json(
    {
      status: stored.status === "done" ? "done" : stored.status === "failed" ? "failed" : "running",
      steps: finished || !mem ? stored.steps : mem.steps,
      events: finished || !mem ? stored.events : mem.events,
      finished,
      result: finished ? stored.result : undefined,
      error: stored.error ?? undefined,
    },
    { headers },
  );
}
