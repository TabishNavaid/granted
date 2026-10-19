"use client";

import * as React from "react";
import Link from "next/link";
import type { Funder, FunderSummary } from "@/lib/types";
import { services } from "@/lib/services";
import { PageContainer, PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EmptyState } from "@/components/ui/empty-state";
import { useToast } from "@/components/ui/toast";
import { formatMoney, formatRange, pluralize } from "@/lib/format";
import { acceptsLabel, funderTypeLabel, placeOf } from "./as-filed";

const relationLabel: Record<FunderSummary["relation"], string> = {
  applied: "You applied",
  matched: "In your matches",
  directory: "From the directory",
};

const STATES = [
  { value: "all", label: "All three states" },
  { value: "OH", label: "Ohio" },
  { value: "KY", label: "Kentucky" },
  { value: "NC", label: "North Carolina" },
];

const href = (id: string) => `/funders/${encodeURIComponent(id)}`;

function typicalGrant(f: Funder) {
  if (f.givingMin != null || f.givingMax != null) return formatRange(f.givingMin, f.givingMax);
  return null;
}

interface Props {
  known: FunderSummary[];
  initialDirectory: FunderSummary[];
  likeYou: { funder: Funder; peers: string[] }[];
}

export function FundersView({ known, initialDirectory, likeYou }: Props) {
  const { toast } = useToast();
  const [query, setQuery] = React.useState("");
  const [state, setState] = React.useState("all");
  const [results, setResults] = React.useState(initialDirectory);
  const [searched, setSearched] = React.useState<{ query: string; state: string } | null>(null);
  const [searching, setSearching] = React.useState(false);

  const search = async (q: string, st: string) => {
    setSearching(true);
    try {
      const rows = await services.funders.directory(q, st === "all" ? null : st);
      setResults(rows);
      setSearched({ query: q, state: st });
    } catch (e) {
      toast({ title: "The search did not run", description: e instanceof Error ? e.message : "Try again in a moment.", tone: "warning" });
    } finally {
      setSearching(false);
    }
  };

  const stateName = (v: string) => STATES.find((s) => s.value === v)?.label ?? v;

  return (
    <PageContainer>
      <PageHeader title="Funders" description="Every funder you have applied to or matched with, and a directory of private foundations to look through." />

      <section aria-labelledby="known-title" className="mt-10">
        <h2 id="known-title" className="font-display text-2xl text-ink">
          Funders you know
        </h2>
        {known.length ? (
          <ul className="mt-4 border-t border-rule">
            {known.map((s) => (
              <li key={s.funder.id} className="border-b border-rule py-4">
                <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
                  <Link href={href(s.funder.id)} className="min-w-0 text-lg font-semibold text-ink underline decoration-rule-strong decoration-[1px] underline-offset-4 hover:decoration-ink">
                    {s.funder.name}
                  </Link>
                  <span className="text-sm text-ink-muted">{relationLabel[s.relation]}</span>
                </div>
                <p className="mt-1 flex flex-wrap gap-x-5 gap-y-1 text-sm text-ink-muted">
                  <span>{funderTypeLabel[s.funder.type]}</span>
                  <span className="tnum">{pluralize(s.applications, "application")}</span>
                  <span className="tnum">{s.won} won</span>
                  {s.dollarsWon ? <span className="tnum">{formatMoney(s.dollarsWon)} awarded</span> : null}
                  {s.fitScore != null ? <span className="tnum">Fit {s.fitScore}</span> : null}
                  {s.acceptsUnsolicited === false ? <span>{acceptsLabel(false)}</span> : null}
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState
            className="mt-4"
            size="sm"
            title="No funders yet"
            description="Funders appear here once you match with one or start an application. The directory below is a good place to start."
            action={
              <Button asChild variant="secondary">
                <Link href="/opportunities">See your opportunities</Link>
              </Button>
            }
          />
        )}
      </section>

      {likeYou.length ? (
        <section aria-labelledby="like-title" className="mt-12">
          <h2 id="like-title" className="font-display text-2xl text-ink">
            Funders like you
          </h2>
          <p className="mt-2 max-w-[65ch] text-base text-ink-muted">Foundations that gave to organizations doing work like yours, which you have not matched with yet. The names are from their own IRS filings.</p>
          <ul className="mt-4 border-t border-rule">
            {likeYou.map(({ funder, peers }) => (
              <li key={funder.id} className="border-b border-rule py-4">
                <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
                  <Link href={href(funder.id)} className="min-w-0 text-lg font-semibold text-ink underline decoration-rule-strong decoration-[1px] underline-offset-4 hover:decoration-ink">
                    {funder.name}
                  </Link>
                  {placeOf(funder) ? <span className="text-sm text-ink-muted">{placeOf(funder)}</span> : null}
                </div>
                {peers.length ? <p className="mt-1 text-base text-ink-muted">Funded {peers.join(", ")}.</p> : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section aria-labelledby="dir-title" className="mt-12">
        <h2 id="dir-title" className="font-display text-2xl text-ink">
          Foundation directory
        </h2>
        <p className="mt-2 max-w-[65ch] text-base text-ink-muted">Private foundations in Ohio, Kentucky, and North Carolina, read from their public IRS Form 990-PF filings.</p>
        <form
          className="mt-5 grid gap-4 sm:grid-cols-[1fr_13rem_auto] sm:items-end"
          onSubmit={(e) => {
            e.preventDefault();
            void search(query, state);
          }}
          role="search"
          aria-label="Foundation directory"
        >
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="dir-query">Name, city, or cause</Label>
            <Input id="dir-query" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Literacy, Dayton, or a foundation's name" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="dir-state">State</Label>
            <Select
              value={state}
              onValueChange={(v) => {
                setState(v);
                void search(query, v);
              }}
            >
              <SelectTrigger id="dir-state">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATES.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button type="submit" loading={searching}>
            Search
          </Button>
        </form>

        <p className="mt-4 text-sm text-ink-muted" aria-live="polite">
          {searched
            ? `${pluralize(results.length, "foundation")}${searched.query.trim() ? ` matching "${searched.query.trim()}"` : ""} in ${stateName(searched.state)}${results.length >= 40 ? ". Showing the first 40; narrow the search to see others." : "."}`
            : `Showing ${pluralize(results.length, "foundation")} from the directory. Search to narrow it.`}
        </p>

        {results.length ? (
          <ul className="mt-3 border-t border-rule">
            {results.map((s) => {
              const grant = typicalGrant(s.funder);
              return (
                <li key={s.funder.id} className="border-b border-rule py-4">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
                    <Link href={href(s.funder.id)} className="min-w-0 text-lg font-semibold text-ink underline decoration-rule-strong decoration-[1px] underline-offset-4 hover:decoration-ink">
                      {s.funder.name}
                    </Link>
                    <span className="text-sm text-ink-muted">{placeOf(s.funder) ?? s.funder.geography}</span>
                  </div>
                  <p className="mt-1 flex flex-wrap gap-x-5 gap-y-1 text-sm text-ink-muted">
                    <span className="tnum">{grant ? `Grants ${grant}` : "Grant sizes not listed"}</span>
                    <span>{acceptsLabel(s.acceptsUnsolicited)}</span>
                    {s.relation !== "directory" ? <span className="font-semibold text-ink">{relationLabel[s.relation]}</span> : null}
                  </p>
                  {s.funder.focusAreas.length ? <p className="mt-1 text-sm text-ink-muted">Focus: {s.funder.focusAreas.join(", ")}</p> : null}
                </li>
              );
            })}
          </ul>
        ) : (
          <EmptyState
            className="mt-3"
            size="sm"
            title="No foundations found"
            description="Try a broader word, like a cause rather than a program name, or search all three states."
            action={
              <Button
                variant="secondary"
                onClick={() => {
                  setQuery("");
                  setState("all");
                  void search("", "all");
                }}
              >
                Clear the search
              </Button>
            }
          />
        )}
      </section>
    </PageContainer>
  );
}
