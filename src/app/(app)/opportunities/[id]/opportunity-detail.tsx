"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ApplicationView, Contact, Funder, MatchView, Opportunity } from "@/lib/types";
import { services } from "@/lib/services";
import { PageContainer } from "@/components/app/page-header";
import { FitScore } from "@/components/app/fit-score";
import { VerifiedSource } from "@/components/app/citation-chip";
import { StageBadge } from "@/components/app/badges";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/input";
import { Field } from "@/components/ui/label";
import { deadlineLabel, formatDate, formatMoney, formatRange } from "@/lib/format";
import { cn } from "@/lib/utils";

interface Props {
  opportunity: Opportunity;
  funder: Funder;
  contacts: Contact[];
  match: MatchView | null;
  application: ApplicationView | null;
  recommendedAsk?: { amount: number; low: number; high: number; why: string[] } | null;
}

const funderHref = (id: string) => `/funders/${encodeURIComponent(id)}`;

export function OpportunityDetail({ opportunity, funder, contacts, match, application, recommendedAsk = null }: Props) {
  const router = useRouter();
  const { toast } = useToast();
  const [starting, setStarting] = React.useState(false);
  const [status, setStatus] = React.useState(match?.status ?? "new");
  const [dismissOpen, setDismissOpen] = React.useState(false);
  const [reason, setReason] = React.useState("");
  const dl = deadlineLabel(opportunity.deadline);
  const soon = dl.tone === "danger" || dl.tone === "warning";

  const start = async () => {
    setStarting(true);
    const app = await services.opportunities.startApplication(opportunity.id);
    toast({ title: "On it", description: "Opening the workspace. Ask for the first draft there and we'll write a letter of inquiry from your confirmed facts." });
    router.push(`/applications/${app.id}`);
  };
  const save = async () => {
    if (!match) return;
    const next = status === "saved" ? "new" : "saved";
    await services.opportunities.setMatchStatus(match.id, next);
    setStatus(next);
  };
  const dismiss = async () => {
    if (!match) return;
    await services.opportunities.dismiss(match.id, reason);
    toast({ title: "Set aside", description: reason.trim() ? "Your reason shapes the next search." : "We won't suggest this one again.", tone: "info" });
    router.push("/opportunities");
  };

  const checks = match?.eligibilityChecks ?? opportunity.eligibility.map((e) => ({ label: e.label, passed: true, detail: "" }));

  return (
    <PageContainer width="wide">
      <Link href="/opportunities" className="text-sm text-ink underline decoration-[1px] underline-offset-4 hover:decoration-ink">
        All funders
      </Link>

      <div className="mt-6 grid gap-10 lg:grid-cols-[1fr_20rem] lg:gap-12">
        <div className="min-w-0">
          <header>
            <p className="text-base text-ink-muted">
              <Link href={funderHref(funder.id)} className="underline decoration-[1px] underline-offset-4 hover:text-ink hover:decoration-ink">
                {funder.name}
              </Link>
            </p>
            <h1 className="mt-1 font-display text-title text-ink">{opportunity.title}</h1>
            <p className="mt-4 max-w-[65ch] text-lg text-ink-muted">{opportunity.summary}</p>
            <div className="mt-4 flex flex-wrap items-baseline gap-x-6 gap-y-1">
              <VerifiedSource url={opportunity.sourceUrl} verifiedAt={opportunity.lastVerifiedAt} note={opportunity.sourceNote} label={opportunity.sourceNote ? "IRS filing" : undefined} />
              <a href={opportunity.guidelinesUrl} target="_blank" rel="noreferrer" className="text-xs text-ink underline decoration-[1px] underline-offset-2 hover:decoration-ink">
                Read the guidelines
              </a>
            </div>
          </header>

          <dl className="mt-8 grid grid-cols-2 gap-6 border-y border-rule py-5 sm:grid-cols-4">
            <div>
              <dt className="text-sm text-ink-muted">Award</dt>
              <dd className="mt-1 font-display text-2xl text-ink tnum">{formatRange(opportunity.amountMin, opportunity.amountMax)}</dd>
            </div>
            <div>
              <dt className="text-sm text-ink-muted">Deadline</dt>
              <dd className="mt-1 font-display text-2xl text-ink">{opportunity.deadline ? formatDate(opportunity.deadline) : opportunity.forecasted ? "Not announced" : "Rolling"}</dd>
              {opportunity.deadline ? (
                <dd className={cn("mt-1 text-sm", dl.tone === "danger" ? "text-alert" : "text-ink-muted")}>
                  {soon ? <span className="font-semibold">{dl.text}</span> : dl.text}
                </dd>
              ) : null}
            </div>
            <div>
              <dt className="text-sm text-ink-muted">Process</dt>
              <dd className="mt-1 font-display text-2xl text-ink">{opportunity.forecasted ? "Forecasted" : opportunity.deadlineType === "loi" ? "Letter first" : opportunity.deadlineType === "rolling" ? "Rolling" : "Full proposal"}</dd>
            </div>
            <div>
              <dt className="text-sm text-ink-muted">Your time</dt>
              <dd className="mt-1 font-display text-2xl text-ink">{opportunity.effort === "low" ? "About 2 hours" : opportunity.effort === "medium" ? "About 5 hours" : "A day or more"}</dd>
            </div>
          </dl>

          {match ? (
            <section aria-labelledby="fit-title" className="mt-12">
              <div className="flex items-start justify-between gap-6">
                <h2 id="fit-title" className="font-display text-2xl text-ink">
                  Why this fits
                </h2>
                <FitScore score={match.fitScore} size="md" />
              </div>
              <ul className="mt-4 border-t border-rule">
                {match.reasons.map((r) => (
                  <li key={r} className="max-w-[65ch] border-b border-rule py-3 text-base text-ink">
                    {r}
                  </li>
                ))}
              </ul>
              {match.cautions.length ? (
                <>
                  <h3 className="mt-6 font-display text-xl text-ink">Worth knowing</h3>
                  <ul className="mt-3 border-t border-rule">
                    {match.cautions.map((c) => (
                      <li key={c} className="max-w-[65ch] border-b border-rule py-3 text-base text-ink-muted">
                        {c}
                      </li>
                    ))}
                  </ul>
                </>
              ) : null}
            </section>
          ) : null}

          <section aria-labelledby="elig-title" className="mt-12">
            <h2 id="elig-title" className="font-display text-2xl text-ink">
              Eligibility
            </h2>
            <ul className="mt-4 border-t border-rule">
              {checks.map((c) => (
                <li key={c.label} className="flex items-start justify-between gap-6 border-b border-rule py-3 text-base">
                  <div className="min-w-0">
                    <p className="font-semibold text-ink">{c.label}</p>
                    {c.detail ? <p className="text-sm text-ink-muted">{c.detail}</p> : null}
                  </div>
                  <span className="shrink-0 text-sm font-semibold text-ink">{c.passed ? "Passed" : "Confirm"}</span>
                  <span className="sr-only">{c.passed ? "Passed" : "Needs confirmation"}</span>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-sm text-ink-muted">Checked against your profile and the funder&apos;s page as of {formatDate(opportunity.lastVerifiedAt)}.</p>
          </section>

          <section aria-labelledby="funder-title" className="mt-12">
            <h2 id="funder-title" className="font-display text-2xl text-ink">
              About {funder.name}
            </h2>
            <p className="mt-3 max-w-[65ch] text-base text-ink-muted">{funder.description}</p>
            <dl className="mt-5 grid gap-x-6 gap-y-4 border-y border-rule py-4 sm:grid-cols-3">
              <div className="sm:col-span-3 lg:col-span-1">
                <dt className="text-sm text-ink-muted">Focus areas</dt>
                <dd className="mt-0.5 text-base text-ink">{funder.focusAreas.join(", ")}</dd>
              </div>
              <div>
                <dt className="text-sm text-ink-muted">Typical giving</dt>
                <dd className="mt-0.5 text-base font-semibold text-ink tnum">{formatRange(funder.givingMin, funder.givingMax)}</dd>
              </div>
              <div>
                <dt className="text-sm text-ink-muted">Geography</dt>
                <dd className="mt-0.5 text-base font-semibold text-ink">{funder.geography}</dd>
              </div>
            </dl>
            {funder.recentGrantees.length ? (
              <div className="mt-6">
                <h3 className="font-display text-xl text-ink">Recent grants</h3>
                <ul className="mt-3 border-t border-rule">
                  {funder.recentGrantees.map((g) => (
                    <li key={g.name + g.year} className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 border-b border-rule py-2.5 text-base">
                      <span className="text-ink">{g.name}</span>
                      <span className="flex gap-x-4 text-sm text-ink-muted tnum">
                        <span>{formatMoney(g.amount)}</span>
                        <span>{g.year}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            {funder.aiPolicy ? (
              <div className="mt-6 max-w-[65ch] border-l-[3px] border-rule-strong pl-4 text-base text-ink">
                <p className="font-semibold">AI disclosure policy</p>
                <p className="mt-0.5 text-ink-muted">{funder.aiPolicy}</p>
              </div>
            ) : null}
            <p className="mt-5">
              <Link href={funderHref(funder.id)} className="text-base font-semibold text-ink underline decoration-[1.5px] underline-offset-4 hover:decoration-ink">
                Funder profile and past grants
              </Link>
            </p>
            <div className="mt-4">
              <VerifiedSource url={funder.sourceUrl} verifiedAt={funder.lastVerifiedAt} note={funder.sourceNote} label={funder.sourceNote ? "IRS filing" : `Funder page: ${new URL(funder.sourceUrl).hostname.replace(/^www\./, "")}`} />
            </div>
          </section>

          {contacts.length ? (
            <section aria-labelledby="contacts-title" className="mt-12">
              <h2 id="contacts-title" className="font-display text-2xl text-ink">
                People
              </h2>
              <ul className="mt-4 border-t border-rule">
                {contacts.map((c) => (
                  <li key={c.id} className="flex flex-wrap items-baseline gap-x-6 gap-y-1 border-b border-rule py-3 text-base">
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-ink">{c.name}</p>
                      <p className="text-sm text-ink-muted">{c.role}</p>
                    </div>
                    {c.email ? <span className="text-sm text-ink-muted">{c.email}</span> : null}
                    <a href={c.publicSourceUrl} target="_blank" rel="noreferrer" className="text-xs text-ink underline decoration-[1px] underline-offset-2 hover:decoration-ink">
                      Public source
                    </a>
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-sm text-ink-muted">Only public professional contacts from the funder&apos;s own site.</p>
            </section>
          ) : null}
        </div>

        <aside className="lg:sticky lg:top-6 lg:self-start">
          <div className="sheet p-5">
            <h2 className="font-display text-xl text-ink">{application ? "In your pipeline" : "Start an application"}</h2>
            {application ? (
              <>
                <dl className="mt-4 border-t border-rule">
                  <div className="flex items-center justify-between gap-4 border-b border-rule py-2.5 text-base">
                    <dt className="text-ink-muted">Stage</dt>
                    <dd>
                      <StageBadge stage={application.stage} />
                    </dd>
                  </div>
                  {application.askAmount ? (
                    <div className="flex items-center justify-between gap-4 border-b border-rule py-2.5 text-base">
                      <dt className="text-ink-muted">Ask</dt>
                      <dd className="font-semibold text-ink tnum">{formatMoney(application.askAmount)}</dd>
                    </div>
                  ) : null}
                  {!application.askAmount && recommendedAsk ? (
                    <div className="flex items-center justify-between gap-4 border-b border-rule py-2.5 text-base">
                      <dt className="text-ink-muted">Suggested ask</dt>
                      <dd className="font-semibold text-ink tnum">{formatMoney(recommendedAsk.amount)}</dd>
                    </div>
                  ) : null}
                  {application.nextMilestone ? (
                    <div className="flex items-start justify-between gap-4 border-b border-rule py-2.5 text-base">
                      <dt className="text-ink-muted">Next</dt>
                      <dd className="text-right text-ink">
                        {application.nextMilestone.title}
                        <span className="block text-sm text-ink-muted">{formatDate(application.nextMilestone.dueDate)}</span>
                      </dd>
                    </div>
                  ) : null}
                </dl>
                <Button asChild className="mt-5 w-full">
                  <Link href={`/applications/${application.id}`}>Open the draft</Link>
                </Button>
              </>
            ) : (
              <>
                {recommendedAsk ? (
                  <div className="mt-4 border-y border-rule py-3 text-sm">
                    <p className="text-ink">
                      Suggested ask <span className="font-semibold tnum">{formatMoney(recommendedAsk.amount)}</span>
                    </p>
                    <p className="text-ink-muted tnum">
                      Range {formatMoney(recommendedAsk.low)} to {formatMoney(recommendedAsk.high)}
                    </p>
                    {recommendedAsk.why[0] ? <p className="mt-1 text-ink-muted">{recommendedAsk.why[0]}</p> : null}
                    <p className="mt-1 text-ink-muted">You set the real ask in the draft.</p>
                  </div>
                ) : null}
                <p className="mt-3 text-base text-ink-muted">We'll write a one-page letter of inquiry from your confirmed facts and this notice's own text. Every claim carries its source, and anything we don't know becomes a question for you.</p>
                <Button onClick={start} loading={starting} className="mt-5 w-full">
                  Start the application
                </Button>
                {match ? (
                  <div className="mt-3 flex flex-col gap-2 sm:flex-row lg:flex-col">
                    <Button variant="secondary" className="flex-1" onClick={save} aria-pressed={status === "saved"}>
                      {status === "saved" ? "Saved" : "Save for later"}
                    </Button>
                    <Button variant="ghost" className="flex-1" onClick={() => setDismissOpen(true)}>
                      Not for us
                    </Button>
                  </div>
                ) : null}
              </>
            )}
          </div>
        </aside>
      </div>
      <Dialog open={dismissOpen} onOpenChange={setDismissOpen}>
        <DialogContent size="sm">
          <DialogHeader>
            <DialogTitle>Why is this not for you?</DialogTitle>
            <DialogDescription>One line is plenty. The next search reads it and scores similar notices lower.</DialogDescription>
          </DialogHeader>
          <Field id="dismiss-reason" label="Reason" optional>
            <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Too big for us, or needs a hospital partner, or wrong state." rows={3} />
          </Field>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDismissOpen(false)}>
              Keep it
            </Button>
            <Button onClick={dismiss}>Set it aside</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageContainer>
  );
}
