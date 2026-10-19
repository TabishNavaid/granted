"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { services } from "@/lib/services";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const ranges = ["Under $100,000", "$100,000 to $250,000", "$250,000 to $500,000", "$500,000 to $1 million", "Over $1 million"];

type Ask = { budget: boolean; people: boolean; location: boolean; result: boolean; staff: boolean; programs: boolean; populations: boolean };

export function GapsStep({ ask, orgName }: { ask: Ask; orgName: string }) {
  const router = useRouter();
  const [budget, setBudget] = React.useState("");
  const [people, setPeople] = React.useState("");
  const [location, setLocation] = React.useState("");
  const [result, setResult] = React.useState("");
  const [staff, setStaff] = React.useState("");
  const [programs, setPrograms] = React.useState("");
  const [populations, setPopulations] = React.useState("");
  const [note, setNote] = React.useState("");
  const [loading, setLoading] = React.useState<"save" | "skip" | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const finish = async (how: "save" | "skip") => {
    setLoading(how);
    setError(null);
    const r = await services.loop.answerGaps(how === "save" ? { budgetRange: budget, peopleServed: people, location, result, staff, programs, populations, note } : {});
    if (!r.ok) {
      setLoading(null);
      setError(r.error);
      return;
    }
    router.push("/onboarding/matches");
  };

  return (
    <div className="max-w-2xl">
      <h1 className="font-display text-h1 text-ink">{Object.values(ask).some(Boolean) ? "A few things your site did not say." : "One question before your matches."}</h1>
      <p className="mt-4 max-w-[52ch] text-lg text-ink-muted">Funders ask these first. Each answer is saved as a fact stated by you, and only what you write here can be cited. Rough is fine, and you can skip any of them.</p>
      <form
        className="mt-8 flex max-w-md flex-col gap-5"
        onSubmit={(e) => {
          e.preventDefault();
          void finish("save");
        }}
      >
        {ask.budget ? (
          <Field id="budget" label="About how big is your annual budget?" optional>
            <Select value={budget} onValueChange={setBudget}>
              <SelectTrigger id="budget" className="h-12">
                <SelectValue placeholder="Choose a range" />
              </SelectTrigger>
              <SelectContent>
                {ranges.map((r) => (
                  <SelectItem key={r} value={r}>
                    {r}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        ) : null}
        {ask.people ? (
          <Field id="people" label="About how many people did you serve last year?" optional hint="A number, or a short phrase like '300 families'.">
            <Input value={people} onChange={(e) => setPeople(e.target.value)} className="h-12" />
          </Field>
        ) : null}
        {ask.location ? (
          <Field id="location" label="Where are you based?" optional hint="City and state, like Dayton, OH.">
            <Input value={location} onChange={(e) => setLocation(e.target.value)} className="h-12" autoComplete="address-level2" />
          </Field>
        ) : null}
        {ask.programs ? (
          <Field id="programs" label="What are your main programs?" optional hint="Names, separated by commas, like After-School Studio, Summer Launch.">
            <Input value={programs} onChange={(e) => setPrograms(e.target.value)} className="h-12" />
          </Field>
        ) : null}
        {ask.populations ? (
          <Field id="populations" label="Who do you serve?" optional hint="In your words, like middle school students in East Dayton.">
            <Input value={populations} onChange={(e) => setPopulations(e.target.value)} className="h-12" />
          </Field>
        ) : null}
        {ask.result ? (
          <Field id="result" label="What is one result you are proud of?" optional hint="With a number if you have one, like 94% of seniors graduated on time.">
            <Input value={result} onChange={(e) => setResult(e.target.value)} className="h-12" />
          </Field>
        ) : null}
        {ask.staff ? (
          <Field id="staff" label="How many staff and volunteers?" optional hint="Like 4 full-time staff and 23 volunteers.">
            <Input value={staff} onChange={(e) => setStaff(e.target.value)} className="h-12" />
          </Field>
        ) : null}
        <Field id="note" label={`What should a funder know about ${orgName || "you"} that your website does not say?`} optional hint="A waitlist, a new partnership, a program that is growing. Saved as a fact stated by you.">
          <textarea id="note" value={note} onChange={(e) => setNote(e.target.value)} rows={3} className="w-full rounded-md border border-rule-strong bg-paper px-3 py-2 text-base text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus" />
        </Field>
        {error ? (
          <p role="alert" className="border-l-[6px] border-alert py-1 pl-4 text-base text-ink">
            {error}
          </p>
        ) : null}
        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" size="lg" loading={loading === "save"}>
            Save and find my matches
          </Button>
          <Button type="button" variant="ghost" size="lg" loading={loading === "skip"} onClick={() => finish("skip")}>
            Skip these
          </Button>
        </div>
      </form>
    </div>
  );
}
