"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import type { OrgType } from "@/lib/types";
import { services, type SampleInfo } from "@/lib/services";
import { ORG_TYPES } from "@/lib/segments";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const ORDER: OrgType[] = ["nonprofit", "firm", "research", "individual"];

/** The first question: what kind of applicant this is. Every later step adapts to the answer. */
export function TypeStep({ initial, samples }: { initial: OrgType; samples: SampleInfo[] | null }) {
  const router = useRouter();
  const [pick, setPick] = React.useState<OrgType>(initial);
  const [loading, setLoading] = React.useState(false);
  const go = async () => {
    setLoading(true);
    // In the demo, each kind of applicant has its own sample; nonprofits pick one of three on the next screen.
    const sample = samples && pick !== "nonprofit" ? samples.find((s) => s.orgType === pick) : null;
    if (sample) {
      await services.demo.startSetup(sample.id);
      if (pick === "individual") router.push("/onboarding");
      else router.push("/onboarding/reading");
      return;
    }
    if (samples) {
      // The demo's nonprofits are three samples; choose one on the next screen without touching the open workspace.
      router.push("/onboarding?type=nonprofit");
      return;
    }
    await services.org.update({ orgType: pick, onboardingStep: "type" });
    router.refresh();
  };
  return (
    <div className="max-w-2xl">
      <h1 className="font-display text-h1 text-ink">Who is applying?</h1>
      <p className="mt-4 max-w-[54ch] text-lg text-ink-muted">Grants, bids, research funding, and scholarships each have their own rules, sections, and dates. Tell us which you pursue and setup will ask only what matters for it.</p>
      <fieldset className="mt-8">
        <legend className="sr-only">Kind of applicant</legend>
        <div className="flex flex-col border-t border-rule">
          {ORDER.map((t) => (
            <label key={t} className={cn("flex cursor-pointer items-start gap-4 border-b border-rule py-4", pick === t && "bg-paper-tint")}>
              <input type="radio" name="org-type" value={t} checked={pick === t} onChange={() => setPick(t)} className="mt-1.5 size-4 accent-[var(--ink)]" aria-label={ORG_TYPES[t].label} />
              <span className="min-w-0">
                <span className="block font-semibold text-ink">{ORG_TYPES[t].label}</span>
                <span className="block text-base text-ink-muted">{ORG_TYPES[t].description}</span>
                {samples && t !== "nonprofit" ? <span className="block text-sm text-ink-muted">Demo sample: {samples.find((s) => s.orgType === t)?.label}</span> : null}
              </span>
            </label>
          ))}
        </div>
      </fieldset>
      <Button size="lg" className="mt-8" loading={loading} onClick={go}>
        Continue
      </Button>
    </div>
  );
}
