"use client";

import * as React from "react";
import Link from "next/link";
import type { ScholarshipMatch, ScholarshipProfile } from "@/lib/types";
import { services } from "@/lib/services";
import { PageContainer, PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EmptyState } from "@/components/ui/empty-state";
import { useToast } from "@/components/ui/toast";
import { formatMoney, pluralize } from "@/lib/format";
import { AsFiled } from "../funders/as-filed";

const STATES = [
  { value: "OH", label: "Ohio" },
  { value: "KY", label: "Kentucky" },
  { value: "NC", label: "North Carolina" },
];

const LEVELS: { value: ScholarshipProfile["level"]; label: string }[] = [
  { value: "high_school", label: "High school student" },
  { value: "undergraduate", label: "Undergraduate" },
  { value: "graduate", label: "Graduate student" },
  { value: "adult", label: "Adult learner" },
];

const linkClass = "text-ink underline decoration-[1px] underline-offset-4 hover:decoration-ink";

const blank: ScholarshipProfile = { state: "OH", level: "high_school", field: "", hometown: "" };

interface Props {
  initialProfile: ScholarshipProfile | null;
  initialMatches: ScholarshipMatch[];
}

export function ScholarshipsView({ initialProfile, initialMatches }: Props) {
  const { toast } = useToast();
  const [profile, setProfile] = React.useState<ScholarshipProfile>(initialProfile ?? blank);
  const [saved, setSaved] = React.useState(Boolean(initialProfile));
  const [matches, setMatches] = React.useState(initialMatches);
  const [saving, setSaving] = React.useState(false);

  const set = <K extends keyof ScholarshipProfile>(key: K, value: ScholarshipProfile[K]) => setProfile((p) => ({ ...p, [key]: value }));

  const save = async () => {
    setSaving(true);
    try {
      const next = await services.scholarships.saveProfile({ ...profile, field: profile.field.trim(), hometown: profile.hometown.trim() });
      setProfile(next);
      const rows = await services.scholarships.matches();
      setMatches(rows);
      setSaved(true);
      toast({ title: "Profile saved", description: rows.length ? `${pluralize(rows.length, "foundation")} to look at.` : "No foundations matched yet. Try another state or a broader field." });
    } catch (e) {
      toast({ title: "Could not save the profile", description: e instanceof Error ? e.message : "Try again in a moment.", tone: "warning" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <PageContainer>
      <PageHeader
        title="Scholarship and fellowship mode"
        description="For one person looking for help with school, rather than for an organization. We look for private foundations whose IRS filings show scholarship or fellowship giving."
      />

      <div className="mt-6 max-w-[65ch] space-y-2 text-base text-ink-muted">
        <p>
          The list comes from public IRS Form 990-PF filings, and only from foundations in Ohio, Kentucky, and North Carolina for now. Filings run a year or two behind, so check each foundation&apos;s current guidelines before you apply.
        </p>
        <p>Some awards are tied to one high school, county, or employer. The reasons and cautions on each one say what we could and could not tell from the filing.</p>
      </div>

      <section aria-labelledby="profile-title" className="mt-10">
        <h2 id="profile-title" className="font-display text-2xl text-ink">
          About the student
        </h2>
        <form
          className="mt-4 grid gap-5 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            void save();
          }}
        >
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="sch-state">State</Label>
            <Select value={profile.state} onValueChange={(v) => set("state", v)}>
              <SelectTrigger id="sch-state">
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
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="sch-level">Level</Label>
            <Select value={profile.level} onValueChange={(v) => set("level", v as ScholarshipProfile["level"])}>
              <SelectTrigger id="sch-level">
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
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="sch-field">Field of study</Label>
            <Input id="sch-field" value={profile.field} onChange={(e) => set("field", e.target.value)} placeholder="Nursing, music, engineering" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="sch-town">Hometown</Label>
            <Input id="sch-town" value={profile.hometown} onChange={(e) => set("hometown", e.target.value)} placeholder="Chillicothe" />
          </div>
          <div className="sm:col-span-2">
            <Button type="submit" loading={saving}>
              {saved ? "Save and search again" : "Save and find scholarships"}
            </Button>
          </div>
        </form>
      </section>

      <section aria-labelledby="results-title" className="mt-12">
        <h2 id="results-title" className="font-display text-2xl text-ink">
          Foundations to look at
        </h2>
        {!saved ? (
          <p className="mt-3 text-base text-ink-muted">Fill in the profile above and save it to see foundations.</p>
        ) : matches.length === 0 ? (
          <EmptyState
            className="mt-4"
            size="sm"
            title="No foundations matched"
            description="No foundation in this state shows scholarship giving on the filings we have. Try one of the other two states; the field and hometown only change the order, not who appears."
          />
        ) : (
          <>
            <p className="mt-2 text-sm text-ink-muted" aria-live="polite">
              {pluralize(matches.length, "foundation")}, best fit first.
            </p>
            <ul className="mt-4 border-t border-rule">
              {matches.map((m) => (
                <li key={m.funderId} className="border-b border-rule py-6">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
                    <h3 className="font-display text-xl text-ink">{m.name}</h3>
                    <span className="text-sm text-ink-muted">
                      {m.city}, {m.state}
                    </span>
                  </div>
                  <dl className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-3">
                    <div>
                      <dt className="text-sm text-ink-muted">Typical award</dt>
                      <dd className="mt-0.5 text-base font-semibold text-ink tnum">{formatMoney(m.typicalAward)}</dd>
                    </div>
                    <div>
                      <dt className="text-sm text-ink-muted">Awards in {m.taxYear}</dt>
                      <dd className="mt-0.5 text-base font-semibold text-ink tnum">{m.awards || "Not itemized"}</dd>
                    </div>
                    <div>
                      <dt className="text-sm text-ink-muted">{m.awards ? "Total for scholarships" : "Total giving"}</dt>
                      <dd className="mt-0.5 text-base font-semibold text-ink tnum">{formatMoney(m.totalScholarships)}</dd>
                    </div>
                  </dl>

                  {m.reasons.length ? (
                    <ul className="mt-4 space-y-1">
                      {m.reasons.map((r) => (
                        <li key={r} className="max-w-[65ch] text-base text-ink">
                          {r}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  {m.cautions.length ? (
                    <ul className="mt-2 space-y-1">
                      {m.cautions.map((c) => (
                        <li key={c} className="max-w-[65ch] text-base text-ink-muted">
                          {c}
                        </li>
                      ))}
                    </ul>
                  ) : null}

                  <AsFiled application={m.application} className="mt-4" />

                  {m.pastRecipients.length ? (
                    <div className="mt-4">
                      <h4 className="text-base font-semibold text-ink">Where past awards went</h4>
                      <p className="text-sm text-ink-muted">Schools and programs as filed. Individual recipients are never shown.</p>
                      <ul className="mt-2 border-t border-rule">
                        {m.pastRecipients.slice(0, 8).map((p, i) => (
                          <li key={`${i}-${p.name}`} className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-0.5 border-b border-rule py-2 text-sm">
                            <span className="text-ink">
                              {p.name}
                              {p.city ? <span className="text-ink-muted">, {[p.city, p.state].filter(Boolean).join(", ")}</span> : null}
                            </span>
                            <span className="text-ink-muted tnum">{formatMoney(p.amount)}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}

                  <p className="mt-4 flex flex-wrap gap-x-6 gap-y-1 text-sm">
                    <a href={m.irsUrl} target="_blank" rel="noreferrer" className={linkClass}>
                      IRS filing for {m.name}
                    </a>
                    <Link href={`/funders/${encodeURIComponent(m.funderId)}`} className={linkClass}>
                      Everything on its filing
                    </Link>
                  </p>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>
    </PageContainer>
  );
}
