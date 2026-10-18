"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import type { SavedSearch, SearchCandidate } from "@/lib/types";
import { services } from "@/lib/services";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";
import { formatDate, relativeTime } from "@/lib/format";
import { FUNDING_CATEGORIES } from "@/lib/grantsgov/categories";

/**
 * Saved searches and a custom Grants.gov search. Results come back unscored
 * (titles from the API); the user picks the ones worth reading and we score
 * only those against the confirmed profile.
 */
export function SearchPanel({ saved: initial }: { saved: SavedSearch[] }) {
  const router = useRouter();
  const { toast } = useToast();
  const [saved, setSaved] = React.useState(initial);
  const [open, setOpen] = React.useState(false);
  const [keyword, setKeyword] = React.useState("");
  const [category, setCategory] = React.useState("any");
  const [running, setRunning] = React.useState(false);
  const [results, setResults] = React.useState<{ candidates: SearchCandidate[]; hitCount: number; keyword: string; categories: string[]; savedId?: string } | null>(null);
  const [picked, setPicked] = React.useState<Record<string, boolean>>({});
  const [scoring, setScoring] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const run = async (kw: string, cats: string[], savedId?: string) => {
    setRunning(true);
    setError(null);
    setPicked({});
    const r = await services.opportunities.runSearch({ keyword: kw, fundingCategories: cats, savedSearchId: savedId });
    setRunning(false);
    if (!r.ok) return setError(r.error);
    setResults({ ...r.data, keyword: kw, categories: cats, savedId });
    if (savedId) setSaved((l) => l.map((s) => (s.id === savedId ? { ...s, lastRunAt: new Date().toISOString() } : s)));
  };
  const score = async () => {
    const ids = Object.entries(picked)
      .filter(([, v]) => v)
      .map(([k]) => k);
    if (!ids.length) return;
    setScoring(true);
    const r = await services.opportunities.scoreCandidates(ids);
    setScoring(false);
    if (!r.ok) return toast({ title: "Could not score those", description: r.error, tone: "warning" });
    toast({ title: r.data.added ? `${r.data.added} added to your matches` : "None of those fit", description: r.data.dropped ? `${r.data.dropped} set aside as not eligible or not a fit.` : "Each one has reasons tied to your facts." });
    setOpen(false);
    setResults(null);
    router.refresh();
  };
  const save = async () => {
    if (!results) return;
    const s = await services.opportunities.saveSearch({ name: results.keyword, keyword: results.keyword, fundingCategories: results.categories });
    setSaved((l) => [s, ...l]);
    toast({ title: "Search saved", description: "Run it again any time from this list." });
  };
  const remove = async (id: string) => {
    await services.opportunities.deleteSavedSearch(id);
    setSaved((l) => l.filter((s) => s.id !== id));
  };
  const pickedCount = Object.values(picked).filter(Boolean).length;

  return (
    <section className="mt-10 border-t border-rule pt-5" aria-labelledby="searches-title">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 id="searches-title" className="font-display text-2xl text-ink">
            Your searches
          </h2>
          <p className="mt-1 max-w-[60ch] text-base text-ink-muted">Search Grants.gov for a program type in your own words. Pick the notices worth reading and we score only those.</p>
        </div>
        <Button
          variant="secondary"
          onClick={() => {
            setResults(null);
            setError(null);
            setOpen(true);
          }}
        >
          New search
        </Button>
      </div>
      {saved.length ? (
        <ul className="mt-4 border-t border-rule">
          {saved.map((s) => (
            <li key={s.id} className="flex flex-wrap items-center gap-x-6 gap-y-2 border-b border-rule py-3 text-base">
              <span className="min-w-0 flex-1">
                <span className="font-semibold text-ink">{s.name}</span>
                <span className="ml-3 text-sm text-ink-muted">
                  &ldquo;{s.keyword}&rdquo;{s.fundingCategories.length ? `, ${s.fundingCategories.map((c) => FUNDING_CATEGORIES[c] ?? c).join(", ")}` : ""}
                </span>
              </span>
              <span className="text-sm text-ink-muted">{s.lastRunAt ? `Ran ${relativeTime(s.lastRunAt)}` : "Not run yet"}</span>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  setKeyword(s.keyword);
                  setCategory(s.fundingCategories[0] ?? "any");
                  setOpen(true);
                  void run(s.keyword, s.fundingCategories, s.id);
                }}
              >
                Run
              </Button>
              <Button size="sm" variant="ghost" onClick={() => remove(s.id)}>
                Remove
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-4 text-base text-ink-muted">No saved searches yet.</p>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent size="lg">
          <DialogHeader>
            <DialogTitle>Search Grants.gov</DialogTitle>
            <DialogDescription>One or two specific words work best: &ldquo;mentoring&rdquo;, &ldquo;pantry&rdquo;, &ldquo;folklife&rdquo;. Grants.gov matches any word you give it.</DialogDescription>
          </DialogHeader>
          <form
            className="flex flex-col gap-3 sm:flex-row sm:items-end"
            onSubmit={(e) => {
              e.preventDefault();
              if (keyword.trim()) void run(keyword.trim(), category === "any" ? [] : [category]);
            }}
          >
            <Field id="kw" label="Keyword" className="flex-1">
              <Input value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder="mentoring" />
            </Field>
            <Field id="cat" label="Category">
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger id="cat" className="w-56">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">Any category</SelectItem>
                  {Object.entries(FUNDING_CATEGORIES).map(([k, v]) => (
                    <SelectItem key={k} value={k}>
                      {v}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Button type="submit" loading={running} disabled={!keyword.trim()}>
              {running ? "Searching" : "Search"}
            </Button>
          </form>
          {error ? (
            <p role="alert" className="border-l-[6px] border-alert py-1 pl-4 text-base text-ink">
              {error}
            </p>
          ) : null}
          {results ? (
            <div>
              <p className="flex flex-wrap items-baseline justify-between gap-2 text-sm text-ink-muted">
                <span className="tnum">
                  {results.hitCount} on Grants.gov, {results.candidates.length} still open to nonprofits
                </span>
                {!results.savedId ? (
                  <button type="button" onClick={save} className="font-semibold text-ink underline decoration-[1.5px] underline-offset-4 hover:decoration-corn">
                    Save this search
                  </button>
                ) : null}
              </p>
              {results.candidates.length === 0 ? (
                <p className="mt-3 text-base text-ink">Nothing open for that word. Try a different one.</p>
              ) : (
                <ul className="mt-3 max-h-80 overflow-y-auto border-t border-rule">
                  {results.candidates.map((c) => (
                    <li key={c.externalId} className="flex items-start gap-3 border-b border-rule py-2.5">
                      <Checkbox id={`c-${c.externalId}`} checked={!!picked[c.externalId]} onCheckedChange={(v) => setPicked((p) => ({ ...p, [c.externalId]: v === true }))} className="mt-1" />
                      <label htmlFor={`c-${c.externalId}`} className="min-w-0 flex-1 cursor-pointer">
                        <span className="block text-base text-ink">{c.title}</span>
                        <span className="flex flex-wrap gap-x-4 text-sm text-ink-muted">
                          <span>{c.agency}</span>
                          <span>{c.status === "forecasted" ? "Forecasted" : c.closeDate ? `Closes ${formatDate(c.closeDate)}` : "No close date"}</span>
                          <a href={c.url} target="_blank" rel="noreferrer" className="text-ink underline decoration-[1px] underline-offset-2 hover:decoration-corn">
                            Grants.gov
                          </a>
                        </span>
                      </label>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : null}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Close
            </Button>
            <Button onClick={score} loading={scoring} disabled={!pickedCount}>
              {scoring ? "Reading and scoring" : pickedCount ? `Read and score ${pickedCount}` : "Pick notices to score"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
