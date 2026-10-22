"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import type { PersonProfile } from "@/lib/types";
import { services } from "@/lib/services";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Field } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EmptyState } from "@/components/ui/empty-state";
import { useToast } from "@/components/ui/toast";

const LEVELS: { value: PersonProfile["level"]; label: string }[] = [
  { value: "high_school", label: "High school senior" },
  { value: "undergraduate", label: "Undergraduate" },
  { value: "graduate", label: "Graduate student" },
  { value: "adult", label: "Returning or adult learner" },
];

/** One person's profile, read from their résumé. Essays may only use what is here, in their words. */
export function PersonProfilePanel({ profile, readOnly }: { profile: PersonProfile | null; readOnly: boolean }) {
  const router = useRouter();
  const { toast } = useToast();
  const [p, setP] = React.useState(profile);
  if (!p) return <EmptyState size="sm" title="No profile yet" description="Set up from your résumé: paste it or upload it, and we read your education, experiences, and awards for you to check." />;
  const save = async () => {
    await services.person.saveProfile(p);
    toast({ title: "Profile saved", description: "Matches and essays use it from now on." });
    router.refresh();
  };
  return (
    <div className="grid gap-10 lg:grid-cols-[1fr_20rem] [&>*]:min-w-0">
      <section>
        <h2 className="font-display text-3xl text-ink">{p.fullName}</h2>
        <p className="text-base text-ink-muted">{[p.school, p.hometown && p.state ? `${p.hometown}, ${p.state}` : p.state, p.gpa ? `GPA ${p.gpa}` : null].filter(Boolean).join(", ")}</p>
        <h3 className="mt-6 font-semibold text-ink">Experiences</h3>
        <ul className="mt-2 border-t border-rule">
          {p.experiences.map((e, i) => (
            <li key={e.id} className="border-b border-rule py-3">
              <p className="font-semibold text-ink">
                {e.title}
                {e.organization ? `, ${e.organization}` : ""} <span className="font-normal text-ink-muted">, {e.years}</span>
              </p>
              {readOnly ? (
                <p className="text-base text-ink">{e.detail}</p>
              ) : (
                <Textarea aria-label={`What you did as ${e.title}`} rows={2} className="mt-1" value={e.detail} onChange={(x) => setP({ ...p, experiences: p.experiences.map((y, j) => (j === i ? { ...y, detail: x.target.value } : y)) })} />
              )}
            </li>
          ))}
        </ul>
        <h3 className="mt-6 font-semibold text-ink">Awards</h3>
        <ul className="mt-2 list-disc pl-5 text-base text-ink">
          {p.awards.map((a) => (
            <li key={a}>{a}</li>
          ))}
        </ul>
        <div className="mt-6">
          <Field id="pp-goals" label="In your own words: what you want to do" hint="Essays quote this rather than invent a goal for you.">
            <Textarea rows={3} value={p.goals ?? ""} onChange={(x) => setP({ ...p, goals: x.target.value })} disabled={readOnly} />
          </Field>
        </div>
      </section>
      <aside className="flex flex-col gap-4 border-l-[3px] border-rule-strong pl-5 lg:self-start">
        <Field id="pp-level" label="Level">
          <Select value={p.level} onValueChange={(v) => setP({ ...p, level: v as PersonProfile["level"] })} disabled={readOnly}>
            <SelectTrigger id="pp-level">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LEVELS.map((l) => (
                <SelectItem key={l.value} value={l.value}>
                  {l.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field id="pp-field" label="Field of study">
          <Input value={p.field} onChange={(x) => setP({ ...p, field: x.target.value })} disabled={readOnly} />
        </Field>
        <Field id="pp-state" label="State (OH)">
          <Input value={p.state} onChange={(x) => setP({ ...p, state: x.target.value.toUpperCase().slice(0, 2) })} disabled={readOnly} />
        </Field>
        <Field id="pp-town" label="Hometown">
          <Input value={p.hometown} onChange={(x) => setP({ ...p, hometown: x.target.value })} disabled={readOnly} />
        </Field>
        {readOnly ? null : (
          <Button className="self-start" onClick={save}>
            Save
          </Button>
        )}
      </aside>
    </div>
  );
}
