"use client";

import * as React from "react";
import Link from "next/link";
import type { MatchView, OrgType, SavedSearch } from "@/lib/types";
import { PageContainer, PageHeader } from "@/components/app/page-header";
import { OpportunityCard, hardEligibilityFails } from "@/components/app/opportunity-card";
import { Button } from "@/components/ui/button";
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

export function OpportunitiesView({ matches, demo, savedSearches, orgType = "nonprofit" }: { matches: MatchView[]; demo: boolean; savedSearches: SavedSearch[]; orgType?: OrgType }) {
  const [sort, setSort] = React.useState<Sort>("fit");
  const [scope, setScope] = React.useState<Scope>("all");
  const [deadline, setDeadline] = React.useState<Deadline>("any");
  const [amount, setAmount] = React.useState<Amount>("any");
  const [category, setCategory] = React.useState("any");
  const [showIneligible, setShowIneligible] = React.useState(false);
  const categories = Array.from(new Set(matches.flatMap((m) => m.funder.focusAreas))).sort();
  // A match that fails a check that would rule you out is hidden by default. Anything already in the pipeline stays.
  const mayNotQualify = (m: MatchView) => m.status !== "applying" && hardEligibilityFails(m).length > 0;

  const passesFilters = (m: MatchView) => {
    if (scope === "new" && !m.isNew) return false;
    if (scope === "eligible" && (hardEligibilityFails(m).length > 0 || m.eligibilityChecks.some((c) => !c.passed && c.label.startsWith("Not open yet")))) return false;
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
  };
  const inFilters = matches.filter(passesFilters);
  const hiddenCount = inFilters.filter(mayNotQualify).length;
  const filtered = showIneligible ? inFilters : inFilters.filter((m) => !mayNotQualify(m));
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
          orgType === "research"
            ? matches.length
              ? `${matches.length} research funding notices from Grants.gov open to universities, ranked by how closely they ask for your team's work, each with the funder's rules on AI. Last searched ${formatDate(lastScan)}.`
              : "Nothing here yet. Confirm your team's profile, then search for research funding."
            : orgType === "individual"
              ? matches.length
                ? `${matches.length} scholarship funds from foundations' IRS filings, ranked for your state, level, and field. Last searched ${formatDate(lastScan)}.`
                : "Nothing here yet. Set up your profile from your résumé, then search for scholarships."
              : matches.length
            ? demo
              ? `${matches.length} funders you can apply to, federal and private, ranked by fit against the confirmed facts. Last searched ${formatDate(lastScan)}.`
              : `${matches.length} funders you can apply to: open federal notices from Grants.gov and private foundations from their IRS filings, ranked by fit against your confirmed facts. Last searched ${formatDate(lastScan)}.`
            : "Nothing here yet. Confirm your profile, then search Grants.gov and the foundation filings for funders that fit."
        }
        actions={demo ? undefined : <FindMatchesButton label={matches.length ? "Search again" : "Search Grants.gov now"} size="sm" />}
      />
      <div className="mt-6 flex flex-col gap-4 2xl:flex-row 2xl:items-end 2xl:justify-between">
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

      {hiddenCount ? (
        <p className="mt-5 flex flex-wrap items-baseline gap-x-3 gap-y-1 text-sm text-ink-muted">
          <span>{showIneligible ? `Showing ${hiddenCount} that fail${hiddenCount === 1 ? "s" : ""} an eligibility check.` : `${hiddenCount} hidden because ${hiddenCount === 1 ? "it fails" : "they fail"} an eligibility check.`}</span>
          <Button variant="link" size="sm" onClick={() => setShowIneligible((v) => !v)} aria-pressed={showIneligible}>
            {showIneligible ? "Hide them" : `Show ${hiddenCount} you may not be eligible for`}
          </Button>
        </p>
      ) : null}

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

      <section aria-labelledby="more-places" className="mt-10 border-t border-rule pt-5">
        <h2 id="more-places" className="font-display text-xl text-ink">
          Other places to look
        </h2>
        <ul className="mt-3 flex flex-col gap-2 text-base">
          <li>
            <Link href="/funders" className="font-semibold text-ink underline decoration-[1.5px] underline-offset-4 hover:decoration-ink">
              The funder directory
            </Link>
            <span className="text-ink-muted">: private foundations from their IRS 990-PF filings, with past grants and who they fund.</span>
          </li>
          <li>
            <Link href="/scholarships" className="font-semibold text-ink underline decoration-[1.5px] underline-offset-4 hover:decoration-ink">
              Looking for a scholarship for yourself?
            </Link>
            <span className="text-ink-muted"> Foundations that give to students, matched to where you live and what you study.</span>
          </li>
        </ul>
      </section>

      {orgType !== "nonprofit" ? null : demo ? (
        <p className="mt-8 max-w-[65ch] text-sm text-ink-muted">In the demo, the Grants.gov searches are recorded runs, so a custom search is not available here. The foundation directory on the Funders page is searchable now.</p>
      ) : (
        <SearchPanel saved={savedSearches} />
      )}
    </PageContainer>
  );
}
