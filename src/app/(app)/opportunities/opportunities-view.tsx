"use client";

import * as React from "react";
import { Compass } from "lucide-react";
import type { MatchView } from "@/lib/types";
import { PageContainer, PageHeader } from "@/components/app/page-header";
import { OpportunityCard } from "@/components/app/opportunity-card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EmptyState } from "@/components/ui/empty-state";
import { Label } from "@/components/ui/label";
import { formatDate } from "@/lib/format";

type Sort = "fit" | "deadline" | "amount";
type Scope = "all" | "new" | "eligible" | "pipeline";

export function OpportunitiesView({ matches }: { matches: MatchView[] }) {
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
        description={`${matches.length} funders you can actually apply to, ranked by fit. We last looked on ${formatDate(lastScan)} and we'll look again Monday.`}
      />
      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Tabs value={scope} onValueChange={(v) => setScope(v as Scope)}>
          <TabsList variant="pill" aria-label="Filter matches">
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="new">
              New {newCount ? <span className="text-xs text-fg-subtle tnum">{newCount}</span> : null}
            </TabsTrigger>
            <TabsTrigger value="eligible">Fully eligible</TabsTrigger>
            <TabsTrigger value="pipeline">In pipeline</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="flex items-center gap-2">
          <Label htmlFor="sort" className="text-fg-subtle">
            Sort by
          </Label>
          <Select value={sort} onValueChange={(v) => setSort(v as Sort)}>
            <SelectTrigger id="sort" className="h-9 w-40">
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
          icon={<Compass />}
          title="No matches here"
          description="Try another filter. New matches show up every Monday and we'll put them in your Inbox."
        />
      ) : (
        <ul className="mt-6 flex flex-col gap-4">
          {sorted.map((m) => (
            <li key={m.id}>
              <OpportunityCard match={m} />
            </li>
          ))}
        </ul>
      )}

      <p className="mt-8 text-sm text-fg-subtle">
        Every funder here comes from a page we checked ourselves. Anything you can't apply for never makes it to this list.
      </p>
    </PageContainer>
  );
}
