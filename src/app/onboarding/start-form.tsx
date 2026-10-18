"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { services } from "@/lib/services";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/label";

export function StartForm({ demo }: { demo: boolean }) {
  const router = useRouter();
  const [url, setUrl] = React.useState("");
  const [ein, setEin] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [errors, setErrors] = React.useState<{ url?: string; ein?: string }>({});
  const [failure, setFailure] = React.useState<string | null>(null);

  const formatEin = (v: string) => {
    const digits = v.replace(/\D/g, "").slice(0, 9);
    return digits.length > 2 ? `${digits.slice(0, 2)}-${digits.slice(2)}` : digits;
  };

  return (
    <div className="grid gap-10 lg:grid-cols-[1fr_18rem]">
      <div>
        <h1 className="font-display text-h1 text-ink">Let's start with who you are.</h1>
        <p className="mt-4 max-w-[60ch] text-lg text-ink-muted">Give us your website. We'll read it and pull out your mission, your programs, and the facts a funder asks for. You get to check all of it before we use a word.</p>
        <form
          className="mt-8 flex max-w-md flex-col gap-5"
          onSubmit={async (e) => {
            e.preventDefault();
            const next: typeof errors = {};
            if (!/^(https?:\/\/)?[\w.-]+\.[a-z]{2,}/i.test(url.trim())) next.url = "Enter your website address, like riverbendyouth.org.";
            const digits = ein.replace(/\D/g, "");
            if (digits.length && digits.length !== 9) next.ein = "An EIN has 9 digits, like 47-3382911.";
            setErrors(next);
            setFailure(null);
            if (Object.keys(next).length) return;
            setLoading(true);
            const r = await services.loop.buildProfile({ websiteUrl: url.trim(), ein: digits.length === 9 ? ein : null });
            setLoading(false);
            if (!r.ok) {
              setFailure(r.code === "unreachable" ? `${r.error} Or go on without it and tell us about yourself on the next screens.` : r.error);
              return;
            }
            router.push(demo ? "/onboarding/documents" : "/onboarding/profile");
          }}
        >
          <Field id="website" label="Website" error={errors.url}>
            <Input inputMode="url" autoComplete="url" placeholder="riverbendyouth.org" value={url} onChange={(e) => setUrl(e.target.value)} />
          </Field>
          <Field id="ein" label="EIN" optional hint="Your employer identification number. It's on your IRS determination letter, usually near the top." error={errors.ein}>
            <Input inputMode="numeric" placeholder="47-3382911" value={ein} onChange={(e) => setEin(formatEin(e.target.value))} className="tnum" />
          </Field>
          {failure ? (
            <p role="alert" className="border-l-[6px] border-burgundy py-1 pl-4 text-base text-ink">
              {failure}
            </p>
          ) : null}
          <div className="flex items-center gap-3 pt-2">
            <Button type="submit" size="lg" loading={loading}>
              {loading ? "Reading your website" : "Read my website"}
            </Button>
          </div>
          {loading ? <p className="text-sm text-ink-muted" aria-live="polite">This takes about a minute. We read your homepage and up to seven more pages.</p> : null}
        </form>
      </div>
      <aside className="border-l-2 border-ink pl-5 text-base text-ink-muted lg:self-start">
        <h2 className="font-display text-xl text-ink">What we read</h2>
        <ul className="mt-3 flex flex-col gap-2">
          <li>Your public website: mission, programs, people served, results.</li>
          <li>An annual report or 990 if your site links to one.</li>
        </ul>
        <p className="mt-4">Every fact keeps a link to the exact passage it came from. If it is not on your site, we do not write it down.</p>
      </aside>
    </div>
  );
}
