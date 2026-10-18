"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/label";

export function StartForm() {
  const router = useRouter();
  const [url, setUrl] = React.useState("");
  const [ein, setEin] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [errors, setErrors] = React.useState<{ url?: string; ein?: string }>({});

  const formatEin = (v: string) => {
    const digits = v.replace(/\D/g, "").slice(0, 9);
    return digits.length > 2 ? `${digits.slice(0, 2)}-${digits.slice(2)}` : digits;
  };

  return (
    <div className="grid gap-10 lg:grid-cols-[1fr_18rem]">
      <div>
        <h1 className="font-display text-3xl text-fg sm:text-4xl">Let us read up on you.</h1>
        <p className="mt-3 max-w-xl text-base text-fg-muted">We start with your website and your EIN. From those we pull your mission, programs, and public 990 data. You confirm everything before it is used.</p>
        <form
          className="mt-8 flex max-w-md flex-col gap-5"
          onSubmit={async (e) => {
            e.preventDefault();
            const next: typeof errors = {};
            if (!/^(https?:\/\/)?[\w.-]+\.[a-z]{2,}/i.test(url)) next.url = "Enter your website address, like riverbendyouth.org.";
            if (ein.replace(/\D/g, "").length !== 9) next.ein = "An EIN has 9 digits, like 47-3382911.";
            setErrors(next);
            if (Object.keys(next).length) return;
            setLoading(true);
            await new Promise((r) => setTimeout(r, 900));
            router.push("/onboarding/documents");
          }}
        >
          <Field id="website" label="Website" error={errors.url}>
            <Input inputMode="url" autoComplete="url" placeholder="riverbendyouth.org" value={url} onChange={(e) => setUrl(e.target.value)} />
          </Field>
          <Field id="ein" label="EIN" hint="Your employer identification number. It is on your IRS determination letter." error={errors.ein}>
            <Input inputMode="numeric" placeholder="47-3382911" value={ein} onChange={(e) => setEin(formatEin(e.target.value))} className="tnum" />
          </Field>
          <div className="flex items-center gap-3 pt-2">
            <Button type="submit" size="lg" loading={loading}>
              {loading ? "Reading your site" : "Continue"} {!loading ? <ArrowRight aria-hidden /> : null}
            </Button>
          </div>
        </form>
      </div>
      <aside className="rounded-lg border border-border bg-surface p-5 text-sm text-fg-muted lg:self-start">
        <p className="flex items-center gap-2 font-medium text-fg">
          <Globe className="size-4 text-accent" aria-hidden /> What we read
        </p>
        <ul className="mt-3 flex flex-col gap-2">
          <li>Your public website: mission, programs, staff.</li>
          <li>Your IRS 990 from public filings: budget, year founded, board size.</li>
        </ul>
        <p className="mt-4">About two minutes. Nothing is published or shared.</p>
      </aside>
    </div>
  );
}
