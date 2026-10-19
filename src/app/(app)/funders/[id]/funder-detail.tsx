"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { FunderProfile, OutcomeResult } from "@/lib/types";
import { services } from "@/lib/services";
import { PageContainer } from "@/components/app/page-header";
import { StageBadge } from "@/components/app/badges";
import { FitScore } from "@/components/app/fit-score";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import { useToast } from "@/components/ui/toast";
import { formatDate, formatMoney, formatRange, pluralize } from "@/lib/format";
import { AsFiled, funderTypeLabel } from "../as-filed";

const outcomeLabel: Record<OutcomeResult, string> = {
  won: "Won",
  lost: "Declined",
  no_response: "No response",
  withdrawn: "Withdrawn",
};

type Filing = NonNullable<FunderProfile["filing"]>;
type Grantee = Filing["grantees"][number];

const linkClass = "text-ink underline decoration-[1px] underline-offset-4 hover:decoration-ink";

function Bars({ rows, label }: { rows: { key: string; name: string; count: number }[]; label: string }) {
  const max = Math.max(1, ...rows.map((r) => r.count));
  return (
    <ul className="mt-3 border-t border-rule" aria-label={label}>
      {rows.map((r) => (
        <li key={r.key} className="grid grid-cols-[minmax(0,9rem)_1fr_2.5rem] items-center gap-3 border-b border-rule py-2 text-sm">
          <span className="truncate text-ink">{r.name}</span>
          <span className="h-2 min-w-0" aria-hidden>
            <span className="block h-full rounded-r-sm bg-rule-strong" style={{ width: `${(r.count / max) * 100}%` }} />
          </span>
          <span className="text-right text-ink tnum">
            {r.count}
            <span className="sr-only"> {r.count === 1 ? "grant" : "grants"}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

export function FunderDetail({ profile }: { profile: FunderProfile }) {
  const router = useRouter();
  const { toast } = useToast();
  const { funder, filing, match, history, contacts, connections, peers, recommendedAsk } = profile;
  const [adding, setAdding] = React.useState(false);
  const [allGrantees, setAllGrantees] = React.useState(false);

  const add = async () => {
    setAdding(true);
    try {
      const m = await services.funders.addToMatches(funder.id);
      if (!m) {
        toast({ title: "Could not add this foundation", description: "Its filing could not be scored against your profile. Try again, or search for it from Opportunities.", tone: "warning" });
        setAdding(false);
        return;
      }
      toast({ title: "Added to your opportunities", description: `Fit ${m.fitScore}. Saved so you can come back to it.` });
      router.push(`/opportunities/${m.opportunity.id}`);
    } catch (e) {
      toast({ title: "Could not add this foundation", description: e instanceof Error ? e.message : "Try again in a moment.", tone: "warning" });
      setAdding(false);
    }
  };

  const grantees = filing ? (allGrantees ? filing.grantees : filing.grantees.slice(0, 15)) : [];

  return (
    <PageContainer width="wide">
      <Link href="/funders" className={`text-sm ${linkClass}`}>
        All funders
      </Link>

      <div className="mt-6 grid gap-10 lg:grid-cols-[1fr_20rem] lg:gap-12">
        <div className="min-w-0">
          <header>
            <p className="text-base text-ink-muted">
              {funderTypeLabel[funder.type]}
              {filing ? `, ${filing.city}, ${filing.state}` : funder.geography ? `, ${funder.geography}` : ""}
            </p>
            <h1 className="mt-1 font-display text-h1 text-ink">{funder.name}</h1>
            <p className="mt-4 max-w-[65ch] text-lg text-ink-muted">{funder.description}</p>
            <p className="mt-4 flex flex-wrap gap-x-6 gap-y-1 text-sm text-ink-muted">
              <a href={filing ? filing.irsUrl || funder.sourceUrl : funder.sourceUrl} target="_blank" rel="noreferrer" className={linkClass}>
                {filing ? "IRS filing" : "Funder source"}
              </a>
              {filing ? <span className="tnum">Form 990-PF for tax year {filing.taxYear}</span> : <span>Checked {formatDate(funder.lastVerifiedAt)}</span>}
              {filing ? <span className="tnum">EIN {filing.ein.length === 9 ? `${filing.ein.slice(0, 2)}-${filing.ein.slice(2)}` : filing.ein}</span> : null}
              {!filing && funder.websiteUrl && funder.websiteUrl !== funder.sourceUrl ? (
                <a href={funder.websiteUrl} target="_blank" rel="noreferrer" className={linkClass}>
                  Website
                </a>
              ) : null}
            </p>
          </header>

          {filing ? (
            <>
              <dl className="mt-8 grid grid-cols-2 gap-6 border-y border-rule py-5 sm:grid-cols-3">
                <div>
                  <dt className="text-sm text-ink-muted">Total giving</dt>
                  <dd className="mt-1 font-display text-2xl text-ink tnum">{formatMoney(filing.totalGiving, { compact: true })}</dd>
                  <dd className="mt-1 text-sm text-ink-muted tnum">{pluralize(filing.grantCount, "grant")}</dd>
                </div>
                <div>
                  <dt className="text-sm text-ink-muted">Typical grant</dt>
                  <dd className="mt-1 font-display text-2xl text-ink tnum">{formatMoney(filing.grantMedian)}</dd>
                  <dd className="mt-1 text-sm text-ink-muted">The middle grant on its list</dd>
                </div>
                <div>
                  <dt className="text-sm text-ink-muted">Smallest to largest</dt>
                  <dd className="mt-1 font-display text-2xl text-ink tnum">{formatRange(filing.grantMin, filing.grantMax)}</dd>
                </div>
                <div>
                  <dt className="text-sm text-ink-muted">Assets</dt>
                  <dd className="mt-1 font-display text-2xl text-ink tnum">{formatMoney(filing.assets, { compact: true })}</dd>
                </div>
                <div className="col-span-2">
                  <dt className="text-sm text-ink-muted">Applications</dt>
                  <dd className="mt-1 text-base font-semibold text-ink">
                    {filing.acceptsUnsolicited === true
                      ? "Its filing says it accepts applications."
                      : filing.acceptsUnsolicited === false
                        ? "Its filing says it gives only to organizations it chooses."
                        : "Its filing does not say whether it accepts applications."}
                  </dd>
                </div>
              </dl>

              <section aria-labelledby="apply-title" className="mt-12">
                <h2 id="apply-title" className="font-display text-2xl text-ink">
                  How to apply
                </h2>
                <p className="mt-2 max-w-[65ch] text-base text-ink-muted">Word for word from its {filing.taxYear} filing. Check its current guidelines before you write, since filings run a year or two behind.</p>
                <AsFiled application={filing.application} className="mt-4" />
              </section>

              {filing.granteeStates.length || filing.granteeCities.length ? (
                <section aria-labelledby="where-title" className="mt-12">
                  <h2 id="where-title" className="font-display text-2xl text-ink">
                    Where its grantees are
                  </h2>
                  <p className="mt-2 text-base text-ink-muted">Counted from the grants listed on its filing.</p>
                  <div className="grid gap-x-10 sm:grid-cols-2">
                    {filing.granteeStates.length ? (
                      <div className="mt-4">
                        <h3 className="text-base font-semibold text-ink">By state</h3>
                        <Bars label="Grants by state" rows={filing.granteeStates.slice(0, 10).map((s) => ({ key: s.state, name: s.state, count: s.count }))} />
                      </div>
                    ) : null}
                    {filing.granteeCities.length ? (
                      <div className="mt-4">
                        <h3 className="text-base font-semibold text-ink">Top cities</h3>
                        <Bars label="Grants by city" rows={filing.granteeCities.slice(0, 8).map((c) => ({ key: c.city + c.state, name: `${c.city}, ${c.state}`, count: c.count }))} />
                      </div>
                    ) : null}
                  </div>
                </section>
              ) : null}

              {filing.grantees.length ? (
                <section aria-labelledby="grantees-title" className="mt-12">
                  <h2 id="grantees-title" className="font-display text-2xl text-ink">
                    Past grantees
                  </h2>
                  <p className="mt-2 max-w-[65ch] text-base text-ink-muted">The purpose column is the filing&apos;s own text, shown as written.</p>
                  <DataTable<Grantee>
                    className="mt-4"
                    caption="Past grantees"
                    rows={grantees}
                    rowKey={(g) => `${g.name}-${g.city}-${g.amount}-${g.purpose}`}
                    columns={[
                      { key: "name", header: "Organization", cell: (g) => (
                          <span>
                            <span className="font-semibold">{g.name}</span>
                            <span className="mt-0.5 block text-ink-muted sm:hidden">{[g.city, g.state].filter(Boolean).join(", ")}{g.purpose ? `. ${g.purpose}` : ""}</span>
                          </span>
                        ), className: "min-w-[10rem]" },
                      { key: "city", header: "City", cell: (g) => <span className="whitespace-nowrap text-ink-muted">{[g.city, g.state].filter(Boolean).join(", ")}</span>, hideBelow: "sm" },
                      { key: "amount", header: "Amount", cell: (g) => <span className="whitespace-nowrap">{formatMoney(g.amount)}</span>, align: "right" },
                      { key: "purpose", header: "Purpose, as filed", cell: (g) => <span className="text-ink-muted">{g.purpose || "None given"}</span>, className: "min-w-[12rem]", hideBelow: "sm" },
                    ]}
                  />
                  {filing.grantees.length > 15 ? (
                    <Button variant="link" className="mt-3" onClick={() => setAllGrantees((v) => !v)} aria-expanded={allGrantees}>
                      {allGrantees ? "Show fewer" : `Show all ${filing.grantees.length} grantees`}
                    </Button>
                  ) : null}
                </section>
              ) : null}

              {filing.officers.length ? (
                <section aria-labelledby="officers-title" className="mt-12">
                  <h2 id="officers-title" className="font-display text-2xl text-ink">
                    Officers and trustees
                  </h2>
                  <ul className="mt-4 border-t border-rule">
                    {filing.officers.map((o, i) => (
                      <li key={`${i}-${o.name ?? ""}`} className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-0.5 border-b border-rule py-2.5 text-base">
                        <span className="text-ink">{o.name}</span>
                        <span className="text-sm text-ink-muted">{o.title}</span>
                      </li>
                    ))}
                  </ul>
                  <p className="mt-2 text-sm text-ink-muted">From its IRS filing. Public information.</p>
                </section>
              ) : null}
            </>
          ) : (
            <>
              <dl className="mt-8 grid gap-x-6 gap-y-4 border-y border-rule py-4 sm:grid-cols-3">
                <div>
                  <dt className="text-sm text-ink-muted">Typical giving</dt>
                  <dd className="mt-0.5 text-base font-semibold text-ink tnum">{formatRange(funder.givingMin, funder.givingMax)}</dd>
                </div>
                <div>
                  <dt className="text-sm text-ink-muted">Geography</dt>
                  <dd className="mt-0.5 text-base text-ink">{funder.geography}</dd>
                </div>
                <div>
                  <dt className="text-sm text-ink-muted">Focus areas</dt>
                  <dd className="mt-0.5 text-base text-ink">{funder.focusAreas.join(", ") || "Not listed"}</dd>
                </div>
              </dl>
              {funder.recentGrantees.length ? (
                <section aria-labelledby="recent-title" className="mt-12">
                  <h2 id="recent-title" className="font-display text-2xl text-ink">
                    Recent grants
                  </h2>
                  <ul className="mt-4 border-t border-rule">
                    {funder.recentGrantees.map((g, i) => (
                      <li key={`${i}-${g.name ?? ""}`} className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 border-b border-rule py-2.5 text-base">
                        <span className="text-ink">{g.name}</span>
                        <span className="flex gap-x-4 text-sm text-ink-muted tnum">
                          <span>{formatMoney(g.amount)}</span>
                          <span>{g.year}</span>
                        </span>
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}
            </>
          )}

          <section aria-labelledby="history-title" className="mt-12">
            <h2 id="history-title" className="font-display text-2xl text-ink">
              Your history with this funder
            </h2>
            {history.length ? (
              <ul className="mt-4 border-t border-rule">
                {history.map((h) => (
                  <li key={h.application.id} className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border-b border-rule py-3">
                    <div className="min-w-0">
                      <Link href={`/applications/${h.application.id}`} className={`text-base font-semibold ${linkClass}`}>
                        {h.opportunityTitle}
                      </Link>
                      <p className="mt-0.5 flex flex-wrap gap-x-4 text-sm text-ink-muted tnum">
                        {h.application.askAmount ? <span>Asked {formatMoney(h.application.askAmount)}</span> : null}
                        {h.outcome ? (
                          <span>
                            {outcomeLabel[h.outcome.result]}
                            {h.outcome.awardAmount ? `, ${formatMoney(h.outcome.awardAmount)}` : ""} on {formatDate(h.outcome.decidedAt)}
                          </span>
                        ) : h.application.submittedAt ? (
                          <span>Submitted {formatDate(h.application.submittedAt)}</span>
                        ) : (
                          <span>Started {formatDate(h.application.createdAt)}</span>
                        )}
                      </p>
                    </div>
                    <StageBadge stage={h.application.stage} />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-base text-ink-muted">You have not applied to {funder.name} yet.</p>
            )}
          </section>

          {connections.length ? (
            <section aria-labelledby="people-title" className="mt-12">
              <h2 id="people-title" className="font-display text-2xl text-ink">
                People you know
              </h2>
              <ul className="mt-4 border-t border-rule">
                {connections.map((c) => (
                  <li key={c.contactId} className="border-b border-rule py-3">
                    <p className="text-base font-semibold text-ink">{c.name}</p>
                    <p className="text-sm text-ink-muted">{[c.role, c.how].filter(Boolean).join(". ")}</p>
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-sm text-ink-muted">
                From your{" "}
                <Link href="/connections" className={linkClass}>
                  connections
                </Link>
                . A warm introduction usually beats a cold letter.
              </p>
            </section>
          ) : null}

          {contacts.length ? (
            <section aria-labelledby="contacts-title" className="mt-12">
              <h2 id="contacts-title" className="font-display text-2xl text-ink">
                Contacts at the funder
              </h2>
              <ul className="mt-4 border-t border-rule">
                {contacts.map((c) => (
                  <li key={c.id} className="flex flex-wrap items-baseline gap-x-6 gap-y-1 border-b border-rule py-3 text-base">
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-ink">{c.name}</p>
                      <p className="text-sm text-ink-muted">{c.role}</p>
                    </div>
                    {c.email ? <span className="break-all text-sm text-ink-muted">{c.email}</span> : null}
                    <a href={c.publicSourceUrl} target="_blank" rel="noreferrer" className={`text-xs ${linkClass}`}>
                      Public source
                    </a>
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-sm text-ink-muted">Only public professional contacts from the funder&apos;s own pages.</p>
            </section>
          ) : null}

          {peers.length ? (
            <section aria-labelledby="peers-title" className="mt-12">
              <h2 id="peers-title" className="font-display text-2xl text-ink">
                Organizations funded by this foundation that do work like yours
              </h2>
              <p className="mt-2 max-w-[65ch] text-base text-ink-muted">They already know how this funder thinks. Ask one for advice before you write, or about applying together.</p>
              <ul className="mt-4 border-t border-rule">
                {peers.map((p, i) => (
                  <li key={`${i}-${p.name ?? ""}`} className="border-b border-rule py-3">
                    <p className="flex flex-wrap items-baseline justify-between gap-x-6">
                      <span className="text-base font-semibold text-ink">{p.name}</span>
                      <span className="text-sm text-ink-muted">{[p.city, p.state].filter(Boolean).join(", ")}</span>
                    </p>
                    <ul className="mt-1 space-y-0.5">
                      {p.sharedFunders.map((s, i) => (
                        <li key={`${i}-${s.funderId}`} className="text-sm text-ink-muted">
                          <span className="tnum">
                            {formatMoney(s.amount)} from {s.name} in {s.year}
                          </span>
                          {s.purpose ? <span>: {s.purpose}</span> : null}
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>

        <aside className="space-y-6 lg:sticky lg:top-6 lg:self-start">
          {recommendedAsk ? (
            <div className="sheet p-5">
              <h2 className="font-display text-xl text-ink">Recommended ask</h2>
              <p className="mt-3 font-display text-4xl text-ink tnum">{formatMoney(recommendedAsk.amount)}</p>
              <p className="mt-1 text-sm text-ink-muted tnum">
                A reasonable range is {formatMoney(recommendedAsk.low)} to {formatMoney(recommendedAsk.high)}.
              </p>
              <ul className="mt-4 border-t border-rule">
                {recommendedAsk.why.map((w) => (
                  <li key={w} className="border-b border-rule py-2.5 text-sm text-ink">
                    {w}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="sheet p-5">
            {match ? (
              <>
                <div className="flex items-start justify-between gap-4">
                  <h2 className="font-display text-xl text-ink">In your opportunities</h2>
                  <FitScore score={match.fitScore} size="sm" />
                </div>
                <p className="mt-2 text-base text-ink-muted">{match.opportunity.title}</p>
                <Button asChild className="mt-5 w-full">
                  <Link href={`/opportunities/${match.opportunityId}`}>Open the opportunity</Link>
                </Button>
              </>
            ) : filing ? (
              <>
                <h2 className="font-display text-xl text-ink">Not in your opportunities</h2>
                <p className="mt-2 text-base text-ink-muted">
                  We will score this foundation against your profile and save it, so you can start a letter of inquiry from it.
                  {filing.acceptsUnsolicited === false ? " Its filing says it chooses its own grantees, so a letter may go unanswered." : ""}
                </p>
                <Button onClick={add} loading={adding} className="mt-5 w-full">
                  Add to my opportunities
                </Button>
              </>
            ) : (
              <>
                <h2 className="font-display text-xl text-ink">No open opportunity</h2>
                <p className="mt-2 text-base text-ink-muted">Nothing from this funder is in your matches right now. New notices show up in Opportunities when the next search runs.</p>
                <Button asChild variant="secondary" className="mt-5 w-full">
                  <Link href="/opportunities">See your opportunities</Link>
                </Button>
              </>
            )}
          </div>
        </aside>
      </div>
    </PageContainer>
  );
}
