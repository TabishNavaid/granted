"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { services } from "@/lib/services";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/label";

const formatEin = (v: string) => {
  const digits = v.replace(/\D/g, "").slice(0, 9);
  return digits.length > 2 ? `${digits.slice(0, 2)}-${digits.slice(2)}` : digits;
};

export function EinStep({ initialEin }: { initialEin: string }) {
  const router = useRouter();
  const [ein, setEin] = React.useState(formatEin(initialEin));
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState<"save" | "skip" | null>(null);
  const [checked, setChecked] = React.useState<{ ein: string; status: string; message: string } | null>(null);
  const go = async (value: string, how: "save" | "skip") => {
    setLoading(how);
    await services.org.update({ ein: value, onboardingStep: "reading" });
    router.push("/onboarding/reading");
  };
  return (
    <div className="max-w-2xl">
      <h1 className="font-display text-h1 text-ink">Do you know your EIN?</h1>
      <p className="mt-4 max-w-[52ch] text-lg text-ink-muted">Optional. Funders use it to confirm you are a 501(c)(3), and it lets us look up your public filings later. It is on your IRS determination letter, usually near the top.</p>
      <form
        className="mt-8 flex max-w-md flex-col gap-5"
        onSubmit={async (e) => {
          e.preventDefault();
          const digits = ein.replace(/\D/g, "");
          if (digits.length && digits.length !== 9) return setError("An EIN has 9 digits, like 47-3382911.");
          setError(null);
          // Check the IRS registry once, show what it says, then continue on the next press.
          if (digits.length === 9 && checked?.ein !== digits) {
            setLoading("save");
            const v = await services.org.verifyEin(digits).catch(() => null);
            setLoading(null);
            if (v) return setChecked({ ein: digits, ...v });
          }
          await go(digits.length === 9 ? ein : "", "save");
        }}
      >
        <Field id="ein" label="EIN" optional error={error ?? undefined}>
          <Input inputMode="numeric" placeholder="47-3382911" value={ein} onChange={(e) => setEin(formatEin(e.target.value))} className="h-12 font-mono text-lg tnum" autoFocus />
        </Field>
        {checked && checked.ein === ein.replace(/\D/g, "") ? (
          <div role="status" className={checked.status === "eligible" ? "border-l-4 border-fellow bg-fellow-tint px-4 py-3" : "border-l-4 border-ink bg-paper-tint px-4 py-3"}>
            <p className="text-sm font-semibold text-ink">{checked.status === "eligible" ? "Found in the IRS records" : checked.status === "unavailable" ? "We could not check it right now" : "Check this before you apply"}</p>
            <p className="mt-1 text-sm text-ink">{checked.message}</p>
            <p className="mt-1 text-xs text-ink-muted">Source: IRS Exempt Organizations Business Master File and Publication 78.</p>
          </div>
        ) : null}
        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" size="lg" loading={loading === "save"}>
            Continue
          </Button>
          <Button type="button" variant="ghost" size="lg" loading={loading === "skip"} onClick={() => go("", "skip")}>
            Skip for now
          </Button>
        </div>
      </form>
    </div>
  );
}
