"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { services } from "@/lib/services";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/label";

export function SignUpForm() {
  const router = useRouter();
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [form, setForm] = React.useState({ fullName: "", orgName: "", email: "", password: "" });
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <div>
      <h1 className="font-display text-3xl text-fg">Create your workspace</h1>
      <p className="mt-2 text-base text-fg-muted">Free to start. You'll have your first matches in about twenty minutes.</p>
      <form
        className="mt-8 flex flex-col gap-5"
        onSubmit={async (e) => {
          e.preventDefault();
          setError(null);
          setLoading(true);
          const r = await services.auth.signUp(form);
          setLoading(false);
          if (!r.ok) return setError(r.error);
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
        <Field id="password" label="Password" hint="At least 8 characters." error={error ?? undefined}>
          <Input type="password" autoComplete="new-password" required minLength={8} value={form.password} onChange={set("password")} />
        </Field>
        <Button type="submit" size="lg" loading={loading}>
          Create workspace
        </Button>
        <p className="text-xs text-fg-subtle">By continuing you agree to the terms and privacy policy. We never train models on your data, full stop.</p>
      </form>
      <p className="mt-8 text-sm text-fg-muted">
        Already have an account?{" "}
        <Link href="/sign-in" className="font-medium text-accent underline-offset-2 hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}
