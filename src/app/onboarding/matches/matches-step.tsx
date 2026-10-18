"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { MatchView } from "@/lib/types";
import { services } from "@/lib/services";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { useToast } from "@/components/ui/toast";
import { OpportunityCard } from "@/components/app/opportunity-card";
import { ProgressSteps, type JobView } from "@/components/app/progress-steps";
import { newJobId, watchJob } from "@/lib/progress-client";

const FALLBACK: JobView = { status: "running", steps: [{ label: "Planning the searches", state: "active" }, { label: "Searching Grants.gov", state: "pending" }, { label: "Reading the strongest notices in full", state: "pending" }, { label: "Scoring each one against your facts", state: "pending" }] };

export function MatchesStep({ initial, total, demo }: { initial: MatchView[] | null; total: number; demo: boolean }) {
  const router = useRouter();
  const { toast } = useToast();
  const [matches, setMatches] = React.useState<MatchView[] | null>(initial);
  const [count, setCount] = React.useState(total);
  const [job, setJob] = React.useState<JobView>(FALLBACK);
  const [failure, setFailure] = React.useState<string | null>(null);
  const [attempt, setAttempt] = React.useState(0);
  const [starting, setStarting] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (matches !== null) return;
    let alive = true;
    const jobId = newJobId();
    const stop = watchJob(jobId, (j) => {
      if (alive) setJob(j);
    });
    (async () => {
      const r = await services.loop.findMatches(jobId);
      if (!alive) return;
      stop();
      if (!r.ok) {
        setFailure(r.error);
        return;
      }
      const list = await services.opportunities.listMatches();
      if (!alive) return;
      setCount(list.length);
      setMatches(list.slice(0, 3));
    })();
    return () => {
      alive = false;
      stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt]);

  const draft = async (m: MatchView) => {
    setStarting(m.id);
    const app = await services.opportunities.startApplication(m.opportunity.id);
    await services.org.update({ onboardingStep: "done" });
    const r = await services.loop.draftLetter(app.id);
    if (!r.ok) toast({ title: "The letter will have to wait", description: r.error, tone: "warning" });
    router.push(`/applications/${app.id}`);
  };
  const finish = async () => {
    await services.org.update({ onboardingStep: "done" });
    router.push("/inbox?tour=1");
  };

  if (failure) {
    return (
      <div className="max-w-2xl">
        <h1 className="font-display text-h1 text-ink">The search did not finish.</h1>
        <p className="mt-4 max-w-[52ch] text-lg text-ink-muted">{failure}</p>
        <div className="mt-8 flex flex-wrap gap-3">
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
          <Button variant="secondary" size="lg" onClick={finish}>
            Go to my Inbox for now
          </Button>
        </div>
      </div>
    );
  }

  if (matches === null) {
    return (
      <div className="max-w-2xl">
        <h1 className="font-display text-h1 text-ink">Looking for grants you can apply for.</h1>
        <p className="mt-4 max-w-[52ch] text-lg text-ink-muted">About a minute. We search Grants.gov, read the strongest notices in full, and keep only the ones we can tie to your facts.</p>
        <div className="mt-10" aria-live="polite">
          <ProgressSteps job={job} />
        </div>
      </div>
    );
  }

  return (
    <div>
      <h1 className="font-display text-h1 text-ink">{matches.length === 0 ? "Nothing strong enough yet." : matches.length === 1 ? "One place to start." : `${matches.length === 2 ? "Two" : "Three"} places to start.`}</h1>
      <p className="mt-4 max-w-[60ch] text-lg text-ink-muted">
        {matches.length === 0
          ? "Grants.gov lists federal funding only, and most small organizations win foundation and local money first. We keep looking, and you can search again any time from Opportunities."
          : demo
            ? "These are the strongest fits in the demo workspace. Each one says why it fits in plain words. Pick one and we will draft a letter from the confirmed facts."
            : `We kept ${count} you can apply for and these are the strongest. Each one says why it fits in plain words. Pick one and we will draft a letter from your confirmed facts.`}
      </p>
      {matches.length ? (
        <ul className="mt-8 border-b border-rule">
          {matches.map((m) => (
            <li key={m.id} className="relative">
              <OpportunityCard match={m} />
              <div className="-mt-2 mb-6 sm:ml-[8.5rem]">
                <Button size="sm" loading={starting === m.id} disabled={starting !== null && starting !== m.id} onClick={() => draft(m)}>
                  {starting === m.id ? "Drafting your letter" : "Draft a letter for this one"}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState className="mt-8" title="No open federal notice fit well enough" description="You can still start from any opportunity later, and the letter will ask you for what it needs." />
      )}
      <div className="mt-8 flex flex-wrap items-center gap-x-5 gap-y-3">
        <Button variant={matches.length ? "secondary" : "primary"} size="lg" onClick={finish}>
          {matches.length ? "Skip for now, show me around" : "Go to my Inbox"}
        </Button>
        {count > 3 ? (
          <Link href="/opportunities" className="text-base font-semibold text-ink underline decoration-[1.5px] underline-offset-4 hover:decoration-pink">
            See all {count}
          </Link>
        ) : null}
      </div>
    </div>
  );
}
