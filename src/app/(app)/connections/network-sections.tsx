"use client";

import * as React from "react";
import Link from "next/link";
import type { FunderProfile, OrgContact } from "@/lib/types";
import { formatMoney } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";

export type Overlap = { contact: OrgContact; funderId: string; funderName: string; how: string };
export type Peer = FunderProfile["peers"][number];

const funderHref = (id: string) => `/funders/${encodeURIComponent(id)}`;

/** People in the network whose names appear among a funder's officers, or who are linked to a funder. */
export function WhoKnowsWhom({ overlaps, onAskIntro, onImport }: { overlaps: Overlap[]; onAskIntro: (o: Overlap) => void; onImport: () => void }) {
  return (
    <section aria-labelledby="who-knows-whom" className="mt-12 border-t border-rule pt-6">
      <h2 id="who-knows-whom" className="font-display text-2xl text-ink">
        Who knows whom
      </h2>
      <p className="mt-1 max-w-[65ch] text-sm text-ink-muted">People in your network who are linked to a funder, or whose names match an officer or trustee on a foundation&apos;s IRS filing. A name match is only a lead: confirm it is the same person before you ask.</p>
      {overlaps.length === 0 ? (
        <EmptyState
          size="sm"
          className="mt-5"
          title="No overlaps yet"
          description="These fill in when someone you know is linked to a funder in their record, or when a name in your network matches an officer or trustee on a private foundation's 990-PF filing. Importing your board list as a CSV is the quickest way to check."
          action={
            <Button variant="secondary" onClick={onImport}>
              Import a board CSV
            </Button>
          }
        />
      ) : (
        <ul className="mt-5 border-t border-rule">
          {overlaps.map((o) => (
            <li key={`${o.contact.id}-${o.funderId}`} className="flex flex-col gap-3 border-b border-rule py-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <p className="text-base text-ink">
                  <span className="font-semibold">{o.contact.name}</span>
                  {o.contact.role || o.contact.organization ? <span className="text-ink-muted">, {[o.contact.role, o.contact.organization].filter(Boolean).join(", ")}</span> : null}
                </p>
                <p className="mt-0.5 text-base text-ink">
                  <Link href={funderHref(o.funderId)} className="font-semibold underline decoration-[1.5px] underline-offset-4 hover:decoration-ink">
                    {o.funderName}
                  </Link>
                </p>
                <p className="mt-1 max-w-[65ch] text-sm text-ink-muted">{o.how}</p>
              </div>
              <Button variant="secondary" size="sm" className="shrink-0 self-start" onClick={() => onAskIntro(o)} aria-label={`Ask for an intro: ${o.contact.name} to ${o.funderName}`}>
                Ask for an intro
              </Button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** Organizations funded by the same foundations for similar work. */
export function PeerOrganizations({ peers }: { peers: Peer[] }) {
  return (
    <section aria-labelledby="peer-orgs" className="mt-12 border-t border-rule pt-6">
      <h2 id="peer-orgs" className="font-display text-2xl text-ink">
        Peer organizations
      </h2>
      <p className="mt-1 max-w-[65ch] text-sm text-ink-muted">Organizations the same foundations funded for similar work, read from those foundations&apos; IRS 990-PF filings. Worth a call to ask how they approached the funder, or to talk about a joint application.</p>
      {peers.length === 0 ? (
        <EmptyState
          size="sm"
          className="mt-5"
          title="No peers found yet"
          description="Peers appear once you have matches with private foundations: we list the other organizations those foundations funded. Add a foundation from the directory to start."
          action={
            <Button asChild variant="secondary">
              <Link href="/funders">Search private foundations</Link>
            </Button>
          }
        />
      ) : (
        <ul className="mt-5 border-t border-rule">
          {peers.map((p) => (
            <li key={`${p.name}-${p.city}-${p.state}`} className="border-b border-rule py-4">
              <p className="text-base text-ink">
                <span className="font-semibold">{p.name}</span>
                {p.city || p.state ? <span className="text-ink-muted">, {[p.city, p.state].filter(Boolean).join(", ")}</span> : null}
              </p>
              <ul className="mt-2 flex flex-col gap-1.5">
                {p.sharedFunders.map((f) => (
                  <li key={`${f.funderId}-${f.year}-${f.amount}`} className="text-sm text-ink-muted">
                    <Link href={funderHref(f.funderId)} className="font-semibold text-ink underline decoration-[1.5px] underline-offset-4 hover:decoration-ink">
                      {f.name}
                    </Link>{" "}
                    gave <span className="tnum">{formatMoney(f.amount)}</span> in <span className="tnum">{f.year}</span>
                    {f.purpose ? <>: {f.purpose}</> : null}
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
