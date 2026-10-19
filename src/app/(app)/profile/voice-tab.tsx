"use client";

import * as React from "react";
import type { VoiceProfile } from "@/lib/types";
import { services } from "@/lib/services";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { Field } from "@/components/ui/label";
import { EmptyState } from "@/components/ui/empty-state";
import { useToast } from "@/components/ui/toast";

/** The same section title can come from several drafts; list it once with a count. */
function sourceCounts(sources: string[]): [string, number][] {
  const counts = new Map<string, number>();
  for (const s of sources) counts.set(s, (counts.get(s) ?? 0) + 1);
  return [...counts.entries()];
}

/** How the organization writes, measured from its own text, and a note in its own words that drafting follows. */
export function VoiceTab({ initial, onAddBoilerplate }: { initial: VoiceProfile; onAddBoilerplate: () => void }) {
  const { toast } = useToast();
  const [voice, setVoice] = React.useState(initial);
  const [note, setNote] = React.useState(initial.note);
  const [saving, setSaving] = React.useState(false);
  const dirty = note.trim() !== voice.note.trim();

  const save = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaving(true);
    try {
      const next = await services.knowledge.setVoiceNote(note);
      setVoice(next);
      setNote(next.note);
      toast({ title: "Voice note saved", description: "The next draft follows it." });
    } catch (err) {
      toast({ title: "Could not save it", description: err instanceof Error ? err.message : "Try again in a moment.", tone: "warning" });
    } finally {
      setSaving(false);
    }
  };

  const measured = voice.sampleWords > 0;
  const lines = measured
    ? [
        `Sentences average ${voice.avgSentenceWords} words.`,
        `Reads at about grade ${voice.readingGrade}.`,
        voice.usesWe ? "Written as we." : "Written about the organization, not as we.",
        voice.contractions ? "Uses contractions, like we're and it's." : "Avoids contractions.",
      ]
    : [];

  return (
    <div className="grid gap-10 lg:grid-cols-[1fr_22rem]">
      <div className="min-w-0">
        <p className="max-w-[65ch] text-base text-ink-muted">Drafts follow this note and these measures, so a proposal sounds like you wrote it.</p>
        <h2 className="mt-6 font-display text-2xl text-ink">What we measured from your writing</h2>
        {measured ? (
          <>
            <ul className="mt-3 border-t border-rule">
              {lines.map((l) => (
                <li key={l} className="border-b border-rule py-3 text-base text-ink">
                  {l}
                </li>
              ))}
              <li className="border-b border-rule py-3 text-base text-ink">
                {voice.commonPhrases.length ? (
                  <>
                    Phrases you repeat:{" "}
                    {voice.commonPhrases.map((p, i) => (
                      <React.Fragment key={p}>
                        {i ? ", " : ""}
                        <span className="font-semibold">&ldquo;{p}&rdquo;</span>
                      </React.Fragment>
                    ))}
                    .
                  </>
                ) : (
                  "No phrase shows up often enough to count as a habit."
                )}
              </li>
            </ul>
            <p className="mt-4 text-sm text-ink-muted tnum">
              Measured from {voice.sampleWords.toLocaleString("en-US")} words in {voice.sources.length} text{voice.sources.length === 1 ? "" : "s"}.
              {voice.sampleWords < 400 ? " That is a small sample, so treat these as rough until you add more of your own writing." : ""}
            </p>
            {voice.sources.length ? (
              <>
                <h3 className="mt-6 font-display text-xl text-ink">What it read</h3>
                <ul className="mt-2 border-t border-rule text-sm">
                  {sourceCounts(voice.sources).map(([s, n]) => (
                    <li key={s} className="flex justify-between gap-4 border-b border-rule py-2 text-ink">
                      <span className="min-w-0">{s}</span>
                      {n > 1 ? <span className="shrink-0 text-ink-muted tnum">{n} times</span> : null}
                    </li>
                  ))}
                </ul>
              </>
            ) : null}
          </>
        ) : (
          <EmptyState
            className="mt-4"
            title="Nothing to measure yet"
            description="Your voice is read from your boilerplate paragraphs and the sections you approve or edit. Add a paragraph in your own words and this fills in."
            action={
              <Button variant="secondary" onClick={onAddBoilerplate}>
                Add a paragraph
              </Button>
            }
          />
        )}
      </div>
      <form onSubmit={save} className="flex flex-col gap-3 border-t border-rule pt-4">
        <h2 className="font-display text-xl text-ink">In your own words</h2>
        <Field id="voice-note" label="How should drafts sound?" hint="For example: plain and warm, name the kids we serve by program, never say beneficiaries.">
          <Textarea value={note} onChange={(e) => setNote(e.target.value)} className="min-h-40" />
        </Field>
        <div>
          <Button type="submit" loading={saving} disabled={!dirty}>
            Save
          </Button>
        </div>
      </form>
    </div>
  );
}
