"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import type { Document, Fact, Organization } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input, Textarea } from "@/components/ui/input";
import { Field } from "@/components/ui/label";
import { CitationChip } from "@/components/app/citation-chip";
import { cn } from "@/lib/utils";

export function ProfileStep({ org, facts, documents }: { org: Organization; facts: Fact[]; documents: Document[] }) {
  const router = useRouter();
  const [mission, setMission] = React.useState(org.mission);
  const [area, setArea] = React.useState(org.serviceArea);
  const [editing, setEditing] = React.useState(false);
  const [kept, setKept] = React.useState<Record<string, boolean>>(Object.fromEntries(facts.map((f) => [f.id, true])));
  const [loading, setLoading] = React.useState(false);
  const docOf = (id: string | null) => documents.find((d) => d.id === id);
  const keptCount = Object.values(kept).filter(Boolean).length;

  return (
    <div className="grid gap-10 lg:grid-cols-[1fr_18rem]">
      <div>
        <h1 className="font-display text-h1 text-ink">Does this look right?</h1>
        <p className="mt-4 max-w-[60ch] text-lg text-ink-muted">This is what we'll say about you. Uncheck anything that's off and we'll leave it out.</p>

        <section className="sheet mt-8 p-5" aria-labelledby="prof-title">
          <div className="flex items-start justify-between gap-3">
            <h2 id="prof-title" className="font-display text-2xl text-ink">
              {org.name}
            </h2>
            <Button variant="ghost" size="sm" onClick={() => setEditing((e) => !e)} aria-expanded={editing}>
              {editing ? "Done" : "Edit"}
            </Button>
          </div>
          {editing ? (
            <div className="mt-4 flex flex-col gap-4">
              <Field id="mission" label="Mission">
                <Textarea value={mission} onChange={(e) => setMission(e.target.value)} />
              </Field>
              <Field id="area" label="Service area">
                <Input value={area} onChange={(e) => setArea(e.target.value)} />
              </Field>
            </div>
          ) : (
            <>
              <p className="mt-3 max-w-[60ch] text-xl leading-relaxed text-ink">{mission}</p>
              <dl className="mt-5 grid gap-x-4 gap-y-3 border-t border-rule pt-4 text-base sm:grid-cols-2">
                <div>
                  <dt className="text-sm text-ink-muted">Service area</dt>
                  <dd className="text-ink">{area}</dd>
                </div>
                <div>
                  <dt className="text-sm text-ink-muted">Causes</dt>
                  <dd className="text-ink">{org.causes.join(", ")}</dd>
                </div>
              </dl>
            </>
          )}
        </section>

        <section className="mt-10" aria-labelledby="facts-title">
          <h2 id="facts-title" className="font-display text-2xl text-ink">
            Facts we found
          </h2>
          <p className="mt-1 text-base text-ink-muted">Each one links to the page it came from. Open a citation to read the exact passage.</p>
          <ul className="mt-4 border-t border-rule">
            {facts.map((f) => {
              const d = docOf(f.sourceDocumentId);
              return (
                <li key={f.id} className={cn("flex items-start gap-4 border-b border-rule py-3", !kept[f.id] && "opacity-50")}>
                  <Checkbox id={`keep-${f.id}`} checked={kept[f.id]} onCheckedChange={(c) => setKept((k) => ({ ...k, [f.id]: c === true }))} className="mt-1.5" />
                  <label htmlFor={`keep-${f.id}`} className="min-w-0 flex-1 cursor-pointer">
                    <span className="block text-sm text-ink-muted">{f.label}</span>
                    <span className={cn("block font-display text-xl text-ink", !kept[f.id] && "line-through")}>{f.value}</span>
                  </label>
                  <CitationChip label={d ? `${d.title}${f.sourcePage ? `, p.${f.sourcePage}` : ""}` : "Website"} sourceTitle={d?.title} excerpt={f.sourceExcerpt} page={f.sourcePage} className="mt-1.5" />
                </li>
              );
            })}
          </ul>
        </section>

        <div className="mt-8 flex flex-wrap items-center gap-x-5 gap-y-3">
          <Button
            size="lg"
            loading={loading}
            onClick={async () => {
              setLoading(true);
              await new Promise((r) => setTimeout(r, 1200));
              router.push("/onboarding/matches");
            }}
          >
            {loading ? "Finding your matches" : "Looks right, find my matches"}
          </Button>
          <span className="text-base text-ink-muted tnum">
            {keptCount} of {facts.length} facts kept
          </span>
        </div>
      </div>
      <aside className="border-l-[3px] border-rule-strong pl-5 text-base text-ink-muted lg:self-start">
        <h2 className="font-display text-xl text-ink">Why confirm</h2>
        <p className="mt-3">Only facts you've confirmed can show up in a draft. If a number looks off, uncheck it now and fix it later on your profile page.</p>
        <p className="mt-3">Anything older than a year will ask you again, so a proposal never goes out with a stale number.</p>
      </aside>
    </div>
  );
}
