"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { MatchView, OrgType } from "@/lib/types";
import { AddRfpDialog } from "@/components/bids/add-rfp-dialog";
import { services } from "@/lib/services";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { OpportunityCard } from "@/components/app/opportunity-card";
import { newestFirst } from "@/lib/matches";
import { ProgressSteps, type JobView } from "@/components/app/progress-steps";
import { finalJob, newJobId, watchJob, runLong } from "@/lib/progress-client";

const FALLBACK: JobView = { status: "running", steps: [{ label: "Planning the searches", state: "active" }, { label: "Searching Grants.gov", state: "pending" }, { label: "Reading the strongest notices in full", state: "pending" }, { label: "Scoring each one against your facts", state: "pending" }, { label: "Checking private foundations' IRS filings", state: "pending" }] };

export function MatchesStep({ initial, total, demo, orgType = "nonprofit" }: { initial: MatchView[] | null; total: number; demo: boolean; orgType?: OrgType }) {
  const router = useRouter();
  const [matches, setMatches] = React.useState<MatchView[] | null>(initial);
  const [count, setCount] = React.useState(total);
  const [job, setJob] = React.useState<JobView>(FALLBACK);
  const [failure, setFailure] = React.useState<string | null>(null);
  const [attempt, setAttempt] = React.useState(0);
  const [starting, setStarting] = React.useState<string | null>(null);

  const pending = React.useRef<MatchView[] | null>(null);
  const onDrained = React.useCallback(() => {
    setTimeout(() => setMatches(pending.current ?? []), 1400);
  }, []);
  const run = React.useRef<{ attempt: number; jobId: string; result: ReturnType<typeof services.loop.findMatches> } | null>(null);
  React.useEffect(() => {
    if (matches !== null) return;
    let alive = true;
    // Started once per attempt, so a second render pass watches the same search.
    if (!run.current || run.current.attempt !== attempt) {
      const id = newJobId();
      run.current = { attempt, jobId: id, result: runLong(id, "loop.findMatches", [id], () => services.loop.findMatches(id)) };
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
        setFailure(r.error);
        return;
      }
      const [list, last] = await Promise.all([services.opportunities.listMatches(), finalJob(jobId, FALLBACK)]);
      if (!alive) return;
      setCount(list.length);
      pending.current = newestFirst(list).slice(0, 3);
      setJob(last);
      // Show the matches once the feed has played out every search and score.
      if (!last.events?.length) setMatches(pending.current);
    })();
    return () => {
      alive = false;
      stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt]);

  const draft = async (m: MatchView) => {
    setStarting(m.id);
    const mode = orgType === "research" ? "research" : orgType === "individual" ? "essay" : "letter";
    const app = await services.opportunities.startApplication(m.opportunity.id, mode);
    await services.org.update({ onboardingStep: "done" });
    // The workspace writes the letter with its progress on screen; research proposals and essays start from their own screen.
    router.push(mode === "letter" ? `/applications/${app.id}?draft=letter` : `/applications/${app.id}`);
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
        <h1 className="font-display text-h1 text-ink">{orgType === "firm" ? "Looking for grants and incentives open to firms." : orgType === "research" ? "Looking for research funding." : orgType === "individual" ? "Looking for scholarships." : "Looking for grants you can apply for."}</h1>
        <p className="mt-4 max-w-[52ch] text-lg text-ink-muted">
          {orgType === "firm"
            ? "We search Grants.gov for programs a for-profit firm can apply for: energy efficiency, workforce training, and small business innovation. Bids come next."
            : orgType === "research"
              ? "We look up funded NSF and NIH projects like yours, search Grants.gov research notices open to universities, and note each funder's rules on AI."
              : orgType === "individual"
                ? "We read foundations' IRS filings for scholarship funds that fit your state, level, and field."
                : "About a minute. We search Grants.gov, read the strongest notices in full, check private foundations' IRS filings, and keep only what we can tie to your facts."}
        </p>
        <div className="mt-10" aria-live="polite">
          <ProgressSteps job={job} onDrained={onDrained} />
        </div>
      </div>
    );
  }

  return (
    <div>
      <h1 className="font-display text-h1 text-ink">{matches.length === 0 ? "Nothing strong enough yet." : matches.length === 1 ? "One place to start." : `${matches.length === 2 ? "Two" : "Three"} places to start.`}</h1>
      <p className="mt-4 max-w-[60ch] text-lg text-ink-muted">
        {matches.length === 0
          ? "Nothing in Grants.gov or the foundation filings we hold fit well enough yet. We keep looking, and you can search again any time from Opportunities."
          : orgType === "firm"
            ? `We kept ${count} grants and incentives a firm can apply for. Your bids are next: add an RFP you have in hand, or pick a SAM.gov notice for your work categories.`
            : orgType === "research"
              ? `We kept ${count} research notices open to universities, each with its funder's AI rules. Pick one and we will draft the standard sections from your team's records.`
              : orgType === "individual"
                ? `We kept ${count} scholarship funds. Pick one and paste its essay prompt; we draft from your own experiences.`
                : `We kept ${count} you can apply for, federal and private, and these are the strongest. Each one says why it fits in plain words. Pick one and we will draft a letter from ${demo ? "the" : "your"} confirmed facts.`}
      </p>
      {matches.length ? (
        <ul className="mt-8 border-b border-rule">
          {matches.map((m) => (
            <li key={m.id} className="relative">
              <OpportunityCard match={m} />
              <div className="-mt-2 mb-6 sm:ml-[8.5rem]">
                <Button size="sm" loading={starting === m.id} disabled={starting !== null && starting !== m.id} onClick={() => draft(m)}>
                  {starting === m.id ? "Starting" : orgType === "research" ? "Start a proposal for this one" : orgType === "individual" ? "Apply to this one" : "Draft a letter for this one"}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState className="mt-8" title="No open federal notice fit well enough" description="You can still start from any opportunity later, and the letter will ask you for what it needs." />
      )}
      {orgType === "firm" ? (
        <div className="mt-10 border-t border-rule pt-6">
          <h2 className="font-display text-2xl text-ink">Your first bid</h2>
          <p className="mt-2 max-w-[60ch] text-base text-ink-muted">Most firms already have the RFP. Add it and we build the compliance matrix, score go or no-go from your records, and put its dates on the calendar.</p>
          <div className="mt-4 flex flex-wrap gap-3">
            <AddRfpDialog demo={demo} trigger={<Button size="lg">Add an RFP</Button>} />
            <Button asChild variant="secondary" size="lg">
              <Link href="/opportunities">See SAM.gov notices for your work</Link>
            </Button>
          </div>
        </div>
      ) : null}
      <div className="mt-8 flex flex-wrap items-center gap-x-5 gap-y-3">
        <Button variant={matches.length ? "secondary" : "primary"} size="lg" onClick={finish}>
          {matches.length ? "Skip for now, show me around" : "Go to my Inbox"}
        </Button>
        {count > 3 ? (
          <Link href="/opportunities" className="text-base font-semibold text-ink underline decoration-[1.5px] underline-offset-4 hover:decoration-ink">
            See all {count}
          </Link>
        ) : null}
      </div>
    </div>
  );
}
