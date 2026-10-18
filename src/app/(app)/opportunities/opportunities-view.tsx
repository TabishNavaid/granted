"use client";

import * as React from "react";
import type { MatchView } from "@/lib/types";
import { PageContainer, PageHeader } from "@/components/app/page-header";
import { OpportunityCard } from "@/components/app/opportunity-card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EmptyState } from "@/components/ui/empty-state";
import { Label } from "@/components/ui/label";
import { formatDate } from "@/lib/format";
import { FindMatchesButton } from "./find-matches-button";

type Sort = "fit" | "deadline" | "amount";
type Scope = "all" | "new" | "eligible" | "pipeline";

export function OpportunitiesView({ matches, demo }: { matches: MatchView[]; demo: boolean }) {
  const [sort, setSort] = React.useState<Sort>("fit");
  const [scope, setScope] = React.useState<Scope>("all");

  const filtered = matches.filter((m) => {
    if (scope === "new") return m.isNew;
    if (scope === "eligible") return m.eligibilityChecks.every((c) => c.passed);
    if (scope === "pipeline") return m.status === "applying";
    return true;
  });
  const sorted = [...filtered].sort((a, b) => {
    if (sort === "fit") return b.fitScore - a.fitScore;
    if (sort === "amount") return (b.opportunity.amountMax ?? 0) - (a.opportunity.amountMax ?? 0);
    const ad = a.opportunity.deadline ?? "9999";
    const bd = b.opportunity.deadline ?? "9999";
    return ad.localeCompare(bd);
  });
  const lastScan = matches.reduce((latest, m) => (m.createdAt > latest ? m.createdAt : latest), "");
  const newCount = matches.filter((m) => m.isNew).length;

  return (
    <PageContainer>
      <PageHeader
        title="Opportunities"
        description={
          matches.length
            ? demo
              ? `${matches.length} funders you can actually apply to, ranked by fit. We last looked on ${formatDate(lastScan)} and we'll look again Monday.`
              : `${matches.length} open federal notice${matches.length === 1 ? "" : "s"} from Grants.gov you can apply for, ranked by fit against your confirmed facts. We last looked on ${formatDate(lastScan)}.`
            : "Nothing here yet. Confirm your profile, then search Grants.gov for open notices that fit."
        }
        actions={demo ? undefined : <FindMatchesButton label={matches.length ? "Search again" : "Search Grants.gov now"} size="sm" />}
      />
      <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <Tabs value={scope} onValueChange={(v) => setScope(v as Scope)}>
          <TabsList variant="pill" aria-label="Filter matches">
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="new">
              New {newCount ? <span className="text-sm text-ink-muted tnum">{newCount}</span> : null}
            </TabsTrigger>
            <TabsTrigger value="eligible">Fully eligible</TabsTrigger>
            <TabsTrigger value="pipeline">In pipeline</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="flex items-center gap-3">
          <Label htmlFor="sort" className="shrink-0 text-sm font-normal text-ink-muted">
            Sort by
          </Label>
          <Select value={sort} onValueChange={(v) => setSort(v as Sort)}>
            <SelectTrigger id="sort" className="h-10 w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="fit">Best fit</SelectItem>
              <SelectItem value="deadline">Soonest deadline</SelectItem>
              <SelectItem value="amount">Largest award</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {sorted.length === 0 ? (
        <EmptyState
          className="mt-6"
          title="No matches here"
          description={demo ? "Try another filter. New matches show up every Monday and we'll put them in your Inbox." : matches.length ? "Try another filter." : "We search Grants.gov for posted and forecasted notices that 501(c)(3) nonprofits can apply for, read the strongest in full, and keep only the ones we can tie to your facts."}
          action={demo || matches.length ? undefined : <FindMatchesButton size="md" />}
        />
      ) : (
        <ul className="mt-6 border-b border-rule">
          {sorted.map((m) => (
            <li key={m.id}>
              <OpportunityCard match={m} />
            </li>
          ))}
        </ul>
      )}

    </PageContainer>
  );
}
