"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Pencil } from "lucide-react";
import type { Document, Fact, Organization } from "@/lib/types";
import { services } from "@/lib/services";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input, Textarea } from "@/components/ui/input";
import { Field } from "@/components/ui/label";
import { EmptyState } from "@/components/ui/empty-state";
import { CitationChip } from "@/components/app/citation-chip";
import { cn } from "@/lib/utils";

interface Props {
  org: Organization;
  facts: Fact[];
  documents: Document[];
  /** The facts came from the user's own site, not the demo seed. */
  real: boolean;
  /** Nothing is waiting on the user; they already confirmed this profile. */
  alreadyConfirmed: boolean;
}

export function ProfileStep({ org, facts, documents, real, alreadyConfirmed }: Props) {
  const router = useRouter();
  const [name, setName] = React.useState(org.name);
  const [mission, setMission] = React.useState(org.mission);
  const [area, setArea] = React.useState(org.serviceArea);
  const [editing, setEditing] = React.useState(false);
  const [kept, setKept] = React.useState<Record<string, boolean>>(Object.fromEntries(facts.map((f) => [f.id, true])));
  const [values, setValues] = React.useState<Record<string, string>>(Object.fromEntries(facts.map((f) => [f.id, f.value])));
  const [editingFact, setEditingFact] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState<string | null>(null);
  const [failure, setFailure] = React.useState<string | null>(null);
  const docOf = (id: string | null) => documents.find((d) => d.id === id);
  const keptCount = Object.values(kept).filter(Boolean).length;

  const chipFor = (f: Fact) => {
    const d = docOf(f.sourceDocumentId);
    if (d) return { label: `${d.title}${f.sourcePage ? `, p.${f.sourcePage}` : ""}`, sourceTitle: d.title, url: null as string | null };
    if (f.sourceUrl) return { label: f.sourceLabel ?? "Website", sourceTitle: f.sourceLabel ?? f.sourceUrl, url: f.sourceUrl };
    return { label: f.sourceLabel ?? "You", sourceTitle: f.sourceLabel ?? "You", url: null as string | null };
  };

  const confirmAndMatch = async () => {
    setFailure(null);
    setLoading("confirm");
    if (real) {
      const factEdits: Record<string, string> = {};
      for (const f of facts) if (values[f.id] !== undefined && values[f.id].trim() !== f.value) factEdits[f.id] = values[f.id];
      const c = await services.loop.confirmProfile({ keptFactIds: facts.filter((f) => kept[f.id]).map((f) => f.id), factEdits, org: { mission, serviceArea: area, name } });
      if (!c.ok) {
        setLoading(null);
        setFailure(c.error);
        return;
      }
    }
    await services.org.update({ onboardingStep: "gaps" });
    router.push("/onboarding/gaps");
  };

  return (
    <div className="grid gap-10 lg:grid-cols-[1fr_18rem] [&>*]:min-w-0">
      <div>
        <h1 className="font-display text-h1 text-ink">Does this look right?</h1>
        <p className="mt-4 max-w-[60ch] text-lg text-ink-muted">This is what we'll say about you. Uncheck anything that's off and we'll leave it out. Open a source to read the exact passage.</p>

        <section className="sheet mt-8 p-5" aria-labelledby="prof-title">
          <div className="flex items-start justify-between gap-3">
            <h2 id="prof-title" className="font-display text-2xl text-ink">
              {name || "Your organization"}
            </h2>
            <Button variant="ghost" size="sm" onClick={() => setEditing((e) => !e)} aria-expanded={editing}>
              {editing ? "Done" : "Edit"}
            </Button>
          </div>
          {editing ? (
            <div className="mt-4 flex flex-col gap-4">
              <Field id="name" label="Name">
                <Input value={name} onChange={(e) => setName(e.target.value)} />
              </Field>
              <Field id="mission" label="Mission">
                <Textarea value={mission} onChange={(e) => setMission(e.target.value)} />
              </Field>
              <Field id="area" label="Service area">
                <Input value={area} onChange={(e) => setArea(e.target.value)} />
              </Field>
            </div>
          ) : (
            <>
              <p className="mt-3 max-w-[60ch] text-xl leading-relaxed text-ink">{mission || <span className="text-ink-muted">We did not find a mission statement on your site. Add one with Edit.</span>}</p>
              <dl className="mt-5 grid gap-x-4 gap-y-3 border-t border-rule pt-4 text-base sm:grid-cols-2">
                <div>
                  <dt className="text-sm text-ink-muted">Service area</dt>
                  <dd className="text-ink">{area || <span className="text-ink-muted">Not stated on your site</span>}</dd>
                </div>
                <div>
                  <dt className="text-sm text-ink-muted">Causes</dt>
                  <dd className="text-ink">{org.causes.length ? org.causes.join(", ") : <span className="text-ink-muted">Not stated</span>}</dd>
                </div>
              </dl>
            </>
          )}
        </section>

        <section className="mt-10" aria-labelledby="facts-title">
          <h2 id="facts-title" className="font-display text-2xl text-ink">
            Facts we found
          </h2>
          <p className="mt-1 text-base text-ink-muted">Each one links to the page it came from. Only what you keep can show up in a letter.</p>
          {facts.length === 0 ? (
            <EmptyState className="mt-4" size="sm" title="We did not find any facts to cite" description="Your site may not state numbers or dates. You can still find matches, and the letter will ask you for what it needs." />
          ) : (
            <ul className="mt-4 border-t border-rule">
              {facts.map((f) => {
                const chip = chipFor(f);
                const isEditing = editingFact === f.id;
                return (
                  <li key={f.id} className={cn("flex items-start gap-4 border-b border-rule py-3", !kept[f.id] && "opacity-50")}>
                    <Checkbox id={`keep-${f.id}`} checked={kept[f.id]} onCheckedChange={(c) => setKept((k) => ({ ...k, [f.id]: c === true }))} className="mt-1.5" />
                    <div className="min-w-0 flex-1">
                      <label htmlFor={`keep-${f.id}`} className="block cursor-pointer text-sm text-ink-muted">
                        {f.label}
                      </label>
                      {isEditing ? (
                        <form
                          className="mt-1 flex gap-2"
                          onSubmit={(e) => {
                            e.preventDefault();
                            setEditingFact(null);
                          }}
                        >
                          <Input aria-label={`Value for ${f.label}`} value={values[f.id]} onChange={(e) => setValues((v) => ({ ...v, [f.id]: e.target.value }))} className="h-9" autoFocus />
                          <Button type="submit" size="sm" variant="secondary">
                            Done
                          </Button>
                        </form>
                      ) : (
                        <span className={cn("block font-display text-xl text-ink", !kept[f.id] && "line-through")}>
                          {values[f.id]}
                          {values[f.id] !== f.value ? <span className="ml-2 font-body text-sm font-normal text-ink-muted">edited by you</span> : null}
                        </span>
                      )}
                    </div>
                    {real && !isEditing ? (
                      <Button variant="ghost" size="icon-sm" aria-label={`Edit ${f.label}`} onClick={() => setEditingFact(f.id)} className="mt-0.5">
                        <Pencil />
                      </Button>
                    ) : null}
                    <CitationChip label={chip.label} sourceTitle={chip.sourceTitle} excerpt={f.sourceExcerpt} page={f.sourcePage} url={chip.url} className="mt-1.5 min-w-0 max-w-[9rem] shrink sm:max-w-[16rem]" />
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {failure ? (
          <p role="alert" className="mt-6 max-w-[60ch] border-l-[6px] border-alert py-1 pl-4 text-base text-ink">
            {failure}
          </p>
        ) : null}

        <div className="mt-8 flex flex-wrap items-center gap-x-5 gap-y-3">
          <Button size="lg" loading={loading !== null} onClick={confirmAndMatch}>
            {loading === "confirm" ? "Saving your facts" : alreadyConfirmed ? "Continue" : "Looks right, continue"}
          </Button>
          <span className="text-base text-ink-muted tnum">
            {keptCount} of {facts.length} facts kept
          </span>
        </div>
      </div>
      <aside className="border-l-[3px] border-rule-strong pl-5 text-base text-ink-muted lg:self-start">
        <h2 className="font-display text-xl text-ink">Why confirm</h2>
        <p className="mt-3">Only facts you've confirmed can show up in a draft. If a number looks off, fix it here or uncheck it. A fact you edit is recorded as stated by you.</p>
        <p className="mt-3">Anything older than a year comes back to you for a check, so an old number does not slip into a letter.</p>
      </aside>
    </div>
  );
}
