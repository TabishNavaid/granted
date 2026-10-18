"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { services } from "@/lib/services";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/label";

const linkClass = "font-semibold text-ink underline decoration-[1.5px] underline-offset-4 hover:decoration-corn";

export function SignUpForm({ magicLink }: { magicLink: boolean }) {
  const router = useRouter();
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [sent, setSent] = React.useState(false);
  const [form, setForm] = React.useState({ fullName: "", orgName: "", email: "", password: "" });
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));

  if (sent) {
    return (
      <div>
        <h1 className="font-display text-3xl text-ink">Check your email</h1>
        <p className="mt-3 text-lg text-ink-muted">We sent a link to {form.email}. Open it on this device and we'll set up {form.orgName} and start with your website.</p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="font-display text-3xl text-ink">Create your workspace</h1>
      <p className="mt-3 text-lg text-ink-muted">Free to start. You'll have your first matches in about twenty minutes.</p>
      <form
        className="mt-8 flex flex-col gap-5"
        onSubmit={async (e) => {
          e.preventDefault();
          setError(null);
          setLoading(true);
          const r = await services.auth.signUp(form);
          setLoading(false);
          if (!r.ok) return setError(r.error);
          if (r.next === "check_email") return setSent(true);
          router.push("/onboarding");
        }}
      >
        <Field id="name" label="Your name">
          <Input autoComplete="name" required value={form.fullName} onChange={set("fullName")} placeholder="Dana Okafor" />
        </Field>
        <Field id="org" label="Organization">
          <Input autoComplete="organization" required value={form.orgName} onChange={set("orgName")} placeholder="Riverbend Youth Collective" />
        </Field>
        <Field id="email" label="Work email">
          <Input type="email" autoComplete="email" required value={form.email} onChange={set("email")} placeholder="you@yourorg.org" />
        </Field>
        {magicLink ? (
          error ? (
            <p role="alert" className="border-l-[6px] border-alert py-1 pl-4 text-base text-ink">
              {error}
            </p>
          ) : null
        ) : (
          <Field id="password" label="Password" hint="At least 8 characters." error={error ?? undefined}>
            <Input type="password" autoComplete="new-password" required minLength={8} value={form.password} onChange={set("password")} />
          </Field>
        )}
        <Button type="submit" size="lg" loading={loading}>
          {magicLink ? "Email me a link" : "Create workspace"}
        </Button>
        <p className="text-sm text-ink-muted">By continuing you agree to the terms and privacy policy. We never train models on your data.</p>
      </form>
      <p className="mt-8 text-base text-ink-muted">
        Already have an account?{" "}
        <Link href="/sign-in" className={linkClass}>
          Sign in
        </Link>
      </p>
    </div>
  );
}
