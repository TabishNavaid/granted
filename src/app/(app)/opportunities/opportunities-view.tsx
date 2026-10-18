"use client";

import * as React from "react";
import type { MatchView, SavedSearch } from "@/lib/types";
import { PageContainer, PageHeader } from "@/components/app/page-header";
import { OpportunityCard } from "@/components/app/opportunity-card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EmptyState } from "@/components/ui/empty-state";
import { Label } from "@/components/ui/label";
import { formatDate } from "@/lib/format";
import { FindMatchesButton } from "./find-matches-button";
import { SearchPanel } from "./search-panel";
import { daysUntil } from "@/lib/format";

type Sort = "fit" | "deadline" | "amount";
type Scope = "all" | "new" | "eligible" | "pipeline";
type Deadline = "any" | "30" | "60" | "90" | "open";
type Amount = "any" | "25" | "100" | "500";

export function OpportunitiesView({ matches, demo, savedSearches }: { matches: MatchView[]; demo: boolean; savedSearches: SavedSearch[] }) {
  const [sort, setSort] = React.useState<Sort>("fit");
  const [scope, setScope] = React.useState<Scope>("all");
  const [deadline, setDeadline] = React.useState<Deadline>("any");
  const [amount, setAmount] = React.useState<Amount>("any");
  const [category, setCategory] = React.useState("any");
  const categories = Array.from(new Set(matches.flatMap((m) => m.funder.focusAreas))).sort();

  const filtered = matches.filter((m) => {
    if (scope === "new" && !m.isNew) return false;
    if (scope === "eligible" && !m.eligibilityChecks.every((c) => c.passed)) return false;
    if (scope === "pipeline" && m.status !== "applying") return false;
    if (deadline === "open" && m.opportunity.forecasted) return false;
    if (deadline !== "any" && deadline !== "open") {
      const d = m.opportunity.deadline ? daysUntil(m.opportunity.deadline) : null;
      if (d === null || d < 0 || d > Number(deadline)) return false;
    }
    if (amount !== "any") {
      const max = m.opportunity.amountMax ?? m.opportunity.amountMin;
      if (max === null || max < Number(amount) * 1000) return false;
    }
    if (category !== "any" && !m.funder.focusAreas.includes(category)) return false;
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
        <div className="flex flex-wrap items-center gap-3">
          <Label htmlFor="deadline" className="sr-only">
            Deadline
          </Label>
          <Select value={deadline} onValueChange={(v) => setDeadline(v as Deadline)}>
            <SelectTrigger id="deadline" className="h-10 w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="any">Any deadline</SelectItem>
              <SelectItem value="30">Due in 30 days</SelectItem>
              <SelectItem value="60">Due in 60 days</SelectItem>
              <SelectItem value="90">Due in 90 days</SelectItem>
              <SelectItem value="open">Open now</SelectItem>
            </SelectContent>
          </Select>
          <Label htmlFor="amount" className="sr-only">
            Award size
          </Label>
          <Select value={amount} onValueChange={(v) => setAmount(v as Amount)}>
            <SelectTrigger id="amount" className="h-10 w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="any">Any award</SelectItem>
              <SelectItem value="25">$25K or more</SelectItem>
              <SelectItem value="100">$100K or more</SelectItem>
              <SelectItem value="500">$500K or more</SelectItem>
            </SelectContent>
          </Select>
          {categories.length ? (
            <>
              <Label htmlFor="category" className="sr-only">
                Category
              </Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger id="category" className="h-10 w-44">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">Any category</SelectItem>
                  {categories.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </>
          ) : null}
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
          description={demo ? "Try another filter. New matches show up every Monday and we'll put them in your Inbox." : matches.length ? "Try another filter, or run a search below." : "We search Grants.gov for posted and forecasted notices that 501(c)(3) nonprofits can apply for, read the strongest in full, and keep only the ones we can tie to your facts."}
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

      {demo ? null : <SearchPanel saved={savedSearches} />}
    </PageContainer>
  );
}
