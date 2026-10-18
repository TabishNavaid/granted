"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { services } from "@/lib/services";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/label";

export function WebsiteStep({ initialUrl }: { initialUrl: string }) {
  const router = useRouter();
  const [url, setUrl] = React.useState(initialUrl.replace(/^https?:\/\//, ""));
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  return (
    <div className="max-w-2xl">
      <h1 className="font-display text-h1 text-ink">What&apos;s your organization&apos;s website?</h1>
      <p className="mt-4 max-w-[52ch] text-lg text-ink-muted">That is all we need to start. We read it the way a funder would and write down what it says, nothing more.</p>
      <form
        className="mt-8 flex max-w-md flex-col gap-5"
        onSubmit={async (e) => {
          e.preventDefault();
          const clean = url.trim();
          if (!/^(https?:\/\/)?[\w.-]+\.[a-z]{2,}/i.test(clean)) return setError("Enter your website address, like riverbendyouth.org.");
          setError(null);
          setLoading(true);
          await services.org.update({ websiteUrl: /^https?:\/\//i.test(clean) ? clean : `https://${clean}`, onboardingStep: "ein" });
          router.push("/onboarding/ein");
        }}
      >
        <Field id="website" label="Website" error={error ?? undefined}>
          <Input inputMode="url" autoComplete="url" placeholder="riverbendyouth.org" value={url} onChange={(e) => setUrl(e.target.value)} autoFocus className="h-12 text-lg" />
        </Field>
        <div>
          <Button type="submit" size="lg" loading={loading}>
            Continue
          </Button>
        </div>
      </form>
    </div>
  );
}
