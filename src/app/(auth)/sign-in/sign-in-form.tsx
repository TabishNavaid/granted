"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { services } from "@/lib/services";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";

const linkClass = "font-semibold text-ink underline decoration-[1.5px] underline-offset-4 hover:decoration-pink";

export function SignInForm({ magicLink, initialError, next }: { magicLink: boolean; initialError: string | null; next: string | null }) {
  const router = useRouter();
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(initialError);
  const [sent, setSent] = React.useState(false);
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");

  if (sent) {
    return (
      <div>
        <h1 className="font-display text-3xl text-ink">Check your email</h1>
        <p className="mt-3 text-lg text-ink-muted">We sent a sign-in link to {email}. Open it on this device and you'll land in your Inbox. The link works once and expires in an hour.</p>
        <p className="mt-8 text-base text-ink-muted">
          Wrong address?{" "}
          <button type="button" className={linkClass} onClick={() => setSent(false)}>
            Try another
          </button>
        </p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="font-display text-3xl text-ink">Welcome back</h1>
      <p className="mt-3 text-lg text-ink-muted">{magicLink ? "Enter your email and we'll send you a link. No password to remember." : "Sign in and see what's waiting in your Inbox."}</p>
      <form
        className="mt-8 flex flex-col gap-5"
        onSubmit={async (e) => {
          e.preventDefault();
          setError(null);
          setLoading(true);
          const r = await services.auth.signIn(email, password);
          setLoading(false);
          if (!r.ok) return setError(r.error);
          if (r.next === "check_email") return setSent(true);
          router.push(next && next.startsWith("/") ? next : "/inbox");
        }}
      >
        <Field id="email" label="Email" error={error ?? undefined}>
          <Input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@yourorg.org" />
        </Field>
        {magicLink ? null : (
          <>
            <Field id="password" label="Password">
              <Input type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
            </Field>
            <div className="flex items-center justify-between text-sm">
              <Link href="#" className={linkClass}>
                Forgot your password?
              </Link>
            </div>
          </>
        )}
        <Button type="submit" size="lg" loading={loading}>
          {magicLink ? "Email me a link" : "Sign in"}
        </Button>
      </form>
      {magicLink ? null : (
        <>
          <div className="my-6 flex items-center gap-3 text-sm text-ink-muted">
            <Separator className="flex-1" /> or <Separator className="flex-1" />
          </div>
          <Button variant="secondary" size="lg" className="w-full" onClick={() => router.push("/inbox")}>
            Continue with Google
          </Button>
        </>
      )}
      <p className="mt-8 text-base text-ink-muted">
        New here?{" "}
        <Link href="/sign-up" className={linkClass}>
          Create your workspace
        </Link>
      </p>
    </div>
  );
}
