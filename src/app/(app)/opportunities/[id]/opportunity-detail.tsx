"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Bookmark, Check, ExternalLink, FileText, Info, X } from "lucide-react";
import type { ApplicationView, Contact, Funder, MatchView, Opportunity } from "@/lib/types";
import { services } from "@/lib/services";
import { PageContainer } from "@/components/app/page-header";
import { FitScore } from "@/components/app/fit-score";
import { VerifiedSource } from "@/components/app/citation-chip";
import { StageBadge } from "@/components/app/badges";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/components/ui/toast";
import { deadlineLabel, formatDate, formatMoney, formatRange } from "@/lib/format";
import { cn } from "@/lib/utils";

interface Props {
  opportunity: Opportunity;
  funder: Funder;
  contacts: Contact[];
  match: MatchView | null;
  application: ApplicationView | null;
}

export function OpportunityDetail({ opportunity, funder, contacts, match, application }: Props) {
  const router = useRouter();
  const { toast } = useToast();
  const [starting, setStarting] = React.useState(false);
  const [status, setStatus] = React.useState(match?.status ?? "new");
  const dl = deadlineLabel(opportunity.deadline);

  const start = async () => {
    setStarting(true);
    const app = await services.opportunities.startApplication(opportunity.id);
    toast({ title: "On it", description: "We're reading the guidelines now. The draft will land in your Inbox when it's ready." });
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
    await services.opportunities.setMatchStatus(match.id, "dismissed");
    toast({ title: "Tucked away", description: "We won't suggest this one again.", tone: "info" });
    router.push("/opportunities");
  };

  return (
    <PageContainer width="wide">
      <Link href="/opportunities" className="inline-flex items-center gap-1.5 text-sm text-fg-muted hover:text-fg">
        <ArrowLeft className="size-4" aria-hidden /> All opportunities
      </Link>

      <div className="mt-4 grid gap-8 lg:grid-cols-[1fr_20rem]">
        <div className="min-w-0">
          <header>
            <p className="text-sm font-medium text-fg-muted">{funder.name}</p>
            <h1 className="mt-1 font-display text-3xl leading-tight text-fg sm:text-4xl">{opportunity.title}</h1>
            <p className="mt-3 max-w-2xl text-base text-fg-muted">{opportunity.summary}</p>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <VerifiedSource url={opportunity.sourceUrl} verifiedAt={opportunity.lastVerifiedAt} />
              <a href={opportunity.guidelinesUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs font-medium text-accent hover:underline">
                <FileText className="size-3" aria-hidden /> Guidelines <ExternalLink className="size-3" aria-hidden />
              </a>
            </div>
          </header>

          <dl className="mt-6 grid grid-cols-2 gap-4 rounded-lg border border-border bg-surface p-5 sm:grid-cols-4">
            <div>
              <dt className="text-xs text-fg-subtle">Award range</dt>
              <dd className="mt-0.5 font-display text-xl text-fg tnum">{formatRange(opportunity.amountMin, opportunity.amountMax)}</dd>
            </div>
            <div>
              <dt className="text-xs text-fg-subtle">Deadline</dt>
              <dd className="mt-0.5 font-display text-xl text-fg">{opportunity.deadline ? formatDate(opportunity.deadline) : "Rolling"}</dd>
              <dd className={cn("text-xs", dl.tone === "danger" ? "text-danger" : dl.tone === "warning" ? "text-warning" : "text-fg-subtle")}>{dl.text}</dd>
            </div>
            <div>
              <dt className="text-xs text-fg-subtle">Process</dt>
              <dd className="mt-0.5 font-display text-xl text-fg">{opportunity.deadlineType === "loi" ? "Letter first" : opportunity.deadlineType === "rolling" ? "Rolling" : "Full proposal"}</dd>
            </div>
            <div>
              <dt className="text-xs text-fg-subtle">Your effort</dt>
              <dd className="mt-0.5 font-display text-xl text-fg">{opportunity.effort === "low" ? "About 2 hours" : opportunity.effort === "medium" ? "About 5 hours" : "A day or more"}</dd>
            </div>
          </dl>

          {match ? (
            <section aria-labelledby="fit-title" className="mt-8">
              <div className="flex items-center justify-between gap-4">
                <h2 id="fit-title" className="font-display text-2xl text-fg">
                  Why this fits
                </h2>
                <FitScore score={match.fitScore} size="md" />
              </div>
              <ul className="mt-4 flex flex-col gap-3">
                {match.reasons.map((r) => (
                  <li key={r} className="flex gap-3 text-base text-fg">
                    <Check className="mt-1 size-4 shrink-0 text-success" aria-hidden />
                    {r}
                  </li>
                ))}
                {match.cautions.map((c) => (
                  <li key={c} className="flex gap-3 text-base text-fg-muted">
                    <Info className="mt-1 size-4 shrink-0 text-warning" aria-hidden />
                    {c}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <section aria-labelledby="elig-title" className="mt-8">
            <h2 id="elig-title" className="font-display text-2xl text-fg">
              Eligibility
            </h2>
            <ul className="mt-4 divide-y divide-border rounded-lg border border-border bg-surface">
              {(match?.eligibilityChecks ?? opportunity.eligibility.map((e) => ({ label: e.label, passed: true, detail: "" }))).map((c) => (
                <li key={c.label} className="flex items-start gap-3 px-4 py-3 text-sm">
                  <span className={cn("mt-0.5 inline-flex size-5 shrink-0 items-center justify-center rounded-full", c.passed ? "bg-success-soft text-success-soft-fg" : "bg-warning-soft text-warning-soft-fg")} aria-hidden>
                    {c.passed ? <Check className="size-3" /> : <X className="size-3" />}
                  </span>
                  <div>
                    <p className="font-medium text-fg">{c.label}</p>
                    {c.detail ? <p className="text-fg-muted">{c.detail}</p> : null}
                  </div>
                  <span className="sr-only">{c.passed ? "Passed" : "Needs confirmation"}</span>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-xs text-fg-subtle">Checked against your profile and the funder&apos;s page as of {formatDate(opportunity.lastVerifiedAt)}.</p>
          </section>

          <section aria-labelledby="funder-title" className="mt-8">
            <h2 id="funder-title" className="font-display text-2xl text-fg">
              About {funder.name}
            </h2>
            <p className="mt-3 text-base text-fg-muted">{funder.description}</p>
            <dl className="mt-4 grid gap-4 sm:grid-cols-2">
              <div className="rounded-lg border border-border bg-surface p-4">
                <dt className="text-xs text-fg-subtle">Focus areas</dt>
                <dd className="mt-2 flex flex-wrap gap-1.5">
                  {funder.focusAreas.map((f) => (
                    <Badge key={f} variant="neutral">
                      {f}
                    </Badge>
                  ))}
                </dd>
              </div>
              <div className="rounded-lg border border-border bg-surface p-4">
                <dt className="text-xs text-fg-subtle">Typical giving</dt>
                <dd className="mt-1 font-medium text-fg tnum">{formatRange(funder.givingMin, funder.givingMax)}</dd>
                <dt className="mt-3 text-xs text-fg-subtle">Geography</dt>
                <dd className="mt-1 font-medium text-fg">{funder.geography}</dd>
              </div>
            </dl>
            {funder.recentGrantees.length ? (
              <div className="mt-4 rounded-lg border border-border bg-surface">
                <p className="border-b border-border px-4 py-2.5 text-xs font-medium uppercase tracking-wide text-fg-subtle">Recent grants</p>
                <ul className="divide-y divide-border">
                  {funder.recentGrantees.map((g) => (
                    <li key={g.name + g.year} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                      <span className="text-fg">{g.name}</span>
                      <span className="text-fg-muted tnum">
                        {formatMoney(g.amount)} · {g.year}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            {funder.aiPolicy ? (
              <div className="mt-4 flex gap-3 rounded-lg border border-warning/40 bg-warning-soft p-4 text-sm text-warning-soft-fg">
                <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
                <div>
                  <p className="font-medium">AI disclosure policy</p>
                  <p className="mt-0.5">{funder.aiPolicy}</p>
                </div>
              </div>
            ) : null}
            <div className="mt-3">
              <VerifiedSource url={funder.sourceUrl} verifiedAt={funder.lastVerifiedAt} label={`Funder page: ${new URL(funder.sourceUrl).hostname.replace(/^www\./, "")}`} />
            </div>
          </section>

          {contacts.length ? (
            <section aria-labelledby="contacts-title" className="mt-8">
              <h2 id="contacts-title" className="font-display text-2xl text-fg">
                People
              </h2>
              <ul className="mt-3 divide-y divide-border rounded-lg border border-border bg-surface">
                {contacts.map((c) => (
                  <li key={c.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 text-sm">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-fg">{c.name}</p>
                      <p className="text-fg-muted">{c.role}</p>
                    </div>
                    {c.email ? <span className="text-fg-muted">{c.email}</span> : null}
                    <a href={c.publicSourceUrl} target="_blank" rel="noreferrer" className="text-xs text-fg-subtle underline-offset-2 hover:underline">
                      Public source
                    </a>
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-xs text-fg-subtle">Only public professional contacts from the funder&apos;s own site.</p>
            </section>
          ) : null}
        </div>

        <aside className="lg:sticky lg:top-6 lg:self-start">
          <Card className="bg-surface-raised">
            <CardHeader>
              <CardTitle>{application ? "In your pipeline" : "Start an application"}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {application ? (
                <>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-fg-muted">Stage</span>
                    <StageBadge stage={application.stage} />
                  </div>
                  {application.askAmount ? (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-fg-muted">Ask</span>
                      <span className="font-medium text-fg tnum">{formatMoney(application.askAmount)}</span>
                    </div>
                  ) : null}
                  {application.nextMilestone ? (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-fg-muted">Next</span>
                      <span className="text-right text-fg">
                        {application.nextMilestone.title}
                        <span className="block text-xs text-fg-subtle">{formatDate(application.nextMilestone.dueDate)}</span>
                      </span>
                    </div>
                  ) : null}
                  <Button asChild className="mt-2">
                    <Link href={`/applications/${application.id}`}>
                      Open workspace <ArrowRight aria-hidden />
                    </Link>
                  </Button>
                </>
              ) : (
                <>
                  <p className="text-sm text-fg-muted">
                    We'll read the guidelines, build the checklist, and write every section from your own facts. You read it over before anything goes anywhere.
                  </p>
                  <Button onClick={start} loading={starting} className="mt-1">
                    Start application <ArrowRight aria-hidden />
                  </Button>
                  {match ? (
                    <div className="flex gap-2">
                      <Button variant="secondary" className="flex-1" onClick={save} aria-pressed={status === "saved"}>
                        <Bookmark aria-hidden className={cn(status === "saved" && "fill-current")} />
                        {status === "saved" ? "Saved" : "Save for later"}
                      </Button>
                      <Button variant="ghost" className="flex-1" onClick={dismiss}>
                        Not for us
                      </Button>
                    </div>
                  ) : null}
                </>
              )}
            </CardContent>
          </Card>
          <p className="mt-3 px-1 text-xs text-fg-subtle">Nothing goes to the funder from here. You submit on their portal when you're ready.</p>
        </aside>
      </div>
    </PageContainer>
  );
}
