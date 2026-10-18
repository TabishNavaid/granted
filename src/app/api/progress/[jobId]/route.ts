import { NextResponse } from "next/server";
import { readJob } from "@/lib/loop/progress";

/**
 * Live progress for a running job. A route handler, not a server action,
 * because the browser queues server actions one after another and a poll
 * would wait behind the job it is watching.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params;
  if (!/^job_[a-z0-9]+$/i.test(jobId)) return NextResponse.json(null, { status: 400 });
  return NextResponse.json(readJob(jobId), { headers: { "cache-control": "no-store" } });
}
