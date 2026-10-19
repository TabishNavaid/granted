"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { services, type SampleInfo } from "@/lib/services";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/label";

/**
 * The first question. In the demo, only the sample organizations' recorded
 * sites can be read, so any other address gets a plain answer and a choice
 * of sample, never a pretend reading.
 */
export function WebsiteStep({ initialUrl, demo }: { initialUrl: string; demo: { samples: SampleInfo[] } | null }) {
  const router = useRouter();
  const [url, setUrl] = React.useState(initialUrl.replace(/^https?:\/\//, ""));
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [unknownHost, setUnknownHost] = React.useState<string | null>(null);
  const [pick, setPick] = React.useState(demo?.samples[0]?.id ?? "");

  const startSample = async (id: string) => {
    setLoading(true);
    await services.demo.startSetup(id);
    router.push("/onboarding/ein");
    router.refresh();
  };

  if (demo && unknownHost) {
    return (
      <div className="max-w-2xl">
        <h1 className="font-display text-h1 text-ink">The demo cannot read {unknownHost}.</h1>
        <p className="mt-4 max-w-[56ch] text-lg text-ink-muted">This public demo runs on recorded sample organizations, so it never pretends to read a site it has not read. Pick one and setup will read its site, find its facts, and search for its grants, the way it would for yours.</p>
        <fieldset className="mt-8 max-w-xl">
          <legend className="sr-only">Sample organization</legend>
          <div className="flex flex-col border-t border-rule">
            {demo.samples.map((s) => (
              <label key={s.id} className={cn("flex cursor-pointer items-start gap-4 border-b border-rule py-4", pick === s.id && "bg-paper-tint")}>
                <input type="radio" name="sample" value={s.id} aria-label={`${s.label}, ${s.kind}`} checked={pick === s.id} onChange={() => setPick(s.id)} className="mt-1.5 size-4 accent-[var(--ink)]" />
                <span className="min-w-0">
                  <span className="block font-semibold text-ink">{s.label}</span>
                  <span className="block text-base text-ink-muted">
                    {s.kind}. {s.history ? "Comes with six months of history." : "Starts empty, like a new account."}
                  </span>
                  <span className="block text-sm text-ink-muted">{s.host}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>
        <div className="mt-8 flex flex-wrap items-center gap-3">
          <Button size="lg" loading={loading} onClick={() => startSample(pick)}>
            Continue with this sample
          </Button>
          <Button variant="ghost" size="lg" onClick={() => setUnknownHost(null)}>
            Back
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl">
      <h1 className="font-display text-h1 text-ink">What&apos;s your organization&apos;s website?</h1>
      <p className="mt-4 max-w-[52ch] text-lg text-ink-muted">That is all we need to start. We read it the way a funder would and write down what it says, nothing more.</p>
      <form
        className="mt-8 flex max-w-md flex-col gap-5"
        onSubmit={async (e) => {
          e.preventDefault();
          const clean = url.trim();
          if (!/^(https?:\/\/)?[\w.-]+\.[a-z]{2,}/i.test(clean)) return setError(`Enter your website address, like ${demo?.samples[0]?.host ?? "riverbendyouth.org"}.`);
          setError(null);
          if (demo) {
            const sample = await services.demo.sampleFor(clean);
            if (!sample) {
              let host = clean;
              try {
                host = new URL(/^https?:\/\//i.test(clean) ? clean : `https://${clean}`).hostname.replace(/^www\./, "");
              } catch {
                // keep what they typed
              }
              setUnknownHost(host);
              return;
            }
            return startSample(sample.id);
          }
          setLoading(true);
          await services.org.update({ websiteUrl: /^https?:\/\//i.test(clean) ? clean : `https://${clean}`, onboardingStep: "ein" });
          router.push("/onboarding/ein");
        }}
      >
        <Field id="website" label="Website" error={error ?? undefined}>
          <Input inputMode="url" autoComplete="url" placeholder={demo?.samples[0]?.host ?? "riverbendyouth.org"} value={url} onChange={(e) => setUrl(e.target.value)} autoFocus className="h-12 text-lg" />
        </Field>
        <div>
          <Button type="submit" size="lg" loading={loading}>
            Continue
          </Button>
        </div>
      </form>
      {demo ? (
        <div className="mt-10 max-w-xl border-t border-rule pt-5">
          <p className="text-base text-ink">In the demo, setup reads one of three sample organizations. Paste any address, or start from one of these:</p>
          <ul className="mt-3 flex flex-col gap-2">
            {demo.samples.map((s) => (
              <li key={s.id}>
                <button type="button" className="text-left text-base text-ink underline decoration-[1.5px] underline-offset-4 hover:decoration-ink disabled:opacity-60" disabled={loading} onClick={() => startSample(s.id)}>
                  {s.label}
                </button>
                <span className="text-base text-ink-muted">, {s.kind.charAt(0).toLowerCase() + s.kind.slice(1)}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
