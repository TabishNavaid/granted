"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import type { Certification, FirmProfile, ResearchProfile } from "@/lib/types";
import { services } from "@/lib/services";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { certWords } from "@/lib/firm/facts";

const STATUSES: Certification["kind"][] = ["small_business", "sdvosb", "vosb", "wosb", "edwosb", "8a", "hubzone", "mbe", "wbe", "dbe"];
const num = (s: string) => (s.trim() === "" ? null : Number(s.replace(/[^0-9.]/g, "")) || null);

/** For firms: the work categories and credentials go/no-go and SAM.gov search depend on. */
export function FirmGapsStep({ profile, held }: { profile: FirmProfile | null; held: Certification["kind"][] }) {
  const router = useRouter();
  const [naics, setNaics] = React.useState(profile?.naics.map((n) => n.code).join(", ") || "541310, 541330");
  const [states, setStates] = React.useState(profile?.states.join(", ") ?? "");
  const [statuses, setStatuses] = React.useState<Certification["kind"][]>(held);
  const [single, setSingle] = React.useState(profile?.bonding?.singleLimit ? String(profile.bonding.singleLimit) : "");
  const [aggregate, setAggregate] = React.useState(profile?.bonding?.aggregateLimit ? String(profile.bonding.aggregateLimit) : "");
  const [capacity, setCapacity] = React.useState(profile?.activeBidCapacity ? String(profile.activeBidCapacity) : "");
  const [loading, setLoading] = React.useState(false);
  const save = async () => {
    setLoading(true);
    const codes = naics.match(/\d{6}/g) ?? [];
    await services.firm.saveProfile({
      naics: codes.map((c, i) => ({ code: c, label: profile?.naics.find((n) => n.code === c)?.label ?? "", primary: i === 0 })),
      states: states.split(/[,\s]+/).map((x) => x.trim().toUpperCase()).filter((x) => /^[A-Z]{2}$/.test(x)),
      bonding: num(single) || num(aggregate) ? { singleLimit: num(single), aggregateLimit: num(aggregate), surety: profile?.bonding?.surety ?? null, asOf: new Date().toISOString().slice(0, 10), documentId: null } : (profile?.bonding ?? null),
      activeBidCapacity: num(capacity),
    });
    for (const k of statuses.filter((s) => !held.includes(s))) await services.firm.saveCertification({ kind: k, label: certWords(k), issuer: "Stated by the firm during setup", state: null, number: null, expires: null, documentId: null });
    await services.org.update({ onboardingStep: "gaps" });
    router.push("/onboarding/matches");
  };
  return (
    <div className="max-w-2xl">
      <h1 className="font-display text-h1 text-ink">Your work and credentials.</h1>
      <p className="mt-4 max-w-[56ch] text-lg text-ink-muted">Go/no-go reads these on every bid, and SAM.gov is searched by your work categories. Skip anything you are not sure of; you can change it on the Firm and records page.</p>
      <div className="mt-8 flex flex-col gap-6">
        <Field id="g-naics" label="NAICS codes you work under" hint="541310 is architectural services, 541330 engineering, 236220 commercial building construction.">
          <Input value={naics} onChange={(e) => setNaics(e.target.value)} />
        </Field>
        <Field id="g-states" label="States you work in" hint="Two-letter codes, separated by commas.">
          <Input value={states} onChange={(e) => setStates(e.target.value)} placeholder="TX, OK" />
        </Field>
        <fieldset>
          <legend className="text-base font-semibold text-ink">Small business and ownership statuses you hold</legend>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {STATUSES.map((k) => (
              <label key={k} className="flex items-center gap-3 text-base text-ink">
                <Checkbox checked={statuses.includes(k)} onCheckedChange={(c) => setStatuses((xs) => (c === true ? [...xs, k] : xs.filter((x) => x !== k)))} />
                {certWords(k)}
              </label>
            ))}
          </div>
        </fieldset>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="g-single" label="Bonding, single project ($)" hint="For construction bids. Leave blank if you are a design firm without bonding.">
            <Input inputMode="numeric" value={single} onChange={(e) => setSingle(e.target.value)} />
          </Field>
          <Field id="g-aggregate" label="Bonding, aggregate ($)">
            <Input inputMode="numeric" value={aggregate} onChange={(e) => setAggregate(e.target.value)} />
          </Field>
        </div>
        <Field id="g-capacity" label="How many proposals can your team carry at once?">
          <Input inputMode="numeric" value={capacity} onChange={(e) => setCapacity(e.target.value)} className="max-w-[8rem]" />
        </Field>
      </div>
      <Button size="lg" className="mt-10" loading={loading} onClick={save}>
        Save and find bids
      </Button>
    </div>
  );
}

/** For research teams: what to search for, and whether SBIR and STTR apply. */
export function ResearchGapsStep({ profile }: { profile: ResearchProfile | null }) {
  const router = useRouter();
  const [keywords, setKeywords] = React.useState((profile?.keywords ?? []).join("; "));
  const [small, setSmall] = React.useState(profile?.smallBusiness ?? false);
  const [loading, setLoading] = React.useState(false);
  const save = async () => {
    setLoading(true);
    await services.research.saveProfile({ keywords: keywords.split(";").map((k) => k.trim()).filter(Boolean).slice(0, 4), smallBusiness: small });
    await services.org.update({ onboardingStep: "gaps" });
    router.push("/onboarding/matches");
  };
  return (
    <div className="max-w-2xl">
      <h1 className="font-display text-h1 text-ink">What should we search for?</h1>
      <p className="mt-4 max-w-[56ch] text-lg text-ink-muted">We search Grants.gov research notices and the NSF and NIH records of funded projects for these phrases. Specific phrases work better than broad fields.</p>
      <div className="mt-8 flex flex-col gap-6">
        <Field id="g-kw" label="Search phrases, separated by semicolons">
          <Input value={keywords} onChange={(e) => setKeywords(e.target.value)} />
        </Field>
        <label className="flex items-start gap-3 text-base text-ink">
          <Checkbox checked={small} onCheckedChange={(c) => setSmall(c === true)} className="mt-1" />
          <span>
            We are a small business (500 employees or fewer), so SBIR and STTR apply.
            <span className="block text-sm text-ink-muted">University labs usually reach SBIR and STTR through a small business partner.</span>
          </span>
        </label>
      </div>
      <Button size="lg" className="mt-10" loading={loading} onClick={save}>
        Save and find funding
      </Button>
    </div>
  );
}
