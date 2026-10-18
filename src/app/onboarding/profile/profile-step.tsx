"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Pencil } from "lucide-react";
import type { Document, Fact, Organization } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
        <h1 className="font-display text-3xl text-fg sm:text-4xl">Does this look right?</h1>
        <p className="mt-3 max-w-xl text-base text-fg-muted">This is what the agents will say about you. Uncheck anything that is wrong and we will leave it out.</p>

        <section className="mt-8 rounded-lg border border-border bg-surface p-5" aria-labelledby="prof-title">
          <div className="flex items-start justify-between gap-3">
            <h2 id="prof-title" className="font-display text-xl text-fg">
              {org.name}
            </h2>
            <Button variant="ghost" size="sm" onClick={() => setEditing((e) => !e)} aria-expanded={editing}>
              <Pencil aria-hidden /> {editing ? "Done" : "Edit"}
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
              <p className="mt-3 font-display text-lg leading-relaxed text-fg">{mission}</p>
              <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-xs text-fg-subtle">Service area</dt>
                  <dd className="text-fg">{area}</dd>
                </div>
                <div>
                  <dt className="text-xs text-fg-subtle">Causes</dt>
                  <dd className="mt-1 flex flex-wrap gap-1">
                    {org.causes.map((c) => (
                      <Badge key={c} variant="neutral">
                        {c}
                      </Badge>
                    ))}
                  </dd>
                </div>
              </dl>
            </>
          )}
        </section>

        <section className="mt-6" aria-labelledby="facts-title">
          <h2 id="facts-title" className="font-display text-xl text-fg">
            Facts we found
          </h2>
          <p className="mt-1 text-sm text-fg-muted">Each one links to the page it came from. Click a chip to read the passage.</p>
          <ul className="mt-4 divide-y divide-border rounded-lg border border-border bg-surface">
            {facts.map((f) => {
              const d = docOf(f.sourceDocumentId);
              return (
                <li key={f.id} className={cn("flex items-start gap-3 px-4 py-3", !kept[f.id] && "opacity-50")}>
                  <Checkbox id={`keep-${f.id}`} checked={kept[f.id]} onCheckedChange={(c) => setKept((k) => ({ ...k, [f.id]: c === true }))} className="mt-1" />
                  <label htmlFor={`keep-${f.id}`} className="min-w-0 flex-1 cursor-pointer">
                    <span className="block text-sm text-fg-muted">{f.label}</span>
                    <span className={cn("block font-display text-lg text-fg", !kept[f.id] && "line-through")}>{f.value}</span>
                  </label>
                  <CitationChip label={d ? `${d.title}${f.sourcePage ? `, p.${f.sourcePage}` : ""}` : "Website"} sourceTitle={d?.title} excerpt={f.sourceExcerpt} page={f.sourcePage} />
                </li>
              );
            })}
          </ul>
        </section>

        <div className="mt-8 flex flex-wrap items-center gap-3">
          <Button
            size="lg"
            loading={loading}
            onClick={async () => {
              setLoading(true);
              await new Promise((r) => setTimeout(r, 1200));
              router.push("/onboarding/matches");
            }}
          >
            {loading ? "Finding matches" : "Looks right, find my matches"} {!loading ? <ArrowRight aria-hidden /> : null}
          </Button>
          <span className="text-sm text-fg-subtle">{keptCount} of {facts.length} facts kept</span>
        </div>
      </div>
      <aside className="rounded-lg border border-border bg-surface p-5 text-sm text-fg-muted lg:self-start">
        <p className="font-medium text-fg">Why confirm</p>
        <p className="mt-2">Only confirmed facts can appear in a draft. If a number is off, uncheck it now and fix it later on your profile page.</p>
        <p className="mt-3">Facts older than a year will ask to be re-confirmed so proposals never go out with stale numbers.</p>
      </aside>
    </div>
  );
}
