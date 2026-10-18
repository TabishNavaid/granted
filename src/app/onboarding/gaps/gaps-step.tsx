"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { services } from "@/lib/services";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const ranges = ["Under $100,000", "$100,000 to $250,000", "$250,000 to $500,000", "$500,000 to $1 million", "Over $1 million"];

export function GapsStep({ ask }: { ask: { budget: boolean; people: boolean; location: boolean } }) {
  const router = useRouter();
  const [budget, setBudget] = React.useState("");
  const [people, setPeople] = React.useState("");
  const [location, setLocation] = React.useState("");
  const [loading, setLoading] = React.useState<"save" | "skip" | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const nothingToAsk = !ask.budget && !ask.people && !ask.location;

  const finish = async (how: "save" | "skip") => {
    setLoading(how);
    setError(null);
    const r = await services.loop.answerGaps(how === "save" ? { budgetRange: budget, peopleServed: people, location } : {});
    if (!r.ok) {
      setLoading(null);
      setError(r.error);
      return;
    }
    router.push("/onboarding/matches");
  };

  React.useEffect(() => {
    if (!nothingToAsk) return;
    const t = setTimeout(() => void finish("skip"), 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nothingToAsk]);

  if (nothingToAsk) {
    return (
      <div className="max-w-2xl">
        <h1 className="font-display text-h1 text-ink">Your site answered everything.</h1>
        <p className="mt-4 text-lg text-ink-muted">On to your matches.</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl">
      <h1 className="font-display text-h1 text-ink">A few things your site did not say.</h1>
      <p className="mt-4 max-w-[52ch] text-lg text-ink-muted">Funders ask these first. Each answer is saved as a fact stated by you. Rough is fine, and you can skip any of them.</p>
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
        {error ? (
          <p role="alert" className="border-l-[6px] border-burgundy py-1 pl-4 text-base text-ink">
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
