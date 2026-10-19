"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { services } from "@/lib/services";
import { Button } from "@/components/ui/button";
import { ProgressSteps, type JobView } from "@/components/app/progress-steps";
import { finalJob, newJobId, watchJob } from "@/lib/progress-client";
import { formatDate } from "@/lib/format";

const FALLBACK: JobView = { status: "running", steps: [{ label: "Reading your homepage", state: "active" }, { label: "Reading your other pages", state: "pending" }, { label: "Writing down the facts", state: "pending" }, { label: "Checking every fact against its page", state: "pending" }] };

/** A calm screen while the profile is built. The server action runs; this screen polls for what it is doing. */
export function ReadingStep({ websiteUrl, ein, recordedOn }: { websiteUrl: string; ein: string | null; recordedOn: string | null }) {
  const router = useRouter();
  const [job, setJob] = React.useState<JobView>(FALLBACK);
  const [failure, setFailure] = React.useState<{ code: string; message: string } | null>(null);
  const [attempt, setAttempt] = React.useState(0);
  const onDrained = React.useCallback(() => {
    setTimeout(() => router.push("/onboarding/profile"), 1400);
  }, [router]);
  const host = websiteUrl.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "");

  // Started once per attempt: a second render pass must watch the same run, not queue another behind it.
  const run = React.useRef<{ attempt: number; jobId: string; result: ReturnType<typeof services.loop.buildProfile> } | null>(null);
  React.useEffect(() => {
    let alive = true;
    if (!run.current || run.current.attempt !== attempt) {
      const id = newJobId();
      run.current = { attempt, jobId: id, result: services.loop.buildProfile({ websiteUrl, ein, jobId: id }) };
    }
    const { jobId, result } = run.current;
    const stop = watchJob(jobId, (j) => {
      if (alive) setJob(j);
    });
    (async () => {
      const r = await result;
      if (!alive) return;
      stop();
      if (!r.ok) {
        setFailure({ code: r.code, message: r.error });
        setJob((j) => ({ ...j, status: "failed" }));
        return;
      }
      const last = await finalJob(jobId, FALLBACK);
      if (!alive) return;
      setJob(last);
      // Move on once the feed has shown every fact, or straight away if there is no feed.
      if (!last.events?.length) setTimeout(() => router.push("/onboarding/profile"), 700);
    })();
    return () => {
      alive = false;
      stop();
    };
  }, [websiteUrl, ein, router, attempt]);

  return (
    <div className="max-w-2xl">
      <h1 className="font-display text-h1 text-ink">{failure ? "We hit a snag." : `Reading ${host}.`}</h1>
      <p className="mt-4 max-w-[52ch] text-lg text-ink-muted">{failure ? failure.message : "About a minute. We only write down what your site says, and every fact keeps a link to the sentence it came from."}</p>
      {recordedOn && !failure ? <p className="mt-3 max-w-[60ch] text-sm text-ink-muted">This replays a reading of the sample site recorded on {formatDate(recordedOn)}. The check that each fact&apos;s passage is on its page runs now, in the live code.</p> : null}
      {failure ? (
        <div className="mt-8 flex flex-wrap items-center gap-3">
          {failure.code === "rate_limited" || failure.code === "unreachable" || failure.code === "failed" ? (
            <Button
              size="lg"
              onClick={() => {
                setFailure(null);
                setJob(FALLBACK);
                setAttempt((a) => a + 1);
              }}
            >
              Try again
            </Button>
          ) : null}
          <Button asChild variant="secondary" size="lg">
            <Link href="/onboarding?restart=1">Use a different address</Link>
          </Button>
          <Button asChild variant="ghost" size="lg">
            <Link href="/onboarding/gaps">Go on without it</Link>
          </Button>
        </div>
      ) : (
        <div className="mt-10" aria-live="polite">
          <ProgressSteps job={job} onDrained={onDrained} />
        </div>
      )}
    </div>
  );
}
