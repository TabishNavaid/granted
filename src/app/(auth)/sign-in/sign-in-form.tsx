"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { services } from "@/lib/services";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";

export function SignInForm() {
  const router = useRouter();
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");

  return (
    <div>
      <h1 className="font-display text-3xl text-fg">Welcome back</h1>
      <p className="mt-2 text-base text-fg-muted">Sign in to see what is waiting in your Inbox.</p>
      <form
        className="mt-8 flex flex-col gap-5"
        onSubmit={async (e) => {
          e.preventDefault();
          setError(null);
          setLoading(true);
          const r = await services.auth.signIn(email, password);
          setLoading(false);
          if (!r.ok) return setError(r.error);
          router.push("/inbox");
        }}
      >
        <Field id="email" label="Email" error={error ?? undefined}>
          <Input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@yourorg.org" />
        </Field>
        <Field id="password" label="Password">
          <Input type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        </Field>
        <div className="flex items-center justify-between text-sm">
          <Link href="#" className="text-fg-muted underline-offset-2 hover:text-fg hover:underline">
            Forgot your password?
          </Link>
        </div>
        <Button type="submit" size="lg" loading={loading}>
          Sign in
        </Button>
      </form>
      <div className="my-6 flex items-center gap-3 text-xs text-fg-subtle">
        <Separator className="flex-1" /> or <Separator className="flex-1" />
      </div>
      <Button variant="secondary" size="lg" className="w-full" onClick={() => router.push("/inbox")}>
        Continue with Google
      </Button>
      <p className="mt-8 text-sm text-fg-muted">
        New here?{" "}
        <Link href="/sign-up" className="font-medium text-accent underline-offset-2 hover:underline">
          Create your workspace
        </Link>
      </p>
    </div>
  );
}
