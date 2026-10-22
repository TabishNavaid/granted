"use client";

import * as React from "react";
import Link from "next/link";
import type { ApplicationView, MatchView, SavedSearch } from "@/lib/types";
import { BidSearches } from "@/components/bids/bid-searches";
import type { SamNotice } from "@/lib/services/contracts";
import { PageContainer, PageHeader } from "@/components/app/page-header";
import { OpportunityCard } from "@/components/app/opportunity-card";
import { AddRfpDialog } from "@/components/bids/add-rfp-dialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState } from "@/components/ui/empty-state";
import { stageLabel } from "@/lib/segments";
import { daysUntil, formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

interface Props {
  bids: (ApplicationView & { goNoGo: number | null })[];
  grants: MatchView[];
  sam: { status: "live" | "recorded" | "not_connected"; note: string; notices: SamNotice[]; recordedOn: string | null };
  demo: boolean;
  initialTab: "bids" | "grants";
  savedSearches: SavedSearch[];
  profile: { naics: string[]; states: string[] };
}

const due = (iso: string | null) => {
  if (!iso) return "No due date";
  const d = daysUntil(iso.slice(0, 10));
  return `Due ${formatDate(iso.slice(0, 10))}${d >= 0 && d <= 30 ? `, in ${d} day${d === 1 ? "" : "s"}` : ""}`;
};

/** A firm's opportunities: bids and RFPs (its own and SAM.gov's), and, kept apart, grants and incentives open to firms. */
export function FirmOpportunitiesView({ bids, grants, sam: initialSam, demo, initialTab, savedSearches, profile }: Props) {
  const [tab, setTab] = React.useState(initialTab);
  const [sam, setSam] = React.useState(initialSam);
  const [label, setLabel] = React.useState("Your profile");
  const active = bids.filter((b) => !["won", "lost"].includes(b.stage));
  return (
    <PageContainer>
      <PageHeader title="Opportunities" description="Bids and RFPs you are tracking, open bids from SAM.gov and state and city portals for your work, and, separately, grants a firm like yours can apply for." actions={<AddRfpDialog demo={demo} />} />
      <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)} className="mt-6">
        <TabsList variant="pill" aria-label="Kind of opportunity">
          <TabsTrigger value="bids">
            Bids and RFPs <span className="text-sm text-ink-muted tnum">{active.length + sam.notices.filter((n) => !n.added).length}</span>
          </TabsTrigger>
          <TabsTrigger value="grants">
            Grants and incentives <span className="text-sm text-ink-muted tnum">{grants.length}</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="bids" className="mt-8">
          <section aria-labelledby="your-bids">
            <h2 id="your-bids" className="font-display text-2xl text-ink">
              Your bids
            </h2>
            {active.length ? (
              <ul className="mt-4 border-t border-rule">
                {active.map((b) => (
                  <li key={b.id} className="grid gap-x-6 gap-y-1 border-b border-rule py-4 sm:grid-cols-[1fr_auto]">
                    <div className="min-w-0">
                      <Link href={`/applications/${b.id}`} className="font-display text-xl text-ink underline-offset-4 hover:underline">
                        {b.opportunity.title}
                      </Link>
                      <p className="mt-1 text-base text-ink-muted">
                        {b.funder.name}, {stageLabel(b.stage, "contract")}, {due(b.opportunity.deadline)}
                      </p>
                    </div>
                    {b.goNoGo != null ? (
                      <p className="text-base text-ink sm:text-right">
                        <span className="font-mono text-2xl tnum">{b.goNoGo}</span> <span className="text-sm text-ink-muted">go/no-go</span>
                      </p>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState className="mt-4" size="sm" title="No bids yet" description="Add an RFP you have in hand, or pick a notice from SAM.gov below. We build the compliance matrix and a go/no-go score from your records." />
            )}
          </section>

          <section aria-labelledby="sam" className="mt-12">
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <h2 id="sam" className="font-display text-2xl text-ink">
                Open bids for your work
              </h2>
              <p className="text-sm text-ink-muted">
                {sam.notices.length} shown for <span className="font-semibold text-ink">{label}</span>
              </p>
            </div>
            <BidSearches saved={savedSearches} profile={profile} onResults={(r, l) => { setSam(r); setLabel(l); }} />
            <p className={cn("mt-3 text-sm", sam.status === "not_connected" ? "text-ink" : "text-ink-muted")}>{sam.note}</p>
            {sam.status === "not_connected" ? (
              <div className="sheet mt-4 p-5">
                <p className="text-base text-ink">SAM.gov is not connected.</p>
                <p className="mt-2 max-w-[60ch] text-base text-ink-muted">Federal contract search uses SAM.gov&apos;s free public API. Create a key in your SAM.gov account (Workspace, then Profile, then Public API Key), set it as SAM_GOV_API_KEY, and this list fills with notices for your NAICS codes. Adding an RFP you already have works without it.</p>
                <Button asChild variant="secondary" className="mt-4">
                  <Link href="/settings/integrations">How to connect SAM.gov</Link>
                </Button>
              </div>
            ) : sam.notices.length ? (
              <ul className="mt-4 border-t border-rule">
                {sam.notices.map((n) => (
                  <li key={n.noticeId} className="grid gap-x-6 gap-y-2 border-b border-rule py-5 sm:grid-cols-[4.5rem_1fr]">
                    <p className="font-mono text-3xl leading-none text-ink tnum" aria-label={`Fit ${n.fit?.score ?? 0} of 100`}>
                      {n.fit?.score ?? "–"}
                    </p>
                    <div className="min-w-0">
                      <p className="text-sm text-ink-muted">
                        <span className="text-ink">{n.type}</span>, {n.agency}
                        {n.office ? `, ${n.office}` : ""}
                      </p>
                      <h3 className="mt-1 font-display text-xl leading-tight text-ink">{n.title}</h3>
                      <dl className="mt-1 flex flex-wrap gap-x-6 gap-y-1 text-sm">
                        <div>
                          <dt className="sr-only">Due</dt>
                          <dd className="text-ink">{due(n.responseDeadLine)}</dd>
                        </div>
                        {n.naicsCode ? (
                          <div className="flex gap-1.5">
                            <dt className="text-ink-muted">NAICS</dt>
                            <dd className="font-mono text-ink">{n.naicsCode}</dd>
                          </div>
                        ) : null}
                        {n.solicitationNumber ? (
                          <div className="flex gap-1.5">
                            <dt className="text-ink-muted">No.</dt>
                            <dd className="font-mono text-ink">{n.solicitationNumber}</dd>
                          </div>
                        ) : null}
                        {n.placeOfPerformance ? (
                          <div className="flex gap-1.5">
                            <dt className="text-ink-muted">Place</dt>
                            <dd className="text-ink">{n.placeOfPerformance}</dd>
                          </div>
                        ) : null}
                      </dl>
                      {n.setAside ? <p className="mt-1 text-base text-ink">Set aside: {n.setAside}</p> : null}
                      {n.fit?.reasons.length ? (
                        <ul className="mt-2 flex flex-col gap-1 text-base text-ink">
                          {n.fit.reasons.map((r) => (
                            <li key={r}>{r}</li>
                          ))}
                        </ul>
                      ) : null}
                      {n.fit?.cautions.length ? (
                        <ul className="mt-1 flex flex-col gap-1 text-base text-ink-muted">
                          {n.fit.cautions.map((r) => (
                            <li key={r}>{r}</li>
                          ))}
                        </ul>
                      ) : null}
                      <div className="mt-3 flex flex-wrap items-center gap-3">
                        {n.added ? <span className="text-base font-semibold text-ink">Added to your bids</span> : <AddRfpDialog demo={demo} samNoticeId={n.noticeId} trigger={<Button size="sm">Add as a bid</Button>} />}
                        <a href={n.uiLink} target="_blank" rel="noreferrer" className="text-base text-ink underline underline-offset-4">
                          {/sam\.gov/.test(n.uiLink) ? "Open on SAM.gov" : "Open the official notice"}<span className="sr-only"> (opens in a new tab)</span>
                        </a>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState className="mt-4" size="sm" title="No open bids match this search" description="Try a shorter NAICS code (2362 covers all building construction), another state, or fewer set-asides. New notices post every day." />
            )}
          </section>
        </TabsContent>

        <TabsContent value="grants" className="mt-8">
          <p className="max-w-[65ch] text-base text-ink-muted">Grants and incentives a for-profit firm can apply for: energy efficiency, workforce training, and small business innovation programs. They are not bids: you apply for funding rather than compete for a contract.</p>
          {grants.length ? (
            <ul className="mt-6 border-b border-rule">
              {grants.map((m) => (
                <li key={m.id}>
                  <OpportunityCard match={m} />
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState className="mt-6" size="sm" title="No grants found yet" description="Run setup's search, or check back: Grants.gov posts new programs every week." />
          )}
        </TabsContent>
      </Tabs>
    </PageContainer>
  );
}
